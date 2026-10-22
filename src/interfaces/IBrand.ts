import { Document, Types } from 'mongoose';

export interface IBrandLink {
  title: string;
  link: string;
}

export default interface IBrand extends Document {
  brandID: string; // user-provided unique identifier (e.g. "golden-shaco")
  name: string;
  description?: string;
  cover?: string; // URL to cover image
  logo?: string; // URL to logo
  more?: IBrandLink[]; // list of links (policy, social pages, etc.)
  collections?: Types.ObjectId[]; // refs to Collection model
  categories?: Types.ObjectId[]; // refs to Category model
  rating?: number; // average rating
  followersCount?: number; // number of followers
  products?: Types.ObjectId[]; // refs to Product model
  active?: boolean;
  // owner: the user that created/owns this brand in our system (null if it's a global Shopify-synced brand)
  owner?: Types.ObjectId;
  // owner: the user that created/owns this brand in our system
  // (if omitted, brand is considered global/local without explicit owner)
  createdAt?: Date;
  updatedAt?: Date;
}
