# 🧠 BACKEND_BRAIN - QScrap System Inventory

**Version:** 1.0 | **Generated:** February 4, 2026 | **Auto-Updated:** Weekly

---

## Quick Stats

| Component | Count |
|-----------|-------|
| Route Files | 35 |
| Controllers | 30 |
| Services | 90+ |
| Middleware | 12 |
| Database Tables | 81+ |
| Socket.IO Events | 20+ |

---

## 1. Controllers (30)

| Controller | File | Domain |
|------------|------|--------|
| AdController | ad.controller.ts | Marketing |
| AddressController | address.controller.ts | Customer |
| AdminController | admin.controller.ts | Admin |
| AdminReportsController | admin-reports.controller.ts | Admin |
| AnalyticsController | analytics.controller.ts | Garage |
| AuthController | auth.controller.ts | Identity |
| BidController | bid.controller.ts | Bidding |
| CancellationController | cancellation.controller.ts | Orders |
| ChatController | chat.controller.ts | Communication |
| DashboardController | dashboard.controller.ts | Garage |
| DashboardUrgentController | dashboard-urgent.controller.ts | Garage |
| DeliveryController | delivery.controller.ts | Logistics |
| DisputeController | dispute.controller.ts | Support |
| DocumentsController | documents.controller.ts | Compliance |
| DriverController | driver.controller.ts | Logistics |
| FinanceController | finance.controller.ts | Finance |
| HistoryController | history.controller.ts | Orders |
| LoyaltyController | loyalty.controller.ts | Customer |
| NegotiationController | negotiation.controller.ts | Bidding |
| NotificationController | notification.controller.ts | Communication |
| OperationsController | operations.controller.ts | Operations |
| OrderController | order.controller.ts | Orders |
| ReportsController | reports.controller.ts | Admin |
| RequestController | request.controller.ts | Bidding |
| ReviewsController | reviews.controller.ts | Reviews |
| SearchController | search.controller.ts | Discovery |
| ShowcaseController | showcase.controller.ts | Garage |
| SubscriptionController | subscription.controller.ts | B2B |
| SupportController | support.controller.ts | Support |
| VehicleController | vehicle.controller.ts | Customer |

---

## 2. Services by Domain

### Identity & Auth
| Service | Purpose |
|---------|---------|
| auth.service.ts | Login, registration, JWT |
| otp.service.ts | Phone verification |
| account-deletion.service.ts | GDPR/data deletion |
| user-management.service.ts | User CRUD |

### Customer
| Service | Purpose |
|---------|---------|
| address.service.ts | Delivery addresses |
| vehicle.service.ts | Customer vehicles |
| loyalty.service.ts | Points & rewards |
| vin.service.ts | VIN decoding |

### Bidding & Negotiation
| Service | Purpose |
|---------|---------|
| bid.service.ts | Bid creation |
| bid-management.service.ts | Bid lifecycle |
| bid-query.service.ts | Bid queries |
| negotiation.service.ts | Counter-offers |
| request.service.ts | Part requests |
| request-lifecycle.service.ts | Request states |
| request-filtering.service.ts | Request matching |
| request-expiry-warning.service.ts | Expiry notifications |

### Orders & Fulfillment
| Service | Purpose |
|---------|---------|
| order.service.ts | Order creation |
| order-management.service.ts | Order lifecycle |
| cancellation.service.ts | Cancellation flow |
| return.service.ts | 7-day returns |
| escrow.service.ts | Payment escrow |

### Logistics & Delivery
| Service | Purpose |
|---------|---------|
| delivery.service.ts | Delivery management |
| delivery-fee.service.ts | Fee calculation |
| driver.service.ts | Driver management |
| driver-eta-notification.service.ts | ETA updates |
| tracking.service.ts | Live tracking |
| location.service.ts | Geolocation |
| geo.service.ts | Distance calculation |

