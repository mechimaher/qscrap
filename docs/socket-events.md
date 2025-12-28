# QScrap Socket.IO Event Reference

Comprehensive documentation of all real-time events in the QScrap backend.

---

## Connection & Rooms

### Room Types

| Room Pattern | Description | Example |
|-------------|-------------|---------|
| `user_{userId}` | Customer-specific events | `user_abc123` |
| `garage_{garageId}` | Garage-specific events | `garage_xyz789` |
| `user_operations` | Operations team room | - |
| `ticket_{ticketId}` | Support ticket chat room | `ticket_123` |

### Client-Side Connection

```javascript
// Connect and join room
socket.emit('join_user_room', userId);
socket.emit('join_garage_room', garageId);
socket.emit('join_operations_room');
socket.emit('join_ticket', ticketId);
```

---

## Event Categories

### 1. Part Requests

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `new_request` | All (global) | `{request_id, car_make, car_model, ...}` | request.controller |
| `request_expired` | `user_{id}` | `{request_id, notification}` | jobs.ts |
| `request_cancelled` | `garage_{id}` or global | `{request_id, notification}` | cancellation.controller |

---

### 2. Bids & Negotiation

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `new_bid` | `user_{customerId}` | `{request_id, bid_summary, notification}` | bid.controller |
| `bid_rejected` | `garage_{id}` | `{bid_id, notification}` | bid.controller |
| `bid_updated` | `user_{customerId}` | `{bid_id, notification}` | bid.controller |
| `bid_withdrawn` | `user_{customerId}` | `{bid_id, request_id, notification}` | bid.controller, cancellation.controller |
| `counter_offer_received` | `garage_{id}` or `user_{id}` | `{counter_offer_id, bid_id, ...}` | negotiation.controller |
| `counter_offer_accepted` | `user_{id}` or `garage_{id}` | `{bid_id, final_amount, notification}` | negotiation.controller |
| `counter_offer_rejected` | `user_{id}` or `garage_{id}` | `{bid_id, notification}` | negotiation.controller |
| `garage_counter_offer` | `user_{customerId}` | `{counter_offer_id, proposed_amount, ...}` | negotiation.controller |

---

### 3. Orders

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `order_status_updated` | `user_{id}`, `garage_{id}` | `{order_id, order_number, old_status, new_status, notification}` | order.controller, operations.controller |
| `order_cancelled` | `garage_{id}` or `user_{id}` | `{order_id, order_number, cancellation_reason, notification}` | cancellation.controller |

---

### 4. Quality Control

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `qc_passed` | `user_{id}`, `garage_{id}` | `{order_id, order_number, notification}` | quality.controller |
| `qc_failed` | `user_{id}`, `garage_{id}` | `{order_id, order_number, failure_reason, notification}` | quality.controller |
| `qc_failed_alert` | All (global) | `{order_id, garage_name, notification}` | quality.controller |
| `return_assignment_created` | `garage_{id}` | `{order_id, notification}` | quality.controller |

---

### 5. Disputes

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `dispute_created` | `garage_{id}` | `{dispute_id, order_id, reason, refund_amount, notification}` | dispute.controller |
| `dispute_accepted` | `user_{customerId}` | `{dispute_id, order_number, refund_amount, notification}` | dispute.controller |
| `dispute_contested` | `user_{customerId}` | `{dispute_id, garage_response, notification}` | dispute.controller |
| `dispute_resolved` | `user_{id}`, `garage_{id}` | `{dispute_id, resolution, refund_amount, notification}` | dispute.controller, jobs.ts, operations.controller |

---

### 6. Payouts & Finance

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `payout_scheduled` | `garage_{id}` | `{payout_id, order_id, amount, scheduled_date, notification}` | jobs.ts |
| `payout_held` | `garage_{id}` | `{payout_id, order_id, reason, notification}` | jobs.ts |
| `payout_completed` | `garage_{id}` | `{payout_id, order_id, amount, reference, notification}` | jobs.ts, finance.controller |
| `payout_released` | `garage_{id}` | `{payout_id, notification}` | jobs.ts, finance.controller |
| `payment_sent` | `garage_{id}` | `{payout_id, notification}` | finance.controller |
| `payment_confirmed` | All (global) | `{payout_id, notification}` | finance.controller |
| `payment_disputed` | All (global) | `{payout_id, notification}` | finance.controller |

---

### 7. Subscriptions

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `subscription_warning` | `garage_{id}` | `{message, expires_at}` | jobs.ts |

---

### 8. Support Tickets

| Event | Target | Payload | Source |
|-------|--------|---------|--------|
| `new_ticket` | `user_operations` | `{ticket_id, subject, priority}` | support.controller |
| `new_message` | `ticket_{id}` | `{message object}` | support.controller |
| `support_reply` | `user_{id}` or `user_operations` | `{ticket_id, message}` | support.controller |
| `ticket_updated` | `ticket_{id}` | `{status}` | support.controller |

---

## Frontend Integration Example

```javascript
// Customer dashboard
socket.on('new_bid', (data) => {
    showNotification(data.notification);
    refreshBidList(data.request_id);
});

socket.on('order_status_updated', (data) => {
    updateOrderStatus(data.order_id, data.new_status);
    showNotification(data.notification);
});

// Garage dashboard
socket.on('new_request', (data) => {
    addToRequestFeed(data);
});

socket.on('qc_failed', (data) => {
    showAlert('QC Failed', data.failure_reason);
});
```
