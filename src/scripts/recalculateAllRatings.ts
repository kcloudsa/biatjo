/**
 * Script to recalculate ratings for all products
 * Run this once to update existing products with correct ratings
 * 
 * Usage: npx ts-node src/scripts/recalculateAllRatings.ts
 */

import mongoose from 'mongoose';
import ProductModel from '../models/productModel';
import ReviewModel from '../models/reviewModel';
import dotenv from 'dotenv';

dotenv.config();

async function recalculateAllRatings() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get all products
    const products = await ProductModel.find({}).lean();
    console.log(`Found ${products.length} products`);

    let updated = 0;
    let skipped = 0;

    // For each product, recalculate its rating
    for (const product of products) {
      const productId = product._id;
      
      // Get all reviews for this product
      const reviews = await ReviewModel.find({ productId }).lean();
      const reviewCount = reviews.length;
      
      if (reviewCount === 0) {
        // No reviews, set to 0
        await ProductModel.findByIdAndUpdate(productId, {
          reviewCount: 0,
          rating: 0,
          averageRating: 0,
        });
        skipped++;
      } else {
        // Calculate average rating
        const totalRating = reviews.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0);
        const averageRating = totalRating / reviewCount;
        
        await ProductModel.findByIdAndUpdate(productId, {
          reviewCount,
          rating: Number(averageRating.toFixed(1)),
          averageRating: Number(averageRating.toFixed(1)),
        });
        
        console.log(`Updated ${product.title}: ${reviewCount} reviews, ${averageRating.toFixed(1)} avg rating`);
        updated++;
      }
    }

    console.log(`\n✅ Done! Updated ${updated} products, skipped ${skipped} products with no reviews`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error recalculating ratings:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

recalculateAllRatings();


