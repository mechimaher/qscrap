# QScrap Cancellation & Refund Policy
## Final Approved Version - Qatar Marketplace

---

## ✅ APPROVED POLICY - January 28, 2026

### Core Principles
1. **Customer is King** - Maximum flexibility before payment
2. **Platform Never Loses** - Fees cover actual costs
3. **Garage Protection** - Compensation for work done
4. **Qatar Compliant** - Follows Consumer Protection Law

---

## Complete Fee Structure

### Stage 1: Request Active (Before Any Bids)
| Action | Fee | Refund |
|--------|-----|--------|
| Customer cancels | **FREE** | N/A |

---

### Stage 2: Bids Received (Before Accept)
| Action | Fee | Refund |
|--------|-----|--------|
| Customer cancels | **FREE** | N/A |

---

### Stage 3: Bid Accepted (Before Payment)
| Action | Fee | Refund |
|--------|-----|--------|
| Customer cancels | **FREE** | N/A |
| Garage cancels | **FREE** | N/A |

---

### Stage 4: Payment Complete (Before Preparation)
| Action | Fee | Refund |
|--------|-----|--------|
| Customer cancels | **5%** | **95% Part** |
| Garage cancels | 0% | 100% + Free Delivery Voucher |

**Fee Breakdown:**
- 2% QPAY transaction fee
- 1% QPAY refund fee  
- 2% Admin processing

---

### Stage 5: Garage Preparing / Ready for Pickup
| Action | Fee | Refund |
|--------|-----|--------|
| Customer cancels | **15%** | **85% Part** |
| Garage cancels | 0% | 100% + Free Delivery Voucher |

**Fee Breakdown:**
- 5% Platform costs (QPAY + admin)
- 10% Garage compensation

---

### Stage 6: Delivery Assigned / In Transit
| Action | Fee | Refund |
|--------|-----|--------|
| Customer cancels | **15% Part + 100% Delivery** | **85% Part only** |
| Garage cancels | 0% | 100% Part + 100% Delivery + Free Delivery Voucher |
| Driver fails | 0% | 100% Everything |

**Fee Breakdown:**
- 5% Platform costs
- 10% Garage compensation
- 100% Delivery (driver already dispatched)

---

### Stage 7: After Delivery (Returns)
| Condition | Fee | Refund |
|-----------|-----|--------|
| Return within 4 days (unused) | **30% Part + 100% Delivery** | **70% Part** |
| Defective/Wrong part | **0%** | **100% + Free Replacement** |
| After 4 days | **No return** | Dispute resolution only |

**Fee Breakdown:**
- 5% Platform costs
- 10% Garage restocking
- 10% Return pickup logistics
- 5% Inspection overhead

**Return Conditions:**
- Part must be unused
- Original packaging required
- No physical damage
- Within 4 days (96 hours) of delivery

---

## Garage Cancellation Compensation

When garage cancels at ANY stage after payment:

| Compensation | Details |
|--------------|---------|
| Full Refund | 100% of amount paid |
| Free Delivery Voucher | Valid for 30 days |
| Voucher Value | Covers delivery on next order (up to 50 QAR) |

**Garage Accountability:**
- 3+ cancellations/month = Account review
- 5+ cancellations/month = Temporary suspension
- Pattern of cancellations = Permanent removal

---

## Special Cases

### Defective Part Received
- **Refund:** 100% Part + 100% Delivery
- **Bonus:** Free replacement shipped immediately
- **Process:** Customer sends photo proof via WhatsApp

### Wrong Part Delivered
- **Refund:** 100% Part + 100% Delivery
- **Bonus:** Correct part shipped free
- **Cost:** Charged to garage

### Driver Fails to Deliver
- **Refund:** 100% Everything
- **Action:** New driver assigned or full refund
- **Driver:** Internal review/penalty

### Customer Disputes (After 4 Days)
- **Process:** WhatsApp escalation
- **SLA:** 24-hour response
- **Resolution:** Case-by-case (QScrap credit, partial refund, etc.)

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│           QSCRAP CANCELLATION QUICK GUIDE               │
├─────────────────────────────────────────────────────────┤
│  BEFORE PAYMENT        →  FREE (0%)                     │
│  AFTER PAYMENT         →  5% fee (95% back)             │
│  DURING PREPARATION    →  15% fee (85% back)            │
│  DELIVERY IN PROGRESS  →  15% + Delivery (85% part)     │
│  AFTER DELIVERY        →  30% + Delivery (70% part)     │
├─────────────────────────────────────────────────────────┤
│  RETURN WINDOW         →  4 DAYS                        │
│  DEFECTIVE PART        →  100% REFUND + REPLACEMENT     │
│  GARAGE CANCELS        →  100% + FREE DELIVERY          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Mobile App
- [ ] Show cancellation fee BEFORE confirming cancel
- [ ] Display "You will receive X QAR back" clearly
- [ ] Add reason selection for analytics
- [ ] Implement 4-day return countdown timer

### Backend
- [ ] Update `cancellation.service.ts` with tiered fees
- [ ] Implement QPAY partial refund API
- [ ] Create free delivery voucher system
- [ ] Add garage cancellation tracking

### Notifications
- [ ] Cancellation confirmation (SMS + Push + Email)
- [ ] Refund processed notification
- [ ] Free delivery voucher notification
- [ ] Return window reminder (Day 3)

### Legal
- [ ] Update Terms of Service
- [ ] Update Privacy Policy if needed
- [ ] Add cancellation policy to checkout screen
- [ ] Arabic translation of all terms

---

## Qatar Compliance Notes

### Consumer Protection Law (Law No. 8 of 2008)
✅ Right to cancel acknowledged at all stages
✅ Fees represent actual costs (not punitive)
✅ Clear disclosure before purchase
✅ Return period provided (4 days)
✅ Defective goods = full refund

### MOCI Requirements
✅ Prices in QAR
✅ Clear refund timeline (48 hours)
✅ Accessible support (WhatsApp)
✅ Written policy available

---

**Document Version:** 2.0 (Final Approved)
**Approved By:** Business Owner
**Date:** January 28, 2026
**Next Review:** July 2026