### Finance & Payments
| Service | Purpose |
|---------|---------|
| payment.service.ts | Stripe integration |
| payment-methods.service.ts | Saved cards |
| payout.service.ts | Garage payouts |
| payout-admin.service.ts | Payout management |
| payout-lifecycle.service.ts | Payout states |
| payout-query.service.ts | Payout queries |
| refund.service.ts | Refund processing |
| refund-calculator.service.ts | Fee calculation |
| finance.service.ts | Dashboard data |
| revenue.service.ts | Revenue tracking |
| revenue-report.service.ts | Revenue reports |
| invoice.service.ts | Invoice generation |
| wallet.service.ts | Driver wallet |

### Garage & B2B
| Service | Purpose |
|---------|---------|
| subscription.service.ts | Plan management |
| garage-approval.service.ts | Onboarding |
| garage-report.service.ts | Garage reports |
| analytics.service.ts | Garage analytics |
| dashboard.service.ts | Garage dashboard |
| pricing.service.ts | Price benchmarks |

### Notifications
| Service | Purpose |
|---------|---------|
| notification.service.ts | Core notifications |
| smart-notification.service.ts | Intelligent routing |
| push.service.ts | Firebase push |
| sms.service.ts | SMS gateway |
| email.service.ts | SendGrid email |

### Support & Operations
| Service | Purpose |
|---------|---------|
| support.service.ts | Ticket management |
| support-actions.service.ts | Resolution actions |
| dispute.service.ts | Dispute handling |
| operations.service.ts | Ops dashboard |
| operations-dashboard.service.ts | Metrics |
| fraud-detection.service.ts | Fraud scoring |

### Admin
| Service | Purpose |
|---------|---------|
| admin.service.ts | Admin dashboard |
| reports.service.ts | Admin reports |
| management.service.ts | User management |

### Infrastructure
| Service | Purpose |
|---------|---------|
| cache.service.ts | Redis caching |
| storage.service.ts | File storage |
| document.service.ts | Document CRUD |
| document-generation.service.ts | PDF generation |

---

## 3. Middleware (12)

| Middleware | Purpose | Applied To |
|------------|---------|------------|
| auth.middleware.ts | JWT validation | Protected routes |
| authorize.middleware.ts | Role-based access | Admin/Garage routes |
| rateLimiter.middleware.ts | Rate limiting | All routes |
| validation.middleware.ts | Request validation | POST/PUT routes |
| errorHandler.middleware.ts | Error handling | Global |
| auditLog.middleware.ts | Audit trail | Admin routes |
| security.middleware.ts | Security headers | Global |
| csrf.middleware.ts | CSRF protection | Forms |
| cache.middleware.ts | Response caching | GET routes |
| file.middleware.ts | File upload | Upload routes |
| requestContext.middleware.ts | Request context | Global |

---

## 4. Socket.IO Events

### Client → Server
| Event | Payload | Handler |
|-------|---------|---------|
| `join_user_room` | `userId` | Base socket |
| `join_customer_room` | - | Customer socket |
| `join_garage_room` | `garageId` | Garage socket |
| `join_driver_room` | `driverId` | Driver socket |
| `join_operations_room` | - | Ops socket |
| `join_ticket` | `ticketId` | Support socket |
| `join_delivery_chat` | `assignmentId` | Chat socket |
| `join_order_chat` | `{orderId, role}` | Chat socket |
| `track_order` | `{orderId}` | Tracking socket |
| `track_request_view` | `{request_id}` | Request socket |

### Server → Client
| Event | Payload | Trigger |
|-------|---------|---------|
| `driver_location_update` | `{lat, lng, eta}` | Driver moves |
| `viewer_count_update` | `{count}` | Request views |
| `payout_scheduled` | `{payoutId, amount}` | Payout created |
| `payout_completed` | `{payoutId}` | Payout sent |
| `payout_held` | `{payoutId, reason}` | Payout blocked |
| `order_auto_confirmed` | `{orderId}` | Auto-confirm |
| `dispute_resolved` | `{disputeId}` | Resolution |
| `tickets_escalated` | `{count}` | Escalation |

---

## 5. API Routes Summary

