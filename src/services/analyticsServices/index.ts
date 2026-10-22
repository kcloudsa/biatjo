import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import UserModel from '../../models/userModel';
import ProductModel from '../../models/productModel';
import OrderModel from '../../models/orderModel';
import BrandModel from '../../models/brandModel';
import ReviewModel from '../../models/reviewModel';
import SavedModel from '../../models/savedModel';
import FollowModel from '../../models/followModel';

// Helper: admin-only check
const assertAdmin = (req: Request) => {
  const role = (req as any).user?.role;
  if (!role || role.toLowerCase() !== 'admin') {
    const err: any = new Error('Admin privileges required');
    err.status = 403;
    throw err;
  }
};

// GET /api/analytics/overview
export const getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);

  const { period = '30' } = req.query; // days
  const days = parseInt(period as string) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Parallel queries for efficiency
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    totalBrands,
    activeUsers,
    totalRevenue,
    recentUsers,
    recentOrders,
    topBrands,
    topProducts,
  ] = await Promise.all([
    UserModel.countDocuments(),
    ProductModel.countDocuments(),
    OrderModel.countDocuments(),
    BrandModel.countDocuments(),
    UserModel.countDocuments({ lastLogin: { $gte: cutoffDate } }),
    OrderModel.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    UserModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('userID username email role createdAt avatar')
      .lean(),
    OrderModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username email')
      .lean(),
    BrandModel.find()
      .sort({ followersCount: -1 })
      .limit(10)
      .select('brandID name logo followersCount rating')
      .lean(),
    ReviewModel.aggregate([
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      { $sort: { avgRating: -1, reviewCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ]),
  ]);

  const revenue = totalRevenue[0]?.total || 0;

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalBrands,
        activeUsers,
        totalRevenue: revenue,
        averageOrderValue: totalOrders > 0 ? revenue / totalOrders : 0,
      },
      recentUsers,
      recentOrders,
      topBrands,
      topProducts,
    },
  });
});

// GET /api/analytics/sales
export const getSalesAnalytics = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);

  const { period = '30' } = req.query;
  const days = parseInt(period as string) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Sales over time (daily aggregation)
  const salesOverTime = await OrderModel.aggregate([
    { $match: { isPaid: true, createdAt: { $gte: cutoffDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        totalSales: { $sum: '$totalPrice' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  // Order status breakdown
  const ordersByStatus = await OrderModel.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Revenue by payment method
  const revenueByPaymentMethod = await OrderModel.aggregate([
    { $match: { isPaid: true } },
    {
      $group: {
        _id: '$payment.method',
        totalRevenue: { $sum: '$totalPrice' },
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      salesOverTime,
      ordersByStatus,
      revenueByPaymentMethod,
    },
  });
});

// GET /api/analytics/users
export const getUserAnalytics = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);

  const { period = '30' } = req.query;
  const days = parseInt(period as string) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // User growth over time
  const userGrowth = await UserModel.aggregate([
    { $match: { createdAt: { $gte: cutoffDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        newUsers: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  // Users by role
  const usersByRole = await UserModel.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
      },
    },
  ]);

  // Active vs inactive users
  const activeVsInactive = await UserModel.aggregate([
    {
      $group: {
        _id: '$active',
        count: { $sum: 1 },
      },
    },
  ]);

  // Users with most orders
  const topCustomers = await UserModel.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'userId',
        as: 'orders',
      },
    },
    {
      $addFields: {
        orderCount: { $size: '$orders' },
        totalSpent: {
          $sum: {
            $map: {
              input: { $filter: { input: '$orders', as: 'order', cond: { $eq: ['$$order.isPaid', true] } } },
              as: 'paidOrder',
              in: '$$paidOrder.totalPrice',
            },
          },
        },
      },
    },
    { $match: { orderCount: { $gt: 0 } } },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
    {
      $project: {
        userID: 1,
        username: 1,
        email: '$contactInfo.email.value',
        orderCount: 1,
        totalSpent: 1,
        avatar: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      userGrowth,
      usersByRole,
      activeVsInactive,
      topCustomers,
    },
  });
});

// GET /api/analytics/products
export const getProductAnalytics = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);

  // Product performance
  const topSellingProducts = await OrderModel.aggregate([
    { $match: { isPaid: true } },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.productId',
        totalSold: { $sum: '$orderItems.quantity' },
        totalRevenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        title: '$product.title',
        images: '$product.images',
        totalSold: 1,
        totalRevenue: 1,
      },
    },
  ]);

  // Most reviewed products
  const mostReviewedProducts = await ReviewModel.aggregate([
    {
      $group: {
        _id: '$productId',
        reviewCount: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    { $sort: { reviewCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        title: '$product.title',
        images: '$product.images',
        reviewCount: 1,
        avgRating: 1,
      },
    },
  ]);

  // Most saved products
  const mostSavedProducts = await SavedModel.aggregate([
    { $unwind: '$products' },
    {
      $group: {
        _id: '$products',
        saveCount: { $sum: 1 },
      },
    },
    { $sort: { saveCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        title: '$product.title',
        images: '$product.images',
        saveCount: 1,
      },
    },
  ]);

  // Products by category/brand
  const productsByBrand = await ProductModel.aggregate([
    {
      $group: {
        _id: '$brand',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'brands',
        localField: '_id',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        brandId: '$_id',
        brandName: '$brand.name',
        productCount: '$count',
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      topSellingProducts,
      mostReviewedProducts,
      mostSavedProducts,
      productsByBrand,
    },
  });
});

// GET /api/analytics/brands
export const getBrandAnalytics = asyncHandler(async (req: Request, res: Response) => {
  assertAdmin(req);

  // Most followed brands
  const mostFollowedBrands = await FollowModel.aggregate([
    { $unwind: '$brands' },
    {
      $group: {
        _id: '$brands',
        followerCount: { $sum: 1 },
      },
    },
    { $sort: { followerCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'brands',
        localField: '_id',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: '$brand' },
    {
      $project: {
        brandId: '$_id',
        name: '$brand.name',
        logo: '$brand.logo',
        followerCount: 1,
        rating: '$brand.rating',
      },
    },
  ]);

  // Top rated brands (based on product reviews)
  const topRatedBrands = await ReviewModel.aggregate([
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.brand',
        avgRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
    { $match: { reviewCount: { $gte: 5 } } }, // Only brands with 5+ reviews
    { $sort: { avgRating: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'brands',
        localField: '_id',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        brandId: '$_id',
        name: '$brand.name',
        logo: '$brand.logo',
        avgRating: 1,
        reviewCount: 1,
      },
    },
  ]);

  // Brand revenue
  const brandRevenue = await OrderModel.aggregate([
    { $match: { isPaid: true } },
    { $unwind: '$orderItems' },
    {
      $lookup: {
        from: 'products',
        localField: 'orderItems.productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$product.brand',
        totalRevenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'brands',
        localField: '_id',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        brandId: '$_id',
        name: '$brand.name',
        logo: '$brand.logo',
        totalRevenue: 1,
        orderCount: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      mostFollowedBrands,
      topRatedBrands,
      brandRevenue,
    },
  });
});

export default {
  getOverviewAnalytics,
  getSalesAnalytics,
  getUserAnalytics,
  getProductAnalytics,
  getBrandAnalytics,
};

