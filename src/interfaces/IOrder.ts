import { Document, Types } from 'mongoose';

export type OrderStatusStep =
  | 'placed'
  | 'packed'
  | 'in_warehouse'
  | 'shipped'
  | 'delivered';

export interface IOrderStatusEntry {
  step: OrderStatusStep;
  at?: Date;
  note?: string;
  code?: number; // numeric step code for frontend
}

export interface IOrderPayment {
  method?: string; // e.g. card, paypal
  methodType?: string; // e.g. credit_card, debit_card
  transactionId?: string;
  paidAmount?: number;
}

export interface IOrderItemKey {
  key: string;
  value: string;
  qty?: number;
}

export interface IOrderItem {
  productId: Types.ObjectId;
  title?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  keys?: IOrderItemKey[];
}

export interface IAddressSnapshot {
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  map?: any;
}

export interface IOrderShipment {
  carrier?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  isDelivered?: boolean;
  deliveredAt?: Date;
}

export default interface IOrder extends Document {
  userId: Types.ObjectId;
  cartId?: Types.ObjectId; // ref to Cart
  shippingAddressId?: Types.ObjectId; // ref to Address
  paymentId?: Types.ObjectId; // ref to Payment
  orderItems?: IOrderItem[]; // snapshot of items at purchase time
  shippingSnapshot?: IAddressSnapshot; // snapshot of shipping address at purchase time
  taxPrice?: number;
  shippingPrice?: number;
  totalPrice?: number;
  payment?: IOrderPayment;
  paidAt?: Date;
  isPaid?: boolean;
  isDelivered?: boolean;
  deliveredAt?: Date;
  shipment?: IOrderShipment;
  status?: OrderStatusStep;
  statusCode?: number;
  statusHistory?: IOrderStatusEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}
