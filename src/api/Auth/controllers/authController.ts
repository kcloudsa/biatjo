import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  generateOTP,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeNotificationEmail,
  sendPasswordResetLinkEmail,
} from '../../../emails';
import UserModel from '../../../models/userModel';
import { getUserByEmail, getUserById } from '../../../services/userServices';
import Iuser from '../../../interfaces/Iuser';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  deleteRefreshToken,
} from '../../../../Utils/tokenUtils';
import ILicenses from '../../../interfaces/ILicenses';
import LicenseModel from '../../../models/licensesModel';
import { Types } from 'mongoose';
import ICar, { CarKindEnum } from '../../../interfaces/ICar';
import CarModel from '../../../models/carModel';
import { Driver } from '../../../models/DriverModel';

// POST /auth/register
export const registerHandler = async (req: Request, res: Response) => {
  try {
    if (req.body && req.body.emailOnly) {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({
          success: false,
          message: 'Email is required',
          error: 'EMAIL_REQUIRED',
        });
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await sendVerificationEmail(email, otp);
      return res.status(200).json({
        success: true,
        message:
          'Registration successful. Please check your email for a verification code.',
        data: { expiresAt },
      });
    }
  } catch (err) {
    console.error('Inline OTP register flow error:', err);
  }

  try {
    const { userName, contactInfo, userInfo, password } = req.body;

    if (!userName?.firstName || !userName?.lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required',
        error: 'VALIDATION_ERROR',
      });
    }
    const emailValue = contactInfo?.email?.email || contactInfo?.email?.value;
    if (!emailValue) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        error: 'VALIDATION_ERROR',
      });
    }
    const phoneValue =
      contactInfo?.phone?.phoneNumber || contactInfo?.phone?.value;
    if (!phoneValue) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
        error: 'VALIDATION_ERROR',
      });
    }

    let passwordValue: string;
    if (typeof password === 'string') passwordValue = password;
    else if (password && typeof password === 'object' && password.hashed)
      passwordValue = password.hashed;
    else if (password && typeof password === 'object' && password.password)
      passwordValue = password.password;
    else
      return res.status(400).json({
        success: false,
        message: 'Password is required',
        error: 'VALIDATION_ERROR',
      });

    if (!passwordValue)
      return res.status(400).json({
        success: false,
        message: 'Password is required',
        error: 'VALIDATION_ERROR',
      });

    // Hash the password before storing (don't store plain text!)
    const looksHashed =
      typeof passwordValue === 'string' && passwordValue.startsWith('$2');
    const hashedPassword = looksHashed
      ? passwordValue
      : await bcrypt.hash(passwordValue, 12);

    const existingEmailUser = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': emailValue },
        { 'contactInfo.email.email': emailValue },
      ],
    });
    if (existingEmailUser)
      return res.status(409).json({
        success: false,
        message: 'Email already in use',
        error: 'EMAIL_EXISTS',
      });

    const existingPhoneUser = await UserModel.findOne({
      $or: [
        { 'contactInfo.phone.value': phoneValue },
        { 'contactInfo.phone.phoneNumber': phoneValue },
      ],
    });
    if (existingPhoneUser)
      return res.status(409).json({
        success: false,
        message: 'Phone number already in use',
        error: 'PHONE_EXISTS',
      });

    const emailOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const phoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const data = {
      name: {
        firstName: userName.firstName,
        lastName: userName.lastName,
        displayName: `${userName.firstName} ${userName.lastName?.charAt(0)}.`,
      },
      contactInfo: {
        email: {
          value: emailValue as string,
          verified: true,
          verifiedAt: null,
          verificationCode: null,
          verificationCodeExpiresAt: emailOtpExpiresAt,
        },
        phone: {
          countryCode: contactInfo?.phone?.countryCode
            ? contactInfo?.phone?.countryCode
            : '+218',
          value: phoneValue as string,
          verified: false,
          verifiedAt: null,
          verificationCode: null,
          verificationCodeExpiresAt: phoneOtpExpiresAt,
        },
      },
      password: {
        hashed: hashedPassword,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      userInfo: {
        gender: userInfo?.gender ? userInfo?.gender : 'unknown',
        nationality: userInfo?.nationality
          ? userInfo?.nationality
          : 'somewhere',
        profilePicture: userInfo?.profilePicture
          ? userInfo?.profilePicture
          : [],
      },
      licenseID: undefined,
      // Align with user model enum: ['user','driver','admin','demo']
      role: 'user',
      active: true,
    } as any;

    const newUser = await UserModel.create(data);
    if (newUser) {
      if (!newUser.userID) {
        return res.status(500).json({
          success: false,
          message: 'User created but userID is missing',
          error: 'USER_ID_MISSING',
        });
      }
    }

    const userId = newUser.userID! as string;
    const accessToken = generateAccessToken({
      id: userId,
      email: (newUser as any).contactInfo.email.value,
      name: (newUser as any).name.displayName,
      role: newUser.role,
    });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(userId, refreshToken);

    return res
      .status(201)
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({
        success: true,
        message: 'User created successfully',
        data: {
          userId: newUser.userID,
          email: (newUser as any).contactInfo.email.value,
          displayName: (newUser as any).name.displayName,
          refreshToken: refreshToken,
          token: accessToken,
        },
      });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Driver registration incomplete',
      error: 'DRIVER_REGISTRATION_FAILED',
    });
  }
};
export const registerDriverHandler = async (req: Request, res: Response) => {
  try {
    if (req.body && req.body.UserID) {
      const { UserID } = req.body;
      if (!UserID)
        return res.status(400).json({
          success: false,
          message: 'UserID is required',
          error: 'UserID_REQUIRED',
        });
      // const otp = generateOTP();
      // const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      // await sendVerificationEmail(email, otp);
      //     return res.status(200).json({
      //       success: true,
      //       message:
      //         'Registration successful. Please check your email for a verification code.',
      //       data: { expiresAt },
      //     });
    }
  } catch (err) {
    // console.error('Inline OTP register flow error:', err);
    console.error('registerDrive  flow error:', err);
  }

  try {
    let license: ILicenses = {} as ILicenses;
    let car: ICar = {} as ICar;
    const { role, driver, UserID } = req.body;
    const existingUser = await UserModel.findOne({
      userID: UserID,
    });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Complete main registration first.',
        error: 'USER_NOT_FOUND',
      });
    }

    if (role && ![0, 1].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified',
        error: 'INVALID_ROLE',
      });
    }

    if (role === 1 && !driver) {
      return res.status(400).json({
        success: false,
        message: 'License info is required for driver ',
        error: 'INVALID_ROLE',
      });
    } else if (role !== 1 && driver) {
      return res.status(400).json({
        success: false,
        message: 'License info should not be provided for non-driver roles',
        error: 'INVALID_ROLE',
      });
    }

    if (role === 1 && driver) {
      // Additional validations for driver license can be added here
      if (!driver?.license?.degree) {
        return res.status(400).json({
          success: false,
          message: 'Driver degree is required',
          error: 'VALIDATION_ERROR',
        });
      }
      if (!driver?.car?.TransPortType) {
        return res.status(400).json({
          success: false,
          message: 'Car transport type is required',
          error: 'VALIDATION_ERROR',
        });
      }
      if (!driver?.car?.plateNum) {
        return res.status(400).json({
          success: false,
          message: 'Car plateNum is required',
          error: 'VALIDATION_ERROR',
        });
      }
      // if (!driver?.license?.licenseNumber) {
      //   return res.status(400).json({
      //     success: false,
      //     message: ' licenseNumber is required',
      //     error: 'VALIDATION_ERROR',
      //   });
      // }
      if (driver?.license?.licenseNumber) {
        const existingLicense = await LicenseModel.findOne({
          licenseNumber: driver.license.licenseNumber,
        });
        if (existingLicense) {
          return res.status(409).json({
            success: false,
            message: 'License with this number already exists',
            error: 'LICENSE_EXISTS',
          });
        }
      }
      if (driver?.car?.carKind) {
        const validCarKinds = Object.values(CarKindEnum);

        if (!validCarKinds.includes(driver?.car?.carKind)) {
          const err = `Invalid carKind. Must be one of: ${validCarKinds.join(
            ', ',
          )}`;
          return res.status(400).json({ error: err });
        }
      }
      if (driver?.car && driver?.car?.plateNum) {
        const existingCar = await CarModel.findOne({
          plateNum: driver.car.plateNum,
        });
        if (existingCar) {
          return res.status(409).json({
            success: false,
            message: 'Car with this plate number already exists',
            error: 'CAR_EXISTS',
          });
        }
      }
      car = {
        carPhotoURL: driver?.car?.carPhotoURL || [],
        TransPortType: driver?.car?.TransPortType || 3,
        carModel: driver?.car?.carModel || '',
        carColor: driver?.car?.carColor || '',
        carYear: driver?.car?.carYear || '',
        carLoadCapacity: driver?.car?.carLoadCapacity || 0,
        carManufacture: driver?.car?.Manufacture || '',
        plateNum: driver?.car?.plateNum || '',
        userId: UserID,
        carKind: driver?.car?.carKind || '',
      } as ICar;

      // Save car to the database

      const newCar = await CarModel.create(car);
      if (!newCar || !newCar._id) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create car for driver',
          error: 'CAR_CREATION_FAILED',
        });
      }

      license = {
        licenseNumber: driver.license.licenseNumber || '',
        licensePhotoURL: driver.licensePhotoURL || [],
        carID: newCar._id || [],
        degree: driver.license?.degree || undefined,
        userId: UserID,
      } as ILicenses;

      // Save license to the database

      const newLicense = await LicenseModel.create(license);
      if (!newLicense || !newLicense._id) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create license for driver',
          error: 'LICENSE_CREATION_FAILED',
        });
      }
      if (existingUser) {
        existingUser.role = 'driver';
        if (driver?.driverImgs) {
          if (existingUser.userInfo) {
            existingUser.userInfo.profilePicture = driver?.driverImgs || [];
          }
        }
        await existingUser.save();
        const driverN = {
          driverId: existingUser.userID,
          lastLocation: {
            lat: 0,
            lng: 0,
            updatedAt: new Date(),
          },
          location: {
            type: 'Point',
            coordinates: [0, 0], // [lng, lat]
          },
          online: false,
          lastOnlineAt: new Date(),
        };

        const newDriver = await Driver.create(driverN);
        if (!newDriver) {
          return res.status(400).json({
            success: false,
            message: 'Failed to createDriver',
            error: 'Driver_CREATION_FAILED',
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: 'User not found. Complete main registration first.',
          error: 'USER_NOT_FOUND',
        });
      }
      const emailForToken =
        (existingUser as any).contactInfo?.email?.value ||
        (existingUser as any).contactInfo?.email?.email ||
        '';
      const displayName =
        (existingUser as any).name?.displayName ||
        (existingUser as any).userName?.displayName ||
        '';
      const accessToken = generateAccessToken({
        id: existingUser.userID!,
        email: emailForToken,
        name: displayName,
        role: existingUser.role,
      });
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(existingUser.userID!, refreshToken);
      return res
        .status(201)
        .cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        })
        .json({
          success: true,
          message: 'Driver created successfully',
          data: {
            userId: existingUser.userID,
            email: emailForToken,
            role: existingUser.role,
            displayName: displayName,
            refreshToken: refreshToken,
            token: accessToken,
          },
        });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: 'USER_CREATION_FAILED',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      error: 'INTERNAL_ERROR',
    });
  }
};
// OTP flows
export const otpRegisterHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        error: 'EMAIL_REQUIRED',
      });
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const updatedUser = await UserModel.findOneAndUpdate(
      {
        $or: [
          { 'contactInfo.email.value': email },
          { 'contactInfo.email.email': email },
        ],
      },
      {
        $set: {
          'contactInfo.email.verificationCode': otp,
          'contactInfo.email.verificationCodeExpiresAt': expiresAt,
          'contactInfo.email.verified': false,
        },
      },
      { new: true },
    );
    if (!updatedUser)
      return res.status(404).json({
        success: false,
        message: 'User not found. Complete main registration first.',
        error: 'USER_NOT_FOUND',
      });
    await sendVerificationEmail(email, otp);
    return res.status(200).json({
      success: true,
      message:
        'Registration successful. Please check your email for a verification code.',
      data: { expiresAt },
    });
  } catch (error) {
    console.error('OTP register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start registration',
      error: 'REGISTER_ERROR',
    });
  }
};

