import mongoose from 'mongoose';
import IBrand from '../interfaces/IBrand';

const brandSchema = new mongoose.Schema<IBrand>(
  {
    brandID: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    cover: { type: String },
    logo: { type: String },
    more: [
      {
        title: { type: String, required: true },
        link: { type: String, required: true },
      },
    ],
    collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],
    categories: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
      validate: {
        validator: function (v: mongoose.Types.ObjectId[]) {
          return Array.isArray(v) && v.length <= 4;
        },
        message: 'A brand cannot belong to more than 4 categories',
      },
    },
    rating: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0, min: 0 },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    active: { type: Boolean, default: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  { timestamps: true },
);

// Ensure brandID is normalized and matches allowed pattern (lowercase, letters, numbers, hyphen)
brandSchema.path('brandID').validate(function (value: string) {
  if (!value) return false;
  // allowed: lowercase letters, numbers, hyphen, underscore optional
  return /^[a-z0-9-_]+$/.test(value);
}, 'brandID must contain only lowercase letters, numbers, hyphen or underscore');

brandSchema.pre('validate', function (next) {
  const doc: any = this;
  if (doc.brandID && typeof doc.brandID === 'string') {
    doc.brandID = doc.brandID.trim().toLowerCase();
  }
  next();
});

// Friendly uniqueness check before saving to avoid raw duplicate-key errors
brandSchema.pre('save', async function (next) {
  try {
    const doc: any = this;
    if (!doc.isModified('brandID')) return next();
    const existing = await mongoose.models.Brand?.findOne({
      brandID: doc.brandID,
    });
    if (existing && existing._id.toString() !== doc._id?.toString()) {
      const err: any = new Error('brandID already in use');
      err.name = 'ValidationError';
      return next(err);
    }
    return next();
  } catch (err) {
    return next(err as any);
  }
});

brandSchema.index({ name: 1 });

const BrandModel = mongoose.model<IBrand>('Brand', brandSchema);
export default BrandModel;

// Static helper: merge DB brands with external source (e.g., Shopify)
// Usage: const merged = await BrandModel.mergeExternal(externalArray, optionalFilter)
// optionalFilter is applied to DB query to limit which DB brands are considered
(BrandModel as any).mergeExternal = async function (
  externalItems: any[],
  filter: any = {},
) {
  const dbItems = await this.find(filter).lean().exec();
  const keyFn = (b: any) =>
    b.brandID ? String(b.brandID).trim().toLowerCase() : undefined;

  // inline mergeDatasets implementation (primary=dbItems wins)
  const map = new Map<string, any>();
  for (const p of dbItems) {
    const k = keyFn(p);
    if (k) map.set(k, { ...p });
    else map.set(Symbol().toString(), { ...p });
  }
  for (const s of externalItems) {
    const k = keyFn(s);
    if (!k) {
      map.set(Symbol().toString(), { ...s });
      continue;
    }
    const existing = map.get(k);
    if (!existing) map.set(k, { ...s });
    else map.set(k, { ...s, ...existing });
  }

  return Array.from(map.values());
};
