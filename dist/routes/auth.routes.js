"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_middleware_1 = require("../middleware/rateLimiter.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
// Apply rate limiting and validation to auth endpoints
router.post('/register', rateLimiter_middleware_1.registerLimiter, (0, validation_middleware_1.validate)(validation_middleware_1.registerCustomerSchema), auth_controller_1.register);
router.post('/register/garage', rateLimiter_middleware_1.registerLimiter, (0, validation_middleware_1.validate)(validation_middleware_1.registerGarageSchema), auth_controller_1.register);
router.post('/login', rateLimiter_middleware_1.loginLimiter, (0, validation_middleware_1.validate)(validation_middleware_1.loginSchema), auth_controller_1.login);
router.delete('/delete-account', auth_middleware_1.authenticate, auth_controller_1.deleteAccount);
exports.default = router;
