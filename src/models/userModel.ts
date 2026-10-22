import mongoose, { Schema } from 'mongoose';

import bcrypt from 'bcryptjs';
import Iuser from '../interfaces/Iuser';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ulid } from 'ulid';
import { slugify } from '../../Utils/slugify';

const userSchema = new Schema<Iuser>(
  {
    userID: { type: String, unique: true, default: ulid },

    name: {
      firstName: { type: String, trim: true, default: '' },
      lastName: { type: String, trim: true, default: '' },
      displayName: { type: String, trim: true, default: '' },
      slug: { type: String, lowercase: true },
    },

    avatar: { type: String },

    active: { type: Boolean, default: true },
    notes: { type: String },

    userInfo: {
      gender: { type: String, trim: true, default: '' },
      nationality: { type: String, trim: true, default: 'Libyan' },
      profilePicture: { type: [String], default: [] },
      dateOfBirth: { type: Schema.Types.Date, default: null },
    },

    role: {
      type: String,
      trim: true,
      default: 'user',
      enum: ['user', 'admin', 'demo', 'driver'],
    },

    // References to other documents
    histories: [{ type: Schema.Types.ObjectId, ref: 'History' }],
    cart: [{ type: Schema.Types.ObjectId, ref: 'Cart' }],
    followedBrands: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
    savedItems: [{ type: Schema.Types.ObjectId, ref: 'Saved' }],
    orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    addresses: [{ type: Schema.Types.ObjectId, ref: 'Address' }],
    licenseID: [{ type: Schema.Types.ObjectId, ref: ' License' }],
    contactInfo: {
      email: {
        value: { type: String, required: true, trim: true, unique: false },
        verified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        verificationCode: { type: String, trim: true },
        verificationCodeExpiresAt: { type: Date },
      },
      phone: {
        countryCode: { type: String, trim: true, default: '+218' },
        value: { type: String, trim: true },
        verified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        verificationCode: { type: String, trim: true },
        verificationCodeExpiresAt: { type: Date },
      },
    },

    isVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now },
    passwordChangedAt: { type: Date },

    password: {
      hashed: { type: String, trim: true },
      expirationDate: { type: Date },
      lastChangedAt: { type: Date },
    },

    passwordReset: {
      otp: { type: String, trim: true },
      expiresAt: { type: Date },
      attempts: { type: Number, default: 0 },
      lockedUntil: { type: Date },
      resetTokenHash: { type: String },
      resetTokenExpiresAt: { type: Date },
    },

    subscriptionID: { type: Schema.Types.ObjectId, ref: 'Subscription' },

    subUsersIDs: {
      type: [{ type: Schema.Types.ObjectId, ref: 'SubUser' }],
      default: [],
      validate: {
        validator: (v: mongoose.Types.ObjectId[]) =>
          Array.isArray(v) &&
          v.every((id) => mongoose.Types.ObjectId.isValid(id)),
        message: 'Each sub user ID must be a valid ObjectId',
      },
    },
    runningTrip: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  },
);

// Sparse unique index for email when present
// userSchema.index(
//   { 'contactInfo.email.value': 1 },
//   { unique: true, sparse: true },
// );

// Virtual to get the Saved list for a user (one-to-one)
userSchema.virtual('saved', {
  ref: 'Saved',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});

// Virtual to get the Follow document for a user (one-to-one)
userSchema.virtual('followed', {
  ref: 'Follow',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});

// Instance method: compare a plaintext password with stored hash
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
) {
  const self: any = this;
  if (!self.password || !self.password.hashed) return false;
  try {
    return await bcrypt.compare(candidatePassword, self.password.hashed);
  } catch (err) {
    return false;
  }
};

// Instance method: generate a password reset token (returns raw token)
// stores a hash and expiry on the document
userSchema.methods.generatePasswordResetToken = async function (opts?: {
  expiresInMinutes?: number;
}) {
  const crypto = await import('crypto');
  const expiresIn = (opts && opts.expiresInMinutes) || 60; // default 60 minutes
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const self: any = this;
  self.passwordReset = self.passwordReset || {};
  self.passwordReset.resetTokenHash = hash;
  self.passwordReset.resetTokenExpiresAt = new Date(
    Date.now() + expiresIn * 60 * 1000,
  );
  await self.save();
  return raw;
};

// Instance method: mark email as verified
userSchema.methods.markEmailVerified = async function () {
  const self: any = this;
  if (!self.contactInfo) self.contactInfo = {};
  if (!self.contactInfo.email) self.contactInfo.email = {};
  self.contactInfo.email.verified = true;
  self.contactInfo.email.verifiedAt = new Date();
  self.isVerified = true;
  await self.save();
  return self;
};

userSchema.pre('save', async function (next) {
  try {
    const self: any = this;

    // Keep slug up to date when name changes or on create
    if (
      self.isNew ||
      self.isModified('name.firstName') ||
      self.isModified('name.lastName') ||
      self.isModified('name.displayName')
    ) {
      const first = self.name?.firstName || '';
      const last = self.name?.lastName || '';
      const display = self.name?.displayName || `${first} ${last}`.trim();
      self.name = self.name || {};
      self.name.displayName = display;
      self.name.slug = slugify(display);
    }

    // Hash password only if a new plaintext (non-bcrypt) value was set/changed
    if (self.isModified('password.hashed')) {
      const current = self.password?.hashed as string | undefined;
      if (current && !current.startsWith('$2')) {
        self.password.hashed = await bcrypt.hash(current, 12);
        self.password.lastChangedAt = new Date();
        self.passwordChangedAt = new Date();
      }
    }

    next();
  } catch (err) {
    next(err as any);
  }
});

const UserModel = mongoose.model<Iuser>('User', userSchema);
export default UserModel;
