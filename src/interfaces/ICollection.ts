import { Document, Types } from 'mongoose';

export default interface ICollection extends Document {
  title: string;
  image?: string;
  products?: Types.ObjectId[]; // refs to Product
  brand?: Types.ObjectId; // owner brand
  createdAt?: Date;
  updatedAt?: Date;
}
