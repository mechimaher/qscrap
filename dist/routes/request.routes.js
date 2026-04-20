"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const request_controller_1 = require("../controllers/request.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const file_middleware_1 = require("../middleware/file.middleware");
const router = (0, express_1.Router)();
// Error handling wrapper for multer
const handleMulterError = (fn) => (req, res, next) => {
    fn(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err.message);
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ error: 'Unexpected file field. Please use "images" for photo uploads.' });
            }
            return res.status(400).json({ error: err.message || 'File upload error' });
        }
        next();
    });
};
// Customer creates request
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), handleMulterError(file_middleware_1.upload.array('images', 5)), request_controller_1.createRequest);
// Customer views their requests
router.get('/my', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), request_controller_1.getMyRequests);
// Garage views active requests
router.get('/pending', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), request_controller_1.getActiveRequests);
// Details (Shared but with logic inside)
router.get('/:request_id', auth_middleware_1.authenticate, request_controller_1.getRequestDetails);
// Customer: Cancel their own request (soft - changes status to cancelled)
router.post('/:request_id/cancel', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), request_controller_1.cancelRequest);
// Customer: Delete their own request (hard - removes from database, only if no orders)
router.delete('/:request_id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), request_controller_1.deleteRequest);
// Garage: Ignore a request (per-garage, request still visible to others)
router.post('/:request_id/ignore', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), request_controller_1.ignoreRequest);
// Garage: Get list of ignored request IDs
router.get('/ignored/list', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), request_controller_1.getIgnoredRequests);
exports.default = router;
