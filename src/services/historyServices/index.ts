import expressAsyncHandler from 'express-async-handler';
import { Request, Response, NextFunction } from 'express';
import type { PassportStatic } from 'passport';
import HistoryModel from '../../models/historyModel';
import ProductModel from '../../models/productModel';

export const getMyHistory = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { type, limit } = req.query as any;
  const items = await (HistoryModel as any).listRecentViews(user._id || user.id, {
    type,
    limit: limit ? Number(limit) : undefined,
  });

  // If filtering for products, fetch the actual product data
  if (!type || type === 'product') {
    const productIds = items
      .filter((item: any) => item.item?.type === 'product' && item.item?.id)
      .map((item: any) => item.item.id);

    if (productIds.length > 0) {
      const products = await ProductModel.find({ _id: { $in: productIds } })
        .populate('brand')
        .lean()
        .exec();

      // Create a map for quick lookup
      const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

      // Return products in the order of recently viewed, filtering out any that no longer exist
      const orderedProducts = items
        .filter((item: any) => item.item?.type === 'product')
        .map((item: any) => productMap.get(item.item.id.toString()))
        .filter(Boolean);

      res.status(200).json({ success: true, data: orderedProducts });
      return;
    }
  }

  res.status(200).json({ success: true, data: items });
});

export const clearMyHistory = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const out = await (HistoryModel as any).clearForUser(user._id || user.id);
  res.status(200).json({ success: true, deleted: out?.deletedCount ?? 0 });
});

export const adminGetHistoryByUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as any;
  const { type, limit } = req.query as any;
  const items = await (HistoryModel as any).listRecentViews(userId, {
    type,
    limit: limit ? Number(limit) : undefined,
  });
  res.status(200).json({ success: true, data: items });
});

export const createHistoryEntry = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const payload = req.body || {};
  const doc = await HistoryModel.create({
    userId: user._id || user.id,
    action: payload.action || 'view',
    item: payload.item,
    diff: payload.diff,
    reason: payload.reason,
    performedBy: payload.performedBy || { userId: user._id || user.id, role: user.role },
  });
  res.status(201).json({ success: true, data: doc });
});

export const deleteHistoryEntry = expressAsyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as any;
  const out = await HistoryModel.findByIdAndDelete(id);
  res.status(200).json({ success: true, deleted: !!out });
});

// Middleware utilities
export const optionalAuthenticateJWT =
  (passport: PassportStatic) => (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (_err: any, user: any) => {
      if (user) (req as any).user = user;
      return next();
    })(req, res, next);
  };

export const recordRecentView =
  (itemType: 'product' | 'brand' | 'other') =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const itemId = (req.params as any).id;
      if (user && itemId) {
        await (HistoryModel as any).recordView(user._id || user.id, itemId, itemType, {
          userId: user._id || user.id,
          role: user.role,
        });
      }
    } catch (_e) {
      // swallow
    }
    next();
  };

export default {
  getMyHistory,
  clearMyHistory,
  adminGetHistoryByUser,
  createHistoryEntry,
  deleteHistoryEntry,
  optionalAuthenticateJWT,
  recordRecentView,
};
