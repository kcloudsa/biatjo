import { Router } from 'express';
import passport from 'passport';
import analyticsServices from '../../services/analyticsServices';

const router = Router();

// Middleware for JWT authentication
const authenticateJWT = (passportInstance: typeof passport) =>
  passportInstance.authenticate('jwt', { session: false });

// GET /api/analytics/overview - Get overview analytics
router.get(
  '/overview',
  authenticateJWT(passport),
  analyticsServices.getOverviewAnalytics,
);

// GET /api/analytics/sales - Get sales analytics
router.get(
  '/sales',
  authenticateJWT(passport),
  analyticsServices.getSalesAnalytics,
);

// GET /api/analytics/users - Get user analytics
router.get(
  '/users',
  authenticateJWT(passport),
  analyticsServices.getUserAnalytics,
);

// GET /api/analytics/products - Get product analytics
router.get(
  '/products',
  authenticateJWT(passport),
  analyticsServices.getProductAnalytics,
);

// GET /api/analytics/brands - Get brand analytics
router.get(
  '/brands',
  authenticateJWT(passport),
  analyticsServices.getBrandAnalytics,
);

export default router;

