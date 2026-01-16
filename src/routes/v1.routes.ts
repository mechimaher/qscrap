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

import { Router } from 'express';

// Core Routes
import authRoutes from './auth.routes';
import requestRoutes from './request.routes';
import bidRoutes from './bid.routes';
import orderRoutes from './order.routes';

// Feature Routes
import subscriptionRoutes from './subscription.routes';
import cancellationRoutes from './cancellation.routes';
import dashboardRoutes from './dashboard.routes';
import negotiationRoutes from './negotiation.routes';
import disputeRoutes from './dispute.routes';
import operationsRoutes from './operations.routes';
import deliveryRoutes from './delivery.routes';
import financeRoutes from './finance.routes';
import supportRoutes from './support.routes';
import searchRoutes from './search.routes';
import reportsRoutes from './reports.routes';
import documentsRoutes from './documents.routes';
import reviewsRoutes from './reviews.routes';

// Driver & Chat Routes
import driverRoutes from './driver.routes';
import chatRoutes from './chat.routes';

// Push Notifications
import pushRoutes from './push.routes';

// Admin Routes
import adminRoutes from './admin.routes';
import addressRoutes from './address.routes';

const v1Router = Router();

// ==========================================
// CORE ROUTES
// ==========================================

/** @swagger path /auth */
v1Router.use('/auth', authRoutes);

/** @swagger path /requests */
v1Router.use('/requests', requestRoutes);

/** @swagger path /bids */
v1Router.use('/bids', bidRoutes);

/** @swagger path /orders */
v1Router.use('/orders', orderRoutes);

// ==========================================
// FEATURE ROUTES
// ==========================================

v1Router.use('/subscriptions', subscriptionRoutes);
v1Router.use('/cancellations', cancellationRoutes);
v1Router.use('/dashboard', dashboardRoutes);
v1Router.use('/negotiations', negotiationRoutes);
v1Router.use('/disputes', disputeRoutes);
v1Router.use('/operations', operationsRoutes);
v1Router.use('/delivery', deliveryRoutes);
v1Router.use('/finance', financeRoutes);
v1Router.use('/support', supportRoutes);
v1Router.use('/search', searchRoutes);
v1Router.use('/reports', reportsRoutes);
v1Router.use('/documents', documentsRoutes);
v1Router.use('/reviews', reviewsRoutes);

// Garage Analytics (Plan-gated: Pro/Enterprise)
import analyticsRoutes from './analytics.routes';
v1Router.use('/garage/analytics', analyticsRoutes);

// Showcase/Marketplace (Enterprise only)
import showcaseRoutes from './showcase.routes';
v1Router.use('/showcase', showcaseRoutes);

// Catalog alias for mobile app compatibility
// Mobile uses /catalog/search which maps to /showcase/parts
v1Router.use('/catalog', showcaseRoutes);

// ==========================================
// DRIVER & CHAT ROUTES
// ==========================================

v1Router.use('/driver', driverRoutes);
v1Router.use('/chat', chatRoutes);
import notificationRoutes from './notification.routes';
// v1Router.use('/notifications', pushRoutes); // Deprecated in favor of generic notification system
v1Router.use('/notifications', notificationRoutes);

// ==========================================
// ADMIN ROUTES
// ==========================================

v1Router.use('/admin', adminRoutes);
v1Router.use('/addresses', addressRoutes);

// OCR Routes (VIN Scanner)
import ocrRoutes from './ocr.routes';
v1Router.use('/ocr', ocrRoutes);

// Vehicle Routes (My Vehicles / Family Fleet)
import vehicleRoutes from './vehicle.routes';
v1Router.use('/vehicles', vehicleRoutes);

// Service Routes (Repair, Home Services)
import serviceRoutes from './services.routes';
v1Router.use('/services', serviceRoutes);

// Insurance Routes (B2B)
import insuranceRoutes from './insurance.routes';
v1Router.use('/insurance', insuranceRoutes);

// History Routes (Public/Data)
import historyRoutes from './history.routes';
v1Router.use('/history', historyRoutes);

// Repair Marketplace Routes (Requests, Bids, Bookings)
import repairRoutes from './repair.routes';
v1Router.use('/repair', repairRoutes);

export default v1Router;
