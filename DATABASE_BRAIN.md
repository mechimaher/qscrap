# 🗄️ DATABASE_BRAIN - QScrap Schema Reference

**Version:** 1.0 | **PostgreSQL:** 14.20 | **Updated:** February 4, 2026

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Tables | 46 (base) + 35 (migrations) |
| Functions | 10+ |
| Triggers | 5+ |
| CHECK Constraints | 50+ |
| Indexes | 100+ |

---

## Schema Standards

| Standard | Implementation |
|----------|---------------|
| **Primary Keys** | UUID via `gen_random_uuid()` |
| **Naming** | `snake_case`, plural tables |
| **PK Pattern** | `{entity}_id` (e.g., `user_id`) |
| **Timestamps** | `created_at`, `updated_at` on all tables |
| **Timezone** | `TIMESTAMP WITH TIME ZONE` (UTC storage) |
| **Status Fields** | `VARCHAR` + CHECK constraints (no ENUMs) |
| **Soft Delete** | `deleted_at` column pattern |

---

## 1. Identity & Access

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| user_id | UUID | PK |
| phone_number | VARCHAR | UNIQUE |
| password_hash | TEXT | |
| user_type | TEXT | Authoritative role |
| full_name | TEXT | |
| email | TEXT | |
| language_preference | VARCHAR | DEFAULT 'en' |
| is_active | BOOLEAN | |
| is_suspended | BOOLEAN | |
| email_verified | BOOLEAN | |

### `password_reset_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK (legacy) |
| user_id | UUID | FK→users |
| token_hash | VARCHAR(64) | SHA-256 |
| token_type | VARCHAR(50) | 'password_reset', 'garage_setup' |
| expires_at | TIMESTAMP | |
| used_at | TIMESTAMP | One-time use |

### `staff_profiles`
| Column | Type | CHECK |
|--------|------|-------|
| staff_id | UUID | PK |
| user_id | UUID | FK→users |
| role | VARCHAR(50) | operations/accounting/customer_service/quality_control/logistics/hr/management |
| permissions | JSONB | |

### `operations_staff`
| Column | Type | Notes |
|--------|------|-------|
| staff_id | UUID | PK |
| user_id | UUID | FK→users |
| role | VARCHAR(50) | DEFAULT 'operator' |
| permissions | JSONB | |

---

## 2. Garage Partners

### `garages`
| Column | Type | CHECK |
|--------|------|-------|
| garage_id | UUID | PK (matches user_id) |
| garage_name | TEXT | NOT NULL |
| trade_license_number | VARCHAR(50) | |
| cr_number | VARCHAR(50) | Qatar CR |
| phone_number | VARCHAR(20) | |
| address | TEXT | |
| location_lat | NUMERIC(10,8) | |
| location_lng | NUMERIC(11,8) | |
| approval_status | VARCHAR(20) | pending/approved/rejected/demo/expired |
| supplier_type | VARCHAR(10) | used/new/both |
| specialized_brands | TEXT[] | |
| all_brands | BOOLEAN | |
| rating_average | NUMERIC(3,2) | |
| bank_name | VARCHAR(100) | |
| iban | VARCHAR(50) | |
| demo_expires_at | TIMESTAMP | |

### `garage_subscriptions`
| Column | Type | CHECK |
|--------|------|-------|
| subscription_id | UUID | PK |
| garage_id | UUID | FK→garages |
| plan_id | UUID | FK→subscription_plans |
| status | VARCHAR(20) | trial/active/past_due/cancelled/expired/suspended |
| billing_cycle_start | DATE | |
| billing_cycle_end | DATE | |
| bids_used_this_cycle | INTEGER | |
| auto_renew | BOOLEAN | |
| is_admin_granted | BOOLEAN | |

### `subscription_plans`
| Column | Type | Notes |
|--------|------|-------|
| plan_id | UUID | PK |
| plan_code | VARCHAR(20) | UNIQUE |
| plan_name | VARCHAR(50) | |
| monthly_fee | NUMERIC(10,2) | |
| commission_rate | NUMERIC(4,3) | |
| max_bids_per_month | INTEGER | NULL = unlimited |
| features | JSONB | |

**Plans:** Demo (0 QR/15%), Free (0 QR/12%), Starter (299 QR/8%), Gold (999 QR/5%), Platinum (2499 QR/3%)

---

## 3. Part Requests & Bidding