export const otpVerifyHandler = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
        error: 'MISSING_FIELDS',
      });
    const user = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': email },
        { 'contactInfo.email.email': email },
      ],
    });
    if (!user)
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    if ((user as any).contactInfo?.email?.verified)
      return res
        .status(200)
        .json({ success: true, message: 'Email already verified' });

    const storedCode = (user as any).contactInfo?.email?.verificationCode;
    const expiresAt = (user as any).contactInfo?.email
      ?.verificationCodeExpiresAt as Date | undefined;
    if (!storedCode || storedCode !== otp)
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        error: 'INVALID_OTP',
      });
    if (!expiresAt || Date.now() > new Date(expiresAt).getTime())
      return res.status(400).json({
        success: false,
        message: 'Verification code expired',
        error: 'OTP_EXPIRED',
      });

    (user as any).contactInfo.email.verified = true;
    (user as any).contactInfo.email.verifiedAt = new Date();
    (user as any).contactInfo.email.verificationCode = 'USED';
    (user as any).contactInfo.email.verificationCodeExpiresAt = null;
    await user.save();
    return res
      .status(200)
      .json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('OTP verify error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify code',
      error: 'VERIFY_ERROR',
    });
  }
};

// Password reset (OTP basic)
export const forgotPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        error: 'EMAIL_REQUIRED',
      });
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await sendPasswordResetEmail(email, otp);
    return res.status(200).json({
      success: true,
      message: 'Password reset code sent. Please check your email.',
      data: { expiresAt },
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reset code',
      error: 'FORGOT_PASSWORD_ERROR',
    });
  }
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and newPassword are required',
        error: 'MISSING_FIELDS',
      });
    await sendPasswordChangeNotificationEmail(email);
    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: 'RESET_PASSWORD_ERROR',
    });
  }
};

