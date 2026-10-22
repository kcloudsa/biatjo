import mongoose from 'mongoose';

export function validateBase(data: {
  tripId?: string;
  riderId?: string;
  driverId?: string;
  amount?: number;
}) {
  const { tripId, riderId, driverId, amount } = data;
  if (!tripId) return 'tripId is required';
  if (!riderId) return 'riderId is required';
  if (!driverId) return 'driverId is required';
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0)
    return 'amount must be a positive number';
  if (!mongoose.Types.ObjectId.isValid(tripId)) return 'Invalid tripId format';
  return null;
}
