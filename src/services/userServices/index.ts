import { createUserSchema } from '../../validation/user/schema';
import Iuser, {
  IContactInfo,
  IPassword,
  IUserName,
  IUserTInfo,
} from '../../interfaces/Iuser';
import UserModel from '../../models/userModel';
// eslint-disable-next-line import/no-extraneous-dependencies
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  uploadBuffer,
  buildPath,
  deleteFile,
  generateFileHash,
  buildHashedPath,
  fileExists,
} from '../../lib/storage';
import path from 'path';
import LicenseModel from '../../models/licensesModel';
import CarModel from '../../models/carModel';

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.flatten(),
      });
      return;
    }
    const data = parsed.data; // Now fully typed and safe!
    // Check if user already exists
    const existingUser = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': data.contactInfo.email.email },
        { 'contactInfo.email.email': data.contactInfo.email.email },
      ],
      'contactInfo.phone.value': data.contactInfo.phone.phoneNumber,
    });
    if (existingUser) {
      // if (existinguser?.active === false) {
      //   res.status(400).json({
      //     message: 'User already exists  but is inactive',
      //   });
      //   return;
      // }
      res.status(400).json({
        message: 'User with this  email or phone number already exists ',
      });
      return;
    }

    // Create user payload

    const userPayload = {
      name: {
        firstName: data.userName.firstName,
        lastName: data.userName.lastName,
        displayName: data.userName.displayName,
      } as IUserName,
      contactInfo: {
        email: {
          value: data.contactInfo.email.email,
          verified: data.contactInfo.email.verified,
          verifiedAt: (data.contactInfo.email.verifiedAt as any) ?? null,
          verificationCode: data.contactInfo.email.verificationCode,
        },
        phone: {
          countryCode: data.contactInfo.phone.countryCode,
          value: data.contactInfo.phone.phoneNumber,
          verified: data.contactInfo.phone.verified,
          verifiedAt: (data.contactInfo.phone.verifiedAt as any) ?? null,
          verificationCode: data.contactInfo.phone.verificationCode,
        },
      } as IContactInfo,
      password: {
        hashed: data.password.hashed,
        expirationDate: (data.password.expirationDate as any) ?? null,
      } as IPassword,
      userInfo: {
        gender: data.userInfo.gender,
        nationality: data.userInfo.nationality,
        profilePicture: data.userInfo.profilePicture || [],
      } as IUserTInfo,
      active: data.active ?? true,
      role: data.role as any,
      subUsersIDs:
        (data.subUsersIDs as any[] | undefined)?.map(
          (id) => new Types.ObjectId(id),
        ) || [],
      subscriptionID: data.subscriptionID
        ? new Types.ObjectId(data.subscriptionID)
        : undefined,
      notes: data.notes || '',
    } as Partial<Iuser>;

    const createdUser = await UserModel.create(userPayload);
    if (createdUser) {
      console.log('User created successfully:', createdUser);
      res.status(201).json(createdUser);
      return;
    } else {
      console.error('User creation failed: No user created');
      res.status(500).json({ message: 'User creation failed' });
      return;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user', error });
    return;
  }
});
export const allUsers = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalUsers = await UserModel.countDocuments({});

    // Fetch paginated users
    const users = await UserModel.find({})
      .populate({
        path: 'followed',
        populate: { path: 'brands' },
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // Most recent first

    // Return paginated response
    res.status(200).json({
      data: users,
      total: totalUsers,
      totalUsers: totalUsers,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalUsers / limit),
      hasMore: page * limit < totalUsers,
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error });
  }
});
export const getMeData = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const user = await UserModel.findOne({ userID: userId });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Failed to fetch user', error });
  }
});
// export const getUserById = asyncHandler(async (req: Request, res: Response) => {
//   try {
//     const userId = req.params.id;
//     const user = await UserModel.findOne({ userID: userId }).populate({
//       path: 'followed',
//       populate: { path: 'brands' },
//     });
//     if (!user) {
//       res.status(404).json({ message: 'User not found' });
//       return;
//     }
//     res.status(200).json(user);
//   } catch (error) {
//     console.error('Error fetching user by ID:', error);
//     res.status(500).json({ message: 'Failed to fetch user', error });
//   }
// });

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;

  if (!userId) {
    res.status(400).json({ message: 'UserID is required' });
    return;
  }

  const user = await UserModel.findOne({ userID: userId });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  let licenses: any[] = [];
  let cars: any[] = [];

  if (user.role === 'driver') {
    const [licenseResults, carResult] = await Promise.all([
      LicenseModel.find({ userId }),
      CarModel.find({ userId }),
    ]);

    licenses = licenseResults;
    cars = carResult;
  }

  res.status(200).json({ user, licenses, cars });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const updateData = req.body || {};
    const authUser: any = (req as any).user || {};
    const role = (authUser.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    const authIdStr =
      authUser.userID ||
      authUser.id ||
      (authUser._id ? String(authUser._id) : undefined);
    const isSelf = !!authIdStr && String(userId) === String(authIdStr);

    // Only the user themselves or an admin can update a user
    if (!isAdmin && !isSelf) {
      res.status(403).json({
        message: 'Access denied: You can only update your own profile',
      });
      return;
    }

    // Sanitize fields for non-admin updates (prevent privilege escalation or sensitive changes)
    if (!isAdmin) {
      // Disallow changing role, active, verification and password-related or relational arrays
      const disallowedPaths = new Set<string>([
        'role',
        'active',
        'isVerified',
        'notes',
        'subscriptionID',
        'subUsersIDs',
        'histories',
        'cart',
        'followedBrands',
        'savedItems',
        'orders',
        'addresses',
        'password',
        'passwordReset',
        'userID',
        '_id',
        'id',
      ]);

      const sanitize = (obj: any, parentPath: string = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          const full = parentPath ? `${parentPath}.${key}` : key;
          if (disallowedPaths.has(full) || disallowedPaths.has(key)) {
            delete obj[key];
            continue;
          }
          // Prevent toggling verification flags directly
          if (
            full === 'contactInfo.email.verified' ||
            full === 'contactInfo.phone.verified'
          ) {
            delete obj[key];
            continue;
          }
          // Recurse for nested objects
          if (obj[key] && typeof obj[key] === 'object')
            sanitize(obj[key], full);
        }
      };
      sanitize(updateData);
    }

    // Optional debug logs (can be removed in production)
    // console.log("🔍 Backend received userId:", userId);
    // console.log("🔍 Backend received updateData:", updateData);
    // console.log("🔍 Backend req.body type:", typeof updateData);
    // console.log("🔍 Backend req.body keys:", Object.keys(updateData));

    const existingDoc = await UserModel.findOne({ userID: userId });
    if (!existingDoc) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const mergedData = { ...existingDoc.toObject(), ...updateData };
    // Validate merged data against the schema
    // const parsed = createUserSchema.safeParse(mergedData);
    // if (!parsed.success) {
    //   res.status(400).json({
    //     message: 'Validation failed',
    //     errors: parsed.error.flatten(),
    //   });
    //   return;
    // }

    // console.log(mergedData);

    const updatedUser = await UserModel.findOneAndUpdate(
      { userID: userId },
      mergedData,
      { new: true, runValidators: true },
    );
    if (!updatedUser) {
      res.status(404).json({ message: 'User not found after update' });
      return;
    }
    // No record history: removed from project
    res.status(200).json(updatedUser);
    return;
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user', error });
    return;
  }
});
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await UserModel.findOne({ userID: userId });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    await UserModel.deleteOne({ userID: userId });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Failed to fetch user', error });
  }
});