// Link-based password reset
const FRONTEND_RESET_URL = `${process.env.FRONTEND_URL}/reset-password`;
const RESET_TOKEN_TTL_MINUTES = 30;
const MAX_RESET_ATTEMPTS = 5;
const hashToken = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex');
const makeResetToken = () => crypto.randomBytes(32).toString('hex');

export const passwordResetRequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        error: 'EMAIL_REQUIRED',
      });
    const user = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': email },
        { 'contactInfo.email.email': email },
      ],
    });
    if (!user)
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a reset link has been sent.',
      });
    if (
      user.passwordReset?.lockedUntil &&
      user.passwordReset.lockedUntil > new Date()
    ) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Try later.',
        error: 'LOCKED',
      });
    }
    const rawToken = makeResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );
    user.passwordReset = {
      ...(user.passwordReset || {}),
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
      attempts: 0,
      lockedUntil: undefined,
    } as any;
    await user.save();
    const resetLink = `${FRONTEND_RESET_URL}?token=${rawToken}&email=${encodeURIComponent(
      email,
    )}`;
    await sendPasswordResetLinkEmail(email, resetLink);
    return res.status(200).json({
      success: true,
      message: 'If the email exists, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process request',
      error: 'RESET_REQUEST_ERROR',
    });
  }
};

