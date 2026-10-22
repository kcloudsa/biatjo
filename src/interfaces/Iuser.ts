import { Document, Types } from 'mongoose';

export interface IContactField {
  value: string;
  verified: boolean;
  verifiedAt?: Date | null;
  verificationCode?: string | null;
  verificationCodeExpiresAt?: Date | null;
}

export interface IContactInfo {
  email: IContactField;
  phone: IContactField & { countryCode?: string | null };
}

export interface IUserTInfo {
  gender?: string;
  nationality?: string;
  profilePicture?: string[];
}

export interface IUserName {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  slug?: string; // Optional slug field for URL-friendly names
}

export interface IPassword {
  hashed: string;
  expirationDate?: Date | null;
  lastChangedAt?: Date | null;
}

export interface IPasswordResetMeta {
  otp?: string | null;
  expiresAt?: Date | null;
  attempts?: number;
  lockedUntil?: Date | null;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: Date | null;
}

export default interface Iuser extends Document {
  userID?: string;
  name?: IUserName; // consolidated name
  avatar?: string | null; // profile picture url
  contactInfo?: IContactInfo;
  password?: IPassword;
  passwordReset?: IPasswordResetMeta;
  isVerified?: boolean; // overall verification flag (email or phone)
  histories?: Types.ObjectId[]; // refs to History model
  cart?: Types.ObjectId[]; // refs to CartItem or Cart model
  followedBrands?: Types.ObjectId[]; // refs to Brand model
  savedItems?: Types.ObjectId[]; // refs to Saved model
  orders?: Types.ObjectId[]; // refs to Order model
  addresses?: Types.ObjectId[]; // refs to Address model
  lastLogin?: Date | null;
  passwordChangedAt?: Date | null;
  active: boolean;
  notes?: string;
  role: 'user' | 'driver' | 'admin' | 'demo';
  subUsersIDs?: Types.ObjectId[];
  subscriptionID?: Types.ObjectId;
  userInfo?: IUserTInfo;
  createdAt: Date | null;
  licenseID?: Types.ObjectId[];
  runningTrip?: Types.ObjectId | null;
}
