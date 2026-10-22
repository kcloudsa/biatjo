import mongoose, { Schema, model, Model } from 'mongoose';
import IFollow from '../interfaces/IFollow';

const FollowSchema = new Schema<IFollow>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    brands: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
  },
  { timestamps: true },
);

// Ensure one follow document per user
FollowSchema.index({ userId: 1 }, { unique: true });

// Normalize brands to be unique on save (defensive against direct mutations)
FollowSchema.pre('save', function (next) {
  try {
    const self: any = this;
    if (Array.isArray(self.brands)) {
      const uniq = Array.from(new Set(self.brands.map((p: any) => String(p))));
      self.brands = uniq as any;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

interface FollowModelType extends Model<IFollow> {
  upsertForUser(userId: any): Promise<IFollow>;
  addBrand(userId: any, brandId: any): Promise<IFollow>;
  removeBrand(userId: any, brandId: any): Promise<IFollow | null>;
  getPopulated(userId: any): Promise<IFollow | null>;
  populateOnUser(userId: any): Promise<any>;
}

FollowSchema.statics.upsertForUser = async function (userId: any) {
  return this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, brands: [] } },
    { new: true, upsert: true },
  );
};

FollowSchema.statics.addBrand = async function (userId: any, brandId: any) {
  return this.findOneAndUpdate(
    { userId },
    { $addToSet: { brands: brandId } },
    { new: true, upsert: true },
  );
};

FollowSchema.statics.removeBrand = async function (userId: any, brandId: any) {
  return this.findOneAndUpdate(
    { userId },
    { $pull: { brands: brandId } },
    { new: true },
  );
};

FollowSchema.statics.getPopulated = async function (userId: any) {
  return this.findOne({ userId }).populate({ path: 'brands' });
};

FollowSchema.statics.populateOnUser = async function (userId: any) {
  const UserModel = require('./userModel').default;
  return UserModel.findById(userId).populate({
    path: 'followed',
    populate: { path: 'brands' },
  });
};

const FollowModel =
  (mongoose.models.Follow as FollowModelType) ||
  (model<IFollow, FollowModelType>('Follow', FollowSchema) as FollowModelType);

export default FollowModel;
