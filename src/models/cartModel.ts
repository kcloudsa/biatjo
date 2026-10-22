import mongoose, { Schema, model, Model } from 'mongoose';
import ICart, { ICartItem } from '../interfaces/ICart';

const CartItemSchema = new Schema<ICartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    status: {
      type: String,
      enum: ['active', 'saved', 'removed'],
      default: 'active',
    },
    keys: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    qty: { type: Number, default: 1, min: 1 },
  },
  { _id: true },
);

const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true },
);

CartSchema.index({ userId: 1 }, { unique: true });

// Normalize and validate items before save
CartSchema.pre('save', function (next) {
  try {
    const self: any = this;
    if (Array.isArray(self.items)) {
      for (const it of self.items) {
        // Deduplicate keys by key+value (no qty at key level anymore)
        if (Array.isArray(it.keys)) {
          const seen = new Map<string, { key: string; value: string }>();
          for (const k of it.keys) {
            const kk = `${k.key}@@${k.value}`;
            if (!seen.has(kk)) {
              seen.set(kk, { key: k.key, value: k.value });
            }
          }
          it.keys = Array.from(seen.values());
        }
        // Ensure qty is at least 1
        if (typeof it.qty !== 'number' || it.qty < 1) {
          it.qty = 1;
        }
        // status normalization
        if (!['active', 'saved', 'removed'].includes(it.status)) {
          it.status = 'active';
        }
      }
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

// Add or update an item in the user's cart
interface CartModelType extends Model<ICart> {
  addOrUpdateItem(
    userId: any,
    productId: any,
    keys?: { key: string; value: string }[],
    qty?: number,
    status?: string,
  ): Promise<ICart>;
  removeItem(userId: any, productId: any, keys?: { key: string; value: string }[]): Promise<ICart | null>;
  getPopulated(userId: any): Promise<ICart | null>;
  incrementItemQty(
    userId: any,
    productId: any,
    keys: { key: string; value: string }[],
    delta: number,
  ): Promise<ICart | null>;
  setItemQty(
    userId: any,
    productId: any,
    keys: { key: string; value: string }[],
    qty: number,
  ): Promise<ICart | null>;
}

CartSchema.statics.addOrUpdateItem = async function (
  userId: any,
  productId: any,
  keys: any[] = [],
  qty = 1,
  status = 'active',
) {
  // upsert cart
  const cart = await this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, items: [] } },
    { new: true, upsert: true },
  );

  // Helper to compare keys (same product + same keys combination = same item)
  const keysMatch = (keys1: any[], keys2: any[]) => {
    if (keys1.length !== keys2.length) return false;
    const sorted1 = [...keys1].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    const sorted2 = [...keys2].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    return sorted1.every((k1, idx) => k1.key === sorted2[idx].key && k1.value === sorted2[idx].value);
  };

  // Find existing item with same product AND same keys combination
  const existing = cart.items.find(
    (it: any) => 
      it.product.toString() === productId.toString() && 
      keysMatch(it.keys || [], keys)
  );

  if (!existing) {
    // New unique item (different product or different keys combination)
    cart.items.push({ product: productId, keys, qty, status });
  } else {
    // Same item exists - increment quantity
    existing.qty = (existing.qty || 0) + qty;
    existing.status = status || existing.status;
  }

  await cart.save();
  return cart;
};

CartSchema.statics.removeItem = async function (userId: any, productId: any, keys: any[] = []) {
  const cart = await this.findOne({ userId });
  if (!cart) return null;

  // Helper to compare keys
  const keysMatch = (keys1: any[], keys2: any[]) => {
    if (keys1.length !== keys2.length) return false;
    const sorted1 = [...keys1].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    const sorted2 = [...keys2].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    return sorted1.every((k1, idx) => k1.key === sorted2[idx].key && k1.value === sorted2[idx].value);
  };

  if (keys.length === 0) {
    // Remove all items with this productId
    cart.items = cart.items.filter((it: any) => it.product.toString() !== productId.toString());
  } else {
    // Remove only the item with matching product + keys
    cart.items = cart.items.filter(
      (it: any) =>
        !(it.product.toString() === productId.toString() && keysMatch(it.keys || [], keys))
    );
  }

  await cart.save();
  return cart;
};

CartSchema.statics.getPopulated = async function (userId: any) {
  return this.findOne({ userId }).populate({ 
    path: 'items.product',
    populate: { path: 'brand' }
  });
};

CartSchema.statics.incrementItemQty = async function (
  userId: any,
  productId: any,
  keys: any[],
  delta: number,
) {
  const cart = await this.findOne({ userId });
  if (!cart) return null;

  // Helper to compare keys
  const keysMatch = (keys1: any[], keys2: any[]) => {
    if (keys1.length !== keys2.length) return false;
    const sorted1 = [...keys1].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    const sorted2 = [...keys2].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    return sorted1.every((k1, idx) => k1.key === sorted2[idx].key && k1.value === sorted2[idx].value);
  };

  const item = cart.items.find(
    (it: any) =>
      it.product.toString() === productId.toString() &&
      keysMatch(it.keys || [], keys)
  );

  if (!item) return cart;

  item.qty = Math.max(1, (item.qty || 1) + delta);
  await cart.save();
  return cart;
};

CartSchema.statics.setItemQty = async function (
  userId: any,
  productId: any,
  keys: any[],
  qty: number,
) {
  const cart = await this.findOne({ userId });
  if (!cart) return null;

  // Helper to compare keys
  const keysMatch = (keys1: any[], keys2: any[]) => {
    if (keys1.length !== keys2.length) return false;
    const sorted1 = [...keys1].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    const sorted2 = [...keys2].sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`));
    return sorted1.every((k1, idx) => k1.key === sorted2[idx].key && k1.value === sorted2[idx].value);
  };

  const item = cart.items.find(
    (it: any) =>
      it.product.toString() === productId.toString() &&
      keysMatch(it.keys || [], keys)
  );

  if (!item) return cart;

  if (qty <= 0) {
    // Remove item if quantity is 0 or less
    cart.items = cart.items.filter(
      (it: any) =>
        !(it.product.toString() === productId.toString() && keysMatch(it.keys || [], keys))
    );
  } else {
    item.qty = qty;
  }

  await cart.save();
  return cart;
};

const CartModel =
  (mongoose.models.Cart as CartModelType) ||
  (model<ICart, CartModelType>('Cart', CartSchema) as CartModelType);
export default CartModel;