### `part_requests`
| Column | Type | CHECK |
|--------|------|-------|
| request_id | UUID | PK |
| customer_id | UUID | FK→users |
| car_make | TEXT | NOT NULL |
| car_model | TEXT | NOT NULL |
| car_year | INTEGER | 1900 to current+2 |
| vin_number | VARCHAR(17) | |
| part_description | TEXT | NOT NULL |
| part_category | VARCHAR(50) | |
| condition_required | TEXT | new/used/any |
| status | TEXT | active/accepted/expired/cancelled_by_customer |
| expires_at | TIMESTAMP | DEFAULT NOW()+24h |
| delivery_lat | NUMERIC(10,8) | |
| delivery_lng | NUMERIC(11,8) | |

### `bids`
| Column | Type | CHECK |
|--------|------|-------|
| bid_id | UUID | PK |
| request_id | UUID | FK→part_requests |
| garage_id | UUID | FK→garages |
| part_condition | TEXT | new/used_excellent/used_good/used_fair/refurbished |
| brand_name | TEXT | |
| part_number | VARCHAR(50) | |
| warranty_days | INTEGER | >=0 |
| bid_amount | NUMERIC(10,2) | >0 |
| original_bid_amount | NUMERIC | After negotiation |
| status | TEXT | pending/accepted/rejected/withdrawn/expired |
| image_urls | TEXT[] | |

### `counter_offers`
| Column | Type | CHECK |
|--------|------|-------|
| counter_offer_id | UUID | PK |
| bid_id | UUID | FK→bids |
| offered_by_type | TEXT | customer/garage |
| proposed_amount | NUMERIC(10,2) | >0 |
| round_number | INTEGER | 1-3 |
| status | TEXT | pending/accepted/rejected/countered/expired |
| expires_at | TIMESTAMP | DEFAULT NOW()+24h |

---

## 4. Orders & Fulfillment

### `orders`
| Column | Type | CHECK |
|--------|------|-------|
| order_id | UUID | PK |
| order_number | VARCHAR(20) | Auto-generated QS-YYMM-XXXX |
| request_id | UUID | FK→part_requests |
| bid_id | UUID | FK→bids |
| customer_id | UUID | FK→users |
| garage_id | UUID | FK→garages |
| driver_id | UUID | FK→drivers |
| part_price | NUMERIC(10,2) | |
| commission_rate | NUMERIC(4,3) | |
| platform_fee | NUMERIC(10,2) | |
| delivery_fee | NUMERIC(10,2) | |
| total_amount | NUMERIC(10,2) | |
| garage_payout_amount | NUMERIC(10,2) | |
| payment_method | TEXT | cash/card/wallet |
| payment_status | TEXT | pending/paid/refunded/partially_refunded |
| order_status | TEXT | confirmed/preparing/ready_for_pickup/in_transit/delivered/completed/cancelled_by_* |

### `order_status_history`
| Column | Type | Notes |
|--------|------|-------|
| history_id | UUID | PK |
| order_id | UUID | FK→orders |
| old_status | VARCHAR(30) | |
| new_status | VARCHAR(30) | |
| changed_by | UUID | |
| changed_by_type | VARCHAR(20) | customer/garage/driver/system/admin/operations |
| reason | TEXT | |

---

## 5. Delivery & Logistics

### `drivers`
| Column | Type | CHECK |
|--------|------|-------|
| driver_id | UUID | PK |
| user_id | UUID | FK→users |
| full_name | VARCHAR(100) | |
| phone | VARCHAR(20) | |
| vehicle_type | VARCHAR(50) | DEFAULT 'motorcycle' |
| status | VARCHAR(20) | available/busy/offline/suspended |
| current_lat | NUMERIC(10,8) | |
| current_lng | NUMERIC(11,8) | |
| total_deliveries | INTEGER | |
| rating_average | NUMERIC(3,2) | |
| bank_account_iban | VARCHAR(50) | |

### `delivery_assignments`
| Column | Type | CHECK |
|--------|------|-------|
| assignment_id | UUID | PK |
| order_id | UUID | FK→orders |
| driver_id | UUID | FK→drivers |
| status | VARCHAR(20) | assigned/picked_up/in_transit/delivered/failed |
| assignment_type | VARCHAR(20) | delivery/return_to_garage/collection |
| pickup_lat | NUMERIC(10,8) | |
| delivery_lat | NUMERIC(10,8) | |
| signature_url | TEXT | |
| delivery_photo_url | TEXT | |

