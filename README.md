# QScrap Platform - Enterprise Automotive Marketplace

**Version:** 2.0  
**Status:** Production-Ready  
**License:** Proprietary  
**Canonical Architecture:** See [BRAIN.MD](BRAIN.MD) for the single source of truth  

---

## 🚀 Platform Overview

QScrap is Qatar's first **enterprise-grade automotive spare parts marketplace** offering:
- **Parts Marketplace**: Spare parts bidding & delivery (✅ Live)
- **Escrow & Buyer Protection**: 7-day warranty hold with proof-of-condition (✅ Live)
- **Partner Revenue**: Analytics, Loyalty, Ads, Subscriptions (✅ Live)
- **Quick Services**: Battery, oil, wash, tire, AC, breakdown (🔜 Phase 2)
- **Repair Services**: Workshop bookings & mobile mechanics (🔜 Phase 2)
- **Insurance Integration**: MOI reports, pricing analytics (🔜 Phase 3)

**Revenue Potential:** 295k QAR/year  
**Market Position:** Leader in Qatar automotive sector  

---

## 📊 Technical Stack

**Backend:**
- Node.js 18+ with Express.js
- TypeScript for type safety
- PostgreSQL 14+ (primary database)
- Redis for caching & real-time features
- Socket.IO for WebSocket communication

**Frontend:**
- React Native (Expo) for mobile apps
- Vanilla HTML/CSS/JS for dashboards
- Premium Qatar VVIP theme (Maroon & Gold)

**Infrastructure:**
- VPS: Hetzner (Doha Region)
- Nginx reverse proxy with TLS + Cloudflare
- Docker Compose (Backend, PostgreSQL 14, Redis)
- GitHub Actions CI/CD → GHCR → Docker pull on VPS

---

## 🛠️ Quick Start

### Prerequisites
```bash
Node.js >= 18
PostgreSQL >= 14
Redis >= 6
npm or yarn
```

### Installation

1. **Clone repository:**
```bash
git clone https://github.com/mechimaher/qscrap.git
cd qscrap
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run database migrations:**
```bash
npm run migrate
```

5. **Start development server:**
```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## 🗂️ Project Structure

```
qscrap/
├── src/                    # Backend source code
│   ├── config/            # Database, Redis, jobs
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── routes/            # API endpoints
│   ├── middleware/        # Auth, validation, rate limiting
│   └── utils/             # Helper functions
├── mobile/                # Customer mobile app
│   ├── src/
│   │   ├── screens/      # App screens
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API clients
│   │   └── navigation/   # App navigation
│   └── build_customer_apk.sh
├── driver-mobile/        # Driver mobile app
├── public/               # Web dashboards & website
│   ├── admin-dashboard.html
│   ├── garage-dashboard.html
│   ├── operations-dashboard.html
│   ├── finance-dashboard.html
│   ├── support-dashboard.html
│   └── css/
├── uploads/              # User uploads
└── tests/               # Automated tests

```

---

## 🔑 API Documentation

### Authentication

**Login:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone_number": "+97412345678",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": "uuid",
    "full_name": "Ahmed Al-Mansoori",
    "role": "customer"
  }
}
```

### Quick Services (🔜 Phase 2 — Not Yet Implemented)

The following on-demand services are planned for Phase 2:
- Battery replacement
- Oil change
- Home car wash
- Tire service/repair
- AC gas refill
- Emergency breakdown assistance

### Complete API Docs

Visit `/api-docs` when server is running for interactive Swagger documentation.
See [BRAIN.MD](BRAIN.MD) Section 3.5 for the full 345-endpoint API reference.

---

## 🧪 Testing

**Run all tests:**
```bash
npm test
```

**Run with coverage:**
```bash
npm run test:coverage
```

**Run specific test:**
```bash
npm test -- loyalty.service.test
```

**Coverage Targets (see COVERAGE-IMPROVEMENT-PLAN.md):**
- Current: ~24%
- Target: 70% (branches, functions, lines, statements)
- Priority: Payment/escrow flows, order state machine

---

## 📦 Deployment

### Production Build

```bash
# Backend
npm run build
npm start

# Mobile App
cd mobile
./build_customer_apk.sh
```

### VPS Deployment (Docker Compose)

```bash
# SSH to server
ssh root@147.93.89.153

# Navigate to project
cd /opt/qscrap

# Pull latest and rebuild
git pull origin main
docker compose build --no-cache backend
docker compose up -d

# Run migrations
docker exec qscrap-backend node scripts/migrate.js

