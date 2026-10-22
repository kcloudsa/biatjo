import mongoose, { Schema, model, Model } from 'mongoose';
import ICollection from '../interfaces/ICollection';

const CollectionSchema = new Schema<ICollection>(
  {
    title: { type: String, required: true, trim: true },
    image: { type: String },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
  },
  { timestamps: true },
);

interface CollectionModelType extends Model<ICollection> {
  getWithProducts(id: any): Promise<ICollection | null>;
}

CollectionSchema.statics.getWithProducts = async function (id: any) {
  return this.findById(id).populate({ path: 'products' });
};

const CollectionModel =
  (mongoose.models.Collection as CollectionModelType) ||
  (model<ICollection, CollectionModelType>(
    'Collection',
    CollectionSchema,
  ) as CollectionModelType);
export default CollectionModel;
