import express from 'express';
import passport from 'passport';
import { authenticateJWT } from '../Auth/middlewares/authenticateJWT';
// import { addSnapshot, getPurchasedById, listPurchased } from '../../services/purchasedItemServices';

const router = express.Router();

// Public listing is not appropriate; require auth for all to protect user privacy
router.use(authenticateJWT(passport));

// router.get('/', listPurchased); // supports ?mine=true or ?userId=... (admin) and ?productId=...
// router.get('/:id', getPurchasedById); // self or admin
// router.post('/', addSnapshot); // self (own user) or admin can specify userId

export default router;
