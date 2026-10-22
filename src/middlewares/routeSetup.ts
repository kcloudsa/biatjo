import { Router } from 'express';
import { requireAuth, validateAuthQuery, addAnalytics, createRateLimit } from './authQuery';

/**
 * Enhanced route setup utility for applying consistent authentication and validation
 * across all API routes that require user context
 */

export const createAuthenticatedRoute = (router: Router) => {
  // Apply authentication to all routes in this router
  router.use(requireAuth);
  return router;
};

export const createSecureGetRoute = (options?: {
  rateLimit?: number;
  allowCrossUserAccess?: boolean;
  maxLimit?: number;
  allowedSortFields?: string[];
  allowedPopulateFields?: string[];
  includeAnalytics?: boolean;
}) => {
  const {
    rateLimit = 2000, // Increased from 1000 to 2000 for development
    allowCrossUserAccess = false,
    maxLimit = 100,
    allowedSortFields = ['createdAt', 'updatedAt'],
    allowedPopulateFields = [],
    includeAnalytics = false
  } = options || {};

  const middleware = [
    createRateLimit(rateLimit),
    validateAuthQuery({
      allowCrossUserAccess,
      maxLimit,
      allowedSortFields,
      allowedPopulateFields
    })
  ];

  if (includeAnalytics) {
    middleware.push(addAnalytics);
  }

  return middleware;
};

export const createSecurePostRoute = (rateLimit: number = 100) => { // Increased from 20 to 100
  return [createRateLimit(rateLimit)];
};

export const createSecurePatchRoute = (rateLimit: number = 150) => { // Increased from 30 to 150
  return [createRateLimit(rateLimit)];
};

export const createSecureDeleteRoute = (rateLimit: number = 50) => { // Increased from 5 to 50
  return [createRateLimit(rateLimit)];
};

/**
 * Pre-configured middleware sets for common use cases
 */
export const middlewareSets = {
  // For listing resources with full query capabilities
  listWithQuery: createSecureGetRoute({
    rateLimit: 1000,
    allowCrossUserAccess: true,
    maxLimit: 200,
    includeAnalytics: true
  }),

  // For simple GET requests without complex querying
  simpleGet: [createRateLimit(1200)],

  // For creating new resources
  create: createSecurePostRoute(20),

  // For updating existing resources
  update: createSecurePatchRoute(30),

  // For deleting resources
  delete: createSecureDeleteRoute(5),

  // For admin-only routes with higher limits
  adminList: createSecureGetRoute({
    rateLimit: 2000,
    allowCrossUserAccess: true,
    maxLimit: 500,
    includeAnalytics: true
  }),

  // For public-like routes (still authenticated but higher limits)
  publicList: createSecureGetRoute({
    rateLimit: 2000,
    maxLimit: 100,
    includeAnalytics: false
  })
};

/**
 * Route validation helpers
 */
export const validateObjectId = (req: any, res: any, next: any, id: string) => {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      code: 'INVALID_ID'
    });
  }
  next();
};

/**
 * Error handling middleware for routes
 */
export const routeErrorHandler = (err: any, req: any, res: any, next: any) => {
  console.error('Route error:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors,
      code: 'VALIDATION_ERROR'
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      code: 'INVALID_ID'
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      code: 'DUPLICATE_ENTRY'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};