### Public Routes
| Path | Methods | Purpose |
|------|---------|---------|
| /api/v1/auth/* | POST | Authentication |
| /api/v1/garages | GET | Garage listing |
| /api/v1/search | GET | Part search |

### Customer Routes (JWT Required)
| Path | Methods | Purpose |
|------|---------|---------|
| /api/v1/requests | GET, POST | Part requests |
| /api/v1/bids | GET | View bids |
| /api/v1/orders | GET, POST | Orders |
| /api/v1/addresses | CRUD | Addresses |
| /api/v1/vehicles | CRUD | Vehicles |
| /api/v1/loyalty | GET | Points |

### Garage Routes (Garage Role)
| Path | Methods | Purpose |
|------|---------|---------|
| /api/v1/garage/dashboard | GET | Dashboard |
| /api/v1/garage/bids | CRUD | Bid management |
| /api/v1/garage/orders | GET | Orders |
| /api/v1/garage/payouts | GET | Payouts |
| /api/v1/garage/subscription | GET, POST | Plan |
| /api/v1/garage/analytics | GET | Analytics |

### Driver Routes (Driver Role)
| Path | Methods | Purpose |
|------|---------|---------|
| /api/v1/driver/assignments | GET | Deliveries |
| /api/v1/driver/location | POST | Location update |
| /api/v1/driver/wallet | GET | Wallet |
| /api/v1/driver/payouts | GET | Payouts |

### Admin Routes (Admin Role)
| Path | Methods | Purpose |
|------|---------|---------|
| /api/admin/dashboard | GET | Stats |
| /api/admin/garages | CRUD | Garage mgmt |
| /api/admin/users | CRUD | User mgmt |
| /api/admin/reports | GET | Reports |

### Finance Routes
| Path | Methods | Purpose |
|------|---------|---------|
| /api/finance/payouts | GET, POST | Payouts |
| /api/finance/refunds | GET, POST | Refunds |
| /api/finance/revenue | GET | Revenue |

### Support Routes
| Path | Methods | Purpose |
|------|---------|---------|
| /api/support/tickets | CRUD | Tickets |
| /api/support/escalations | GET, POST | Escalations |

---

## 6. Database Tables (Core)

### Identity
- `users` - All user accounts
- `password_reset_tokens` - Auth tokens
- `staff_profiles` - Support staff
- `operations_staff` - Ops team

### Business
- `garages` - Partner profiles
- `garage_subscriptions` - Plans
- `subscription_plans` - Tier config
- `garage_payment_methods` - Saved cards

### Orders Flow
- `part_requests` - Customer requests
- `bids` - Garage bids
- `counter_offers` - Negotiations
- `orders` - Accepted orders
- `order_status_history` - Audit trail

### Delivery
- `delivery_assignments` - Driver tasks
- `delivery_zones` - Zone config
- `drivers` - Driver profiles
- `driver_locations` - GPS tracking

### Finance
- `garage_payouts` - Payouts
- `refunds` - Customer refunds
- `driver_wallets` - Driver balance
- `driver_payouts` - Driver payments
- `subscription_invoices` - B2B invoices

### Support
- `support_tickets` - Tickets
- `disputes` - Disputes
- `cancellation_requests` - Cancellations
- `return_requests` - Returns

### Compliance
- `audit_logs` - System audit
- `admin_audit_log` - Admin actions
- `stripe_webhook_events` - Payment webhooks

---

## 7. External Integrations

| Service | Purpose | Config |
|---------|---------|--------|
| **Stripe** | Payments | `STRIPE_SECRET_KEY` |
| **SendGrid** | Email | `SENDGRID_API_KEY` |
| **Firebase** | Push | `FIREBASE_*` |
| **Cloudflare R2** | Storage | `R2_*` |
| **Google Maps** | Geocoding | `GOOGLE_MAPS_API_KEY` |

---

## 8. Environment Variables

### Required
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG....
```

### Optional
```
SLACK_WEBHOOK=https://hooks.slack.com/...
GOOGLE_MAPS_API_KEY=...
```

---

*Auto-generated from codebase analysis. Last updated: February 4, 2026*
