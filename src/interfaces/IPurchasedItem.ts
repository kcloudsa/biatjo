import { Document, Types } from 'mongoose';

export interface IPurchaseSnapshot {
  price: number; // amount paid at purchase time
  currency?: string; // ISO code
  quantity?: number;
  metadata?: Record<string, any>; // any other edits or data to snapshot (e.g. selected keys)
  purchasedAt?: Date;
}

export default interface IPurchasedItem extends Document {
  userId: Types.ObjectId; // who purchased
  productId: Types.ObjectId; // which product
  snapshots: IPurchaseSnapshot[]; // historical purchases of this product by this user
  createdAt?: Date;
  updatedAt?: Date;
}
