"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ocr_controller_1 = require("../controllers/ocr.controller");
const file_middleware_1 = require("../middleware/file.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/ocr/vin - Recognize VIN from uploaded image
router.post('/vin', auth_middleware_1.authenticate, file_middleware_1.upload.single('image'), ocr_controller_1.recognizeVIN);
exports.default = router;
