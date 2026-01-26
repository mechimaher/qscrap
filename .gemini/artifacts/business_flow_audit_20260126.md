# QScrap Platform Business Flow Audit
## Complete Edge Case Analysis & Robustness Testing
**Audit Date:** 2026-01-26
**Auditors:** Business Flow Team, Scenario Testers, Platform Robustness Team

---

# 📊 EXECUTIVE SUMMARY

## Systems Under Audit
| System | Role | Users |
|--------|------|-------|
| Customer App | B2C - Request parts, bid acceptance, disputes | End customers |
| Garage App | B2B - Bid on requests, fulfill orders | Parts suppliers |
| Driver App | B2C2C - Pickup & delivery | Delivery partners |
| Support Dashboard | Internal - Customer resolution | Support agents |
| Operations Dashboard | Internal - Order/dispute management | Ops managers |
| Finance Dashboard | Internal - Payouts/refunds | Finance team |
| Admin Dashboard | Internal - System configuration | Admins |

---

# 🔄 SCENARIO 1: Happy Path Order Flow

## Flow Diagram
```
Customer → Request → Garage Bids → Customer Accepts → Order Created → 
Payment → Garage Prepares → Driver Collects → Delivery → Customer Confirms → 
Garage Payout → Complete
```

## Step-by-Step Audit

### 1.1 Customer Requests Part
- **Endpoint:** `POST /api/part-requests`
- **Tables:** `part_requests`, `notifications`
- ✅ Status: Working
- ⚠️ Finding: Request expiry job runs daily at 2 AM - if customer creates request at 1 AM, it may expire prematurely

### 1.2 Garages Receive Notification & Bid
- **Endpoint:** `POST /api/bids`
- **Tables:** `bids`, `notifications`
- ✅ Status: Working
- ✅ Real-time Socket.IO to all approved garages

### 1.3 Customer Accepts Bid → Order Created
- **Endpoint:** `POST /api/bids/:bid_id/accept`
- **Tables:** `orders`, `order_status_history`
- ✅ Status: Working
- **Flow:** Bid accepted → Order created with status `pending_payment`

### 1.4 Customer Payment
- **Endpoint:** `POST /api/payments/create-intent`
- **Tables:** `payment_intents`, `orders`
- ✅ Status: Working (Stripe integration)
- **Flow:** Payment success → Order status → `confirmed`

### 1.5 Garage Marks Ready
- **Endpoint:** `PATCH /api/garage/orders/:id/status` (status: ready_for_pickup)
- **Tables:** `orders`, `order_status_history`
- ✅ Status: Working

### 1.6 Driver Assigned
- **Endpoint:** `POST /api/delivery/assign`
- **Tables:** `delivery_assignments`, `orders`
- ✅ Status: Working

### 1.7 Delivery Completed
- **Endpoint:** `POST /api/delivery/:id/complete`
- **Tables:** `orders`, `delivery_assignments`
- ✅ Status: Working
- **Flow:** Order status → `delivered`

### 1.8 Customer Confirms / Auto-Complete (48h)
- **Endpoint:** `POST /api/orders/:id/confirm`
- **Job:** Auto-complete runs daily at 2 AM
- ✅ Status: Working
- **Flow:** Order status → `completed` → Creates `garage_payouts` record

### 1.9 Garage Payout
- **Endpoint:** Finance processes via `/api/finance/payouts`
- **Tables:** `garage_payouts`
- ✅ Status: Working

---

# ⚠️ SCENARIO 2: Customer Disputes Order (After Delivery)

## Flow Diagram
```
Customer → Dispute Order → Payout HELD → Garage Responds? → 
Operations Reviews → Approve Refund / Reject → Payout Cancelled or Released
```

## Audit Findings

### 2.1 Customer Creates Dispute
- **Endpoint:** `POST /api/disputes`
- **Service:** `DisputeOrderService.createDispute()`
- **Tables:** `disputes`
- ✅ Creates dispute record
- ✅ Automatically HOLDS related payout
- ✅ 48-hour window after delivery enforced

### 2.2 Garage Response
- **Endpoint:** `POST /api/disputes/:id/respond`
- ✅ Status: Working
- **Flow:** Dispute status → `under_review`

### 2.3 Operations Review
- **Dashboard:** Operations Dashboard → Disputes section
- **Endpoint:** `GET /api/operations/disputes`
- ⚠️ **FINDING:** Operations queries `disputes` table correctly
- ✅ Can approve refund or reject

### 2.4 Refund Approved → Finance Dashboard
- **Flow:** Dispute resolved → Refund created → Shows in Finance pending refunds
- ⚠️ **FIXED TODAY:** Refund schema aligned between support-actions and finance

---

# 🚨 SCENARIO 3: Support Escalation Flow

## Original Gap Identified
```
Customer → Support Ticket → Agent Escalates → ??? (nowhere to go)
```

## Fixed Flow
```
Customer → Support Ticket → Agent Escalates → 
Operations Dashboard (NEW: /escalations endpoint) → Resolved
```

### 3.1 Customer Contacts Support
- **Endpoint:** `POST /api/support/tickets`
- ✅ Status: Working

### 3.2 Agent Escalates to Operations
- **Dashboard:** Support Dashboard
- **Endpoint:** `POST /api/support/quick-action` (action: escalate_to_ops)
- **Tables:** `support_escalations`
- ✅ Status: Working

