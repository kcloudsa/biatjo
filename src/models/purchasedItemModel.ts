import mongoose, { Schema, model, Model } from 'mongoose';
import IPurchasedItem, {
  IPurchaseSnapshot,
} from '../interfaces/IPurchasedItem';

const PurchaseSnapshotSchema = new Schema<IPurchaseSnapshot>(
  {
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'USD' },
    quantity: { type: Number, default: 1, min: 1 },
    metadata: { type: Schema.Types.Mixed },
    purchasedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const PurchasedItemSchema = new Schema<IPurchasedItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    snapshots: { type: [PurchaseSnapshotSchema], default: [] },
  },
  { timestamps: true },
);

// Ensure one doc per user+product
PurchasedItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

interface PurchasedItemModelType extends Model<IPurchasedItem> {
  addSnapshot(
    userId: any,
    productId: any,
    snapshot: IPurchaseSnapshot,
  ): Promise<IPurchasedItem>;
}

// Add or append a purchase snapshot
PurchasedItemSchema.statics.addSnapshot = async function (
  userId: any,
  productId: any,
  snapshot: IPurchaseSnapshot,
) {
  const doc = await this.findOneAndUpdate(
    { userId, productId },
    { $push: { snapshots: snapshot }, $setOnInsert: { userId, productId } },
    { new: true, upsert: true },
  );
  return doc;
};

const PurchasedItemModel =
  (mongoose.models.PurchasedItem as PurchasedItemModelType) ||
  (model<IPurchasedItem, PurchasedItemModelType>(
    'PurchasedItem',
    PurchasedItemSchema,
  ) as PurchasedItemModelType);
export default PurchasedItemModel;