# Health check
curl -s https://api.qscrap.qa/health | jq
```

### Database Backup

```bash
# Manual backup
docker exec qscrap-postgres pg_dump -U postgres qscrap_db > backup.sql

# Automated backup (daily)
# See: /opt/scripts/backup.sh
```

---

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qscrap_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# Rate Limiting
RATE_LIMIT_WINDOW=15      # minutes
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
SENTRY_DSN=your_sentry_dsn (optional)
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────┐
│   Customers │
│  (Mobile App)│
└──────┬──────┘
       │
┌──────▼──────┐     ┌──────────┐
│   API Layer │◄────┤ Dashboards│
│  (Express)  │     └──────────┘
└──────┬──────┘
       │
┌──────▼──────┐     ┌──────────┐
│  Services   │◄────┤  Cache   │
│   Layer     │     │  (Redis) │
└──────┬──────┘     └──────────┘
       │
┌──────▼──────┐
│  Database   │
│ (PostgreSQL)│
└─────────────┘
```

### Request Lifecycle

1. **Client Request** → API endpoint
2. **Authentication** → JWT validation
3. **Validation** → Zod schema check
4. **Rate Limiting** → Abuse prevention
5. **Business Logic** → Service layer
6. **Database** → Query execution
7. **Cache** → Redis for performance
8. **Response** → JSON to client

---

## 🎯 Key Features

### For Customers (✅ Live)
- 🔍 Request spare parts (multi-garage bidding)
- 🚚 Real-time delivery tracking
- 🎁 Loyalty rewards (4-tier system)
- ⭐ Ratings & reviews
- 🔄 30-second undo for accidental orders
- 💬 In-app chat with garages

### For Partners / Garages (✅ Live)
- 📊 Analytics dashboard
- 💰 Revenue management & payout tracking
- 💳 Premium subscriptions (5 tiers: Demo → Platinum)
- 📦 Inventory & showcase management
- 🤝 3-round negotiation system

### For Operations (✅ Live)
- 👥 User management
- 💵 Payout processing (2-way confirmation)
- 🎫 Support tickets with SLA tracking
- 📈 Platform analytics
- ⚙️ System configuration

### Planned Features (🔜 Phase 2-3)
- ⚡ Quick services (battery, oil, wash, tire, AC, breakdown)
- 🔧 Workshop bookings & mobile mechanics
- 📄 Insurance integration (MOI reports, pricing benchmarks)
- 📢 Ad campaigns for garages

---

## 📈 Performance Metrics

**Current Performance:**
- API Response Time: ~50ms (p95)
- Database Query Time: ~20ms (p95)
- Socket.IO Latency: <50ms
- Cache Hit Rate: 80%+
- Test Coverage: ~24% (target: 70%)
- Uptime: 99.9%+

---

## 🔐 Security

**Implemented:**
- ✅ JWT authentication (15m access + 7d refresh tokens)
- ✅ Input validation (Zod + express-validator)
- ✅ Rate limiting (express-rate-limit per endpoint)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (Helmet + request sanitization)
- ✅ CORS configuration (origin whitelist)
- ✅ Helmet security headers (HSTS, CSP, X-Frame-Options)
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ CSRF protection (double-submit cookie)
- ✅ Audit logging (`audit_logs`, `admin_audit_log` tables)
- ✅ Idempotency keys (payment deduplication)
- ✅ Stripe webhook signature verification

**Planned:**
- [ ] Two-factor authentication
- [ ] IP whitelisting (admin)
- [ ] Penetration testing
- [ ] CSP nonce migration (remove `unsafe-inline`)

---

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Restart container
docker restart qscrap-postgres
```

**Redis Not Connected:**
```bash
# Check Redis is running
docker ps | grep redis

# Test connection
redis-cli -h localhost -p 6379 ping
```

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

**Migration Errors:**
```bash
# Roll back last migration
npm run migrate:rollback

# Re-run migrations
npm run migrate
```

---

## 📞 Support

**Technical Issues:**
- GitHub Issues: https://github.com/mechimaher/qscrap/issues
- Email: support@qscrap.qa

**Business Inquiries:**
- Email: business@qscrap.qa
- Phone: +974 XXXX XXXX

---

## 📄 License

Copyright © 2026 QScrap. All rights reserved.

Proprietary software - Not for redistribution.

---

## 🙏 Acknowledgments

Built with exceptional execution and enterprise-grade standards for Qatar's automotive market.

**Technology Partners:**
- Node.js Foundation
- PostgreSQL Community
- React Native Team
- Expo Framework

**Status:** Production-Ready | Market-Leading Platform
