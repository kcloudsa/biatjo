import { Document, Types } from 'mongoose';

export default interface IReview extends Document {
  userId: Types.ObjectId; // who left the review
  productId: Types.ObjectId; // product being reviewed
  brandId?: Types.ObjectId; // optional denormalized brand id for faster lookups
  title?: string;
  body?: string;
  rating: number; // stars (1-5)
  createdAt?: Date;
  updatedAt?: Date;
}
