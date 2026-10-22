import express from 'express';
import passport from 'passport';
import { authenticateJWT } from '../Auth/middlewares/authenticateJWT';
import { enforceUserOwnership } from '../../middlewares/userIsolation';
import {
  allUsers,
  createUser,
  deleteUser,
  getUserById,
  updateUser,
  changePassword,
  // uploadAvatar,
  getMeData,
} from '../../services/userServices';
import { uploadImage } from '../../middlewares/upload';

const router = express.Router();

// Public: none (keep user data protected)

// Authenticated routes
router.get(
  '/',
  authenticateJWT(passport),
  enforceUserOwnership('user'),
  allUsers,
); // Consider restricting to admin on service side if needed
router.get(
  '/:id',
  // authenticateJWT(passport),
  // enforceUserOwnership('user'),
  getUserById,
);

// Self or admin can update
router.patch(
  '/:id',
  authenticateJWT(passport),
  enforceUserOwnership('user'),
  updateUser,
);

// Password change (self or admin with allowWithoutOld via service logic if needed)
router.post(
  '/:id/change-password',
  authenticateJWT(passport),
  enforceUserOwnership('user'),
  changePassword,
);

// Upload avatar (multipart/form-data with field 'avatar')
router.post(
  '/:id/avatar/upload',
  authenticateJWT(passport),
  enforceUserOwnership('user'),
  uploadImage.single('avatar'),
  // uploadAvatar,
);

// Admin operations (creation/deletion)
router.post('/', authenticateJWT(passport), createUser);
router.delete('/:id', authenticateJWT(passport), deleteUser);

export default router;
