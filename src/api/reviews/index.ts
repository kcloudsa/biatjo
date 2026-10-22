import express from 'express';
import passport from 'passport';
import { authenticateJWT } from '../Auth/middlewares/authenticateJWT';
// import {
//   createReview,
//   deleteReview,
//   getReviewById,
//   listReviews,
//   updateReview,
//   listReviewsByBrand,
//   listReviewsByProduct,
// } from '../../services/reviewServices';

const router = express.Router();

// // Public
// router.get('/', listReviews);
// // Get reviews by brand id (denormalized brandId on reviews)
// router.get('/brand/:brandId', listReviewsByBrand);
// router.get('/product/:productId', listReviewsByProduct);
// router.get('/:id', getReviewById);

// // Protected
// router.post('/', authenticateJWT(passport), createReview);
// router.patch('/:id', authenticateJWT(passport), updateReview);
// router.delete('/:id', authenticateJWT(passport), deleteReview);

export default router;
