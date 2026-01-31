/**
 * ShowcaseOrderService - Quick Orders & Quote Requests
 * Handles direct purchase and quote request flows from showcase
 */

import { Pool, PoolClient } from 'pg';
import { QuickOrderData, QuoteRequestData } from './types';
import {
    PartNotFoundError,
    InsufficientStockError,
    PartNotActiveError
} from './errors';
import { getDeliveryFeeForLocation } from '../../controllers/delivery.controller';
import { createNotification } from '../notification.service';

export class ShowcaseOrderService {
    constructor(private pool: Pool) { }

    /**
     * Create quick order from showcase (fixed price)
     */
    async quickOrderFromShowcase(customerId: string, orderData: QuickOrderData): Promise<any> {
        const {
            part_id,
            quantity,
            delivery_address_text,
            delivery_lat,
            delivery_lng,
            payment_method,
            delivery_notes
        } = orderData;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get part details
            const partResult = await client.query(`
                SELECT gp.*, g.garage_name, g.commission_rate
                FROM garage_parts gp
                JOIN garages g ON gp.garage_id = g.garage_id
                WHERE gp.part_id = $1
                FOR UPDATE
            `, [part_id]);

            if (partResult.rows.length === 0) {
                throw new PartNotFoundError(part_id);
            }

            const part = partResult.rows[0];

            if (part.status !== 'active') {
                throw new PartNotActiveError(part_id);
            }

            if (part.quantity < quantity) {
                throw new InsufficientStockError(part_id, quantity, part.quantity);
            }

            // Calculate delivery fee (Zone-based: Garage → Customer only)
            let delivery_fee = 10.00; // Zone 1 base fee
            let delivery_zone_id = null;
            if (delivery_lat && delivery_lng) {
                const zoneInfo = await getDeliveryFeeForLocation(delivery_lat, delivery_lng);
                delivery_fee = zoneInfo.fee;
                delivery_zone_id = zoneInfo.zone_id;
            }

            const part_price = part.price * quantity;
            const platform_fee = part_price * (part.commission_rate || 0.15);
            const total_amount = part_price + delivery_fee;

            // Create part request
            const requestResult = await client.query(`
                INSERT INTO part_requests 
                (customer_id, car_make, car_model, car_year, part_description, 
                 delivery_address_text, delivery_lat, delivery_lng, status, source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'matched', 'showcase')
                RETURNING request_id
            `, [
                customerId, part.car_make, part.car_model, part.car_year,
                `${part.title} - ${part.part_description}`,
                delivery_address_text, delivery_lat, delivery_lng
            ]);

            const request_id = requestResult.rows[0].request_id;

            // Create auto-bid
            const bidResult = await client.query(`
                INSERT INTO bids 
                (request_id, garage_id, price, warranty_days, part_condition,
                 notes, status, source, image_urls)
                VALUES ($1, $2, $3, 30, 'new', $4, 'pending', 'showcase', $5)
                RETURNING bid_id
            `, [
                request_id, part.garage_id, part_price,
                `Showcase part: ${part.title}`, part.image_urls || []
            ]);

            const bid_id = bidResult.rows[0].bid_id;

            // Create order
            const orderResult = await client.query(`
                INSERT INTO orders 
                (customer_id, garage_id, request_id, bid_id, order_status,
                 part_price, delivery_fee, platform_fee, total_amount,
                 garage_payout_amount, payment_method, delivery_notes,
                 delivery_zone_id, source)
                VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8, $9, $10, $11, $12, 'showcase')
                RETURNING order_id, order_number
            `, [
                customerId, part.garage_id, request_id, bid_id,
                part_price, delivery_fee, platform_fee, total_amount,
                part_price - platform_fee, payment_method, delivery_notes,
                delivery_zone_id
            ]);

            const order = orderResult.rows[0];

            // Decrement stock
            await client.query(`
                UPDATE garage_parts
                SET quantity = quantity - $1, updated_at = NOW()
                WHERE part_id = $2
            `, [quantity, part_id]);

            await client.query('COMMIT');

            // Notifications
            await this.notifyQuickOrder(customerId, part.garage_id, order);

            return {
                order_id: order.order_id,
                order_number: order.order_number,
                total_amount
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Request quote from showcase (negotiable parts)
     */
    async requestQuoteFromShowcase(customerId: string, quoteData: QuoteRequestData): Promise<any> {
        const {
            part_id,
            quantity,
            delivery_address_text,
            delivery_lat,
            delivery_lng,
            customer_notes
        } = quoteData;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get part details
            const partResult = await client.query(`
                SELECT gp.*, g.garage_name
                FROM garage_parts gp
                JOIN garages g ON gp.garage_id = g.garage_id
                WHERE gp.part_id = $1
            `, [part_id]);

            if (partResult.rows.length === 0) {
                throw new PartNotFoundError(part_id);
            }

            const part = partResult.rows[0];

            if (part.status !== 'active') {
                throw new PartNotActiveError(part_id);
            }

            // Create part request
            const requestResult = await client.query(`
                INSERT INTO part_requests 
                (customer_id, car_make, car_model, car_year, part_description, part_number,
                 delivery_address_text, delivery_lat, delivery_lng, status, source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', 'showcase')
                RETURNING request_id
            `, [
                customerId, part.car_make, part.car_model, part.car_year,
                `${part.title} - ${part.part_description}${customer_notes ? ` (${customer_notes})` : ''}`,
                part.part_number || '',
                delivery_address_text, delivery_lat, delivery_lng
            ]);

            const request_id = requestResult.rows[0].request_id;

            // Create auto-bid
            await client.query(`
                INSERT INTO bids 
                (request_id, garage_id, price, warranty_days, part_condition,
                 notes, status, source, image_urls)
                VALUES ($1, $2, $3, 30, 'new', $4, 'pending', 'showcase', $5)
            `, [
                request_id, part.garage_id, part.price * quantity,
                `Quote for: ${part.title} (Qty: ${quantity})`, part.image_urls || []
            ]);

            await client.query('COMMIT');

            // Notifications
            await this.notifyQuoteRequest(customerId, part.garage_id, request_id);

            return { request_id, message: 'Quote request sent successfully' };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Notify quick order
     */
    private async notifyQuickOrder(customerId: string, garageId: string, order: any): Promise<void> {
        await createNotification({
            userId: garageId,
            type: 'new_order',
            title: 'New Showcase Order 🛒',
            message: `Order #${order.order_number} from showcase`,
            data: { order_id: order.order_id, order_number: order.order_number },
            target_role: 'garage'
        });

        const io = (global as any).io;
        io.to(`garage_${garageId}`).emit('new_order', {
            order_id: order.order_id,
            order_number: order.order_number,
            source: 'showcase'
        });
    }

    /**
     * Notify quote request
     */
    private async notifyQuoteRequest(customerId: string, garageId: string, requestId: string): Promise<void> {
        await createNotification({
            userId: garageId,
            type: 'new_request',
            title: 'New Quote Request 💬',
            message: 'Customer requested quote from your showcase',
            data: { request_id: requestId },
            target_role: 'garage'
        });

        const io = (global as any).io;
        io.to(`garage_${garageId}`).emit('new_quote_request', { request_id: requestId });
    }
}
