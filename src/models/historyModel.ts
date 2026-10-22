import mongoose, { Model } from 'mongoose';
import { IHistory } from '../interfaces/Ihistory';

// This History model is user-centric: each entry belongs to a user
const historySchema = new mongoose.Schema<IHistory>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: {
    type: String,
    enum: [
      'view',
      'password_changed',
      'email_verified',
      'login',
      'create',
      'update',
      'delete',
      'restore',
    ],
    required: true,
    index: true,
  },
  timestamp: { type: Date, default: Date.now, index: true },
  performedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    role: String,
  },
  item: {
    id: { type: mongoose.Schema.Types.ObjectId },
    type: { type: String, enum: ['product', 'brand', 'other'] },
  },
  diff: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String },
});

// Compound indexes useful for recent views and upsert
historySchema.index({ userId: 1, 'item.id': 1, 'item.type': 1, action: 1 });
historySchema.index({ userId: 1, timestamp: -1 });

interface HistoryModelType extends Model<IHistory> {
  recordView(userId: any, itemId: any, itemType: string, performedBy?: any): Promise<IHistory>;
  listRecentViews(userId: any, opts?: { type?: string; limit?: number }): Promise<IHistory[]>;
  clearForUser(userId: any): Promise<{ deletedCount?: number }>;
}

historySchema.statics.recordView = async function (
  userId: any,
  itemId: any,
  itemType: string,
  performedBy?: any,
) {
  const History: HistoryModelType = this as any;
  const now = new Date();
  
  // Check if this exact view already exists
  const existing = await History.findOne({
    userId,
    'item.id': itemId,
    'item.type': itemType,
    action: 'view',
  });

  if (existing) {
    // Just update the timestamp if it already exists
    existing.timestamp = now;
    await existing.save();
    return existing;
  }

  // Create new entry if it doesn't exist
  const doc = await History.create({
    userId,
    action: 'view',
    item: { id: itemId, type: itemType },
    performedBy: performedBy || undefined,
    timestamp: now,
  });
  
  return doc;
};

historySchema.statics.listRecentViews = async function (
  userId: any,
  opts?: { type?: string; limit?: number },
) {
  const History: HistoryModelType = this as any;
  const filter: any = { userId, action: 'view' };
  if (opts?.type) filter['item.type'] = opts.type;
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
  return History.find(filter).sort({ timestamp: -1 }).limit(limit).lean().exec();
};

historySchema.statics.clearForUser = async function (userId: any) {
  const History: HistoryModelType = this as any;
  return History.deleteMany({ userId }).exec();
};

const HistoryModel = (mongoose.models.History as HistoryModelType) || mongoose.model<IHistory>('History', historySchema);
export default HistoryModel;
