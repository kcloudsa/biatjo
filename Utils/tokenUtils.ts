import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import RefreshTokenModel from '../src/models/refreshTokenModel';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role?: string;
  profilePicture?: string | null;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '1y' });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

export const storeRefreshToken = async (
  userId: string,
  refreshToken: string,
): Promise<void> => {
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days

  // Remove any existing refresh tokens for this user
  await RefreshTokenModel.deleteMany({ userId });

  // Store new refresh token
  await RefreshTokenModel.create({
    userId,
    token: refreshToken,
    expiresAt,
  });
};

export const verifyRefreshToken = async (
  token: string,
): Promise<string | null> => {
  const tokenDoc = await RefreshTokenModel.findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  return tokenDoc ? tokenDoc.userId : null;
};

export const deleteRefreshToken = async (token: string): Promise<void> => {
  await RefreshTokenModel.deleteOne({ token });
};

export const deleteAllUserRefreshTokens = async (
  userId: string,
): Promise<void> => {
  await RefreshTokenModel.deleteMany({ userId });
};
