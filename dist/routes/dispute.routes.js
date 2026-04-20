"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const dispute_controller_1 = require("../controllers/dispute.controller");
const router = express_1.default.Router();
// Multer config for dispute photos
const storage = multer_1.default.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `dispute_${Date.now()}-${Math.round(Math.random() * 1E9)}${path_1.default.extname(file.originalname)}`);
    }
});
const upload = (0, multer_1.default)({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
// Customer creates dispute
router.post('/', auth_middleware_1.authenticate, upload.array('photos', 5), dispute_controller_1.createDispute);
// Get my disputes (works for both customer and garage)
router.get('/my', auth_middleware_1.authenticate, dispute_controller_1.getMyDisputes);
// Get pending disputes count (garage)
router.get('/pending-count', auth_middleware_1.authenticate, dispute_controller_1.getPendingDisputesCount);
// Get dispute details
router.get('/:dispute_id', auth_middleware_1.authenticate, (0, validation_middleware_1.validateParams)(validation_middleware_1.disputeIdParamSchema), dispute_controller_1.getDisputeDetails);
// Garage responds to dispute
router.post('/:dispute_id/garage-respond', auth_middleware_1.authenticate, (0, validation_middleware_1.validateParams)(validation_middleware_1.disputeIdParamSchema), dispute_controller_1.garageRespondToDispute);
exports.default = router;
