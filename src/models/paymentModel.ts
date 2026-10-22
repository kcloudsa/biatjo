import mongoose, { Schema, model } from 'mongoose';
import IPayment, {
  PaymentCurrency,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '../interfaces/IPayment';

// Use a looser schema generic to accommodate Decimal128 typings while exposing IPayment at the model level
const PaymentSchema = new Schema<any>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // use Decimal128 with a getter; cast to any to satisfy TS for Decimal128
    amount: {
      type: Schema.Types.Decimal128 as any,
      required: true,
      get: (v: any) => (v ? parseFloat(v.toString()) : 0),
    },
    currency: {
      type: String,
      enum: ['SAR'] satisfies PaymentCurrency[],
      default: 'SAR',
    },
    status: {
      type: String,
      enum: [
        'initiated',
        'pending',
        'paid',
        'failed',
        'canceled',
      ] satisfies PaymentStatus[],
      default: 'initiated',
      index: true,
    },
    method: {
      type: String,
      enum: ['card', 'wallet', 'bank'] satisfies PaymentMethod[],
      required: true,
    },
    provider: {
      type: String,
      enum: ['Paymob'] satisfies PaymentProvider[],
      default: 'Paymob',
    },

    providerTransactionId: { type: String, index: true },
    transactionDate: { type: Date },
    callbackData: { type: Schema.Types.Mixed },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } },
);

// Helpful compound index for provider tracking queries
PaymentSchema.index(
  { provider: 1, providerTransactionId: 1 },
  { unique: false, sparse: true },
);

const PaymentModel =
  (mongoose.models.Payment as mongoose.Model<IPayment>) ||
  model<IPayment>('Payment', PaymentSchema);
export default PaymentModel;
