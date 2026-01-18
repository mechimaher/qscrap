/**
 * Search Service
 * Handles universal search and autocomplete suggestions
 */
import { Pool } from 'pg';

export class SearchService {
    constructor(private pool: Pool) { }

    async universalSearch(userId: string, userType: string, query: string, searchType?: string, maxResults: number = 10) {
        const searchTerm = `%${query.trim()}%`;
        const results: Record<string, unknown> = {};

        // Orders search
        if (!searchType || searchType === 'orders') {
            let orderQuery = `SELECT o.order_id, o.order_number, o.order_status, o.part_price, o.created_at, pr.part_description, pr.car_make, pr.car_model, g.garage_name, u.full_name as customer_name FROM orders o JOIN part_requests pr ON o.request_id = pr.request_id JOIN garages g ON o.garage_id = g.garage_id JOIN users u ON o.customer_id = u.user_id WHERE (o.order_number ILIKE $1 OR pr.part_description ILIKE $1 OR pr.car_make ILIKE $1 OR pr.car_model ILIKE $1 OR g.garage_name ILIKE $1 OR u.full_name ILIKE $1)`;
            const params: unknown[] = [searchTerm];
            if (userType === 'customer') { orderQuery += ` AND o.customer_id = $2`; params.push(userId); }
            else if (userType === 'garage') { orderQuery += ` AND o.garage_id = $2`; params.push(userId); }
            orderQuery += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
            params.push(maxResults);
            const orderResult = await this.pool.query(orderQuery, params);
            if (orderResult.rows.length > 0) results.orders = orderResult.rows;
        }

        // Users search - admin only
        if (userType === 'admin' && (!searchType || searchType === 'users')) {
            const userResult = await this.pool.query(`SELECT user_id, full_name, email, phone_number, user_type, is_active, created_at FROM users WHERE (full_name ILIKE $1 OR email ILIKE $1 OR phone_number ILIKE $1) ORDER BY created_at DESC LIMIT $2`, [searchTerm, maxResults]);
            if (userResult.rows.length > 0) results.users = userResult.rows;
        }

        // Requests search
        if (!searchType || searchType === 'requests') {
            let requestQuery = `SELECT pr.request_id, pr.part_description, pr.car_make, pr.car_model, pr.car_year, pr.status, pr.created_at, u.full_name as customer_name FROM part_requests pr JOIN users u ON pr.customer_id = u.user_id WHERE (pr.part_description ILIKE $1 OR pr.car_make ILIKE $1 OR pr.car_model ILIKE $1 OR pr.vin_number ILIKE $1)`;
            const params: unknown[] = [searchTerm];
            if (userType === 'customer') { requestQuery += ` AND pr.customer_id = $2`; params.push(userId); }
            else if (userType === 'garage') { requestQuery += ` AND (pr.status = 'pending' OR EXISTS (SELECT 1 FROM bids b WHERE b.request_id = pr.request_id AND b.garage_id = $2))`; params.push(userId); }
            requestQuery += ` ORDER BY pr.created_at DESC LIMIT $${params.length + 1}`;
            params.push(maxResults);
            const requestResult = await this.pool.query(requestQuery, params);
            if (requestResult.rows.length > 0) results.requests = requestResult.rows;
        }

        // Disputes search - admin only
        if (userType === 'admin' && (!searchType || searchType === 'disputes')) {
            const disputeResult = await this.pool.query(`SELECT d.dispute_id, d.reason, d.description, d.status, d.created_at, o.order_number, u.full_name as customer_name FROM disputes d JOIN orders o ON d.order_id = o.order_id JOIN users u ON d.customer_id = u.user_id WHERE (d.reason ILIKE $1 OR d.description ILIKE $1 OR o.order_number ILIKE $1 OR u.full_name ILIKE $1) ORDER BY d.created_at DESC LIMIT $2`, [searchTerm, maxResults]);
            if (disputeResult.rows.length > 0) results.disputes = disputeResult.rows;
        }

        return results;
    }

    async getSuggestions(userId: string, userType: string, query: string) {
        const searchTerm = `%${query.trim()}%`;
        const suggestions: Record<string, unknown>[] = [];

        // Order number suggestions
        let orderQuery = `SELECT o.order_id, o.order_number, 'order' as type, pr.part_description as subtitle FROM orders o JOIN part_requests pr ON o.request_id = pr.request_id WHERE o.order_number ILIKE $1`;
        const params: unknown[] = [searchTerm];
        if (userType === 'customer') { orderQuery += ` AND o.customer_id = $2`; params.push(userId); }
        else if (userType === 'garage') { orderQuery += ` AND o.garage_id = $2`; params.push(userId); }
        orderQuery += ` LIMIT 5`;
        const orderResult = await this.pool.query(orderQuery, params);
        suggestions.push(...orderResult.rows.map(r => ({ id: r.order_id, label: `#${r.order_number}`, subtitle: r.subtitle, type: 'order' })));

        // Part description suggestions
        let partQuery = `SELECT DISTINCT pr.part_description FROM part_requests pr WHERE pr.part_description ILIKE $1`;
        if (userType === 'customer') partQuery += ` AND pr.customer_id = $2`;
        partQuery += ` LIMIT 3`;
        const partResult = await this.pool.query(partQuery, userType === 'customer' ? [searchTerm, userId] : [searchTerm]);
        suggestions.push(...partResult.rows.map(r => ({ label: r.part_description, type: 'part' })));

        return suggestions;
    }
}