export const passwordResetValidateHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { email, token } = req.body;
    if (!email || !token)
      return res.status(400).json({
        success: false,
        message: 'Email and token required',
        error: 'MISSING_FIELDS',
      });
    const user = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': email },
        { 'contactInfo.email.email': email },
      ],
    });
    if (!user || !user.passwordReset?.resetTokenHash)
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN',
      });
    if (
      user.passwordReset.resetTokenExpiresAt &&
      user.passwordReset.resetTokenExpiresAt < new Date()
    )
      return res.status(400).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED',
      });
    const incomingHash = hashToken(token);
    if (incomingHash !== user.passwordReset.resetTokenHash)
      return res.status(400).json({
        success: false,
        message: 'Invalid token',
        error: 'INVALID_TOKEN',
      });
    return res.status(200).json({ success: true, message: 'Token valid' });
  } catch (error) {
    console.error('Password reset validate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate token',
      error: 'RESET_VALIDATE_ERROR',
    });
  }
};

export const passwordResetCompleteHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword)
      return res.status(400).json({
        success: false,
        message: 'Email, token, and newPassword required',
        error: 'MISSING_FIELDS',
      });
    const user = await UserModel.findOne({
      $or: [
        { 'contactInfo.email.value': email },
        { 'contactInfo.email.email': email },
      ],
    });
    if (!user || !user.passwordReset?.resetTokenHash)
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN',
      });
    if (
      user.passwordReset.lockedUntil &&
      user.passwordReset.lockedUntil > new Date()
    )
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Try later.',
        error: 'LOCKED',
      });
    const now = new Date();
    if (
      user.passwordReset.resetTokenExpiresAt &&
      user.passwordReset.resetTokenExpiresAt < now
    )
      return res.status(400).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED',
      });
    const incomingHash = hashToken(token);
    if (incomingHash !== user.passwordReset.resetTokenHash) {
      user.passwordReset.attempts = (user.passwordReset.attempts || 0) + 1;
      if (user.passwordReset.attempts >= MAX_RESET_ATTEMPTS)
        user.passwordReset.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid token',
        error: 'INVALID_TOKEN',
      });
    }
    (user as any).password = (user as any).password || {};
    (user as any).password.hashed = newPassword;
    (user as any).password.lastChangedAt = new Date();
    user.passwordReset = undefined as any;
    await user.save();
    await sendPasswordChangeNotificationEmail(email);
    return res
      .status(200)
      .json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset complete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: 'RESET_COMPLETE_ERROR',
    });
  }
};

