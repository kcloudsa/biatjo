import express from 'express';
// import passport from 'passport';
// import { authenticateJWT } from '../Auth/middlewares/authenticateJWT';
// import {
//   addOrderStatus,
//   createOrder,
//   deleteOrder,
//   getOrderById,
//   listOrders,
//   updateOrder,
// } from '../../services/orderServices';

// const router = express.Router();

// // List orders: requires auth; non-admins only see their own
// router.get('/', authenticateJWT(passport), listOrders);

// // Get order by id: requires auth (self-or-admin handled in service)
// router.get('/:id', authenticateJWT(passport), getOrderById);

// // Create order: requires auth
// router.post('/', authenticateJWT(passport), createOrder);

// // Admin modifications
// router.patch('/:id', authenticateJWT(passport), updateOrder);
// router.delete('/:id', authenticateJWT(passport), deleteOrder);
// router.post('/:id/status', authenticateJWT(passport), addOrderStatus);

// export default router;
