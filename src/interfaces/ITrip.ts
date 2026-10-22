import { Document } from 'mongoose';
import { CarKindEnum, TransPortTypeEnum } from './ICar';

export type TripStatus =
  | 'requested'
  | 'negotiating'
  | 'accepted'
  | 'driver_on_the_way'
  | 'driver_arrived'
  | 'running'
  | 'completed'
  | 'cancelled';

export interface ILocation {
  lat: number;
  lng: number;
  address?: string;
  updatedAt?: Date;
}

export interface INegotiation {
  driverId: string;
  riderId: string;
  count: number;
  lastOfferBy: 'driver' | 'rider';
  lastAmount: number;
  updatedAt: Date;
}

export interface ITrip extends Document {
  riderId: string;
  negotiations: INegotiation[];
  allLocations: ILocation[];
  driverId?: string;
  pickup: ILocation;
  dropoff: ILocation;
  status: TripStatus;
  fare?: number;
  // currentFareOffer: number;
  negotiationCount: number;
  lastOfferBy: 'rider' | 'driver' | null;
  maxNegotiations: number;
  loadDescription?: string;
  loadWeight?: number;
  carKind?: CarKindEnum;
  transportType?: TransPortTypeEnum;
  isScheduled?: boolean;
  tripTime?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  lastDriverLocation?: ILocation;
}
