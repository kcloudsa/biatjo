import mongoose, { Schema, Model } from 'mongoose';
import IProduct from '../interfaces/IProduct';

const PriceSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, uppercase: true },
  },
  { _id: false },
);
const KeysSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: [String], required: true },
  },
  { _id: false },
);

const SaleSchema = new Schema(
  {
    amount: {
      type: Number,
      min: 0,
    },
    percentage: { type: Number, min: 0, max: 100 },
    currency: { type: String, required: true, trim: true, uppercase: true },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    images: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    price: { type: PriceSchema, required: false },
    sale: { type: SaleSchema, required: false },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: false },
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    active: { type: Boolean, default: true },
    keys: {
      type: [KeysSchema],
      default: [],
    },
  },
  { timestamps: true },
);

ProductSchema.index({ title: 'text', description: 'text' });

// Recalculate ratings for a product from the Review collection
ProductSchema.statics.recalculateRatings = async function (productId: any) {
  const Review = mongoose.models.Review;
  if (!Review) return null;
  const oid = new mongoose.Types.ObjectId(productId);
  const agg = await Review.aggregate([
    { $match: { productId: oid } },
    {
      $group: {
        _id: '$productId',
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);
  if (!agg || agg.length === 0) {
    return this.findByIdAndUpdate(
      productId,
      { $set: { averageRating: 0, reviewCount: 0, rating: 0 } },
      { new: true },
    );
  }
  const { avg, count } = agg[0];
  // also keep legacy rating field in sync
  return this.findByIdAndUpdate(
    productId,
    { $set: { averageRating: avg, reviewCount: count, rating: avg } },
    { new: true },
  );
};

const Product: any =
  mongoose.models.Product || mongoose.model('Product', ProductSchema);

export default Product;
