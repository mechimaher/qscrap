"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const search_controller_1 = require("../controllers/search.controller");
const router = (0, express_1.Router)();
// All search routes require authentication
router.use(auth_middleware_1.authenticate);
// Main search endpoint
router.get('/', search_controller_1.universalSearch);
// Quick suggestions for autocomplete
router.get('/suggestions', search_controller_1.getSearchSuggestions);
exports.default = router;
