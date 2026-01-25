# QSCRAP Escrow & Payment Flow Documentation

## Overview

QSCRAP uses a **Delivery Fee Upfront + Cash on Delivery** model:
- **Delivery fee** paid by card at checkout (held in escrow)
- **Part price** paid as COD to driver

---

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CHECKOUT                                                             │
│     Customer accepts bid → Stripe Payment Intent created                │
│     └─► Delivery fee captured → Order status: pending_payment           │
│                                                                          │
│  2. PAYMENT CONFIRMED                                                    │
│     Stripe webhook: payment_intent.succeeded                            │
│     └─► Order status: confirmed → Garage notified                       │
│                                                                          │
│  3. ORDER LIFECYCLE                                                      │
│     confirmed → preparing → ready_for_pickup → collected                │
│     collected → in_transit → delivered → completed                      │
│                                                                          │
│  4. COMPLETION                                                           │
│     Driver confirms delivery with POD + OTP                             │
│     └─► Part price collected (COD)                                      │
│     └─► Order status: completed                                         │
│     └─► Payout record created for garage                                │
│                                                                          │
│  5. PAYOUT                                                               │
│     Finance sends payment to garage bank account                        │
│     └─► Garage confirms receipt                                         │
│     └─► Payout status: confirmed                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Money Flow

| Stage | Customer → | Platform → | Garage → |
|-------|------------|------------|----------|
| **Checkout** | Pays delivery fee (card) | Holds in Stripe | - |
| **Delivery** | Pays part price (COD to driver) | - | - |
| **Completion** | - | Releases delivery fee | Receives payment |
| **Payout** | - | Sends part price - commission | Confirms receipt |

---

## Amounts Breakdown

For a typical order:
- **Part price:** 500 QAR (set by garage bid)
- **Delivery fee:** 35 QAR (zone-based)
- **Platform commission:** 50 QAR (10% of part price)

| Recipient | Amount | Source |
|-----------|--------|--------|
| **Garage receives** | 450 QAR | Part price - commission |
| **Platform receives** | 50 QAR | Commission |
| **Driver receives** | 26.25 QAR | 75% of delivery fee |
| **Platform (delivery)** | 8.75 QAR | 25% of delivery fee |

---

## Cancellation Scenarios

### Before Payment
- No payment processed
- Order deleted or marked cancelled

### After Payment, Before Pickup
- **Full refund** of delivery fee via Stripe
- Order marked cancelled
- No payout to garage

### After Pickup, Before Delivery
- **Partial refund** (50% of delivery fee)
- Part returned to garage
- Garage not charged commission

### After Delivery (Dispute)
- Handled via Support ticket
- Outcome determines refund/payout
- May involve partial refund + garage compensation

---

## Dispute Flow

```
Customer initiates dispute
       │
       ▼
┌──────────────────┐
│ Support reviews  │
│ POD photos + OTP │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Valid      Invalid
   │           │
   ▼           ▼
Refund     Garage paid
issued     as normal
```

---

## API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Create deposit | `/api/payments/deposit/:orderId` | POST |
| Confirm payment | Webhook | - |
| Request refund | `/api/finance/refunds` | POST |
| Process payout | `/api/finance/payouts/:id/send` | POST |

---

## Database Tables

- `payment_intents` - Stripe payment intents
- `refunds` - Refund records
- `payouts` - Garage payout records
- `orders` - Order with payment_status field

---

**Document Prepared By:** Finance & Backend Team