### `delivery_zones`
| Column | Type | Notes |
|--------|------|-------|
| zone_id | INTEGER | PK (sequence) |
| zone_name | VARCHAR(50) | |
| min_distance_km | NUMERIC(6,2) | |
| max_distance_km | NUMERIC(6,2) | |
| delivery_fee | NUMERIC(10,2) | Max 20 QR (MOCI) |

### `driver_locations`
| Column | Type | Notes |
|--------|------|-------|
| driver_id | UUID | PK |
| latitude | NUMERIC(10,8) | |
| longitude | NUMERIC(11,8) | |
| heading | NUMERIC(5,2) | |
| speed | NUMERIC(5,2) | |
| updated_at | TIMESTAMPTZ | |

### `driver_wallets`
| Column | Type | Notes |
|--------|------|-------|
| wallet_id | UUID | PK |
| driver_id | UUID | FK→drivers |
| balance | NUMERIC(10,2) | |
| total_earned | NUMERIC(10,2) | |
| cash_collected | NUMERIC(10,2) | |

---

## 6. Finance & Payments

### `garage_payouts`
| Column | Type | CHECK |
|--------|------|-------|
| payout_id | UUID | PK |
| garage_id | UUID | FK→garages |
| order_id | UUID | FK→orders |
| gross_amount | NUMERIC(10,2) | |
| commission_amount | NUMERIC(10,2) | |
| net_amount | NUMERIC(10,2) | |
| payout_status | VARCHAR(50) | pending/processing/awaiting_confirmation/completed/disputed/failed/on_hold/cancelled |
| sent_at | TIMESTAMP | |
| confirmed_at | TIMESTAMP | |
| auto_confirmed | BOOLEAN | |

### `refunds`
| Column | Type | CHECK |
|--------|------|-------|
| refund_id | UUID | PK |
| order_id | UUID | FK→orders |
| cancellation_id | UUID | FK→cancellation_requests |
| original_amount | NUMERIC(10,2) | |
| refund_amount | NUMERIC(10,2) | |
| fee_retained | NUMERIC(10,2) | |
| refund_method | VARCHAR(50) | original_payment/wallet_credit/bank_transfer/cash |
| refund_status | VARCHAR(20) | pending/processing/completed/failed |

### `driver_payouts`
| Column | Type | Notes |
|--------|------|-------|
| payout_id | UUID | PK |
| driver_id | UUID | FK→drivers |
| assignment_id | UUID | |
| amount | NUMERIC(10,2) | |
| status | VARCHAR(20) | pending/completed |

### `subscription_payments`
| Column | Type | Notes |
|--------|------|-------|
| payment_id | UUID | PK |
| subscription_id | UUID | FK→garage_subscriptions |
| amount | NUMERIC(10,2) | |
| payment_status | VARCHAR(20) | pending/processing/completed/failed/refunded |
| invoice_number | VARCHAR(50) | |

---

## 7. Cancellations & Returns

### `cancellation_requests`
| Column | Type | CHECK |
|--------|------|-------|
| cancellation_id | UUID | PK |
| order_id | UUID | FK→orders |
| requested_by | UUID | |
| requested_by_type | VARCHAR(20) | customer/garage/admin |
| reason_code | VARCHAR(50) | changed_mind/found_elsewhere/too_expensive/wrong_part/taking_too_long/stock_out/part_defective/customer_unreachable/other |
| cancellation_fee | NUMERIC(10,2) | |
| refund_amount | NUMERIC(10,2) | |
| status | VARCHAR(20) | pending/approved/rejected/processed |

### `disputes`
| Column | Type | CHECK |
|--------|------|-------|
| dispute_id | UUID | PK |
| order_id | UUID | FK→orders |
| customer_id | UUID | |
| garage_id | UUID | |
| reason | VARCHAR(50) | wrong_part/damaged/not_as_described/doesnt_fit/changed_mind/other |
| refund_amount | NUMERIC(10,2) | |
| status | VARCHAR(30) | pending/contested/accepted/refund_approved/refund_denied/resolved/auto_resolved/cancelled |
| auto_resolve_at | TIMESTAMP | DEFAULT NOW()+48h |

---

## 8. Reviews & Support

