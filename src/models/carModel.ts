import mongoose, { Schema, model, Model } from 'mongoose';
import ICar, { TransPortTypeEnum } from '../interfaces/ICar';

const CarSchema = new Schema<ICar>(
  {
    carPhotoURL: {
      type: [String],
      required: false,
    },
    TransPortType: {
      type: Number,
      enum: [
        TransPortTypeEnum.heavy,
        TransPortTypeEnum.middle,
        TransPortTypeEnum.light,
        TransPortTypeEnum.tools,
      ],
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    carModel: {
      type: String,
    },
    carColor: {
      type: String,
    },
    carYear: {
      type: Number,
    },
    carLoadCapacity: {
      type: Number,
    },
    carManufacture: {
      type: String,
    },
    plateNum: {
      type: String,
      required: true,
    },
    carKind: {
      type: String,
      enum: [
        'truck',
        'hafza',
        'star',
        'talaga',
        'betena',
        'qlapa',
        'grar',
        'dnbr',
        'noQlapa',
      ],
    },
  },
  { timestamps: true },
);

// Optional: prevent duplicate Car by same user for same plateNum
CarSchema.index({ plateNum: 1, userId: 1 }, { unique: false });

const CarModel =
  (mongoose.models.Car as Model<ICar>) || model<ICar>('Car', CarSchema);
export default CarModel;
