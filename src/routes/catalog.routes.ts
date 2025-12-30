import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/file.middleware';
import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleFeatured,
    getCatalogStats,
    searchCatalog,
    getProductDetails
} from '../controllers/catalog.controller';

const router = Router();

// ============================================
// GARAGE ROUTES (authenticated)
// ============================================

// Garage catalog management
router.get('/', authenticate, requireRole('garage'), getProducts);
router.post('/', authenticate, requireRole('garage'), upload.array('images', 5), createProduct);
router.put('/:id', authenticate, requireRole('garage'), upload.array('images', 5), updateProduct);
router.delete('/:id', authenticate, requireRole('garage'), deleteProduct);
router.post('/:id/feature', authenticate, requireRole('garage'), toggleFeatured);
router.get('/stats', authenticate, requireRole('garage'), getCatalogStats);

// ============================================
// PUBLIC/CUSTOMER ROUTES
// ============================================

// Customer catalog browsing
router.get('/search', authenticate, searchCatalog);
router.get('/product/:id', authenticate, getProductDetails);

export default router;
