import { Document, Types } from 'mongoose';

export default interface IAuditLog extends Document {
  paymentId: Types.ObjectId; // ref: Payment
  payload: any; // JSON payload as received from provider or internal events
  receivedAt: Date;
  createdAt?: Date;
}