### 3.3 Operations Sees Escalations
- **Dashboard:** Operations Dashboard
- **Endpoint:** `GET /api/operations/escalations` (**NEW TODAY**)
- ✅ Added pending_escalations to dashboard stats
- ✅ Can resolve escalations

---

# 🔴 SCENARIO 4: Order Cancellation Flows

## 4.1 Customer Cancels (Before Pickup)
- **Endpoint:** `POST /api/cancellation/order/:id/customer`
- ✅ Cancellation fee based on status/time
- ✅ Auto-refund via Stripe if paid
- ✅ Delivery fee retained if driver was assigned

## 4.2 Garage Cancels (Stock Out)
- **Endpoint:** `POST /api/cancellation/order/:id/garage`
- ✅ Full refund to customer
- ✅ Impacts garage fulfillment rate
- ⚠️ **No penalty mechanism** for repeat garage cancellations

## 4.3 Operations Cancels (Cleanup)
- **Endpoint:** `POST /api/operations/orders/:id/cancel`
- ✅ Can cancel ANY status
- ✅ Handles refund automatically
- ✅ Releases bid if pending_payment

---

# 📋 SCENARIO 5: Counter-Offer Negotiation

## Flow Diagram
```
Customer Requests → Garage Bids → Customer Counter-Offers → 
Garage Counter-Offers → Customer Accepts → Order Created
```

### 5.1 Customer Counter-Offers
- **Endpoint:** `POST /api/counter-offers`
- ✅ Status: Working

### 5.2 Garage Counter-Offers
- **Endpoint:** `POST /api/counter-offers/garage`
- ✅ Status: Working

### 5.3 Accept Counter-Offer → Order
- **Endpoint:** `POST /api/counter-offers/:id/accept`
- ✅ Creates order from accepted counter-offer

---

# 🔍 CRITICAL ISSUES FOUND & FIXED TODAY

## Issue 1: Support Quick Actions Failing
- **Error:** `check constraint "order_status_history_changed_by_type_check" violated`
- **Root Cause:** Constraint didn't include 'support' and 'operations'
- **Fix:** Migration `20260127_fix_order_status_history_constraint.sql`
- ✅ FIXED

## Issue 2: Refunds Not Showing in Finance
- **Error:** Support-actions used different column names than finance module
- **Root Cause:** Schema mismatch (`amount` vs `refund_amount`, `status` vs `refund_status`)
- **Fix:** Updated `processCustomerRefund()` + migration for schema alignment
- ✅ FIXED

## Issue 3: Escalations Not Visible to Operations
- **Error:** Escalated tickets went to `support_escalations` but Operations only queried `disputes`
- **Root Cause:** Missing endpoint and dashboard integration
- **Fix:** Added `/api/operations/escalations` endpoint + dashboard stats
- ✅ FIXED

## Issue 4: Tickets Not Loading in Customer 360
- **Status:** Under investigation
- **Symptoms:** User reports tickets panel shows "Select a customer" even after selection
- 🔍 TO INVESTIGATE

---

# 🔮 REMAINING EDGE CASES TO TEST

## Priority 1 (Critical)
| Scenario | Status | Risk |
|----------|--------|------|
| Driver cancels mid-delivery | ❓ Needs test | Order stuck? |
| Payment fails after order confirmed | ❓ Needs test | Inconsistent state |
| Payout already sent when dispute created | ❓ Needs test | Platform loss |
| Multiple concurrent bids accepted | ❓ Needs test | Duplicate orders |

## Priority 2 (Important)
| Scenario | Status | Risk |
|----------|--------|------|
| Garage deactivated during active order | ❓ Needs test | Order orphaned |
| Customer deletes account with active orders | ❓ Needs test | Data integrity |
| Driver offline during assigned delivery | ❓ Needs test | Delayed delivery |
| Payment refund fails (Stripe error) | ❓ Needs test | Manual intervention |

## Priority 3 (Edge)
| Scenario | Status | Risk |
|----------|--------|------|
| Part request expires with pending bids | ✅ Working | Bids auto-expired |
| Warranty period dispute (day 7) | ✅ Working | Enforced |
| Loyalty discount calculation edge | ❓ Needs test | Wrong discount |
| Subscription expired during order | ❓ Needs test | Commission rate? |

---

# 📊 DATABASE INTEGRITY CHECKS

## Foreign Key Constraints
- `orders.customer_id` → `users.user_id` ✅
- `orders.garage_id` → `garages.garage_id` ✅
- `garage_payouts.order_id` → `orders.order_id` ✅
- `refunds.order_id` → `orders.order_id` ✅

## Check Constraints Verified
- `order_status_history.changed_by_type` → Fixed ✅
- `refunds.refund_status` → Fixed ✅
- `support_tickets.requester_type` → Valid ✅
- `users.user_type` → Valid ✅

---

# 🎯 IMMEDIATE ACTION ITEMS

1. ✅ Fix order_status_history constraint - DONE
2. ✅ Fix refunds schema alignment - DONE
3. ✅ Add escalations to Operations - DONE
4. 🔄 Investigate tickets not loading in customer 360
5. 🔄 Test driver cancellation flow
6. 🔄 Test concurrent bid acceptance protection

---

# 📈 NEXT AUDIT PHASE

1. Mobile app API compatibility testing
2. Socket.IO real-time event coverage
3. Email notification delivery
4. Push notification reliability
5. Performance under load
