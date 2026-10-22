import { Document, Types } from 'mongoose';

export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'canceled';
export type PaymentMethod = 'card' | 'wallet' | 'bank';
export type PaymentProvider = 'Paymob';
export type PaymentCurrency = 'SAR';

export default interface IPayment extends Document {
  orderId: Types.ObjectId; // ref: Order
  userId: Types.ObjectId; // ref: User
  amount: Types.Decimal128 | number; // stored as Decimal128 in DB; exposed as number via getter
  currency: PaymentCurrency; // 'SAR'
  status: PaymentStatus;
  method: PaymentMethod;
  provider: PaymentProvider; // 'Paymob'
  providerTransactionId?: string;
  transactionDate?: Date;
  callbackData?: any; // raw provider callback JSON
  createdAt?: Date;
  updatedAt?: Date;
}
