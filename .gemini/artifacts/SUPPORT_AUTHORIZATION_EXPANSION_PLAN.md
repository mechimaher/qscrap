# Support Team Authorization Expansion - Implementation Plan

## Objective
Empower Customer Service team to resolve issues directly without requiring Operations handoff.

---

## Phase 1: Analysis Complete ✅

### Current Architecture

| Component | File | Current State |
|-----------|------|---------------|
| Auth Middleware | `src/middleware/auth.middleware.ts` | `authorizeOperations` allows: `operations`, `admin`, `staff` |
| Support Tickets | `src/routes/support.routes.ts` | Full access for support |
| Finance Routes | `src/routes/finance.routes.ts` | Refunds protected by `authorizeOperations` |
| Order Routes | `src/routes/order.routes.ts` | Order details available to customers/garages |
| Staff Roles | `src/services/admin/types.ts` | Roles: `operations`, `accounting`, `customer_service`, etc. |

### Gap Analysis

| Capability | Support Can Do Now | Needed |
|------------|-------------------|--------|
| View tickets | ✅ Yes | ✅ |
| Reply to tickets | ✅ Yes | ✅ |
| View order details | ❌ No direct access | ✅ **ADD** |
| See delivery status | ❌ No | ✅ **ADD** |
| See garage contact | ❌ No | ✅ **ADD** |
| Initiate refund | ❌ Operations only | ⚠️ **CONSIDER** |
| Cancel order | ❌ Operations only | ⚠️ **CONSIDER** |

---

## Phase 2: Proposed Changes

### Option A: Minimal Change (Recommended First)
Add order context to ticket view - NO middleware changes.

**Why:** Lower risk, immediate value, no authorization changes.

#### Changes Required:

1. **Backend: Enhance ticket detail API**
   - File: `src/services/support/support.service.ts`
   - Method: `getTicketDetail()`
   - Add: Join to `orders` table to include delivery status, garage info

2. **Frontend: Display order details in ticket**
   - File: `public/js/support-dashboard.js`
   - Method: `selectTicket()`
   - Add: Order status, delivery info, garage phone display

### Option B: Full Authorization (Future Phase)
Add `customer_service` role to operations actions.

**Risk:** Financial actions require audit trail first.
**Recommendation:** Implement AFTER action logging is in place.

---

## Phase 3: Implementation Details (Option A)

### Task 1: Backend - Enhance Ticket Detail Query

**File:** `src/services/support/support.service.ts`

**Current Query:**
```sql
SELECT t.*, u.full_name as customer_name, 
       u.phone_number as customer_phone, 
       u.email as customer_email, 
       o.order_number 
FROM support_tickets t 
JOIN users u ON t.customer_id = u.user_id 
LEFT JOIN orders o ON t.order_id = o.order_id 
WHERE t.ticket_id = $1
```

**Enhanced Query:**
```sql
SELECT t.*, 
       u.full_name as customer_name, 
       u.phone_number as customer_phone, 
       u.email as customer_email,
       o.order_number,
       o.status as order_status,
       o.delivery_status,
       o.delivery_address,
       o.created_at as order_created_at,
       o.total_amount,
       g.garage_name,
       gu.phone_number as garage_phone,
       g.address as garage_address
FROM support_tickets t 
JOIN users u ON t.customer_id = u.user_id 
LEFT JOIN orders o ON t.order_id = o.order_id 
LEFT JOIN garages g ON o.garage_id = g.garage_id
LEFT JOIN users gu ON g.garage_id = gu.user_id
WHERE t.ticket_id = $1
```

**Fields Added:**
- `order_status` - Order processing status
- `delivery_status` - Current delivery state
- `delivery_address` - Where it's going
- `order_created_at` - When order was placed
- `total_amount` - Order value
- `garage_name` - Selling garage
- `garage_phone` - Garage contact
- `garage_address` - Garage location

### Task 2: Frontend - Display Order Context

**File:** `public/js/support-dashboard.js`

**Location:** Inside `selectTicket()` function, after loading ticket data

**Add order context panel:**
```javascript
// Show order context if linked
if (data.ticket.order_number) {
    document.getElementById('orderContextPanel').style.display = 'block';
    document.getElementById('orderStatusValue').textContent = data.ticket.order_status || 'N/A';
    document.getElementById('deliveryStatusValue').textContent = data.ticket.delivery_status || 'N/A';
    document.getElementById('garageNameValue').textContent = data.ticket.garage_name || 'N/A';
    document.getElementById('garagePhoneValue').innerHTML = data.ticket.garage_phone 
        ? `<a href="tel:${data.ticket.garage_phone}">${data.ticket.garage_phone}</a>` 
        : 'N/A';
    document.getElementById('orderAmountValue').textContent = data.ticket.total_amount 
        ? `${data.ticket.total_amount} QAR` 
        : 'N/A';
} else {
    document.getElementById('orderContextPanel').style.display = 'none';
}
```

### Task 3: Frontend - Add HTML Panel

**File:** `public/support-dashboard.html`

**Location:** After chat header, before chat messages

**Add collapsible order context section:**
```html
<!-- Order Context Panel (shown when ticket is linked to order) -->
<div id="orderContextPanel" style="display: none; padding: 10px 16px; 
     background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
    <div style="font-size: 11px; font-weight: 700; margin-bottom: 8px;">
        📦 Order Details
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
        <div><strong>Status:</strong> <span id="orderStatusValue">-</span></div>
        <div><strong>Delivery:</strong> <span id="deliveryStatusValue">-</span></div>
        <div><strong>Garage:</strong> <span id="garageNameValue">-</span></div>
        <div><strong>Garage Tel:</strong> <span id="garagePhoneValue">-</span></div>
        <div><strong>Amount:</strong> <span id="orderAmountValue">-</span></div>
    </div>
</div>
```

---

## Phase 4: Testing Checklist

| Test Case | Expected Result |
|-----------|-----------------|
| Load ticket WITH order_id | Order context panel visible with data |
| Load ticket WITHOUT order_id | Order context panel hidden |
| Ticket with null garage | Garage fields show "N/A" |
| Garage phone clickable | Opens tel: link |
| Old tickets (before fix) | Still work, show available data |

---

## Phase 5: Rollback Plan

If issues occur:
1. Revert `support.service.ts` to previous query
2. Revert `support-dashboard.js` to previous version
3. Revert `support-dashboard.html` to previous version
4. Redeploy

---

## Approval Required

Please confirm:
- [ ] Option A (order context in ticket) is the right approach
- [ ] No authorization changes in this phase
- [ ] Ready to implement

---

## Future Phase (After This)

Once this is stable, can consider:
1. Add action logging service
2. Expand `authorizeOperations` to include `customer_service`
3. Add refund request button with audit trail
4. Add cancellation button (if order unshipped)
