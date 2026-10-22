import { Document, Types } from 'mongoose';

export type CartItemStatus = 'active' | 'saved' | 'removed';

export interface ICartItemKey {
  key: string;
  value: string;
}

export interface ICartItem {
  product: Types.ObjectId;
  status?: CartItemStatus;
  keys?: ICartItemKey[]; // e.g. { key: 'color', value: 'red' }
  qty: number; // quantity for this specific item (product + keys combination)
}

export default interface ICart extends Document {
  userId: Types.ObjectId;
  items: ICartItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
