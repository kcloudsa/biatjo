import { Document, Types } from 'mongoose';

export interface IPrice {
  amount: number;
  currency: string; // ISO code
}

export interface ISale {
  amount?: number;
  percentage?: number;
  currency: string; // ISO code
}

export interface IKeys {
   key: string;
   value: string[]
}

export default interface IProduct extends Document {
  title: string;
  description?: string;
  images?: string[]; // URLs (Firebase storage links expected)
  rating?: number;
  reviewCount?: number;
  averageRating?: number;
  price?: IPrice;
  sale?: ISale;
  brand?: Types.ObjectId; // ref to Brand
  collections?: Types.ObjectId[]; // refs to Collection
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  keys: IKeys[],
}
