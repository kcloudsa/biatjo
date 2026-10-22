import mongoose, { Schema, model, Model } from 'mongoose';
import ISaved from '../interfaces/ISaved';

const SavedSchema = new Schema<ISaved>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true },
);

// Ensure one saved document per user
SavedSchema.index({ userId: 1 }, { unique: true });

// Normalize products to be unique on save (defensive against direct mutations)
SavedSchema.pre('save', function (next) {
  try {
    const self: any = this;
    if (Array.isArray(self.products)) {
      const uniq = Array.from(
        new Set(self.products.map((p: any) => String(p))),
      );
      self.products = uniq as any;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

interface SavedModelType extends Model<ISaved> {
  upsertForUser(userId: any): Promise<ISaved>;
  addProduct(userId: any, productId: any): Promise<ISaved>;
  removeProduct(userId: any, productId: any): Promise<ISaved | null>;
  getPopulated(userId: any): Promise<ISaved | null>;
  populateOnUser(userId: any): Promise<any>;
}

// Static helper: upsert a saved doc for a user
SavedSchema.statics.upsertForUser = async function (userId: any) {
  return this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, products: [] } },
    { new: true, upsert: true },
  );
};

SavedSchema.statics.addProduct = async function (userId: any, productId: any) {
  return this.findOneAndUpdate(
    { userId },
    { $addToSet: { products: productId } },
    { new: true, upsert: true },
  );
};

SavedSchema.statics.removeProduct = async function (
  userId: any,
  productId: any,
) {
  return this.findOneAndUpdate(
    { userId },
    { $pull: { products: productId } },
    { new: true },
  );
};

SavedSchema.statics.getPopulated = async function (userId: any) {
  return this.findOne({ userId }).populate({ path: 'products' });
};

SavedSchema.statics.populateOnUser = async function (userId: any) {
  // Dynamic require to avoid potential circular import issues
  const UserModel = require('./userModel').default;
  return UserModel.findById(userId).populate({
    path: 'saved',
    populate: { path: 'products' },
  });
};

const SavedModel =
  (mongoose.models.Saved as SavedModelType) ||
  (model<ISaved, SavedModelType>('Saved', SavedSchema) as SavedModelType);
export default SavedModel;
