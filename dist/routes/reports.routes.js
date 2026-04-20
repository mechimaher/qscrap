"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const reports_controller_1 = require("../controllers/reports.controller");
const router = express_1.default.Router();
// All reports require authentication and operations/admin role
router.use(auth_middleware_1.authenticate);
router.use(authorize_middleware_1.authorizeOperations);
// Report endpoints
router.get('/orders', reports_controller_1.getOrdersReport);
router.get('/revenue', reports_controller_1.getRevenueReport);
router.get('/disputes', reports_controller_1.getDisputesReport);
router.get('/deliveries', reports_controller_1.getDeliveriesReport);
router.get('/garages', reports_controller_1.getGaragesReport);
exports.default = router;
