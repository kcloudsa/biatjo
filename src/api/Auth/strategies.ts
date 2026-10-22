import { PassportStatic } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getUserByEmail } from '../../services/userServices';
import Iuser from '../../interfaces/Iuser';
import UserModel from '../../models/userModel';
import { TokenPayload } from '../../../Utils/tokenUtils';
import { generateOTP, sendVerificationEmail } from '../../emails';
import { Request } from 'express';

let googleStrategyRegistered = false;

const jwtExtractor = (req: Request) => {
  let token: string | null = null;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.substring(7);
  }
  return token;
};

export const registerLocalStrategy = (passport: PassportStatic) => {
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email: string, password: string, done) => {
        try {
          const user = (await getUserByEmail(email)) as Iuser | null;
          if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          const emailInfo: any = user.contactInfo?.email;
          if (emailInfo && !emailInfo.verified) {
            try {
              const needNewCode =
                !emailInfo.verificationCode ||
                !emailInfo.verificationCodeExpiresAt ||
                (emailInfo.verificationCodeExpiresAt &&
                  new Date(emailInfo.verificationCodeExpiresAt).getTime() <
                    Date.now());
              if (needNewCode) {
                const freshOtp = generateOTP();
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                await UserModel.updateOne(
                  {
                    $or: [
                      { 'contactInfo.email.value': email },
                      { 'contactInfo.email.email': email },
                    ],
                  },
                  {
                    $set: {
                      'contactInfo.email.verificationCode': freshOtp,
                      'contactInfo.email.verificationCodeExpiresAt': expiresAt,
                    },
                  },
                );
                sendVerificationEmail(email, freshOtp).catch((err) =>
                  console.error('Resend verification email failed:', err),
                );
              }
            } catch (otpErr) {
              console.error('Email verification resend error:', otpErr);
            }
            return done(null, false, { message: 'EMAIL_NOT_VERIFIED' });
          }

          if (user && user.password?.hashed) {
            const storedPassword = user.password.hashed as string;
            try {
              const isPasswordValid = await bcrypt.compare(
                password,
                storedPassword,
              );
              if (isPasswordValid) {
                return done(null, {
                  _id: (user as any)._id,
                  id: user.userID,
                  email:
                    (user as any).contactInfo?.email?.email ||
                    (user as any).contactInfo?.email?.value,
                  name:
                    (user as any).name?.firstName &&
                    (user as any).name?.lastName
                      ? `${(user as any).name.firstName} ${
                          (user as any).name.lastName
                        }`.trim()
                      : (user as any).name?.displayName ||
                        (user as any).userName?.displayName,
                  role: user.role,
                  profilePicture:
                    (user as any).userInfo?.profilePicture || null,
                });
              }
            } catch (_err) {
              const plainTextMatch = storedPassword === password;
              if (plainTextMatch) {
                try {
                  const hashedPassword = password.startsWith('$2')
                    ? password
                    : await bcrypt.hash(password, 12);
                  await UserModel.updateOne(
                    {
                      $or: [
                        { 'contactInfo.email.value': email },
                        { 'contactInfo.email.email': email },
                      ],
                    },
                    { 'password.hashed': hashedPassword },
                  );
                } catch (migrationError) {
                  console.error(
                    'Failed to migrate password for user:',
                    email,
                    migrationError,
                  );
                }
                return done(null, {
                  _id: (user as any)._id,
                  id: user.userID,
                  email:
                    (user as any).contactInfo?.email?.email ||
                    (user as any).contactInfo?.email?.value,
                  name:
                    (user as any).name?.firstName &&
                    (user as any).name?.lastName
                      ? `${(user as any).name.firstName} ${
                          (user as any).name.lastName
                        }`.trim()
                      : (user as any).name?.displayName ||
                        (user as any).userName?.displayName,
                  role: user.role,
                  profilePicture:
                    (user as any).userInfo?.profilePicture || null,
                });
              }
            }
            return done(null, false, { message: 'Invalid email or password' });
          }
          return done(null, false, { message: 'Invalid email or password' });
        } catch (error) {
          console.error('Authorization error:', error);
          return done(error);
        }
      },
    ),
  );
};

