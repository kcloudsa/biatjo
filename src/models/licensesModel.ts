import mongoose, { Schema, model, Model } from 'mongoose';
import ILicenses, { DegreeEnum } from '../interfaces/ILicenses';

const LicenseSchema = new Schema<ILicenses>(
  {
    licensePhotoURL: {
      type: [String],
    },
    carID: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Car',
        index: true,
      },
    ],
    degree: {
      type: Number,
      enum: [DegreeEnum.Level1, DegreeEnum.Level2, DegreeEnum.Level3], // 1,2,3
      required: false,
    },
    licenseNumber: {
      type: String,
    },
    userId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// Optional: prevent duplicate License by same user for same carID
LicenseSchema.index({ carID: 1, userId: 1 }, { unique: false });

const LicenseModel =
  (mongoose.models.License as Model<ILicenses>) ||
  model<ILicenses>('License', LicenseSchema);
export default LicenseModel;
