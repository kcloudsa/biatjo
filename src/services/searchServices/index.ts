import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import CategoryModel from '../../models/categoryModel';
import BrandModel from '../../models/brandModel';
import ProductModel from '../../models/productModel';
import CollectionModel from '../../models/collectionModel';

/**
 * Universal Search Service
 * Searches across Categories, Brands, Products, and Collections
 * with full population and relevance scoring
 */

// Helper function to calculate relevance score
const calculateRelevance = (text: string, query: string): number => {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 100;

  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 90;

  // Contains query as whole word
  const words = lowerText.split(/\s+/);
  if (words.some((w) => w === lowerQuery)) return 80;

  // Contains query
  if (lowerText.includes(lowerQuery)) return 70;

  // Fuzzy match - contains all characters in order
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) queryIndex++;
  }
  if (queryIndex === lowerQuery.length) return 50;

  // Partial word matches
  const queryWords = lowerQuery.split(/\s+/);
  const matchedWords = queryWords.filter((qw) => lowerText.includes(qw));
  if (matchedWords.length > 0) return (matchedWords.length / queryWords.length) * 40;

  return 0;
};

/**
 * GET /api/search?q=query
 * Universal search across all entities
 */
export const universalSearch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query as { q?: string };

  if (!q || typeof q !== 'string' || q.trim() === '') {
    res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
    return;
  }

  const query = q.trim();

  try {
    // Search Categories
    const categories = await CategoryModel.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    })
      .lean()
      .exec();

    // Calculate relevance for categories
    const categoriesWithRelevance = categories
      .map((cat: any) => ({
        ...cat,
        _relevance: Math.max(
          calculateRelevance(cat.name || '', query),
          calculateRelevance(cat.description || '', query)
        ),
      }))
      .filter((c: any) => c._relevance > 0)
      .sort((a: any, b: any) => b._relevance - a._relevance);

    // Get category IDs for deep search (categories are stored as ObjectIds in products)
    const categoryIds = categoriesWithRelevance.map((c: any) => c._id);

    // Search Brands (direct match first)
    const brandsQuery: any = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { brandID: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    };

    const directMatchBrands = await BrandModel.find(brandsQuery).lean().exec();

    // Find ALL brands that have products in matched categories (this is the key!)
    const categoryBrandProducts = categoryIds.length > 0 
      ? await ProductModel.find({
          categories: { $in: categoryIds },
        })
          .select('brand')
          .lean()
          .exec()
      : [];

    // Get unique brand IDs from products in matched categories
    const categoryBrandIds = [...new Set(categoryBrandProducts.map((p: any) => p.brand?.toString()).filter(Boolean))];

    // Fetch those brands
    const categoryBrands = categoryBrandIds.length > 0
      ? await BrandModel.find({
          _id: { $in: categoryBrandIds },
        }).lean().exec()
      : [];

    // Combine direct match brands and category brands
    const allBrandsMap = new Map();
    
    // Add direct match brands
    directMatchBrands.forEach((b: any) => {
      allBrandsMap.set(b._id.toString(), {
        ...b,
        isDirect: true,
      });
    });

    // Add category-connected brands
    categoryBrands.forEach((b: any) => {
      if (!allBrandsMap.has(b._id.toString())) {
        allBrandsMap.set(b._id.toString(), {
          ...b,
          isDirect: false,
        });
      }
    });

    const allBrands = Array.from(allBrandsMap.values());

    // Calculate relevance for brands
    const brandsWithRelevance = allBrands
      .map((brand: any) => {
        let relevance = Math.max(
          calculateRelevance(brand.name || '', query),
          calculateRelevance(brand.brandID || '', query),
          calculateRelevance(brand.description || '', query)
        );

        // Boost if brand has products in matched categories
        if (!brand.isDirect && categoryBrandIds.includes(brand._id.toString())) {
          relevance = Math.max(relevance, 60); // Boost for category connection
        }

        return { ...brand, _relevance: relevance };
      })
      .filter((b: any) => b._relevance > 0)
      .sort((a: any, b: any) => b._relevance - a._relevance);

    const matchedBrandIds = brandsWithRelevance.map((b: any) => b._id);

    // Search Products (direct match + products from matched brands + products in matched categories)
    const productsQuery: any = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $in: matchedBrandIds } },
      ],
    };

    // Add category filter if we have matched categories (using ObjectIds, not names!)
    if (categoryIds.length > 0) {
      productsQuery.$or.push({
        categories: { $in: categoryIds },
      });
    }

    const products = await ProductModel.find(productsQuery)
      .populate('brand', 'name brandID logo')
      .populate('categories', 'name image')
      .lean()
      .exec();

    // Calculate relevance for products
    const productsWithRelevance = products
      .map((product: any) => {
        let relevance = Math.max(
          calculateRelevance(product.title || '', query),
          calculateRelevance(product.description || '', query)
        );

        // Boost if product's brand matches
        if (matchedBrandIds.some((id: any) => id.toString() === product.brand?._id?.toString())) {
          relevance = Math.max(relevance, 55);
        }

        // Boost if product's brand name matches
        const brandRelevance = calculateRelevance(product.brand?.name || '', query);
        if (brandRelevance > 0) {
          relevance = Math.max(relevance, brandRelevance);
        }

        // Boost if product is in matched category (categories are now populated objects)
        if (Array.isArray(product.categories)) {
          const categoryRelevance = product.categories.reduce((max: number, cat: any) => {
            // Check if this product's category is in our matched categories
            const catId = cat?._id?.toString() || cat?.toString();
            const isMatchedCategory = categoryIds.some((id: any) => id.toString() === catId);
            if (isMatchedCategory) return Math.max(max, 65);
            
            // Also check category name match
            const catName = cat?.name || '';
            const catMatch = calculateRelevance(catName, query);
            return Math.max(max, catMatch);
          }, 0);
          relevance = Math.max(relevance, categoryRelevance);
        }

        // Check collections
        if (Array.isArray(product.collections)) {
          const collectionRelevance = product.collections.reduce((max: number, colId: any) => {
            // Collections are just IDs here, we'll handle collection search separately
            return max;
          }, 0);
          relevance = Math.max(relevance, collectionRelevance);
        }

        return { ...product, _relevance: relevance };
      })
      .filter((p: any) => p._relevance > 0)
      .sort((a: any, b: any) => b._relevance - a._relevance);

    // Search Collections
    const collectionsQuery: any = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $in: matchedBrandIds } },
      ],
    };

    const collections = await CollectionModel.find(collectionsQuery)
      .populate('brand', 'name brandID logo')
      .lean()
      .exec();

    // Calculate relevance for collections
    const collectionsWithRelevance = collections
      .map((collection: any) => {
        let relevance = Math.max(
          calculateRelevance(collection.title || '', query),
          calculateRelevance(collection.description || '', query)
        );

        // Boost if collection's brand matches
        if (matchedBrandIds.some((id: any) => id.toString() === collection.brand?._id?.toString())) {
          relevance = Math.max(relevance, 55);
        }

        return { ...collection, _relevance: relevance };
      })
      .filter((c: any) => c._relevance > 0)
      .sort((a: any, b: any) => b._relevance - a._relevance);

    // Generate recommended products (products from matched brands/categories not in main results)
    const mainProductIds = productsWithRelevance.map((p: any) => p._id.toString());
    const recommendedQuery: any = {
      _id: { $nin: productsWithRelevance.map((p: any) => p._id) },
      $or: [
        { brand: { $in: matchedBrandIds } },
      ],
    };

    // Add category filter using ObjectIds
    if (categoryIds.length > 0) {
      recommendedQuery.$or.push({
        categories: { $in: categoryIds },
      });
    }

    const recommended = await ProductModel.find(recommendedQuery)
      .populate('brand', 'name brandID logo')
      .populate('categories', 'name image')
      .limit(12)
      .lean()
      .exec();

    // Response
    const total =
      categoriesWithRelevance.length +
      brandsWithRelevance.length +
      productsWithRelevance.length +
      collectionsWithRelevance.length;

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithRelevance,
        brands: brandsWithRelevance,
        products: productsWithRelevance,
        collections: collectionsWithRelevance,
        recommended,
        total,
        query,
      },
    });
    return;
  } catch (error: any) {
    console.error('Universal search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
    });
    return;
  }
});

export default {
  universalSearch,
};

