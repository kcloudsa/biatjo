import { Document, Types } from 'mongoose';

export default interface ISaved extends Document {
  userId: Types.ObjectId;
  products: Types.ObjectId[]; // refs to Product
  createdAt?: Date;
  updatedAt?: Date;
}
