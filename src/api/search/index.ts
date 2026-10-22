import express from 'express';
import searchServices from '../../services/searchServices';

const router = express.Router();

/**
 * @route   GET /api/search
 * @desc    Universal search across categories, brands, products, and collections
 * @query   q - Search query string
 * @access  Public
 */
router.get('/', searchServices.universalSearch);

export default router;

