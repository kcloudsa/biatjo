import { Schema, model } from 'mongoose';

const MapInfoSchema = new Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    placeId: { type: String },
    formattedAddress: { type: String },
    streetNumber: { type: String },
    route: { type: String },
    neighborhood: { type: String },
    postalCode: { type: String },
    country: { type: String },
    state: { type: String },
    city: { type: String },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: { type: String, enum: ['home', 'work', 'other'], default: 'other' },
    label: { type: String },
    isDefault: { type: Boolean, default: false },

    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String },

    map: { type: MapInfoSchema },

    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },

    deliveryInstructions: { type: String },
    isVerified: { type: Boolean, default: false },

    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// When an address is saved with isDefault=true, unset isDefault on other addresses for the same user.
AddressSchema.pre('save', async function (next) {
  // Only run when isDefault is true and it was modified
  // @ts-ignore
  if (this.isDefault) {
    try {
      // @ts-ignore
      await (this.constructor as any).updateMany(
        { userId: this.userId, _id: { $ne: this._id }, isDefault: true },
        { $set: { isDefault: false } },
      );
    } catch (err) {
      return next(err as any);
    }
  }
  next();
});

// Optional: keep a compound unique index to prevent duplicates of identical address lines for same user
AddressSchema.index(
  { userId: 1, addressLine1: 1, addressLine2: 1, postalCode: 1 },
  { unique: false },
);

const AddressModel = model('Address', AddressSchema);

export default AddressModel;