export const getUserByEmail = async (email: string): Promise<Iuser | null> => {
  try {
    const user = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': email },
        { 'contactInfo.email.email': email },
      ],
    });
    return user; // null if not found
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error; // let caller handle errors
  }
};

// Change user password with optional old password verification
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { oldPassword, newPassword, allowWithoutOld } = req.body as {
        oldPassword?: string;
        newPassword?: string;
        allowWithoutOld?: boolean;
      };

      if (
        !newPassword ||
        typeof newPassword !== 'string' ||
        newPassword.length < 8
      ) {
        res
          .status(400)
          .json({ message: 'New password must be at least 8 characters' });
        return;
      }

      const user = await UserModel.findOne({ userID: userId });
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const storedHash = (user.password?.hashed as string) || '';

      // Require old password unless explicitly allowed (e.g., OAuth user setting password first time)
      if (!allowWithoutOld) {
        if (!oldPassword) {
          res.status(400).json({ message: 'Current password is required' });
          return;
        }
        if (storedHash) {
          const isMatch = await bcrypt.compare(oldPassword, storedHash);
          if (!isMatch) {
            res.status(401).json({ message: 'Current password is incorrect' });
            return;
          }
        }
      }

      const hashedPassword = newPassword.startsWith('$2')
        ? newPassword
        : await bcrypt.hash(newPassword, 12);

      // Use save() to trigger any model hooks
      user.password = {
        ...(user.password || {}),
        hashed: hashedPassword,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      } as IPassword;
      await user?.save();

      // No record history: removed from project

      res
        .status(200)
        .json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Failed to change password', error });
    }
  },
);

// Upload user avatar to Firebase Storage and update the user document
// export const uploadAvatar = asyncHandler(
//   async (req: Request, res: Response) => {
//     const userId = req.params.id;
//     const file: any = (req as any).file;
//     if (!file || !file.buffer) {
//       res.status(400).json({
//         message:
//           'Avatar file is required (multipart/form-data, field name: avatar)',
//       });
//       return;
//     }
//     const user = await UserModel.findOne({ userID: userId });
//     if (!user) {
//       res.status(404).json({ message: 'User not found' });
//       return;
//     }

//     // Delete old avatar if exists
//     if (user.avatar) {
//       await deleteFile(user.avatar);
//     }

//     // Generate hash for deduplication
//     const fileHash = generateFileHash(file.buffer);
//     const ext = path.extname(file.originalname || '.jpg');
//     // const hashedPath = buildHashedPath({
//     //   entity: 'users',
//     //   id: userId,
//     //   field: 'avatar',
//     //   hash: fileHash,
//     //   extension: ext,
//     // });

//     // Check if file with this hash already exists
//     const exists = await fileExists(hashedPath);
//     let url: string;
//     let filePath: string;

//     if (exists) {
//       // Reuse existing file
//       const { ref, getDownloadURL } = await import('firebase/storage');
//       const { storage } = await import('../../firebase');
//       const fileRef = ref(storage, hashedPath);
//       url = await getDownloadURL(fileRef);
//       filePath = hashedPath;
//     } else {
//       // Upload new file
//       const result = await uploadBuffer(
//         hashedPath,
//         file.buffer as Buffer,
//         file.mimetype || 'application/octet-stream',
//       );
//       url = result.url;
//       filePath = result.path;
//     }

//     user.avatar = url;
//     if (user.userInfo) {
//       (user.userInfo as any).profilePicture = url;
//     }
//     await user.save();
//     res.status(200).json({ success: true, url, path: filePath });
//   },
// );

export default {
  // ...existing exports are preserved by named exports above
};
