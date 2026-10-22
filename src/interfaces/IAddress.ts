import { Document, Types } from 'mongoose';

export interface IMapInfo {
  latitude?: number;
  longitude?: number;
  placeId?: string; // Google Place ID
  formattedAddress?: string;
  streetNumber?: string;
  route?: string;
  neighborhood?: string;
  postalCode?: string;
  country?: string;
  state?: string;
  city?: string;
}

export default interface IAddress extends Document {
  userId: Types.ObjectId; // owner
  type?: 'home' | 'work' | 'other';
  label?: string;
  isDefault?: boolean;

  firstName?: string;
  lastName?: string;
  phone?: string;

  map?: IMapInfo; // optional google map data

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;

  deliveryInstructions?: string;
  isVerified?: boolean;

  lastUsedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