export const registerJwtStrategy = (passport: PassportStatic) => {
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: jwtExtractor,
        secretOrKey: process.env.ACCESS_TOKEN_SECRET || 'access-secret',
      },
      async (payload: TokenPayload, done) => {
        try {
          const user = await getUserByEmail(payload.email);
          if (user) {
            return done(null, {
              _id: (user as any)._id,
              id: user.userID,
              email:
                (user as any).contactInfo?.email?.email ||
                (user as any).contactInfo?.email?.value,
              firstName:
                (user as any).name?.firstName ||
                (user as any).userName?.firstName,
              lastName:
                (user as any).name?.lastName ||
                (user as any).userName?.lastName,
              displayName:
                (user as any).name?.displayName ||
                (user as any).userName?.displayName,
              name:
                (user as any).name?.firstName && (user as any).name?.lastName
                  ? `${(user as any).name.firstName} ${
                      (user as any).name.lastName
                    }`.trim()
                  : (user as any).name?.displayName ||
                    (user as any).userName?.displayName,
              role: user.role,
              profilePicture: (user as any).userInfo?.profilePicture || null,
            });
          }
          return done(null, false);
        } catch (error) {
          return done(error, false);
        }
      },
    ),
  );
};

export const registerGoogleStrategy = (passport: PassportStatic) => {
  const googleClientId = process.env.AUTH_GOOGLE_ID;
  const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!googleClientId || !googleClientSecret) {
    googleStrategyRegistered = false;
    return;
  }

  try {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: `${process.env.CALLBACK_URI}/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google'), false);

            let existingUser = await getUserByEmail(email);
            if (existingUser) {
              return done(null, {
                _id: (existingUser as any)._id,
                id: existingUser.userID,
                email:
                  (existingUser as any).contactInfo?.email?.email ||
                  (existingUser as any).contactInfo?.email?.value,
                name:
                  (existingUser as any).name?.firstName &&
                  (existingUser as any).name?.lastName
                    ? `${(existingUser as any).name.firstName} ${
                        (existingUser as any).name.lastName
                      }`.trim()
                    : (existingUser as any).name?.displayName ||
                      (existingUser as any).userName?.displayName,
                role: existingUser.role,
                profilePicture:
                  (existingUser as any).userInfo?.profilePicture || null,
              });
            }

            const newUserData = {
              name: {
                firstName: profile.name?.givenName || 'Unknown',
                lastName: profile.name?.familyName || 'User',
                displayName: profile.displayName || 'Unknown User',
              },
              contactInfo: {
                email: {
                  value: email,
                  verified: true,
                  verifiedAt: new Date(),
                  verificationCode: 'verified',
                },
                phone: {
                  countryCode: '+1',
                  value: `oauth${Date.now()}${Math.floor(
                    Math.random() * 1000,
                  )}`,
                  verified: false,
                  verifiedAt: null,
                  verificationCode: '000000',
                },
              },
              password: {
                hashed: crypto.randomBytes(32).toString('hex'),
                expirationDate: new Date(
                  Date.now() + 365 * 24 * 60 * 60 * 1000,
                ),
              },
              userInfo: {
                gender: 'unknown',
                nationality: 'unknown',
                profilePicture: profile.photos?.[0]?.value || '',
              },
              // Align with user model enum
              role: 'user',
              active: true,
            } as any;

            const newUser = await UserModel.create(newUserData);
            return done(null, {
              _id: (newUser as any)._id,
              id: newUser.userID,
              email:
                (newUser as any).contactInfo?.email?.email ||
                (newUser as any).contactInfo?.email?.value,
              name:
                (newUser as any).name?.firstName &&
                (newUser as any).name?.lastName
                  ? `${(newUser as any).name.firstName} ${
                      (newUser as any).name.lastName
                    }`.trim()
                  : (newUser as any).name?.displayName,
              role: newUser.role,
              profilePicture: (newUser as any).userInfo?.profilePicture || null,
            });
          } catch (error) {
            console.error('Google OAuth error:', error);
            return done(error, false);
          }
        },
      ),
    );
    googleStrategyRegistered = true;
  } catch (error) {
    console.error('Error registering Google OAuth strategy:', error);
    googleStrategyRegistered = false;
  }
};

export const registerSessionSerialization = (passport: PassportStatic) => {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await UserModel.findOne({ userID: id });
      if (user) {
        const sessionUser = {
          id: user.userID,
          _id: (user as any)._id,
          email:
            (user as any).contactInfo?.email?.email ||
            (user as any).contactInfo?.email?.value,
          name:
            (user as any).name?.firstName && (user as any).name?.lastName
              ? `${(user as any).name.firstName} ${
                  (user as any).name.lastName
                }`.trim()
              : (user as any).name?.displayName ||
                (user as any).userName?.displayName,
          role: user.role,
          profilePicture: (user as any).userInfo?.profilePicture || null,
          userName: (user as any).name || (user as any).userName,
        } as any;
        done(null, sessionUser);
      } else {
        done(null, false);
      }
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(error, null);
    }
  });
};

export const isGoogleStrategyEnabled = () => googleStrategyRegistered;
