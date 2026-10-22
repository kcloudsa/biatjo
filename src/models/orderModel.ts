import mongoose, { Schema, model, Model } from 'mongoose';
import IOrder, { IOrderStatusEntry } from '../interfaces/IOrder';

const OrderStatusSchema = new Schema<IOrderStatusEntry>(
  {
    step: { type: String, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String },
    code: { type: Number },
  },
  { _id: false },
);

const PaymentSchema = new Schema(
  {
    method: { type: String },
    methodType: { type: String },
    transactionId: { type: String },
    paidAmount: { type: Number },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cartId: { type: Schema.Types.ObjectId, ref: 'Cart' },
    shippingAddressId: { type: Schema.Types.ObjectId, ref: 'Address' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },

    // Snapshot of order items copied from cart at creation time
    orderItems: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        title: { type: String },
        price: { type: Number },
        currency: { type: String },
        quantity: { type: Number },
        keys: [
          {
            key: { type: String },
            value: { type: String },
            qty: { type: Number },
          },
        ],
      },
    ],

    // Snapshot of the address used for shipping at creation
    shippingSnapshot: {
      firstName: { type: String },
      lastName: { type: String },
      phone: { type: String },
      addressLine1: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
      map: { type: Schema.Types.Mixed },
    },

    taxPrice: { type: Number, default: 0, min: 0 },
    shippingPrice: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },

    payment: { type: PaymentSchema },
    paidAt: { type: Date },
    isPaid: { type: Boolean, default: false },

    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },

    shipment: {
      carrier: { type: String },
      trackingNumber: { type: String },
      estimatedDelivery: { type: Date },
      isDelivered: { type: Boolean, default: false },
      deliveredAt: { type: Date },
    },

    status: { type: String, default: 'placed', enum: ['placed', 'packed', 'in_warehouse', 'shipped', 'delivered'] },
    statusCode: { type: Number, default: 1 },
    statusHistory: { type: [OrderStatusSchema], default: [] },
  },
  { timestamps: true },
);

// Add a status history entry and set status
interface OrderModelType extends Model<IOrder> {
  addStatus(orderId: any, entry: IOrderStatusEntry): Promise<IOrder | null>;
}

OrderSchema.statics.addStatus = async function (
  orderId: any,
  entry: IOrderStatusEntry,
) {
  const order = await this.findById(orderId);
  if (!order) return null;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push(entry);
  order.status = entry.step;
  if (typeof entry.code === 'number') order.statusCode = entry.code;
  await order.save();
  return order;
};

// When an order is paid, record purchases for each cart item into PurchasedItem collection
async function recordPurchasesForOrder(order: any) {
  try {
    if (!order || !order.isPaid) return;
    // use mongoose.models to avoid circular imports
    const Purchased = mongoose.models.PurchasedItem;
    const Cart = mongoose.models.Cart;
    const Product = mongoose.models.Product;
    if (!Purchased || !Cart) return;

    // need cart items
    const cart = await Cart.findById(order.cartId).populate({
      path: 'items.product',
    });
    if (!cart || !Array.isArray(cart.items)) return;

    for (const item of cart.items) {
      const product = item.product;
      const productId = product?._id || item.product;

      // compute quantity as sum of keys.qty or default 1
      let qty = 0;
      if (Array.isArray(item.keys) && item.keys.length) {
        qty = item.keys.reduce((s: number, k: any) => s + (k.qty || 0), 0);
      }
      if (qty === 0) qty = 1;

      // determine price: prefer product.price.amount if available, otherwise try to estimate
      let price = 0;
      let currency = 'USD';
      if (
        product &&
        product.price &&
        typeof product.price.amount === 'number'
      ) {
        price = product.price.amount;
        currency = product.price.currency || currency;
      } else if (typeof order.totalPrice === 'number') {
        // fallback: estimate per-item price by splitting order total by number of cart items
        const itemCount = cart.items.length || 1;
        price = (order.totalPrice || 0) / itemCount;
      }

      // avoid duplicate snapshots for same order
      const existing = await Purchased.findOne({
        userId: order.userId,
        productId,
        'snapshots.metadata.orderId': order._id,
      });
      if (existing) continue;

      const snapshot = {
        price,
        currency,
        quantity: qty,
        metadata: {
          orderId: order._id,
          cartItemId: item._id,
          keys: item.keys || [],
        },
        purchasedAt: order.paidAt || new Date(),
      };
      await (Purchased as any).addSnapshot(
        order.userId,
        productId,
        snapshot as any,
      );
    }
  } catch (err) {
    // swallow errors; consider logging in production
  }
}

// Trigger purchase recording when order is saved and isPaid is true
OrderSchema.post('save', async function (doc: any) {
  try {
    await recordPurchasesForOrder(doc);
  } catch (err) {}
});

OrderSchema.post('findOneAndUpdate', async function (doc: any) {
  try {
    // doc is the post-update document
    await recordPurchasesForOrder(doc);
  } catch (err) {}
});

// Pre-save: if the order is new, snapshot cart items and shipping address into the order
OrderSchema.pre('save', async function (next: any) {
  try {
    // @ts-ignore
    const self: any = this;
    if (!self.isNew) return next();

    const Cart = mongoose.models.Cart;
    const Address = mongoose.models.Address;
    if (self.cartId && Cart) {
      const cart = await Cart.findById(self.cartId).populate({
        path: 'items.product',
      });
      if (cart && Array.isArray(cart.items)) {
        self.orderItems = cart.items.map((it: any) => ({
          productId: it.product?._id || it.product,
          title: it.product?.title || undefined,
          price: it.product?.price?.amount || undefined,
          currency: it.product?.price?.currency || undefined,
          quantity:
            Array.isArray(it.keys) && it.keys.length
              ? it.keys.reduce((s: number, k: any) => s + (k.qty || 0), 0)
              : 1,
          keys: it.keys || [],
        }));
      }
    }

    if (self.shippingAddressId && Address) {
      const addr = await Address.findById(self.shippingAddressId);
      if (addr) {
        self.shippingSnapshot = {
          firstName: addr.firstName,
          lastName: addr.lastName,
          phone: addr.phone,
          addressLine1: addr.addressLine1,
          addressLine2: addr.addressLine2,
          city: addr.city,
          state: addr.state,
          country: addr.country,
          postalCode: addr.postalCode,
          map: addr.map,
        };
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

const OrderModel =
  (mongoose.models.Order as OrderModelType) ||
  (model<IOrder, OrderModelType>('Order', OrderSchema) as OrderModelType);
export default OrderModel;
