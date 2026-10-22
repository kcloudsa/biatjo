import { Document, Types } from 'mongoose';

// User-centric history entries. Each document represents one history event
// related to a user (views, password changes, email verification, login, etc.)
export interface IHistory extends Document {
  userId: Types.ObjectId; // the user this history belongs to
  action:
    | 'view'
    | 'password_changed'
    | 'email_verified'
    | 'login'
    | 'create'
    | 'update'
    | 'delete'
    | 'restore';
  timestamp: Date;
  performedBy?: {
    userId?: Types.ObjectId; // who performed the action (could be same user or admin)
    name?: string;
    role?: string;
  };
  // Optional reference to the item that was viewed (product/brand/etc.)
  item?: { id: Types.ObjectId; type: 'product' | 'brand' | 'other' };
  diff?: Record<string, any> | null;
  reason?: string | null;
}
