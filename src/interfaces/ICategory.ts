import { Document, Types } from 'mongoose';

export default interface ICategory extends Document {
  name: string;
  image?: string;
  parentId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}
