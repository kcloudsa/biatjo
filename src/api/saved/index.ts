import express from 'express';
import passport from 'passport';
import { authenticateJWT } from '../Auth/middlewares/authenticateJWT';
// import {
//   addToMySaved,
//   adminAddToSaved,
//   adminGetSavedByUser,
//   adminRemoveFromSaved,
//   clearMySaved,
//   getMySaved,
//   removeFromMySaved,
// } from '../../services/savedServices';

const router = express.Router();

// All routes require JWT
router.use(authenticateJWT(passport));

// Self endpoints
// router.get('/me', getMySaved);
// router.post('/me', addToMySaved); // body: { productId }
// router.delete('/me', removeFromMySaved); // body: { productId }
// router.post('/me/clear', clearMySaved);

// // Admin endpoints
// router.get('/user/:userId', adminGetSavedByUser);
// router.post('/user/:userId', adminAddToSaved);
// router.delete('/user/:userId', adminRemoveFromSaved);

export default router;
