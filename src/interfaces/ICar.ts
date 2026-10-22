import { Document, Types } from 'mongoose';

export enum TransPortTypeEnum {
  heavy = 1,
  middle = 2,
  light = 3,
  tools = 4,
}
export enum CarKindEnum {
  truck = 'truck',
  hafza = 'hafza',
  star = 'star',
  talaga = 'talaga',
  betena = 'betena',
  qlapa = 'qlapa',
  grar = 'grar',
  dnbr = 'dnbr',
  noQlapa = 'noQlapa',
}
export default interface ICar extends Document {
  carPhotoURL?: string[];
  TransPortType: TransPortTypeEnum;
  carModel?: string;
  carColor?: string;
  carYear?: number;
  carLoadCapacity?: number;
  carManufacture?: string;
  plateNum: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
  carKind?: CarKindEnum;
}
