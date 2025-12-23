# QScrap - Auto Parts Marketplace for Qatar 🚗

A comprehensive B2B2C marketplace connecting customers seeking auto parts with garages (scrapyards) in Qatar. Built with real-time bidding, quality control, and integrated delivery management.

## 🌟 Features

### For Customers
- **Smart Part Requests** - Submit requests with photos, VIN scanning, and location-based delivery
- **Real-time Bidding** - Receive competitive bids from multiple garages
- **Price Negotiation** - Counter-offer system with up to 3 negotiation rounds
- **Order Tracking** - Live delivery tracking with driver chat
- **Quality Assurance** - QC inspection before delivery

### For Garages
- **Live Request Feed** - Real-time part requests with urgency indicators
- **Bid Management** - Submit, update, and track bids
- **Order Dashboard** - Manage orders through the fulfillment pipeline
- **Earnings & Payouts** - Track commissions and download statements
- **Subscription Plans** - Tiered access with bid limits

### For Operations
- **QC Inspections** - Quality control workflow with pass/fail decisions
- **Delivery Management** - Driver assignment and route optimization
- **Dispute Resolution** - Handle customer complaints and refunds
- **Financial Reports** - Revenue, payouts, and commission tracking

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL |
| **Cache** | Redis |
| **Real-time** | Socket.IO |
| **Frontend** | Vanilla JS + Bootstrap Icons + Leaflet Maps |
| **File Storage** | Local (configurable for S3) |

## 📁 Project Structure

```
QScrap/
├── src/
│   ├── controllers/     # Business logic (20+ controllers)
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, validation, rate limiting
│   └── config/          # Database, Redis, jobs
├── public/
│   ├── customer-dashboard.html
│   ├── garage-dashboard.html
│   ├── operations-dashboard.html
│   ├── css/             # Modular stylesheets
│   ├── js/              # Dashboard logic
│   └── driver-app/      # PWA for drivers
└── dist/                # Compiled TypeScript
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
node run_migration.js

# Build TypeScript
npm run build

# Start server
npm start
```

### Development

```bash
npm run dev  # Starts with nodemon + ts-node
```

## 📊 API Overview

| Module | Endpoints |
|--------|-----------|
| Auth | `/api/auth/*` - Login, register, logout |
| Requests | `/api/requests/*` - Create, view, cancel |
| Bids | `/api/bids/*` - Submit, update, withdraw |
| Orders | `/api/orders/*` - Accept, confirm, track |
| Delivery | `/api/delivery/*` - Assignment, tracking |
| Quality | `/api/quality/*` - Inspection workflow |
| Finance | `/api/finance/*` - Payouts, commissions |
| Support | `/api/support/*` - Tickets, chat |

## 🔌 Socket.IO Events

Real-time updates for:
- New part requests
- Bid submissions and acceptances
- Order status changes
- Delivery tracking
- Chat messages

## 📱 Dashboards

- **Customer**: `/customer-dashboard.html`
- **Garage**: `/garage-dashboard.html`
- **Operations**: `/operations-dashboard.html`
- **Driver PWA**: `/driver-app/index.html`

## 🔐 Security

- JWT authentication
- Rate limiting
- Input validation
- XSS protection
- CSRF tokens

## 📄 License

Private - All rights reserved

---

Built with ❤️ for the Qatar auto parts industry
