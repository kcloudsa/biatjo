import { Document } from 'mongoose';
export interface IOffer extends Document {
  offerId: string;
  tripId: string;
  riderId: string;
  driverId: string;
  amount: number;
  role: 'driver' | 'rider';
  status: 'negotiating' | 'accepted' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}
