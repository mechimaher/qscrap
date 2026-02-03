# 🔌 API_BRAIN - QScrap REST API Reference

**Version:** 1.0 | **Base URL:** `https://api.qscrap.qa/api/v1` | **Updated:** February 4, 2026

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Route Files | 35 |
| API Endpoints | 150+ |
| Auth Methods | JWT Bearer |
| Rate Limits | 50-200 req/min |

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

### JWT Payload
```json
{
  "userId": "uuid",
  "userType": "customer|garage|driver|admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

---

## 1. Auth Routes `/api/v1/auth`

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | /register | ❌ | 10/min | Register customer |
| POST | /register/garage | ❌ | 10/min | Register garage |
| POST | /login | ❌ | 10/min | Login |
| POST | /register-with-email | ❌ | 10/min | Email registration |
| POST | /verify-email-otp | ❌ | 10/min | Verify email OTP |
| POST | /resend-otp | ❌ | 10/min | Resend OTP |
| GET | /deletion-eligibility | ✅ | 50/min | Check if can delete account |
| DELETE | /delete-account | ✅ | 10/min | Delete account (GDPR) |

---

## 2. Customer Routes

### Addresses `/api/v1/addresses`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ✅ | List addresses |
| POST | / | ✅ | Add address |
| PUT | /:address_id | ✅ | Update address |
| DELETE | /:address_id | ✅ | Delete address |
| PUT | /:address_id/default | ✅ | Set default |

### Dashboard `/api/v1/dashboard`
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /customer/stats | ✅ | customer | Customer stats |
| GET | /customer/activity | ✅ | customer | Recent activity |
| GET | /customer/urgent-actions | ✅ | customer | Pending actions |
| GET | /profile | ✅ | any | Get profile |
| PUT | /profile | ✅ | any | Update profile |

### Vehicles `/api/v1/vehicles`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ✅ | List vehicles |
| POST | / | ✅ | Add vehicle |
| PUT | /:vehicle_id | ✅ | Update vehicle |
| DELETE | /:vehicle_id | ✅ | Delete vehicle |

### Loyalty `/api/v1/loyalty`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /points | ✅ | Get points balance |
| GET | /history | ✅ | Points history |
| POST | /redeem | ✅ | Redeem points |

---

## 3. Part Requests `/api/v1/requests`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | / | ✅ | customer | My requests |
| POST | / | ✅ | customer | Create request |
| GET | /:request_id | ✅ | any | Get request |
| DELETE | /:request_id | ✅ | customer | Cancel request |
| GET | /active | ✅ | garage | Active requests for garage |
| POST | /:request_id/cancel | ✅ | customer | Cancel request |

---

## 4. Bids `/api/v1/bids`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | / | ✅ | garage | Submit bid (with images) |
| GET | /my | ✅ | garage | My bids |
| GET | /:bid_id | ✅ | garage | Get bid details |
| PUT | /:bid_id | ✅ | garage | Update bid |
| POST | /:bid_id/reject | ✅ | customer | Reject bid |
| POST | /:bid_id/withdraw | ✅ | garage | Withdraw bid |
| GET | /estimate | ✅ | any | Fair price estimate |

---

## 5. Orders `/api/v1/orders`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | / | ✅ | any | List orders |
| GET | /:order_id | ✅ | any | Order details |
| POST | / | ✅ | customer | Create order (accept bid) |
| GET | /:order_id/track | ✅ | any | Live tracking |
| POST | /:order_id/confirm | ✅ | customer | Confirm delivery |

### Order Cancellation
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /:order_id/cancel-preview | ✅ | any | Cancellation fee preview |
| POST | /:order_id/cancel/customer | ✅ | customer | Customer cancel |
| POST | /:order_id/cancel/garage | ✅ | garage | Garage cancel |
| POST | /:order_id/cancel/driver | ✅ | driver | Driver cancel |

### Returns
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /:order_id/return-preview | ✅ | customer | Return fee preview |
| POST | /:order_id/return | ✅ | customer | Request return |

---

## 6. Garage Routes

### Dashboard `/api/v1/garage`
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /stats | ✅ | garage | Dashboard stats |
| GET | /profile | ✅ | garage | Garage profile |
| PUT | /business-details | ✅ | garage | Update details |
| PUT | /specialization | ✅ | garage | Update brands |
| PUT | /location | ✅ | garage | Update location |
| GET | /badge-counts | ✅ | garage | Notification badges |

### Analytics `/api/v1/garage/analytics`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ✅ | Analytics overview |
| GET | /export | ✅ | Export analytics |
| GET | /customers | ✅ | Customer insights |
| GET | /market | ✅ | Market insights |

### Subscription `/api/v1/subscription`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ✅ | Current subscription |
| GET | /plans | ✅ | Available plans |
| POST | /upgrade | ✅ | Request upgrade |
| POST | /payment-method | ✅ | Save card |
| GET | /invoices | ✅ | Invoice history |

---

## 7. Driver Routes `/api/v1/driver`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /assignments | ✅ | driver | My deliveries |
| GET | /assignments/:id | ✅ | driver | Assignment details |
| POST | /assignments/:id/accept | ✅ | driver | Accept assignment |
| POST | /assignments/:id/pickup | ✅ | driver | Mark picked up |
| POST | /assignments/:id/deliver | ✅ | driver | Mark delivered |
| POST | /location | ✅ | driver | Update location |
| GET | /wallet | ✅ | driver | Wallet balance |
| GET | /payouts | ✅ | driver | Payout history |
| GET | /profile | ✅ | driver | Driver profile |
| PUT | /profile | ✅ | driver | Update profile |
| PUT | /bank-details | ✅ | driver | Update bank info |

---

## 8. Support Routes `/api/v1/support`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /tickets | ✅ | My tickets |
| POST | /tickets | ✅ | Create ticket |
| GET | /tickets/:id | ✅ | Ticket details |
| POST | /tickets/:id/messages | ✅ | Send message |
| POST | /tickets/:id/close | ✅ | Close ticket |

---

## 9. Finance Routes `/api/finance`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /overview | ✅ | admin | Finance overview |
| GET | /payouts | ✅ | admin | All payouts |
| POST | /payouts/:id/process | ✅ | admin | Process payout |
| GET | /refunds | ✅ | admin | All refunds |
| POST | /refunds/:id/process | ✅ | admin | Process refund |
| GET | /revenue | ✅ | admin | Revenue report |
| GET | /revenue/export | ✅ | admin | Export revenue |

---

## 10. Admin Routes `/api/admin`

### Dashboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /dashboard | ✅ | Dashboard stats |
| GET | /audit | ✅ | Audit log |

### Garage Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /garages | ✅ | All garages |
| GET | /garages/pending | ✅ | Pending approval |
| POST | /garages/:id/approve | ✅ | Approve garage |
| POST | /garages/:id/reject | ✅ | Reject garage |
| POST | /garages/:id/demo | ✅ | Grant demo |
| POST | /garages/:id/revoke | ✅ | Revoke access |
| PUT | /garages/:id/specialization | ✅ | Update brands |

### Subscription Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /plans | ✅ | All plans |
| POST | /garages/:id/plan | ✅ | Assign plan |
| POST | /garages/:id/plan/revoke | ✅ | Revoke plan |
| POST | /garages/:id/plan/extend | ✅ | Extend plan |
| POST | /garages/:id/commission | ✅ | Override commission |
| GET | /requests | ✅ | Upgrade requests |
| POST | /requests/:id/approve | ✅ | Approve request |
| POST | /requests/:id/reject | ✅ | Reject request |
| POST | /requests/:id/verify-payment | ✅ | Verify bank transfer |

### User Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /users | ✅ | All users |
| POST | /users/create | ✅ | Create user |
| GET | /users/:id | ✅ | User details |
| PUT | /users/:id | ✅ | Update user |
| POST | /users/:id/suspend | ✅ | Suspend user |
| POST | /users/:id/activate | ✅ | Activate user |
| POST | /users/:id/reset-password | ✅ | Reset password |

### Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /reports | ✅ | Available reports |
| GET | /reports/demo-garages | ✅ | Demo garages |
| GET | /reports/expired-demos | ✅ | Expired demos |
| GET | /reports/demo-conversions | ✅ | Conversions |
| GET | /reports/subscription-renewals | ✅ | Renewals |
| GET | /reports/commission-revenue | ✅ | Revenue |
| GET | /reports/all-garages | ✅ | All garages |
| GET | /reports/registrations | ✅ | Registrations |

---

## 11. Chat Routes `/api/v1/chat`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /messages/:order_id | ✅ | Order chat messages |
| POST | /messages | ✅ | Send message |
| GET | /assignment/:id | ✅ | Delivery chat |
| POST | /assignment/:id | ✅ | Send delivery message |
| GET | /unread | ✅ | Unread count |

---

## 12. Notifications `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ✅ | List notifications |
| POST | /:id/read | ✅ | Mark read |
| POST | /read-all | ✅ | Mark all read |
| DELETE | /:id | ✅ | Delete one |
| DELETE | / | ✅ | Clear all |

---

## 13. Payments `/api/v1/payments`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /create-intent | ✅ | Create Stripe intent |
| POST | /confirm | ✅ | Confirm payment |
| GET | /methods | ✅ | Saved payment methods |
| POST | /methods | ✅ | Save new card |
| DELETE | /methods/:id | ✅ | Remove card |
| POST | /webhook | ❌ | Stripe webhook |

---

## 14. Negotiation `/api/v1/negotiation`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /counter | ✅ | Submit counter-offer |
| POST | /:id/accept | ✅ | Accept counter |
| POST | /:id/reject | ✅ | Reject counter |
| GET | /bid/:bid_id | ✅ | Negotiation history |

---

## Rate Limits

| Category | Limit |
|----------|-------|
| Auth (register/login) | 10/min |
| Bid submission | 20/min |
| General API | 100/min |
| Webhook | Unlimited |

---

## Error Responses

```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request body |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

*API Reference verified against production - February 4, 2026*
