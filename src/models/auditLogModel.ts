import mongoose, { Schema, model } from 'mongoose';
import IAuditLog from '../interfaces/IAuditLog';

const AuditLogSchema = new Schema<IAuditLog>(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) ||
  model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLogModel;
  