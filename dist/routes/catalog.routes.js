"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const file_middleware_1 = require("../middleware/file.middleware");
const catalog_controller_1 = require("../controllers/catalog.controller");
const router = (0, express_1.Router)();
// ============================================
// GARAGE ROUTES (authenticated)
// ============================================
// Garage catalog management
router.get('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), catalog_controller_1.getProducts);
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), file_middleware_1.upload.array('images', 5), catalog_controller_1.createProduct);
router.put('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), file_middleware_1.upload.array('images', 5), catalog_controller_1.updateProduct);
router.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), catalog_controller_1.deleteProduct);
router.post('/:id/feature', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), catalog_controller_1.toggleFeatured);
router.get('/stats', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), catalog_controller_1.getCatalogStats);
// ============================================
// PUBLIC/CUSTOMER ROUTES
// ============================================
// Customer catalog browsing
router.get('/search', auth_middleware_1.authenticate, catalog_controller_1.searchCatalog);
router.get('/product/:id', auth_middleware_1.authenticate, catalog_controller_1.getProductDetails);
exports.default = router;
