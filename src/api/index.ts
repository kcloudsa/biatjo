import express from 'express';
import MessageResponse from '../interfaces/MessageResponse';
import apiKey from './apiKey';
// import brandsAPI from './brands';
// import productsAPI from './product';
import usersAPI from './users';
import savedAPI from './saved';
import reviewsAPI from './reviews';
// import cartAPI from './cart';
// import addressesAPI from './addresses';
import purchasedItemsAPI from './purchased-items';
// import ordersAPI from './orders';
// import categoryAPI from './category';
// import collectionAPI from './collection';
// import historyAPI from './history';
// import followAPI from './follow';
import searchAPI from './search';
import analyticsAPI from './analytics';
import { routeErrorHandler } from '../middlewares/routeSetup';
import passport from 'passport';
import { authenticateJWT } from './Auth/middlewares/authenticateJWT';
import { enforceUserOwnership } from '../middlewares/userIsolation';
import { getMeData } from '../services/userServices';

const router = express.Router();

router.get<{}, MessageResponse>('/', (req, res) => {
  res.json({
    message: 'API - 👋🌎🌍🌏',
  });
});

// API routes
router.use('/apikeys', apiKey);
// router.use('/brands', brandsAPI);
// router.use('/products', productsAPI);
router.use('/saved', savedAPI);
// router.use('/follow', followAPI);
router.use('/reviews', reviewsAPI);
// router.use('/cart', cartAPI);
// router.use('/addresses', addressesAPI);
router.use('/purchased-items', purchasedItemsAPI);
// router.use('/orders', ordersAPI);
router.use('/users', usersAPI);
// router.use('/category', categoryAPI);/
// router.use('/collection', collectionAPI);
// router.use('/history', historyAPI);
router.use('/search', searchAPI);
router.use('/analytics', analyticsAPI);
router.get(
  '/me',
  authenticateJWT(passport),
  enforceUserOwnership('user'),
  getMeData,
);

// Global error handler for all API routes
router.use(routeErrorHandler);

export default router;