// Login
export const loginHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  passportInstance: typeof passport,
) => {
  passportInstance.authenticate(
    'local',
    { session: true },
    async (err: any, user: any, info: any) => {
      if (err)
        return res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: 'INTERNAL_ERROR',
        });
      if (!user)
        return res.status(401).json({
          success: false,
          message: info?.message || 'Invalid email or password',
          error: 'INVALID_CREDENTIALS',
        });
      try {
        req.logIn(user, { session: true }, async (errLogin) => {
          if (errLogin)
            return res.status(500).json({
              success: false,
              message: 'Failed to log in user',
              error: 'LOGIN_ERROR',
            });

          // Update lastLogin timestamp
          try {
            await UserModel.findByIdAndUpdate(user._id, {
              lastLogin: new Date(),
            });
          } catch (updateErr) {
            console.error('Failed to update lastLogin:', updateErr);
            // Don't fail the login if this update fails
          }

          const accessToken = generateAccessToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          });
          const refreshToken = generateRefreshToken();
          await storeRefreshToken(user.id, refreshToken);
          res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              },
              token: accessToken,
              accessToken,
            },
          });
        });
      } catch (error) {
        console.error('Token generation error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate tokens',
          error: 'TOKEN_ERROR',
        });
      }
    },
  )(req, res, next);
};
// Login dash
export const loginDashHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  passportInstance: typeof passport,
) => {
  passportInstance.authenticate(
    'local',
    { session: true },
    async (err: any, user: any, info: any) => {
      if (err)
        return res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: 'INTERNAL_ERROR',
        });
      if (!user)
        return res.status(401).json({
          success: false,
          message: info?.message || 'Invalid email or password',
          error: 'INVALID_CREDENTIALS',
        });
      try {
        req.logIn(user, { session: true }, async (errLogin) => {
          if (!['superadmin', 'admin'].includes(user.role)) {
            return res.status(403).json({
              success: false,
              message: 'Not authorized',
              error: 'LOGIN_ERROR',
            });
          }
          if (errLogin)
            return res.status(500).json({
              success: false,
              message: 'Failed to log in user',
              error: 'LOGIN_ERROR',
            });

          // Update lastLogin timestamp
          try {
            await UserModel.findByIdAndUpdate(user._id, {
              lastLogin: new Date(),
            });
          } catch (updateErr) {
            console.error('Failed to update lastLogin:', updateErr);
            // Don't fail the login if this update fails
          }

          const accessToken = generateAccessToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          });
          const refreshToken = generateRefreshToken();
          await storeRefreshToken(user.id, refreshToken);
          res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              },
              token: accessToken,
              accessToken,
            },
          });
        });
      } catch (error) {
        console.error('Token generation error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate tokens',
          error: 'TOKEN_ERROR',
        });
      }
    },
  )(req, res, next);
};

