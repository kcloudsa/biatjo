import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0, // MongoDB TTL - will auto-delete when expiresAt is reached
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const RefreshTokenModel = mongoose.model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
);
export default RefreshTokenModel;
