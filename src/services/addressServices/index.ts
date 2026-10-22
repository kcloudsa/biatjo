import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import AddressModel from '../../models/addressModel';
import IAddress from '../../interfaces/IAddress';

const assertAdmin = (req: Request) => {
  const role = (req as any).user?.role;
  if (!role || role.toLowerCase() !== 'admin') {
    const err: any = new Error('Admin privileges required');
    err.status = 403;
    throw err;
  }
};

// Self endpoints
export const listMyAddresses = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const docs = await AddressModel.find({ userId }).lean();
  res.status(200).json({ success: true, data: docs });
});

export const getMyAddressById = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const { id } = req.params;
  const doc = await AddressModel.findOne({ _id: id, userId }).lean();
  if (!doc) return void res.status(404).json({ success: false, message: 'Address not found' });
  res.status(200).json({ success: true, data: doc });
});

export const createMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const payload: Partial<IAddress> = req.body || {};
  const created = await AddressModel.create({ ...payload, userId });
  res.status(201).json({ success: true, data: created });
});

export const updateMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const { id } = req.params;
  const updates: Partial<IAddress> = req.body || {};
  // never allow changing owner
  delete (updates as any).userId;
  const updated = await AddressModel.findOneAndUpdate(
    { _id: id, userId },
    updates,
    { new: true, runValidators: true },
  );
  if (!updated) return void res.status(404).json({ success: false, message: 'Address not found' });
  res.status(200).json({ success: true, data: updated });
});

export const deleteMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const { id } = req.params;
  const deleted = await AddressModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) return void res.status(404).json({ success: false, message: 'Address not found' });
  res.status(200).json({ success: true, message: 'Address deleted' });
});

export const setDefaultMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const { id } = req.params;
  const doc = await AddressModel.findOne({ _id: id, userId });
  if (!doc) return void res.status(404).json({ success: false, message: 'Address not found' });
  doc.isDefault = true;
  await doc.save();
  res.status(200).json({ success: true, data: doc });
});

// Admin endpoints
export const adminListAddressesByUser = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);
  const { userId } = req.params;
  const docs = await AddressModel.find({ userId }).lean();
  res.status(200).json({ success: true, data: docs });
});

export const adminCreateAddressForUser = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);
  const { userId } = req.params;
  const payload: Partial<IAddress> = req.body || {};
  const created = await AddressModel.create({ ...payload, userId });
  res.status(201).json({ success: true, data: created });
});

export const adminUpdateAddress = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);
  const { id } = req.params;
  const updates: Partial<IAddress> = req.body || {};
  const updated = await AddressModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!updated) return void res.status(404).json({ success: false, message: 'Address not found' });
  res.status(200).json({ success: true, data: updated });
});

export const adminDeleteAddress = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);
  const { id } = req.params;
  const deleted = await AddressModel.findByIdAndDelete(id);
  if (!deleted) return void res.status(404).json({ success: false, message: 'Address not found' });
  res.status(200).json({ success: true, message: 'Address deleted' });
});

export default {
  listMyAddresses,
  getMyAddressById,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  setDefaultMyAddress,
  adminListAddressesByUser,
  adminCreateAddressForUser,
  adminUpdateAddress,
  adminDeleteAddress,
};
