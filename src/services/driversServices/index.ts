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
import { Driver } from '../../models/DriverModel';
import LicenseModel from '../../models/licensesModel';
import CarModel from '../../models/carModel';

export const allDrivers = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalDrivers = await Driver.countDocuments({ online: true });

    // Fetch paginated users
    const users = await Driver.find({ online: true })
      //   .populate({
      //     path: 'followed',
      //     populate: { path: 'brands' },
      //   })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // Most recent first

    // Return paginated response
    res.status(200).json({
      data: users,
      total: totalDrivers,
      totalUsers: totalDrivers,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalDrivers / limit),
      hasMore: page * limit < totalDrivers,
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error });
  }
});
export const allDriversOnOff = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      // Extract pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Get total count for pagination metadata
      const totalDrivers = await Driver.countDocuments({});

      // Fetch paginated users
      const users = await Driver.find().sort({ createdAt: -1 }); // Most recent first

      // Return paginated response
      res.status(200).json({
        data: users,
        total: totalDrivers,
      });
    } catch (error) {
      console.error('Error fetching all allDriversOnOff:', error);
      res
        .status(500)
        .json({ message: 'Failed to fetch allDriversOnOff', error });
    }
  },
);
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    console.log('userId', userId);
    let licenses = [];
    let cars = [];
    if (!userId) {
      res.status(404).json({ message: 'UserID Is required' });
      return;
    }
    const user = await UserModel.findOne({ userID: userId });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.role == 'driver') {
      const license = await LicenseModel.findOne({ userId: userId });
      console.log(license);
      const car = await CarModel.findOne({ userId: userId });
      console.log(car);
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Failed to fetch user', error });
  }
});
export const updateUserActive = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    console.log('userId', userId);
    if (!userId) {
      res.status(400).json({ message: 'UserID is required' });
      return;
    }

    const {
      active,
      isVerified,
      emailVerified,
    }: {
      active?: boolean;
      isVerified?: boolean;
      emailVerified?: boolean;
    } = req.body;

    const updateData: Record<string, boolean> = {};

    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        res.status(400).json({ message: 'active must be boolean' });
        return;
      }

      updateData.active = active;
    }

    if (isVerified !== undefined) {
      if (typeof isVerified !== 'boolean') {
        res.status(400).json({ message: 'isVerified must be boolean' });
        return;
      }

      updateData.isVerified = isVerified;
    }

    if (emailVerified !== undefined) {
      if (typeof emailVerified !== 'boolean') {
        res.status(400).json({ message: 'emailVerified must be boolean' });
        return;
      }

      updateData['contactInfo.email.verified'] = emailVerified;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        message:
          'At least one field is required: active, isVerified, emailVerified',
      });
      return;
    }

    const user = await UserModel.findOneAndUpdate(
      { userID: userId },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      message: 'User updated successfully',
      user,
    });
  },
);
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  try {
    let licenses = [];
    let cars = [];

    const drivers = await UserModel.find({ role: 'user' });
    if (!drivers) {
      res.status(404).json({ message: 'drivers not found' });
      return;
    }

    res.status(200).json(drivers);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Failed to fetch drivers', error });
  }
});
export const getAlldrivers = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      let licenses = [];
      let cars = [];

      const drivers = await UserModel.find({ role: 'driver' });
      if (!drivers) {
        res.status(404).json({ message: 'drivers not found' });
        return;
      }

      res.status(200).json(drivers);
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      res.status(500).json({ message: 'Failed to fetch drivers', error });
    }
  },
);
export const AllNearstDriver = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { lat, lng } = req.body;

      const isValidNumber = (n: unknown): n is number =>
        typeof n === 'number' && Number.isFinite(n);

      if (!isValidNumber(lat) || !isValidNumber(lng)) {
        res
          .status(400)
          .json({ error: 'lat and lng (finite numbers) are required' });
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        res.status(400).json({ error: 'lat/lng out of range' });
        return;
      }

      // GeoJSON pickup point
      const pickupPoint = {
        type: 'Point' as const,
        coordinates: [lng, lat] as [number, number],
      };

      // Dynamic radius search
      const maxRadiusKm = 50;
      const stepKm = 0.5;

      let radiusKm = stepKm;
      let drivers: any[] = [];

      while (radiusKm <= maxRadiusKm && drivers.length === 0) {
        const radiusMeters = radiusKm * 5000;

        // Use $geoNear so we can return distances from MongoDB
        drivers = await Driver.aggregate([
          {
            $geoNear: {
              near: pickupPoint,
              key: 'location', // must be 2dsphere indexed
              spherical: true,
              maxDistance: radiusMeters,
              distanceField: 'distanceMeters',
              query: { online: true },
            },
          },
          {
            $addFields: {
              distanceKm: { $divide: ['$distanceMeters', 5000] },
            },
          },
          {
            $project: {
              distanceMeters: 0, // optional
            },
          },
        ]);

        if (drivers.length === 0) radiusKm += stepKm;
      }

      const foundRadiusKm = drivers.length ? radiusKm : null;

      res.json({
        success: true,
        foundRadiusKm,
        drivers,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error in /drivers/nearby', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
export const getDriverById = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const user = await UserModel.findOne({ userID: userId }).populate({
        path: 'followed',
        populate: { path: 'brands' },
      });
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      res.status(500).json({ message: 'Failed to fetch user', error });
    }
  },
);
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

export default {
  // ...existing exports are preserved by named exports above
};
