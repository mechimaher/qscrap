"use strict";
/**
 * API v1 Routes
 *
 * Aggregates all API routes under the v1 namespace.
 * This file provides a single entry point for all versioned API routes.
 *
 * Usage in app.ts:
 *   app.use('/api/v1', v1Router);
 *   app.use('/api', v1Router); // Backward compatibility
 *
 * @module routes/v1.routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// Core Routes
const auth_routes_1 = __importDefault(require("./auth.routes"));
const request_routes_1 = __importDefault(require("./request.routes"));
const bid_routes_1 = __importDefault(require("./bid.routes"));
const order_routes_1 = __importDefault(require("./order.routes"));
// Feature Routes
const subscription_routes_1 = __importDefault(require("./subscription.routes"));
const cancellation_routes_1 = __importDefault(require("./cancellation.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const negotiation_routes_1 = __importDefault(require("./negotiation.routes"));
const dispute_routes_1 = __importDefault(require("./dispute.routes"));
const operations_routes_1 = __importDefault(require("./operations.routes"));
const quality_routes_1 = __importDefault(require("./quality.routes"));
const delivery_routes_1 = __importDefault(require("./delivery.routes"));
const finance_routes_1 = __importDefault(require("./finance.routes"));
const support_routes_1 = __importDefault(require("./support.routes"));
const search_routes_1 = __importDefault(require("./search.routes"));
const reports_routes_1 = __importDefault(require("./reports.routes"));
const documents_routes_1 = __importDefault(require("./documents.routes"));
const reviews_routes_1 = __importDefault(require("./reviews.routes"));
// Driver & Chat Routes
const driver_routes_1 = __importDefault(require("./driver.routes"));
const chat_routes_1 = __importDefault(require("./chat.routes"));
// Admin Routes
const admin_routes_1 = __importDefault(require("./admin.routes"));
const address_routes_1 = __importDefault(require("./address.routes"));
const v1Router = (0, express_1.Router)();
// ==========================================
// CORE ROUTES
// ==========================================
/** @swagger path /auth */
v1Router.use('/auth', auth_routes_1.default);
/** @swagger path /requests */
v1Router.use('/requests', request_routes_1.default);
/** @swagger path /bids */
v1Router.use('/bids', bid_routes_1.default);
/** @swagger path /orders */
v1Router.use('/orders', order_routes_1.default);
// ==========================================
// FEATURE ROUTES
// ==========================================
v1Router.use('/subscriptions', subscription_routes_1.default);
v1Router.use('/cancellations', cancellation_routes_1.default);
v1Router.use('/dashboard', dashboard_routes_1.default);
v1Router.use('/negotiations', negotiation_routes_1.default);
v1Router.use('/disputes', dispute_routes_1.default);
v1Router.use('/operations', operations_routes_1.default);
v1Router.use('/quality', quality_routes_1.default);
v1Router.use('/delivery', delivery_routes_1.default);
v1Router.use('/finance', finance_routes_1.default);
v1Router.use('/support', support_routes_1.default);
v1Router.use('/search', search_routes_1.default);
v1Router.use('/reports', reports_routes_1.default);
v1Router.use('/documents', documents_routes_1.default);
v1Router.use('/reviews', reviews_routes_1.default);
// Garage Analytics (Plan-gated: Pro/Enterprise)
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
v1Router.use('/garage/analytics', analytics_routes_1.default);
// Catalog (Plan-gated: Pro/Enterprise for garage, open for customer browse)
const catalog_routes_1 = __importDefault(require("./catalog.routes"));
v1Router.use('/garage/catalog', catalog_routes_1.default);
v1Router.use('/catalog', catalog_routes_1.default);
// ==========================================
// DRIVER & CHAT ROUTES
// ==========================================
v1Router.use('/driver', driver_routes_1.default);
v1Router.use('/chat', chat_routes_1.default);
// ==========================================
// ADMIN ROUTES
// ==========================================
v1Router.use('/admin', admin_routes_1.default);
v1Router.use('/addresses', address_routes_1.default);
exports.default = v1Router;
