import { Types } from 'mongoose';

export default interface IFollow {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  brands: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}