### `order_reviews`
| Column | Type | CHECK |
|--------|------|-------|
| review_id | UUID | PK |
| order_id | UUID | FK→orders |
| customer_id | UUID | |
| garage_id | UUID | |
| overall_rating | INTEGER | 1-5 |
| part_quality_rating | INTEGER | 1-5 |
| communication_rating | INTEGER | 1-5 |
| delivery_rating | INTEGER | 1-5 |
| review_text | TEXT | |
| moderation_status | VARCHAR(20) | pending/approved/rejected |
| is_visible | BOOLEAN | |

### `support_tickets`
| Column | Type | CHECK |
|--------|------|-------|
| ticket_id | UUID | PK |
| customer_id | UUID | |
| order_id | UUID | |
| subject | VARCHAR(200) | |
| status | VARCHAR(20) | open/in_progress/resolved/closed |
| priority | VARCHAR(20) | low/normal/high/urgent |
| sla_deadline | TIMESTAMP | DEFAULT NOW()+24h |
| escalation_level | INTEGER | 0-3 |

### `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| message_id | UUID | PK |
| ticket_id | UUID | FK→support_tickets |
| sender_id | UUID | |
| sender_type | VARCHAR(20) | |
| message_text | TEXT | |
| is_read | BOOLEAN | |

---

## 9. Documents & Compliance

### `documents`
| Column | Type | CHECK |
|--------|------|-------|
| document_id | UUID | PK |
| document_type | VARCHAR(50) | invoice/receipt/warranty_card/delivery_note/quote |
| document_number | VARCHAR(50) | Auto-generated |
| order_id | UUID | |
| file_path | VARCHAR(500) | |
| verification_code | VARCHAR(100) | |
| status | VARCHAR(30) | draft/generated/sent/viewed/downloaded/archived/voided |

**Note:** Qatar MOCI requires 10-year retention.

### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| log_id | UUID | PK |
| user_id | UUID | |
| action | VARCHAR(100) | |
| entity_type | VARCHAR(50) | |
| entity_id | UUID | |
| old_data | JSONB | |
| new_data | JSONB | |
| ip_address | VARCHAR(45) | |

### `admin_audit_log`
| Column | Type | Notes |
|--------|------|-------|
| log_id | UUID | PK |
| admin_id | UUID | |
| action_type | VARCHAR(50) | |
| target_type | VARCHAR(50) | |
| target_id | UUID | |
| old_value | JSONB | |
| new_value | JSONB | |

---

## 10. Database Functions

| Function | Purpose |
|----------|---------|
| `check_garage_can_bid()` | Trigger: validates subscription and bid limits |
| `check_request_active_for_bid()` | Trigger: ensures request is active |
| `generate_order_number()` | Trigger: auto-generates QS-YYMM-XXXX |
| `generate_document_number(type)` | Generates INV/RCP/WRC prefixed numbers |
| `generate_verification_code()` | Generates QS-VRF-XXXXXXXX |
| `update_garage_rating()` | Trigger: recalculates garage rating |
| `update_updated_at()` | Trigger: auto-updates timestamp |
| `log_admin_action()` | Logs admin actions to audit log |

---

## 11. Known Hazards

| Table | Column | Issue |
|-------|--------|-------|
| users | role | DEPRECATED - use `user_type` |
| orders | delivery_status | DOES NOT EXIST - use `order_status` |
| orders | winning_bid_id | DOES NOT EXIST - use `bid_id` |
| bids | part_name | DOES NOT EXIST - join part_requests |
| garages | garage_name_ar | DOES NOT EXIST |
| garage_payouts | paid_at | DOES NOT EXIST - use `sent_at` |
| refunds | status/amount | Use `refund_status`/`refund_amount` |
| part_requests | car_vin | DOES NOT EXIST - use `vin_number` |
| reviews | * | DEPRECATED - use `order_reviews` |
| user_addresses | * | DEPRECATED - use `customer_addresses` |

---

## 12. Migration History

| Migration | Date | Purpose |
|-----------|------|---------|
| 081_cleanup_orphan_objects | Feb 3, 2026 | Dropped ad_impressions, ad_placements |
| 20260203_add_cancelled_to_request_status | Feb 3 | Added cancelled status |
| 20260202_enterprise_infrastructure | Feb 2 | Payment methods, invoices, webhooks |
| 20260202_subscription_upgrade_payments | Feb 2 | B2B upgrade tracking |

---

*Schema verified against production VPS - February 4, 2026*
