# QSCRAP Warranty Claim Process

## Overview

Garages can offer 0-365 day warranties on parts. This document describes the claim handling workflow.

---

## Warranty Coverage

| Part Condition | Typical Warranty |
|----------------|------------------|
| New | 30-90 days |
| Refurbished | 14-30 days |
| Used Excellent | 7-14 days |
| Used Good | 0-7 days |
| Used Fair | 0 days (as-is) |

---

## Claim Process

### Step 1: Customer Initiates Claim
```
Customer opens Support ticket with:
- Order ID
- Photos of defective part
- Description of issue
- Date issue discovered
```

### Step 2: Verification
```
Support checks:
- Order is within warranty period
- Part was not damaged by customer
- Claim matches part description
```

### Step 3: Resolution Options

| Outcome | Action |
|---------|--------|
| **Valid claim** | Garage provides replacement OR refund |
| **Partial valid** | Partial refund negotiated |
| **Invalid claim** | Claim rejected with explanation |

### Step 4: Replacement Flow
```
1. Garage ships replacement part
2. Driver collects original (if needed)
3. Customer receives replacement
4. Claim closed
```

### Step 5: Refund Flow
```
1. Support initiates refund
2. Finance processes via Stripe
3. Customer receives funds (3-5 days)
4. Claim closed
```

---

## Warranty Card

Each order generates a warranty card:
- **Document URL:** `/api/documents/order/:id/warranty`
- **Contains:** Order details, part info, warranty period, QR code
- **Verification:** QR code links to verification page

---

## Garage Responsibilities

1. Honor warranty as stated in bid
2. Respond to claims within 48 hours
3. Provide replacement or refund as agreed
4. Maintain quality standards

---

## FAQ

**Q: What if garage disputes the claim?**
A: Support mediates based on photos and evidence.

**Q: Can warranty be extended?**
A: Only at garage's discretion during bidding.

**Q: Who pays for return shipping?**
A: Platform covers driver return pickup if claim is valid.

---

**Document Prepared By:** Support & Operations Team
