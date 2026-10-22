import mongoose, { Schema } from 'mongoose';
import { IOffer } from '../interfaces/IOffer';

const OfferSchema = new Schema<IOffer>(
  {
    tripId: { type: String, required: true, index: true },
    riderId: { type: String, required: true },
    driverId: { type: String, required: true },
    amount: { type: Number, required: true },
    role: { type: String, enum: ['driver', 'rider'], required: true },
    status: {
      type: String,
      enum: ['negotiating', 'accepted', 'cancelled'],
      default: 'negotiating',
    },
  },
  { timestamps: true },
);

const OfferModel = mongoose.model<IOffer>('Offer', OfferSchema);
export default OfferModel;
