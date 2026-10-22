import { Document, Types } from 'mongoose';

export enum DegreeEnum {
  Level1 = 1,
  Level2 = 2,
  Level3 = 3,
}

export default interface ILicenses {
  licensePhotoURL?: string[];
  licenseNumber?: string;
  carID: Types.ObjectId; // refs to Car
  degree: DegreeEnum; // enum ref to Degree [1,2,3]
  userId: string; // owner user
  createdAt?: Date;
  updatedAt?: Date;
}
