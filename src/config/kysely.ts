/**
 * Kysely Database Configuration
 * 
 * Type-safe SQL query builder for PostgreSQL.
 * This provides compile-time type checking for database operations.
 */

import { Kysely, PostgresDialect, Generated, ColumnType } from 'kysely';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// TABLE TYPE DEFINITIONS
// ============================================

// Helper types
type Timestamp = ColumnType<Date, Date | string, Date | string>;

// Users Table
interface UsersTable {
    user_id: Generated<string>;
    phone_number: string;
    user_type: 'customer' | 'garage' | 'driver' | 'operations';
    full_name: string | null;
    email: string | null;
    password_hash: string;
    fcm_token: string | null;
    is_active: boolean;
    email_verified: boolean;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    deleted_at: Timestamp | null;
}

// Garages Table
interface GaragesTable {
    garage_id: string;
    garage_name: string;
    owner_name: string | null;
    address: string | null;
    location_lat: number | null;
    location_lng: number | null;
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'demo';
    supplier_type: 'new' | 'used' | 'both';
    specialized_brands: string[] | null;
    all_brands: boolean;
    rating_average: number;
    rating_count: number;
    total_transactions: number;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    deleted_at: Timestamp | null;
}

// Part Requests Table
interface PartRequestsTable {
    request_id: Generated<string>;
    customer_id: string;
    car_make: string;
    car_model: string;
    car_year: number;
    vin_number: string | null;
    part_description: string;
    part_number: string | null;
    part_category: string | null;
    condition_required: 'new' | 'used' | 'any';
    image_urls: string[];
    status: 'active' | 'accepted' | 'cancelled' | 'expired';
    bid_count: Generated<number>;
    delivery_lat: number | null;
    delivery_lng: number | null;
    delivery_address_text: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
}

// Bids Table
interface BidsTable {
    bid_id: Generated<string>;
    request_id: string;
    garage_id: string;
    bid_amount: number;
    warranty_days: number | null;
    notes: string | null;
    part_condition: 'new' | 'used_excellent' | 'used_good' | 'used_fair' | 'refurbished';
    brand_name: string | null;
    part_number: string | null;
    image_urls: string[];
    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
}

// Orders Table
interface OrdersTable {
    order_id: Generated<string>;
    order_number: Generated<string>;
    request_id: string;
    bid_id: string;
    customer_id: string;
    garage_id: string;
    part_price: number;
    commission_rate: number;
    platform_fee: number;
    delivery_fee: number;
    total_amount: number;
    garage_payout_amount: number;
    order_status: 'confirmed' | 'preparing' | 'ready_for_pickup' | 'collected' | 'qc_in_progress' | 'qc_passed' | 'qc_failed' | 'in_transit' | 'delivered' | 'completed' | 'cancelled_by_customer' | 'cancelled_by_garage' | 'cancelled_by_ops' | 'disputed' | 'refunded';
    payment_method: string;
    payment_status: 'pending' | 'processing' | 'paid' | 'refunded' | 'failed';
    delivery_address: string | null;
    delivery_notes: string | null;
    actual_delivery_at: Timestamp | null;
    completed_at: Timestamp | null;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
}

// Order Status History Table
interface OrderStatusHistoryTable {
    id: Generated<number>;
    order_id: string;
    old_status: string | null;
    new_status: string;
    changed_by: string | null;
    changed_by_type: 'customer' | 'garage' | 'driver' | 'operations' | 'system';
    reason: string | null;
    created_at: Generated<Timestamp>;
}

// Garage Subscriptions Table
interface GarageSubscriptionsTable {
    subscription_id: Generated<string>;
    garage_id: string;
    plan_id: string;
    status: 'active' | 'trial' | 'expired' | 'cancelled';
    bids_used_this_cycle: number;
    current_period_start: Timestamp;
    current_period_end: Timestamp;
    created_at: Generated<Timestamp>;
}

// Counter Offers Table
interface CounterOffersTable {
    id: Generated<string>;
    bid_id: string;
    proposed_amount: number;
    offered_by_type: 'customer' | 'garage';
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    created_at: Generated<Timestamp>;
}

// ============================================
// DATABASE INTERFACE
// ============================================

export interface Database {
    users: UsersTable;
    garages: GaragesTable;
    part_requests: PartRequestsTable;
    bids: BidsTable;
    orders: OrdersTable;
    order_status_history: OrderStatusHistoryTable;
    garage_subscriptions: GarageSubscriptionsTable;
    counter_offers: CounterOffersTable;
}

// ============================================
// KYSELY INSTANCE
// ============================================

const dialect = new PostgresDialect({
    pool: new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'qscrap_db',
        port: parseInt(process.env.DB_PORT || '5432'),
        max: 10
    })
});

export const db = new Kysely<Database>({ dialect });

// ============================================
// TYPED QUERY HELPERS
// ============================================

export type NewOrder = Omit<OrdersTable, 'order_id' | 'order_number' | 'created_at' | 'updated_at'>;
export type NewBid = Omit<BidsTable, 'bid_id' | 'created_at' | 'updated_at' | 'status'>;
export type NewRequest = Omit<PartRequestsTable, 'request_id' | 'created_at' | 'updated_at' | 'bid_count' | 'status'>;

console.log('✅ [DB] Kysely typed query builder initialized');
