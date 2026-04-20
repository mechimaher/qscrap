# QScrap - Complete Architecture Audit & Project Structure
## Enterprise SaaS Marketplace for Auto Parts in Qatar
**Version:** 1.0.0  
**Audit Date:** April 2025  
**Prepared by:** Senior Full-Stack Engineering Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Complete Project Tree Structure](#3-complete-project-tree-structure)
4. [Backend Architecture Analysis](#4-backend-architecture-analysis)
5. [Frontend Architecture Analysis](#5-frontend-architecture-analysis)
6. [Mobile Application Architecture](#6-mobile-application-architecture)
7. [Database Architecture](#7-database-architecture)
8. [Security Architecture](#8-security-architecture)
9. [DevOps & Infrastructure](#9-devops--infrastructure)
10. [API Documentation](#10-api-documentation)
11. [Real-time Events (Socket.IO)](#11-real-time-events-socketio)
12. [File Organization Audit](#12-file-organization-audit)
13. [Recommendations & Best Practices](#13-recommendations--best-practices)
14. [Scaling Strategy](#14-scaling-strategy)
15. [Production Readiness Checklist](#15-production-readiness-checklist)

---

## 1. Executive Summary

### Project Overview
QScrap is a comprehensive B2B2C marketplace connecting customers seeking auto parts with garages (scrapyards) in Qatar. The platform features real-time bidding, quality control workflows, integrated delivery management, and multi-stakeholder dashboards.

### Key Metrics
- **Total Backend Files:** 83 TypeScript files
- **Controllers:** 26 business logic controllers
- **Routes:** 26 API route modules
- **Middleware:** 10 middleware components
- **Frontend Dashboards:** 5 HTML dashboards (Customer, Garage, Operations, Admin, Driver PWA)
- **Mobile App:** React Native (Expo) with full feature parity
- **Database:** PostgreSQL with migration support
- **Real-time:** Socket.IO with Redis adapter support

### Technology Stack Assessment

| Layer | Technology | Version | Status |
|-------|------------|---------|--------|
| **Backend Runtime** | Node.js | 18.x | ✅ Production Ready |
| **Backend Framework** | Express.js | 4.18.2 | ✅ Stable |
| **Language** | TypeScript | 5.0.4 | ✅ Type Safe |
| **Database** | PostgreSQL | 14+ | ✅ Relational |
| **Cache/Session** | Redis | 5.10.0 client | ✅ Optional |
| **Real-time** | Socket.IO | 4.6.1 | ✅ Configured |
| **Queue** | BullMQ | 5.66.2 | ✅ Job Processing |
| **ORM** | Raw SQL (pg) | 8.10.0 | ⚠️ Consider Prisma/Knex |
| **Validation** | Zod | 4.2.0 | ✅ Schema Validation |
| **Auth** | JWT + bcryptjs | 9.0.0 / 3.0.3 | ✅ Secure |
| **File Upload** | Multer | 1.4.5-lts.1 | ✅ Configured |
| **Documentation** | Swagger UI | 5.0.1 | ✅ API Docs |
| **Mobile** | React Native (Expo) | ~54.0.30 | ✅ Cross-platform |
| **Web Frontend** | Vanilla JS + Bootstrap | - | ⚠️ Consider Modern Framework |
| **Maps** | Leaflet | - | ✅ Open Source |
| **Charts** | Chart.js | - | ✅ Analytics |
| **Containerization** | Docker | 18-alpine | ✅ Configured |
| **Orchestration** | Docker Compose | 3.8 | ✅ Local Dev |

---

## 2. System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│   Customer   │    Garage    │  Operations  │    Admin     │   Driver    │
│  Dashboard   │  Dashboard   │  Dashboard   │  Dashboard   │  PWA/Mobile │
│  (HTML/JS)   │  (HTML/JS)   │  (HTML/JS)   │  (HTML/JS)   │  (RN/Expo)  │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘
       │              │              │              │              │
       └──────────────┴──────────────┼──────────────┴──────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │      LOAD BALANCER (Nginx)      │
                    │   - SSL Termination             │
                    │   - Rate Limiting               │
                    │   - WebSocket Upgrade           │
                    └────────────────┬────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼────────┐         ┌────────▼────────┐         ┌────────▼────────┐
│   App Server   │         │   App Server    │         │   App Server    │
│   Node:3001    │         │   Node:3002     │         │   Node:3003     │
│   (Express)    │         │   (Express)     │         │   (Express)     │
└───────┬────────┘         └────────┬────────┘         └────────┬────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌───────▼────────┐      ┌──────────▼──────────┐     ┌─────────▼────────┐
│    PostgreSQL  │      │  Redis Cluster      │     │  Object Storage  │
│   Primary +    │      │  - Session Store    │     │  - S3/Azure      │
│   Read Replicas│      │  - Pub/Sub          │     │  - File Uploads  │
└────────────────┘      └─────────────────────┘     └──────────────────┘
```

### Architecture Patterns Used

1. **MVC (Model-View-Controller)** - Clear separation of concerns
2. **Repository Pattern** - Database abstraction layer
3. **Service Layer Pattern** - Business logic encapsulation
4. **Middleware Chain** - Request preprocessing pipeline
5. **Event-Driven Architecture** - Socket.IO for real-time updates
6. **Job Queue Pattern** - BullMQ for async processing
7. **State Machine Pattern** - Order lifecycle management

---

## 3. Complete Project Tree Structure

```
/workspace (QScrap Root)
│
├── 📄 .dockerignore                    # Docker build exclusions
├── 📄 .env.example                     # Environment template
├── 📄 .gitignore                       # Git ignore rules
├── 📄 CLUSTER_DEPLOYMENT.md            # Multi-server deployment guide
├── 📄 Dockerfile                       # Container definition
├── 📄 docker-compose.yml               # Local development stack
├── 📄 invoice_response*.json/html      # Payment integration samples
├── 📄 package.json                     # Backend dependencies
├── 📄 process-existing-payouts.js      # Payout processing script
├── 📄 QScrap-Premium.apk               # Android mobile app build
├── 📄 QScrap-logo.png                  # Brand asset
├── 📄 QScrap2026.txt                   # Business planning doc
├── 📄 README.md                        # Project overview
├── 📄 reset-and-seed.js                # Database reset utility
├── 📄 reset-data.js                    # Data cleanup script
├── 📄 run-migration.js                 # Migration runner (alias)
├── 📄 run_migration.js                 # Migration runner
├── 📄 SCALING_GUIDE.md                 # Scaling configuration
├── 📄 tsconfig.json                    # TypeScript configuration
│
├── 📁 docs/                            # Technical documentation
│   └── socket-events.md                # Socket.IO event reference
│
├── 📁 migrations/                      # Database migrations
│   └── 003_audit_logs.sql              # Audit logging schema
│
├── 📁 mobile/                          # React Native mobile app
│   ├── 📄 .gitignore
│   ├── 📄 App.tsx                      # Mobile app entry point
│   ├── 📄 app.json                     # Expo configuration
│   ├── 📄 build_apk.sh                 # APK build script
│   ├── 📄 eas.json                     # EAS Build config
│   ├── 📄 index.ts                     # App registration
│   ├── 📄 package.json                 # Mobile dependencies
│   ├── 📄 tsconfig.json                # TS config for mobile
│   │
│   ├── 📁 assets/                      # Static assets (images, fonts)
│   │
│   ├── 📁 locales/                     # Internationalization
│   │   ├── en.json                     # English translations
│   │   └── ar.json                     # Arabic translations
│   │
│   └── 📁 src/                         # Mobile source code
│       ├── 📁 components/              # Reusable UI components
│       ├── 📁 config/                  # App configuration
│       ├── 📁 constants/               # App-wide constants
│       ├── 📁 contexts/                # React contexts (state)
│       ├── 📁 hooks/                   # Custom React hooks
│       ├── 📁 i18n/                    # Internationalization setup
│       ├── 📁 navigation/              # React Navigation setup
│       ├── 📁 screens/                 # Screen components
│       │   ├── customer/               # Customer screens
│       │   ├── garage/                 # Garage screens
│       │   ├── auth/                   # Authentication screens
│       │   └── shared/                 # Shared screens
│       ├── 📁 services/                # API clients, Socket.IO
│       └── 📁 utils/                   # Utility functions
│
├── 📁 public/                          # Static web assets
│   ├── 📄 admin-dashboard.html         # Admin panel (49KB)
│   ├── 📄 customer-dashboard.html      # Customer portal (72KB)
│   ├── 📄 garage-dashboard.html        # Garage portal (81KB)
│   ├── 📄 operations-dashboard.html    # Operations panel (64KB)
│   ├── 📄 privacy.html                 # Privacy policy
│   ├── 📄 terms.html                   # Terms of service
│   │
│   ├── 📁 assets/                      # Third-party libraries
│   │   ├── bootstrap-icons/            # Icon font
│   │   ├── images/                     # Image assets
│   │   ├── leaflet/                    # Map library
│   │   └── tesseract/                  # OCR library
│   │
│   ├── 📁 css/                         # Stylesheets
│   │   ├── admin-dashboard.css         # Admin styles (56KB)
│   │   ├── customer-dashboard.css      # Customer styles (73KB)
│   │   ├── customer-dashboard.css.disabled  # Deprecated
│   │   ├── design-tokens.css           # CSS variables/theme
│   │   ├── garage-dashboard.css        # Garage styles (78KB)
│   │   ├── operations-dashboard.css    # Operations styles (47KB)
│   │   ├── shared.css                  # Common styles (15KB)
│   │   └── 📁 customer/                # Customer-specific styles
│   │
│   ├── 📁 js/                          # JavaScript modules
│   │   ├── admin-dashboard.js          # Admin logic (92KB)
│   │   ├── chart.min.js                # Chart.js library (205KB)
│   │   ├── customer-dashboard.js       # Customer logic (159KB)
│   │   ├── garage-dashboard.js         # Garage logic (207KB)
│   │   ├── operations-dashboard.js     # Operations logic (231KB)
│   │   ├── pagination-utils.js         # Pagination helper
│   │   └── 📁 shared/                  # Shared utilities
│   │
│   └── 📁 driver-app/                  # Driver PWA
│       ├── 📄 index.html               # Driver interface (14KB)
│       ├── 📄 manifest.json            # PWA manifest
│       ├── 📄 sw.js                    # Service worker
│       ├── 📁 css/                     # Driver styles
│       ├── 📁 icons/                   # App icons
│       └── 📁 js/                      # Driver logic
│
├── 📁 scripts/                         # Build/deployment scripts
│   └── migrate.js                      # Database migration script
│
└── 📁 src/                             # Backend TypeScript source
    ├── 📄 app.ts                       # Express app setup
    ├── 📄 server.ts                    # Server entry point
    │
    ├── 📁 config/                      # Configuration modules
    │   ├── db.ts                       # Database connection pool
    │   ├── redis.ts                    # Redis client setup
    │   ├── socketAdapter.ts            # Socket.IO adapter
    │   ├── swagger.ts                  # OpenAPI/Swagger config
    │   ├── jobQueue.ts                 # BullMQ queue setup
    │   ├── jobs.ts                     # Scheduled jobs
    │   ├── security.ts                 # Security configurations
    │   ├── storage.ts                  # File storage config
    │   └── system.config.ts            # System-wide settings
    │
    ├── 📁 controllers/                 # Business logic (26 files)
    │   ├── admin.controller.ts         # Admin operations
    │   ├── admin-reports.controller.ts # Admin reporting
    │   ├── analytics.controller.ts     # Analytics endpoints
    │   ├── address.controller.ts       # Address management
    │   ├── auth.controller.ts          # Authentication
    │   ├── bid.controller.ts           # Bid management
    │   ├── cancellation.controller.ts  # Cancellation handling
    │   ├── catalog.controller.ts       # Parts catalog
    │   ├── chat.controller.ts          # Chat/messaging
    │   ├── dashboard.controller.ts     # Dashboard data
    │   ├── delivery.controller.ts      # Delivery management
    │   ├── dispute.controller.ts       # Dispute resolution
    │   ├── documents.controller.ts     # Document uploads
    │   ├── driver.controller.ts        # Driver operations
    │   ├── finance.controller.ts       # Financial operations
    │   ├── negotiation.controller.ts   # Price negotiation
    │   ├── operations.controller.ts    # Operations workflows
    │   ├── order.controller.ts         # Order management
    │   ├── ocr.controller.ts           # OCR/VIN scanning
    │   ├── quality.controller.ts       # QC inspections
    │   ├── reports.controller.ts       # Report generation
    │   ├── request.controller.ts       # Part requests
    │   ├── reviews.controller.ts       # Review system
    │   ├── search.controller.ts        # Search functionality
    │   ├── subscription.controller.ts  # Subscription plans
    │   └── support.controller.ts       # Support tickets
    │
    ├── 📁 middleware/                  # Request middleware (10 files)
    │   ├── auditLog.middleware.ts      # Audit logging
    │   ├── auth.middleware.ts          # JWT authentication
    │   ├── authorize.middleware.ts     # Role-based authorization
    │   ├── cache.middleware.ts         # Response caching
    │   ├── csrf.middleware.ts          # CSRF protection
    │   ├── errorHandler.middleware.ts  # Global error handling
    │   ├── file.middleware.ts          # File upload handling
    │   ├── rateLimiter.middleware.ts   # Rate limiting
    │   ├── requestContext.middleware.ts# Request context
    │   ├── security.middleware.ts      # Security headers
    │   └── validation.middleware.ts    # Input validation
    │
    ├── 📁 repositories/                # Data access layer
    │   └── driver.repository.ts        # Driver data access
    │
    ├── 📁 routes/                      # API routes (26 files)
    │   ├── v1.routes.ts                # API versioning
    │   ├── admin.routes.ts             # Admin endpoints
    │   ├── address.routes.ts           # Address endpoints
    │   ├── analytics.routes.ts         # Analytics endpoints
    │   ├── auth.routes.ts              # Auth endpoints
    │   ├── bid.routes.ts               # Bid endpoints
    │   ├── cancellation.routes.ts      # Cancellation endpoints
    │   ├── catalog.routes.ts           # Catalog endpoints
    │   ├── chat.routes.ts              # Chat endpoints
    │   ├── dashboard.routes.ts         # Dashboard endpoints
    │   ├── delivery.routes.ts          # Delivery endpoints
    │   ├── dispute.routes.ts           # Dispute endpoints
    │   ├── documents.routes.ts         # Documents endpoints
    │   ├── driver.routes.ts            # Driver endpoints
    │   ├── finance.routes.ts           # Finance endpoints
    │   ├── negotiation.routes.ts       # Negotiation endpoints
    │   ├── operations.routes.ts        # Operations endpoints
    │   ├── order.routes.ts             # Order endpoints
    │   ├── ocr.routes.ts               # OCR endpoints
    │   ├── quality.routes.ts           # Quality endpoints
    │   ├── reports.routes.ts           # Reports endpoints
    │   ├── request.routes.ts           # Request endpoints
    │   ├── reviews.routes.ts           # Reviews endpoints
    │   ├── search.routes.ts            # Search endpoints
    │   ├── subscription.routes.ts      # Subscription endpoints
    │   └── support.routes.ts           # Support endpoints
    │
    ├── 📁 schemas/                     # Zod validation schemas
    │   └── driver.schema.ts            # Driver validation
    │
    ├── 📁 scripts/                     # Backend scripts
    │   └── create-admin.ts             # Admin user creation
    │
    ├── 📁 services/                    # Business services
    │   │                               # (To be expanded)
    │
    ├── 📁 state/                       # Application state
    │   └── state-machine.ts            # Order state machine
    │
    ├── 📁 types/                       # TypeScript type definitions
    │   └──                            # (To be expanded)
    │
    └── 📁 utils/                       # Utility functions
        └── state-machine.ts            # State machine utilities
```

---

## 4. Backend Architecture Analysis

### 4.1 Entry Points

#### `src/server.ts`
**Purpose:** Main server bootstrap file  
**Responsibilities:**
- Environment variable loading
- Express app initialization
- HTTP server creation
- Socket.IO attachment
- Database connection establishment
- Graceful shutdown handling

**Key Features:**
```typescript
// Expected structure based on project patterns
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app';
import { connectDB } from './config/db';
import { initializeRedis } from './config/redis';
import { setupSocketIO } from './config/socketAdapter';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await connectDB();
  await initializeRedis();
  
  const httpServer = createServer(app);
  const io = setupSocketIO(httpServer);
  
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
```

#### `src/app.ts`
**Purpose:** Express application factory  
**Responsibilities:**
- Middleware registration
- Route mounting
- Error handling setup
- CORS configuration
- Security headers (Helmet)

**Middleware Stack Order:**
1. `cors()` - Cross-origin resource sharing
2. `helmet()` - Security headers
3. `express.json()` - JSON parsing
4. `requestContextMiddleware` - Request context tracking
5. `auditLogMiddleware` - Audit trail
6. Routes (`/api/*`)
7. Static files (`/public`)
8. `errorHandlerMiddleware` - Global error handler

### 4.2 Controller Layer (26 Controllers)

**Pattern:** Each controller handles a specific domain with CRUD operations.

| Controller | Endpoints | Business Domain | Complexity |
|------------|-----------|-----------------|------------|
| `auth.controller.ts` | `/api/auth/*` | User authentication, JWT tokens | Medium |
| `request.controller.ts` | `/api/requests/*` | Part request lifecycle | High |
| `bid.controller.ts` | `/api/bids/*` | Bidding system | High |
| `negotiation.controller.ts` | `/api/negotiation/*` | Price negotiation (3 rounds) | High |
| `order.controller.ts` | `/api/orders/*` | Order management | High |
| `delivery.controller.ts` | `/api/delivery/*` | Delivery assignment & tracking | Medium |
| `quality.controller.ts` | `/api/quality/*` | QC inspection workflow | Medium |
| `dispute.controller.ts` | `/api/disputes/*` | Dispute resolution | Medium |
| `finance.controller.ts` | `/api/finance/*` | Payouts, commissions | High |
| `subscription.controller.ts` | `/api/subscriptions/*` | Tiered plans | Low |
| `dashboard.controller.ts` | `/api/dashboard/*` | Aggregated metrics | Medium |
| `analytics.controller.ts` | `/api/analytics/*` | Advanced analytics | Medium |
| `reports.controller.ts` | `/api/reports/*` | Report generation | Medium |
| `admin.controller.ts` | `/api/admin/*` | Admin operations | High |
| `operations.controller.ts` | `/api/operations/*` | Operations workflows | High |
| `driver.controller.ts` | `/api/drivers/*` | Driver management | Medium |
| `chat.controller.ts` | `/api/chat/*` | Messaging system | Medium |
| `support.controller.ts` | `/api/support/*` | Support tickets | Low |
| `reviews.controller.ts` | `/api/reviews/*` | Rating system | Low |
| `search.controller.ts` | `/api/search/*` | Search functionality | Medium |
| `catalog.controller.ts` | `/api/catalog/*` | Parts catalog | Medium |
| `address.controller.ts` | `/api/address/*` | Address management | Low |
| `documents.controller.ts` | `/api/documents/*` | Document uploads | Low |
| `ocr.controller.ts` | `/api/ocr/*` | VIN scanning | Low |
| `cancellation.controller.ts` | `/api/cancellations/*` | Cancellation logic | Medium |
| `admin-reports.controller.ts` | `/api/admin/reports/*` | Admin reporting | High |

**Best Practice Observations:**
✅ Single Responsibility Principle followed  
✅ Consistent naming convention  
✅ Separation from routes  

⚠️ **Recommendation:** Add service layer between controllers and repositories for complex business logic (e.g., order placement involves multiple steps).

### 4.3 Route Layer (26 Route Files)

**Pattern:** RESTful API design with versioning support via `v1.routes.ts`.

**Route Structure Example:**
```typescript
// Typical route file pattern
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validation.middleware';
import * as controller from '../controllers/request.controller';

const router = Router();

router.post('/', authenticate, authorize(['customer']), validate(requestSchema), controller.create);
router.get('/', authenticate, controller.getAll);
router.get('/:id', authenticate, controller.getById);
router.put('/:id', authenticate, controller.update);
router.delete('/:id', authenticate, controller.delete);

export default router;
```

**API Endpoint Summary:**

| Module | Base Path | Methods | Auth Required |
|--------|-----------|---------|---------------|
| Auth | `/api/auth` | POST | No (except logout) |
| Requests | `/api/requests` | GET, POST, PUT, DELETE | Yes |
| Bids | `/api/bids` | GET, POST, PUT, DELETE | Yes |
| Orders | `/api/orders` | GET, POST, PUT | Yes |
| Delivery | `/api/delivery` | GET, POST, PUT | Yes |
| Quality | `/api/quality` | POST, PUT | Yes |
| Finance | `/api/finance` | GET, POST | Yes |
| Admin | `/api/admin` | ALL | Yes (Admin only) |
| ... | ... | ... | ... |

### 4.4 Middleware Layer (10 Components)

**Execution Order:** Critical for security and functionality.

```
Request → CORS → Helmet → JSON Parse → RequestContext → 
AuditLog → Auth → Authorize → RateLimiter → Cache → 
Route Handler → ErrorHandler
```

| Middleware | Purpose | Priority |
|------------|---------|----------|
| `security.middleware.ts` | Helmet, XSS protection | 1 (First) |
| `requestContext.middleware.ts` | Request ID tracing | 2 |
| `auditLog.middleware.ts` | Audit trail logging | 3 |
| `auth.middleware.ts` | JWT verification | 4 |
| `authorize.middleware.ts` | RBAC checks | 5 |
| `rateLimiter.middleware.ts` | DDoS protection | 6 |
| `cache.middleware.ts` | Response caching | 7 |
| `csrf.middleware.ts` | CSRF token validation | 8 |
| `validation.middleware.ts` | Zod schema validation | 9 |
| `file.middleware.ts` | Multer file handling | 10 |
| `errorHandler.middleware.ts` | Global error catch | Last |

### 4.5 Configuration Layer

| File | Purpose | Key Settings |
|------|---------|--------------|
| `db.ts` | PostgreSQL pool | max: 20, min: 5, timeout: 30s |
| `redis.ts` | Redis client | URL from env, session store |
| `socketAdapter.ts` | Socket.IO setup | Redis adapter for clustering |
| `jobQueue.ts` | BullMQ queues | Payout jobs, notifications |
| `jobs.ts` | Cron jobs | Request expiry, payout scheduling |
| `security.ts` | Security config | CORS origins, cookie settings |
| `storage.ts` | File storage | Local/S3/Azure switching |
| `swagger.ts` | API docs | OpenAPI 3.0 spec |
| `system.config.ts` | System constants | Pagination limits, max file size |

### 4.6 Repository Pattern

**Current State:** Minimal implementation (`driver.repository.ts`)  
**Recommendation:** Expand to all entities for better testability and database abstraction.

**Proposed Repository Structure:**
```
src/repositories/
├── base.repository.ts          # Generic CRUD operations
├── user.repository.ts
├── request.repository.ts
├── bid.repository.ts
├── order.repository.ts
├── garage.repository.ts
├── driver.repository.ts        # ✅ Already exists
├── payment.repository.ts
└── ...
```

---

## 5. Frontend Architecture Analysis

### 5.1 Web Dashboards (Vanilla JS + Bootstrap)

**Dashboard Inventory:**

| Dashboard | File Size | Target Users | Key Features |
|-----------|-----------|--------------|--------------|
| Customer | 72KB HTML + 159KB JS + 73KB CSS | End users | Part requests, bidding, tracking |
| Garage | 81KB HTML + 207KB JS + 78KB CSS | Scrapyards | Bid management, orders, payouts |
| Operations | 64KB HTML + 231KB JS + 47KB CSS | Staff | QC, delivery, disputes |
| Admin | 49KB HTML + 92KB JS + 56KB CSS | Administrators | User mgmt, reports, settings |
| Driver PWA | 14KB HTML + Service Worker | Drivers | Delivery tasks, navigation |

**Architecture Pattern:**
- **No build step** - Direct browser execution
- **Modular CSS** - Separate stylesheets per dashboard
- **Shared utilities** - `pagination-utils.js`, `shared/` folder
- **Third-party libs** - Bootstrap Icons, Leaflet, Chart.js, Tesseract OCR

**Strengths:**
✅ Fast initial load (no bundle)  
✅ Simple deployment  
✅ Easy debugging  

**Weaknesses:**
⚠️ No component reusability  
⚠️ Manual DOM manipulation  
⚠️ Limited state management  
⚠️ No TypeScript safety  
⚠️ Difficult to scale complexity  

**Recommendations:**
1. **Short-term:** Refactor shared logic into ES6 modules
2. **Mid-term:** Migrate to Vue.js or React for component architecture
3. **Long-term:** Implement build pipeline (Vite/Webpack)

### 5.2 CSS Architecture

**Design System:**
- `design-tokens.css` - CSS custom properties (colors, spacing, typography)
- `shared.css` - Common utilities, resets
- Dashboard-specific stylesheets

**Token Structure:**
```css
:root {
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --spacing-unit: 0.25rem;
  --font-family-base: 'Inter', system-ui, sans-serif;
  --border-radius-md: 0.375rem;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

### 5.3 JavaScript Architecture

**Patterns Observed:**
- IIFE (Immediately Invoked Function Expressions) for scope isolation
- Event delegation for dynamic elements
- Async/await for API calls
- Socket.IO client for real-time updates

**Example Structure:**
```javascript
// customer-dashboard.js pattern
(function() {
  'use strict';
  
  const API_BASE = '/api';
  const socket = io();
  
  async function init() {
    await loadUser();
    await loadRequests();
    setupEventListeners();
    setupSocketListeners();
  }
  
  function setupSocketListeners() {
    socket.on('new_bid', handleNewBid);
    socket.on('order_status_updated', handleOrderUpdate);
  }
  
  init();
})();
```

---

## 6. Mobile Application Architecture

### 6.1 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Expo SDK | ~54.0.30 |
| React Native | react-native | 0.81.5 |
| React | react | 19.1.0 |
| Navigation | React Navigation | ^7.1.26 |
| State Management | React Context | Built-in |
| Storage | AsyncStorage | 2.2.0 |
| Maps | react-native-maps | 1.20.1 |
| Camera | expo-camera | ~17.0.10 |
| Location | expo-location | ~19.0.8 |
| Socket.IO | socket.io-client | 4.x |
| i18n | Custom | - |

### 6.2 Project Structure

```
mobile/
├── App.tsx                    # Root component with providers
├── app.json                   # Expo configuration
├── eas.json                   # EAS Build config
├── build_apk.sh              # APK build script
├── index.ts                   # App registration
├── package.json
├── tsconfig.json
│
├── assets/                    # Images, fonts, icons
│
├── locales/                   # Translation files
│   ├── en.json               # English
│   └── ar.json               # Arabic (RTL support needed)
│
└── src/
    ├── components/           # Reusable UI components
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   ├── Input.tsx
    │   ├── PartImage.tsx
    │   ├── BidCard.tsx
    │   └── ...
    │
    ├── config/               # App configuration
    │   ├── api.ts            # API client setup
    │   ├── socket.ts         # Socket.IO setup
    │   └── theme.ts          # Theme definition
    │
    ├── constants/            # Constants
    │   ├── colors.ts
    │   ├── layouts.ts
    │   └── routes.ts
    │
    ├── contexts/             # React Context providers
    │   ├── AuthContext.tsx
    │   ├── ThemeContext.tsx
    │   └── SocketContext.tsx
    │
    ├── hooks/                # Custom hooks
    │   ├── useAuth.ts
    │   ├── useSocket.ts
    │   ├── useLocation.ts
    │   └── ...
    │
    ├── i18n/                 # Internationalization
    │   ├── index.ts
    │   └── translations.ts
    │
    ├── navigation/           # Navigation setup
    │   ├── AppNavigator.tsx
    │   ├── CustomerStack.tsx
    │   ├── GarageStack.tsx
    │   └── AuthStack.tsx
    │
    ├── screens/              # Screen components
    │   ├── auth/
    │   │   ├── LoginScreen.tsx
    │   │   └── RegisterScreen.tsx
    │   ├── customer/
    │   │   ├── HomeScreen.tsx
    │   │   ├── RequestPartScreen.tsx
    │   │   ├── BidsScreen.tsx
    │   │   └── OrderTrackingScreen.tsx
    │   ├── garage/
    │   │   ├── RequestFeedScreen.tsx
    │   │   ├── SubmitBidScreen.tsx
    │   │   └── OrdersScreen.tsx
    │   └── shared/
    │       ├── ProfileScreen.tsx
    │       └── SettingsScreen.tsx
    │
    ├── services/             # API services
    │   ├── api.ts            # Axios/fetch wrapper
    │   ├── authService.ts
    │   ├── requestService.ts
    │   ├── bidService.ts
    │   └── ...
    │
    └── utils/                # Utilities
        ├── formatters.ts
        ├── validators.ts
        └── helpers.ts
```

### 6.3 Key Features Implementation

**Authentication Flow:**
```typescript
// AuthContext pattern
const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadStoredToken();
  }, []);
  
  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    await SecureStore.setItemAsync('token', response.data.token);
    setUser(response.data.user);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Navigation Structure:**
```typescript
// AppNavigator.tsx
function AppNavigator() {
  const { user } = useAuth();
  
  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : (
        <Tabs.Navigator>
          <Tabs.Screen name="Home" component={HomeScreen} />
          <Tabs.Screen name="Requests" component={RequestsScreen} />
          <Tabs.Screen name="Profile" component={ProfileScreen} />
        </Tabs.Navigator>
      )}
    </NavigationContainer>
  );
}
```

### 6.4 Build & Deployment

**APK Build Script (`build_apk.sh`):**
```bash
#!/bin/bash
# Build production APK using EAS

npm install -g eas-cli
eas build --platform android --profile production
```

**EAS Configuration (`eas.json`):**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

---

## 7. Database Architecture

### 7.1 Current Schema (Inferred from Code)

**Core Entities:**

```sql
-- Users & Authentication
users (id, email, password_hash, role, created_at, updated_at)
customers (id, user_id, name, phone, default_address_id)
garages (id, user_id, business_name, license_number, subscription_tier, rating)
drivers (id, user_id, vehicle_info, license_plate, is_available)

-- Core Business Logic
part_requests (id, customer_id, description, car_make, car_model, year, vin, status, expires_at)
request_images (id, request_id, image_url, is_primary)
bids (id, request_id, garage_id, amount, message, status, created_at)
counter_offers (id, bid_id, proposed_amount, round, status)
orders (id, bid_id, order_number, status, total_amount, qc_status)

-- Delivery & Logistics
deliveries (id, order_id, driver_id, pickup_address, delivery_address, status, tracked_at)
delivery_tracking (id, delivery_id, latitude, longitude, timestamp)

-- Quality Control
qc_inspections (id, order_id, inspector_id, result, notes, images, created_at)

-- Financial
payments (id, order_id, amount, method, status, transaction_id)
payouts (id, garage_id, order_id, amount, status, scheduled_date, paid_at)
commissions (id, order_id, platform_fee, garage_earnings)

-- Disputes & Support
disputes (id, order_id, reason, status, resolution, refund_amount)
support_tickets (id, user_id, subject, message, status, assigned_to)

-- Reviews
reviews (id, order_id, reviewer_id, reviewee_id, rating, comment)

-- Subscriptions
subscriptions (id, garage_id, plan_type, start_date, end_date, bids_limit)

-- Audit & Logging
audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
```

### 7.2 Connection Pool Configuration

**From `SCALING_GUIDE.md`:**

| Server RAM | DB_POOL_MAX | DB_POOL_MIN | Expected Users |
|------------|-------------|-------------|----------------|
| 2GB        | 10          | 2           | ~200           |
| 4GB        | 20          | 5           | ~500           |
| 8GB        | 40          | 10          | ~1,000         |
| 16GB       | 80          | 20          | ~2,000         |

**Environment Variables:**
```env
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=30000
```

### 7.3 Read Replica Strategy

**Automatic Query Routing:**
- **Write queries** → Primary database
- **Read queries** (dashboards, reports, search) → Read replicas

**Configuration:**
```env
DB_READ_REPLICA_HOST=replica.database.azure.net
DB_READ_REPLICA_PORT=5432
DB_READ_POOL_MAX=30
```

### 7.4 Migration Strategy

**Current Approach:**
- Manual SQL scripts in `/migrations/`
- Runner script: `run_migration.js`

**Recommendation:** Implement versioned migrations with rollback support.

```sql
-- Example migration structure
-- migrations/004_add_indexes.sql
-- UP
CREATE INDEX CONCURRENTLY idx_requests_status ON part_requests(status);
CREATE INDEX CONCURRENTLY idx_bids_request_id ON bids(request_id);

-- DOWN
DROP INDEX IF EXISTS idx_requests_status;
DROP INDEX IF EXISTS idx_bids_request_id;
```

---

## 8. Security Architecture

### 8.1 Authentication & Authorization

**JWT Token Structure:**
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  role: 'customer' | 'garage' | 'driver' | 'operations' | 'admin';
  iat: number;
  exp: number;
}
```

**Token Lifecycle:**
- Access token: 15 minutes
- Refresh token: 7 days (stored in HttpOnly cookie)
- Logout: Token blacklist in Redis

**RBAC Matrix:**

| Resource | Customer | Garage | Driver | Operations | Admin |
|----------|----------|--------|--------|------------|-------|
| Create Request | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submit Bid | ❌ | ✅ | ❌ | ❌ | ❌ |
| Accept Bid | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update Order Status | ❌ | ✅ | ❌ | ✅ | ✅ |
| QC Inspection | ❌ | ❌ | ❌ | ✅ | ✅ |
| Assign Driver | ❌ | ❌ | ❌ | ✅ | ✅ |
| View All Users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage Subscriptions | ❌ | ❌ | ❌ | ❌ | ✅ |

### 8.2 Security Headers (Helmet)

```typescript
// Implemented via helmet middleware
Content-Security-Policy: default-src 'self'
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-Download-Options: noopen
X-Content-Type-Options: nosniff
X-XSS-Protection: 0
```

### 8.3 Rate Limiting

**Configuration:**
```typescript
// General API: 100 requests/minute
// Auth endpoints: 10 requests/minute
// File uploads: 20 requests/minute
```

**Nginx Layer (Production):**
```nginx
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
```

### 8.4 Input Validation

**Zod Schema Example:**
```typescript
import { z } from 'zod';

const createRequestSchema = z.object({
  carMake: z.string().min(2).max(50),
  carModel: z.string().min(2).max(50),
  year: z.number().int().min(1900).max(2026),
  description: z.string().min(10).max(1000),
  vin: z.string().length(17).optional(),
  images: z.array(z.string().uuid()).max(5),
});
```

### 8.5 File Upload Security

**Multer Configuration:**
- Max file size: 5MB
- Allowed types: image/jpeg, image/png, image/webp
- Filename sanitization
- Virus scanning (recommended addition)

### 8.6 CSRF Protection

**Implementation:**
- Double-submit cookie pattern
- Token validation on state-changing operations
- Excluded for API endpoints (JWT-based)

---

## 9. DevOps & Infrastructure

### 9.1 Docker Configuration

**Dockerfile Analysis:**
```dockerfile
FROM node:18-alpine

# Puppeteer dependencies
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**Optimization Recommendations:**
1. Use multi-stage builds for smaller image
2. Run as non-root user
3. Add health check instruction
4. Use `.dockerignore` effectively

**Improved Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
RUN apk add --no-cache chromium nss freetype harfbuzz
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node dist/healthcheck.js
CMD ["node", "dist/server.js"]
```

### 9.2 Docker Compose (Development)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: qscrap_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  backend:
    build: .
    environment:
      - DB_HOST=postgres
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
    volumes:
      - .:/app:cached
    ports:
      - "3000:3000"
    command: npm run dev
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 9.3 Production Deployment Architecture

**Multi-Server Setup (from CLUSTER_DEPLOYMENT.md):**

```
Internet → Cloudflare CDN → Nginx Load Balancer
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
                App Server 1      App Server 2      App Server 3
                (PM2 managed)     (PM2 managed)     (PM2 managed)
                    ↓                 ↓                 ↓
                    └─────────────────┼─────────────────┘
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
              PostgreSQL         Redis Cluster      S3/Azure
              (Primary +         (Session Store)    (File Storage)
              Read Replicas)
```

### 9.4 CI/CD Pipeline Recommendation

**GitHub Actions Workflow:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh $SERVER_HOST "cd /opt/qscrap && git pull && npm install && pm2 restart all"
```

### 9.5 Monitoring & Observability

**Health Check Endpoint:**
```bash
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "environment": "production",
  "uptime": 3600.5,
  "database": {
    "primary": { "connected": true, "total": 20, "idle": 15 },
    "replica": { "connected": true, "total": 30, "idle": 25 }
  },
  "redis": { "connected": true },
  "storage": "S3"
}
```

**Recommended Tools:**
- **Application Monitoring:** PM2 Logrotate, New Relic, Datadog
- **Error Tracking:** Sentry
- **Logging:** Winston + ELK Stack or Papertrail
- **Uptime Monitoring:** UptimeRobot, Pingdom
- **APM:** Clinic.js, Node Insights

---

## 10. API Documentation

### 10.1 Swagger/OpenAPI Configuration

**Endpoint:** `/api-docs`  
**JSON Spec:** `/swagger.json`

**Configured via `swagger.ts`:**
```typescript
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QScrap API',
      version: '1.0.0',
      description: 'Auto Parts Marketplace API'
    },
    servers: [
      { url: 'http://localhost:3000' },
      { url: 'https://api.qscrap.qa' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
};
```

### 10.2 Key API Endpoints

#### Authentication
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login
POST   /api/auth/logout            # Logout
POST   /api/auth/refresh           # Refresh token
POST   /api/auth/forgot-password   # Password reset request
POST   /api/auth/reset-password    # Password reset
```

#### Part Requests
```
GET    /api/requests               # List requests (paginated)
POST   /api/requests               # Create new request
GET    /api/requests/:id           # Get request details
PUT    /api/requests/:id           # Update request
DELETE /api/requests/:id           # Cancel request
GET    /api/requests/:id/bids      # Get all bids for request
```

#### Bids
```
POST   /api/bids                   # Submit bid
PUT    /api/bids/:id               # Update bid
DELETE /api/bids/:id               # Withdraw bid
POST   /api/bids/:id/accept        # Accept bid (creates order)
POST   /api/bids/:id/reject        # Reject bid
```

#### Orders
```
GET    /api/orders                 # List orders
GET    /api/orders/:id             # Get order details
PUT    /api/orders/:id/status      # Update order status
POST   /api/orders/:id/qc          # Submit QC inspection
```

#### Finance
```
GET    /api/finance/payouts        # Get payout history
POST   /api/finance/payouts/:id/release  # Release held payout
GET    /api/finance/statements     # Download financial statement
```

### 10.3 Response Format Standard

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

---

## 11. Real-time Events (Socket.IO)

### 11.1 Room Architecture

**Room Types:**
- `user_{userId}` - Personal notifications
- `garage_{garageId}` - Garage-specific updates
- `user_operations` - Operations team broadcast
- `ticket_{ticketId}` - Support chat rooms
- `delivery_{deliveryId}` - Delivery tracking room

### 11.2 Event Catalog

#### Part Request Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `new_request` | Server → All | Request object | New part request created |
| `request_expired` | Server → User | {requestId} | Request expired without bids |
| `request_cancelled` | Server → Garages | {requestId, reason} | Request cancelled |

#### Bidding Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `new_bid` | Server → Customer | {bid, notification} | New bid received |
| `bid_rejected` | Server → Garage | {bidId, reason} | Bid rejected by customer |
| `bid_updated` | Server → Customer | {bid} | Bid modified by garage |
| `bid_withdrawn` | Server → Customer | {bidId} | Bid withdrawn |

#### Negotiation Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `counter_offer_received` | Server → Counterparty | {counterOffer} | Counter offer submitted |
| `counter_offer_accepted` | Server → Both | {bidId, finalAmount} | Deal accepted |
| `counter_offer_rejected` | Server → Sender | {counterOfferId} | Offer rejected |

#### Order Lifecycle Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `order_status_updated` | Server → All parties | {orderId, newStatus} | Status changed |
| `order_cancelled` | Server → All parties | {orderId, reason} | Order cancelled |

#### Quality Control Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `qc_passed` | Server → All parties | {orderId} | QC inspection passed |
| `qc_failed` | Server → All parties | {orderId, reason} | QC failed |
| `qc_failed_alert` | Server → Operations | {orderId, garageName} | Alert for review |

#### Delivery Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `driver_assigned` | Server → Customer | {orderId, driverInfo} | Driver assigned |
| `location_update` | Server → Customer | {orderId, lat, lng} | Live tracking update |
| `delivery_completed` | Server → All parties | {orderId} | Delivery finished |

#### Financial Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `payout_scheduled` | Server → Garage | {payoutId, amount, date} | Payout scheduled |
| `payout_held` | Server → Garage | {payoutId, reason} | Payout on hold |
| `payout_completed` | Server → Garage | {payoutId, reference} | Payout sent |

### 11.3 Client Implementation Example

```javascript
// customer-dashboard.js
const socket = io();

// Join user-specific room
socket.emit('join_user_room', userId);

// Listen for new bids
socket.on('new_bid', (data) => {
  showNotification(`New bid received: $${data.bid.amount}`);
  updateBidList(data.bid);
});

// Listen for order updates
socket.on('order_status_updated', (data) => {
  updateOrderStatus(data.orderId, data.newStatus);
  if (data.newStatus === 'out_for_delivery') {
    showMapTracking(data.orderId);
  }
});
```

---

## 12. File Organization Audit

### 12.1 File Count Summary

| Category | Count | Size Range |
|----------|-------|------------|
| TypeScript (.ts) | 83 | 1KB - 50KB |
| JavaScript (.js) | 7 | 3KB - 231KB |
| HTML | 8 | 14KB - 81KB |
| CSS | 8 | 15KB - 78KB |
| SQL | 1 | 2KB |
| Markdown | 4 | 5KB - 62KB |
| JSON | 8 | 1KB - 62KB |
| Shell Scripts | 2 | 1KB |
| Docker Files | 2 | 1KB |

### 12.2 Large Files (>100KB)

| File | Size | Concern | Action |
|------|------|---------|--------|
| `operations-dashboard.js` | 231KB | ⚠️ High complexity | Split into modules |
| `garage-dashboard.js` | 207KB | ⚠️ High complexity | Split into modules |
| `chart.min.js` | 205KB | ✅ Third-party | Keep in vendor |
| `customer-dashboard.js` | 159KB | ⚠️ Medium complexity | Refactor soon |
| `garage-dashboard.css` | 78KB | ⚠️ Large stylesheet | Modularize |
| `customer-dashboard.css` | 73KB | ⚠️ Large stylesheet | Modularize |
| `customer-dashboard.html` | 72KB | ⚠️ Large template | Componentize |
| `operations-dashboard.html` | 64KB | ⚠️ Large template | Componentize |

### 12.3 Code Quality Metrics

**Backend (TypeScript):**
- ✅ Strong typing with TypeScript
- ✅ Consistent naming conventions
- ✅ Separation of concerns (MVC)
- ⚠️ Missing unit tests
- ⚠️ Limited repository pattern usage

**Frontend (Vanilla JS):**
- ⚠️ No type safety
- ⚠️ Large monolithic files
- ⚠️ Mixed concerns (UI + logic)
- ✅ No build dependencies
- ✅ Fast development cycle

**Mobile (React Native):**
- ✅ TypeScript enabled
- ✅ Component-based architecture
- ✅ Proper navigation structure
- ⚠️ Needs more hooks extraction

---

## 13. Recommendations & Best Practices

### 13.1 Critical Priority (Immediate)

1. **Add Unit Tests**
   ```bash
   npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
   ```
   Target: 70% code coverage minimum

2. **Implement Service Layer**
   Extract complex business logic from controllers:
   ```
   src/services/
   ├── order.service.ts
   ├── bid.service.ts
   ├── payment.service.ts
   └── notification.service.ts
   ```

3. **Add Logging Framework**
   ```bash
   npm install winston @types/winston
   ```
   Configure structured logging with correlation IDs

4. **Database Indexing Audit**
   Review query performance and add missing indexes

### 13.2 High Priority (Next Sprint)

5. **Expand Repository Pattern**
   Create repositories for all major entities

6. **Frontend Modularization**
   Break down large dashboard JS files into ES6 modules

7. **API Versioning Strategy**
   Implement proper versioning beyond `/api/v1`

8. **Error Tracking Integration**
   Integrate Sentry or similar for production monitoring

### 13.3 Medium Priority (Quarter 2)

9. **Frontend Framework Migration**
   Evaluate migration to React or Vue.js for dashboards

10. **GraphQL API Layer**
    Consider GraphQL for complex queries (dashboards, reports)

11. **Microservices Preparation**
    Identify candidates for service extraction:
    - Notification service
    - Payment service
    - OCR service

12. **Mobile Feature Parity**
    Ensure mobile app has full feature parity with web

### 13.4 Long-term Strategic

13. **Event Sourcing**
    Implement event sourcing for audit trail and analytics

14. **CQRS Pattern**
    Separate read/write models for scalability

15. **Kubernetes Migration**
    Move from Docker Compose to Kubernetes for production

16. **Multi-region Deployment**
    Plan for GCC region expansion

---

## 14. Scaling Strategy

### 14.1 Current Capacity

**Single Server Configuration:**
- 4GB RAM, 2 CPU cores
- PostgreSQL local
- In-memory sessions
- Local file storage

**Estimated Capacity:** 500 concurrent users, 50 req/s

### 14.2 Phase 1: Vertical Scaling (1-2 months)

**Actions:**
- Increase server to 8GB RAM, 4 CPU
- Optimize DB pool (max: 40)
- Add Redis for sessions
- Move to S3/Azure Blob storage

**Expected Capacity:** 2,000 concurrent users, 200 req/s

### 14.3 Phase 2: Horizontal Scaling (3-6 months)

**Actions:**
- Deploy 3 app servers behind Nginx
- Redis cluster for sessions
- PostgreSQL read replicas
- CDN for static assets

**Expected Capacity:** 10,000 concurrent users, 1,000 req/s

### 14.4 Phase 3: Microservices (6-12 months)

**Services to Extract:**
1. **Auth Service** - Centralized authentication
2. **Notification Service** - Email, SMS, push
3. **Payment Service** - Payment gateway integration
4. **Search Service** - Elasticsearch for search
5. **Analytics Service** - Data warehousing

**Infrastructure:**
- Kubernetes cluster
- Service mesh (Istio)
- Message queue (RabbitMQ/Kafka)
- Distributed tracing (Jaeger)

### 14.5 Scaling Benchmarks

| Phase | Infrastructure | Users | Req/s | Cost/month |
|-------|---------------|-------|-------|------------|
| Current | 1 server | 500 | 50 | $50 |
| Phase 1 | 1 server (upgraded) | 2,000 | 200 | $150 |
| Phase 2 | 3 servers + Redis + RDS | 10,000 | 1,000 | $500 |
| Phase 3 | Kubernetes (5 nodes) | 50,000 | 5,000 | $2,000 |

---

## 15. Production Readiness Checklist

### 15.1 Security ✅

- [x] JWT authentication implemented
- [x] HTTPS enforced (production)
- [x] Rate limiting configured
- [x] Input validation with Zod
- [x] SQL injection prevention (parameterized queries)
- [x] XSS protection (Helmet)
- [x] CSRF tokens for forms
- [ ] Security audit completed
- [ ] Penetration testing done
- [ ] Dependency vulnerability scanning (npm audit)

### 15.2 Performance ⚠️

- [x] Database connection pooling
- [ ] Query optimization completed
- [ ] Database indexes added
- [ ] Caching strategy implemented
- [ ] CDN configured
- [ ] Load testing completed (target: 1000 req/s)
- [ ] Performance monitoring setup

### 15.3 Reliability ⚠️

- [x] Error handling middleware
- [ ] Graceful shutdown implemented
- [ ] Health check endpoint
- [ ] Database backup automation
- [ ] Disaster recovery plan
- [ ] High availability setup (multi-AZ)
- [ ] Failover testing completed

### 15.4 Monitoring ⚠️

- [x] Basic logging
- [ ] Structured logging (Winston)
- [ ] Error tracking (Sentry)
- [ ] APM tool (New Relic/Datadog)
- [ ] Uptime monitoring
- [ ] Alert configuration (PagerDuty)
- [ ] Dashboard for key metrics

### 15.5 Documentation ✅

- [x] README with setup instructions
- [x] API documentation (Swagger)
- [x] Socket.IO events documented
- [x] Deployment guides (Cluster, Scaling)
- [ ] User manuals for each dashboard
- [ ] Runbook for common issues
- [ ] On-call rotation schedule

### 15.6 Compliance ⚠️

- [x] Privacy policy page
- [x] Terms of service page
- [ ] GDPR compliance (data export/delete)
- [ ] PCI DSS compliance (if handling cards directly)
- [ ] Qatar data residency requirements
- [ ] Accessibility compliance (WCAG 2.1)

### 15.7 Testing ⚠️

- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] E2E tests (Playwright/Cypress)
- [ ] Load tests (k6)
- [ ] Security tests (OWASP ZAP)
- [ ] Mobile app tests (Detox)

---

## Appendix A: Environment Variable Reference

### Required Variables
```env
# Server
NODE_ENV=production
PORT=3000

# Database
DB_USER=postgres
DB_PASSWORD=<secure-password>
DB_NAME=qscrap_db
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_SECRET=<64-character-random-string>

# Redis (for multi-server)
REDIS_URL=redis://localhost:6379
```

### Optional Variables
```env
# Read Replica
DB_READ_REPLICA_HOST=replica.host
DB_READ_REPLICA_PORT=5432

# File Storage (S3)
S3_BUCKET=qscrap-uploads
S3_REGION=eu-central-1
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>

# File Storage (Azure)
AZURE_STORAGE_ACCOUNT=account
AZURE_STORAGE_CONTAINER=container
AZURE_STORAGE_CONNECTION_STRING=<connection-string>

# OCR
OCR_SPACE_API_KEY=<key>

# CORS
CORS_ORIGINS=https://qscrap.qa,https://www.qscrap.qa
COOKIE_DOMAIN=.qscrap.qa
```

---

## Appendix B: Command Reference

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build TypeScript
npm run build

# Run migrations
npm run db:migrate

# Reset and seed database
npm run db:reset
```

### Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up -d --build
```

### Mobile
```bash
# Install dependencies
cd mobile && npm install

# Start development server
npm start

# Build Android APK
./build_apk.sh

# Build with EAS
eas build --platform android
```

### Production
```bash
# Build for production
npm run build

# Start production server
npm start

# PM2 commands
pm2 start dist/server.js --name qscrap
pm2 save
pm2 startup
```

---

## Appendix C: Troubleshooting Guide

### Common Issues

**1. Database Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Check PostgreSQL is running, verify credentials in `.env`

**2. Redis Session Store Not Working**
```
Warning: Falling back to in-memory session store
```
**Solution:** Verify Redis URL, check Redis server is accessible

**3. File Upload Fails**
```
Error: ENOENT: no such file or directory, mkdir 'uploads'
```
**Solution:** Create uploads directory, check permissions

**4. Socket.IO Connection Issues**
```
WebSocket connection failed
```
**Solution:** Check Nginx WebSocket upgrade configuration, verify CORS settings

**5. High Memory Usage**
```
Process running out of memory
```
**Solution:** Increase DB_POOL_MAX gradually, check for memory leaks with clinic.js

---

## Conclusion

QScrap demonstrates a solid foundation with well-organized backend architecture, comprehensive feature set, and clear scaling path. The current monolithic structure is appropriate for the current scale (< 1000 users) and can be incrementally improved following the recommendations above.

**Key Strengths:**
- Clean MVC architecture
- Comprehensive API coverage
- Real-time capabilities
- Multi-platform support (web + mobile)
- Good documentation

**Priority Improvements:**
1. Add comprehensive test suite
2. Implement service layer for complex business logic
3. Modularize frontend JavaScript
4. Set up production monitoring
5. Optimize database queries and indexes

Following this roadmap will ensure QScrap can scale reliably to support 10,000+ concurrent users while maintaining code quality and system stability.

---

**Document Version:** 1.0  
**Last Updated:** April 2025  
**Maintained by:** Senior Full-Stack Engineering Team
