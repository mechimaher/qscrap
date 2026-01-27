# 🧠 QSCRAP BRAIN — SINGLE SOURCE OF TRUTH (v2.0)

> Project Constitution | Zero-Defect Implementation Gate | Jan 27, 2026

---

## 0. NON-NEGOTIABLE RULE

If a feature, field, API, table, or behavior is **not explicitly defined in this document**, it **does not exist** and **must not be implemented**.

If any conflict, ambiguity, or mismatch is detected → **STOP IMPLEMENTATION**.

---

## 1. PROJECT IDENTITY

- **Project Name**: QSCRAP  
- **Region**: State of Qatar  
- **Platform Type**: B2B + B2C Marketplace  
- **Domain**: Delivery of NEW & USED automotive parts  
- **Comparable Platforms**: Snoonu, Talabat, Careem, Uber  
- **Database**: PostgreSQL 14 (Alpine) in Docker
- **Backend**: Node.js + Express + TypeScript
- **Mobile**: React Native (Expo)
- **Dashboards**: Vanilla HTML/CSS/JS

---

## 2. CORE OBJECTIVES

- Zero post-deploy production failures  
- 100% alignment between Frontend, Backend, Database  
- Contract-first development  
- Qatar legal, VAT, and accounting compliance  
- Predictable, auditable delivery workflows  
- **Qatar National Branding**: Maroon (#8D1B3D) + Gold (#C9A227)

---

## 3. USER ROLES (LOCKED)

| Role | user_type | Description |
|------|-----------|-------------|
| **Customer** | `customer` | B2C buyers requesting parts |
| **Garage** | `garage` | B2B sellers bidding on requests |
| **Driver** | `driver` | Delivery personnel |
| **Staff** | `staff` | Internal ops (customer_service, finance) |
| **Admin** | `admin` | Full platform access |

> [!IMPORTANT]
> The `user_type` column in `users` table is the **authoritative discriminator**.
> The legacy `role` column is **DEPRECATED** - do not use in SQL.
> Staff functional roles are stored in `staff_profiles.role`.

---

## 4. CORE DOMAIN ENTITIES (VERIFIED PRODUCTION SCHEMA)

### 4.1 User Management (7 tables)
```
users
customer_vehicles
customer_addresses
user_addresses
push_tokens
customer_rewards
staff_profiles
```

### 4.2 Core Marketplace (12 tables)
```
part_requests
bids
counter_offers
orders
order_status_history
order_reviews
part_price_history
disputes
refunds
cancellation_requests
chat_messages
reviews
```

### 4.3 Garage Partners (10 tables)
```
garages
garage_settings
garage_stats
garage_products
garage_parts
garage_subscriptions
subscription_plans
garage_payouts
garage_analytics_summary
garage_ignored_requests
```

### 4.4 Delivery & Logistics (8 tables)
```
drivers
delivery_assignments
delivery_zones
delivery_zone_history
delivery_chats
driver_locations
driver_wallets
driver_transactions
```

### 4.5 Monetization & Subscriptions (8 tables)
```
ad_campaigns
ad_impressions
ad_placements
ad_pricing
reward_tiers
reward_transactions
subscription_payments
subscription_change_requests
```

### 4.6 Support & Operations (10 tables)
```
support_tickets
support_escalations
customer_notes
resolution_logs
payout_reversals
notifications
operations_staff
admin_audit_log
audit_logs
migrations
```

### 4.7 Documents & Compliance (7 tables)
```
insurance_claims
insurance_companies
documents
document_templates
document_access_log
product_inquiries
hub_locations
```

> [!CAUTION]
> If an entity is needed and not listed → **STOP** and update this document first.
> Total verified tables: **63**

---

## 5. DATABASE STANDARDS (STRICT)

### 5.1 Naming Conventions
- Tables: `snake_case`, plural  
- Columns: `snake_case`  
- Foreign keys: `{entity}_id` (e.g., `garage_id`, `order_id`)
- Primary keys: `{entity}_id` (e.g., `user_id`, NOT `id`)

### 5.2 Mandatory Columns (ALL tables)
```sql
{entity}_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 5.3 Type Standards
| Purpose | Type |
|---------|------|
| Primary Keys | `UUID` |
| Timestamps | `TIMESTAMP WITH TIME ZONE` |
| Money | `NUMERIC(10,2)` |
| Status Fields | `VARCHAR` with CHECK constraint |
| Boolean States | `BOOLEAN` (not timestamp IS NULL) |

### 5.4 ENUM Strategy
> **Why VARCHAR + CHECK over PostgreSQL ENUM?**
> - ENUMs require `ALTER TYPE` for changes (high-risk in production)
> - VARCHAR + CHECK allows safe migration via `DROP CONSTRAINT` → `ADD CONSTRAINT`
> - All status changes are deployed via versioned migrations with rollback SQL

### 5.5 Timezone Rule
> **All timestamps are stored in UTC.**  
> UI layer converts to `Asia/Qatar` (UTC+3) for display.  
> This prevents subtle reporting bugs in financial and delivery SLAs.

### 5.6 Forbidden Patterns
- Implicit columns
- Undocumented JSON blobs
- Nullable foreign keys without justification
- Using `id` instead of `{entity}_id`
- Using `role` column (deprecated, use `user_type`)

---

## 6. DATABASE CHANGE RULES

Before ANY migration:
1. ☐ Column exists in this document  
2. ☐ Column referenced by backend service  
3. ☐ Column consumed by frontend/mobile  
4. ☐ Rollback SQL defined  
5. ☐ Run with `--dry-run` first

**Missing step → STOP.**

### 6.1 Breaking Change Protocol
Any breaking change (schema, API, or contract) requires:
1. **Version bump** in this document
2. **Migration plan** with rollback tested
3. **Backward compatibility window** (minimum 7 days)
4. **Stakeholder notification** before deployment

---

## 7. ORDER STATUS LIFECYCLE (LOCKED)

```
pending_payment → confirmed → preparing → ready_for_pickup → 
collected → in_transit → delivered → completed
```

### Terminal States (Cancellation)
```
cancelled_by_customer
cancelled_by_garage
cancelled_by_ops
refunded
```

> [!IMPORTANT]
> All status changes are logged to `order_status_history` and are **auditable**.

---

## 8. DELIVERY STATES (LOCKED)

| Status | Description |
|--------|-------------|
| `pending` | Awaiting driver assignment |
| `assigned` | Driver accepted |
| `picked_up` | Driver collected from garage |
| `in_transit` | En route to customer |
| `delivered` | POD submitted by driver |
| `failed` | Delivery attempt failed |
| `cancelled` | Order cancelled |

> Proof of delivery (POD) with photo is **REQUIRED**.

---

## 9. CRITICAL BUSINESS RULES

### 9.1 The 7-Day Warranty Window (RED LINE)
```
NO payouts are permitted within 7 days of delivery.
Customer has 7 days from delivery to:
- Report defective parts
- Request refunds
- File disputes
```
- **Backend Guard**: `PayoutLifecycleService.sendPayment` throws error if attempted early
- **Query Filter**: `PayoutQueryService.getPayouts` excludes orders < 7 days old
- **UI Display**: "In Warranty" section shows countdown

### 9.2 The 48-Hour Auto-Complete Rule
```
If customer doesn't confirm within 48h of delivery:
- Order auto-transitions to 'completed'
- Garage payout becomes eligible (after 7-day window)
```

### 9.3 Refund & Reversal Rules
| Scenario | Delivery Fee | Platform Fee |
|----------|--------------|--------------|
| Cancelled before dispatch | Refunded | Refunded |
| Cancelled after driver assigned | **Retained** | Refunded |
| Customer refusal at door | **Retained** | Refunded |
| Defective part (warranty) | Refunded | Refunded |

### 9.4 Payout Reversal Protocol
If a refund is issued **after** garage payout was completed:
1. Create negative entry in `payout_reversals`
2. Deduct from next payout cycle
3. Notify garage via Socket + Push

### 9.5 Monthly Batch Payment Standard (Qatar B2B)
- Garages receive consolidated monthly payouts
- Individual "Send Payment" for exceptions only
- Batch processing via `processBulkPayouts`

---

## 10. PAYMENTS, VAT & ACCOUNTING (QATAR)

### 10.1 Financial Mandates
- VAT calculated per invoice line  
- Invoices are **immutable** after generation  
- Commissions explicitly tracked in `garage_payouts`  
- Refunds generate reversals (not deletions)  
- **NO hard deletes** on financial records  

### 10.2 Invoice Requirements (MOC Compliance)
- Sequential invoice numbers  
- Bilingual (Arabic + English)  
- **Unified Contact Footer** required:
  - Landline: +974 4455 4444
  - PO BOX: 32544, Industrial Area St 10
  - Email: support@qscrap.qa
- Text-only headers (no emojis in PDFs)

---

## 11. API CONTRACT LAW

### 11.1 Requirements
- No frontend request without backend contract  
- No backend response without frontend consumer  

### 11.2 Every endpoint MUST define:
- Method  
- URL  
- Auth role  
- Request body  
- Params  
- Validation  
- Success & error schemas  

### 11.3 Notification Mandate
Every transactional status update MUST be broadcast via:
1. **Socket.IO** (ephemeral, real-time)
2. **Push Notification** (persistent, background users)

---

## 12. FRONTEND & MOBILE RULES

### 12.1 Strict Alignment
- No invented fields  
- Handle loading, empty, error states  
- No assumed defaults  

### 12.2 Cache Busting Standard
All dashboard JS/CSS must use versioned query strings:
```html
<script src="js/dashboard.js?v=2026.01.27.1"></script>
```

### 12.3 Branding
- Primary: Maroon `#8D1B3D`
- Accent: Gold `#C9A227`
- No hardcoded blue (#007bff, #3b82f6) - all eliminated

**Mismatch → STOP.**

---

## 13. SUPPORT & ESCALATION FLOW

### 13.1 Ticket Lifecycle
```
open → in_progress → escalated → resolved → closed
```

### 13.2 Escalation Protocol
1. Support agent flags issue → `support_escalations` created
2. Ops reviews in Operations Dashboard
3. Resolution triggers:
   - Ticket thread update
   - Customer notification
   - Garage notification (if payout affected)
   - Finance integration (if refund/reversal)

### 13.3 Resolution Mapping
| Resolution | Trigger |
|------------|---------|
| Refund Approved | `executeFullRefund()` |
| Partial Refund | `executePartialRefund()` |
| No Action | Notify customer with explanation |
| Reassign Driver | `executeReassignDriver()` |

---

## 14. LEGAL & COMPLIANCE

### 14.1 Qatar Legal References
- **Law No. 8 of 2008** (Consumer Protection)
- **PDPPL** (Personal Data Protection)

### 14.2 Compliance Mandates
- Sequential invoice numbers  
- Financial data retention (7 years)  
- Auditable disputes  
- Account deletion = anonymization (not deletion)
- Terms & Privacy screens must be in-app (not external links)

**Unclear → BLOCK.**

---

## 15. DEVOPS & PRODUCTION SAFETY

### 15.1 Production Environment
- VPS: Doha-based Docker containers
- Deployment: `scripts/sync_vps.py`
- Container rebuild: `docker compose up -d --build`

### 15.2 Mandatory Checks
- ENV documented  
- Migrations dry-run  
- Rollback tested  
- Health checks  
- Logging enabled  

### 15.3 Forbidden
- No direct prod hotfixes
- No `dist/` commits (generated on VPS)
- No commented-out dev IPs in production builds

---

## 16. SUBSCRIPTION PLANS (VERIFIED UUIDs)

| Plan | UUID | Billing |
|------|------|---------|
| **Starter** | `1af9e120-e679-43d5-9c47-895ceadfe48e` | Monthly |
| **Professional** | `d13eead9-24ee-48e8-86e3-d4cc2f681819` | Monthly |
| **Enterprise** | `10ae7529-05fe-4b61-b8c2-e7e8f7274e4a` | Monthly |

> [!NOTE]
> Use `billing_cycle_start` and `billing_cycle_end` (not `current_period_*`).

---

## 17. WEBSOCKET EVENTS (LOCKED)

### Customer Receives:
```javascript
socket.on('new_bid', { request_id, bid_id, garage_name, amount })
socket.on('order_update', { order_id, status, driver_eta })
socket.on('counter_offer', { bid_id, new_amount, expires_at })
```

### Room Structure:
```javascript
user_{customer_id}    // Personal notifications
request_{request_id}  // Request-specific updates
order_{order_id}      // Order tracking
```

---

## 18. IMPLEMENTATION GATE CHECKLIST

Before ANY implementation:

- [ ] Feature defined in this BRAIN document
- [ ] DB schema verified in production
- [ ] Migration safe (dry-run tested)  
- [ ] API documented  
- [ ] Frontend aligned  
- [ ] Delivery verified  
- [ ] Accounting approved (if financial)  
- [ ] Legal approved (if user-facing)  
- [ ] Rollback ready  

---

## 19. AI USAGE RULE

Any AI MUST:
1. Read this file first  
2. Obey it  
3. Warn on conflicts  
4. Refuse unsafe work  
5. Update this document when adding new entities/rules

---

## 20. FINAL AUTHORITY

This document overrides opinions, speed pressure, and assumptions.

**IF IT'S NOT HERE, IT'S NOT REAL.**

---

## 21. VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | Initial | Basic structure |
| v2.0 Platinum | Jan 27, 2026 | Comprehensive update from 17 audits, ENUM strategy, UTC timezone, breaking change protocol |

> **Schema**: 63 tables | 105 FKs | 301 indexes  
> **Business Rules**: 7-Day Hold, 48h Auto-Complete, Batch Payments  
> **Compliance**: Qatar MOC, PDPPL, Law No. 8 of 2008

---

## 22. As part of this task, please focus on delivering a high-quality implementation by adhering to best practices throughout the stack:

Frontend – maintain clean and modular code.

Backend & DB – ensure stability, optimize performance, and handle errors robustly.

Sockets / Epo notifications – implement with reliability in mind, catching errors to prevent crashes.

JS & General Code – write maintainable, readable code and cover edge cases for stability.

Overall – prioritize robustness, clean architecture, and application stability.

*Frozen: Jan 27, 2026 - v2.0 Platinum | Institutional Memory*
