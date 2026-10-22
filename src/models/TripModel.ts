import { Schema, model } from 'mongoose';
import { ILocation, ITrip } from '../interfaces/ITrip';
import { TransPortTypeEnum } from '../interfaces/ICar';
const LocationSchema = new Schema<ILocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
/*
loadDescription : String?
loadWeight:double?
carKind: String?
transportType:String?
isScheduled:Boolean?
tripTime: long?
*/

const TripSchema = new Schema<ITrip>(
  {
    riderId: { type: String, required: true, index: true },
    driverId: { type: String, index: true },
    pickup: { type: LocationSchema, required: true },
    dropoff: { type: LocationSchema, required: true },
    negotiations: [
      {
        driverId: { type: String, required: true },
        riderId: { type: String, required: true },
        count: { type: Number, default: 0 },
        lastOfferBy: { type: String, enum: ['driver', 'rider'] },
        lastAmount: { type: Number },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    // currentFareOffer: { type: Number, default: 0 }, // current price on the table
    negotiationCount: { type: Number, default: 0 }, // how many offers made
    // lastOfferBy: {
    //   type: String,
    //   enum: ['rider', 'driver', null],
    //   default: null,
    // },
    maxNegotiations: { type: Number, default: 3 },
    status: {
      type: String,
      enum: [
        'requested',
        'accepted',
        'negotiating',
        'driver_on_the_way',
        'driver_arrived',
        'running',
        'completed',
        'cancelled',
      ],
      default: 'requested',
      index: true,
    },
    fare: { type: Number },
    loadDescription: { type: String },
    loadWeight: { type: Number },
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
    transportType: {
      type: Number,
      enum: [
        TransPortTypeEnum.heavy,
        TransPortTypeEnum.middle,
        TransPortTypeEnum.light,
        TransPortTypeEnum.tools,
      ],
    },
    allLocations: { type: [LocationSchema], default: [] },
    isScheduled: { type: Boolean, default: false },
    tripTime: { type: Number, default: Date.now },
    completedAt: { type: Date },

    lastDriverLocation: { type: LocationSchema },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  },
);

export const Trip = model<ITrip>('Trip', TripSchema);
