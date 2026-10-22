import multer from 'multer';
import type { Request } from 'express';

const storage = multer.memoryStorage();

const imageFileFilter = (_req: Request, file: any, cb: any) => {
  if (file?.mimetype && /^image\//.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image uploads are allowed'));
};

export const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter as any,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default { uploadImage };
