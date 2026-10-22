import { Schema, model } from 'mongoose';
import { IDriver, IDriverLocation } from '../interfaces/IDriver';
const DriverLocationSchema = new Schema<IDriverLocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);
const GeoLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (val: number[]) => val.length === 2,
        message: 'Coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false },
);

const DriverSchema = new Schema<IDriver>(
  {
    driverId: { type: String, required: true, unique: true, index: true },
    online: { type: Boolean, default: false, index: true },
    lastOnlineAt: { type: Date },
    lastLocation: { type: DriverLocationSchema },
    location: { type: GeoLocationSchema },
    runningTrip: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);
DriverSchema.index({ location: '2dsphere' });
export const Driver = model<IDriver>('Driver', DriverSchema);
