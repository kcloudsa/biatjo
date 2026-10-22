import mongoose, { Schema, model, Model } from 'mongoose';
import IReview from '../interfaces/IReview';

const ReviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    // denormalized brand id to speed up queries by brand without joining products
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: false,
      index: true,
    },
    title: { type: String },
    body: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true },
);

// Optional: prevent duplicate review by same user for same product
ReviewSchema.index({ userId: 1, productId: 1 }, { unique: false });

// Automatic hooks: recalculate product ratings when reviews change
// IMPORTANT: Define hooks BEFORE creating the model
ReviewSchema.post('save', async function (doc: any) {
  try {
    const Product = mongoose.models.Product as any;
    if (Product && typeof Product.recalculateRatings === 'function') {
      await Product.recalculateRatings(doc.productId);
    }
  } catch (err) {
    console.error('Error recalculating ratings after save:', err);
  }
});

// findOneAndDelete / findOneAndUpdate (covers findByIdAndUpdate, findByIdAndDelete)
ReviewSchema.post('findOneAndDelete', async function (doc: any) {
  try {
    if (!doc) return;
    const Product = mongoose.models.Product as any;
    if (Product && typeof Product.recalculateRatings === 'function') {
      await Product.recalculateRatings(doc.productId);
    }
  } catch (err) {
    console.error('Error recalculating ratings after delete:', err);
  }
});

ReviewSchema.post('findOneAndUpdate', async function (doc: any) {
  try {
    if (!doc) return;
    const Product = mongoose.models.Product as any;
    if (Product && typeof Product.recalculateRatings === 'function') {
      await Product.recalculateRatings(doc.productId);
    }
  } catch (err) {
    console.error('Error recalculating ratings after update:', err);
  }
});

const ReviewModel =
  (mongoose.models.Review as Model<IReview>) ||
  model<IReview>('Review', ReviewSchema);
export default ReviewModel;