export const refreshHandler = async (req: Request, res: Response) => {
  try {
    const refreshToken = (req as any).cookies?.refreshToken;
    if (!refreshToken)
      return res.status(401).json({
        success: false,
        message: 'Refresh token not provided',
        error: 'NO_REFRESH_TOKEN',
      });
    const userId = await verifyRefreshToken(refreshToken);
    if (!userId)
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        error: 'INVALID_REFRESH_TOKEN',
      });
    const user = await UserModel.findOne({ userID: userId });
    if (!user || !user.userID)
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    const accessToken = generateAccessToken({
      id: user.userID,
      email:
        (user as any).contactInfo?.email?.value ||
        (user as any).contactInfo?.email?.email ||
        '',
      name:
        (user as any).name?.displayName ||
        (user as any).userName?.displayName ||
        '',
      role: user.role,
    });
    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { accessToken },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: 'REFRESH_ERROR',
    });
  }
};

export const logoutHandler = async (req: Request, res: Response) => {
  try {
    // Step 1: Delete refresh token from database
    const refreshToken = (req as any).body?.refreshToken;
    if (refreshToken) {
      try {
        await deleteRefreshToken(refreshToken);
      } catch (err) {
        console.error('Failed to delete refresh token:', err);
      }
    }

    // Step 2: Passport logout (must be done before session destruction)
    const canUseSessionLogout = Boolean(
      req.session &&
      typeof (req as any).logout === 'function' &&
      typeof (req as any).isAuthenticated === 'function' &&
      (req as any).isAuthenticated(),
    );
    if (canUseSessionLogout) {
      await new Promise<void>((resolve) => {
        (req as any).logout((err: any) => {
          if (err) console.error('Passport logout error:', err);
          resolve();
        });
      });
    }

    // Step 3: Destroy session
    if (req.session) {
      await new Promise<void>((resolve) => {
        req.session.destroy((err) => {
          if (err) console.error('Session destruction error:', err);
          resolve();
        });
      });
    }

    // Step 4: Clear ALL cookies (comprehensive approach)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };

    // Clear common authentication cookies
    const cookiesToClear = [
      'refreshToken',
      'connect.sid',
      'session',
      'accessToken',
      'token',
      'auth',
      'jwt',
    ];

    // Clear all known cookies
    cookiesToClear.forEach((cookieName) => {
      res.clearCookie(cookieName, cookieOptions);
      // Also try clearing with different path/domain combinations
      res.clearCookie(cookieName, { ...cookieOptions, path: '/' });
      res.clearCookie(cookieName, { ...cookieOptions, domain: req.hostname });
    });

    // Step 5: Clear any additional cookies from request
    if (req.cookies) {
      Object.keys(req.cookies).forEach((cookieName) => {
        res.clearCookie(cookieName, cookieOptions);
      });
    }

    // Step 6: Set cache control headers to prevent caching
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res
      .status(200)
      .json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: 'LOGOUT_ERROR',
    });
  }
};

export const meHandler = (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'User data retrieved',
    data: { user: (req as any).user },
  });
};

export const googleCallbackHandler = async (
  req: Request,
  res: Response,
  passportInstance: typeof passport,
) => {
  try {
    const user = (req as any).user as any;
    if (!user) {
      const returnUrl = (
        (req.session as any)?.returnUrl || process.env.FRONTEND_URL
      ).replace(/\/$/, '');
      return res.redirect(`${returnUrl}/auth/error?message=no_user`);
    }

    req.logIn(user, { session: true }, async (err) => {
      if (err) {
        let returnUrl = (
          (req.session as any)?.returnUrl || process.env.FRONTEND_URL
        ).replace(/\/$/, '');
        return res.redirect(`${returnUrl}/auth/error?message=login_error`);
      }
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(user.id, refreshToken);
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      let returnUrl = (
        (req.session as any)?.returnUrl || process.env.FRONTEND_URL
      ).replace(/\/$/, '');
      if (req.session) delete (req.session as any).returnUrl;
      return res.redirect(`${returnUrl}/auth/callback?token=${accessToken}`);
    });
  } catch (error) {
    let returnUrl = (
      (req.session as any)?.returnUrl || process.env.FRONTEND_URL
    ).replace(/\/$/, '');
    return res.redirect(`${returnUrl}/auth/error?message=callback_error`);
  }
};
