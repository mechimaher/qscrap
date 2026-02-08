/**
 * Request Lifecycle Service
 * Handles request cancellation and deletion
 */
import { Pool, PoolClient } from 'pg';
import { createNotification } from '../notification.service';
import { getIO } from '../../utils/socketIO';

export class RequestLifecycleService {
    constructor(private pool: Pool) { }

    /**
     * Cancel an active request
     */
    async cancelRequest(requestId: string, userId: string): Promise<void> {
        // Verify ownership and status
        const requestResult = await this.pool.query(
            'SELECT * FROM part_requests WHERE request_id = $1 AND customer_id = $2',
            [requestId, userId]
        );

        if (requestResult.rows.length === 0) {
            throw new Error('Request not found or access denied');
        }

        const request = requestResult.rows[0];

        if (request.status !== 'active') {
            throw new Error('Only active requests can be cancelled');
        }

        // Update status to cancelled
        await this.pool.query(
            `UPDATE part_requests SET status = 'cancelled', updated_at = NOW() WHERE request_id = $1`,
            [requestId]
        );
    }

    /**
     * Permanently delete a request (only if NO orders exist)
     */
    async deleteRequest(requestId: string, userId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify ownership
            const requestResult = await client.query(
                'SELECT * FROM part_requests WHERE request_id = $1 AND customer_id = $2 FOR UPDATE',
                [requestId, userId]
            );

            if (requestResult.rows.length === 0) {
                throw new Error('Request not found or access denied');
            }

            const request = requestResult.rows[0];

            // Check if any orders exist for this request
            const orderCheck = await client.query(
                'SELECT order_id FROM orders WHERE request_id = $1 LIMIT 1',
                [requestId]
            );

            if (orderCheck.rows.length > 0) {
                throw new Error('Cannot delete request with existing orders');
            }

            // Get garage IDs for notification before deletion
            const bidsResult = await client.query(
                'SELECT DISTINCT garage_id FROM bids WHERE request_id = $1',
                [requestId]
            );
            const garageIds = bidsResult.rows.map(r => r.garage_id);

            // Delete counter-offers first (foreign key constraint)
            await client.query('DELETE FROM counter_offers WHERE request_id = $1', [requestId]);

            // Delete bids (foreign key constraint)
            await client.query('DELETE FROM bids WHERE request_id = $1', [requestId]);

            // Delete from garage ignored requests
            await client.query('DELETE FROM garage_ignored_requests WHERE request_id = $1', [requestId]);

            // Finally delete the request
            await client.query('DELETE FROM part_requests WHERE request_id = $1', [requestId]);

            await client.query('COMMIT');

            // Notify all garages that had bids
            const io = getIO();

            for (const garageId of garageIds) {
                await createNotification({
                    userId: garageId,
                    type: 'request_deleted',
                    title: 'Request Deleted',
                    message: 'A request you bid on has been deleted by the customer',
                    data: { request_id: requestId },
                    target_role: 'garage'
                });
            }

            // Broadcast to all garages that this request no longer exists
            io?.emit('request_removed', { request_id: requestId });

            return {
                success: true,
                message: 'Request permanently deleted',
                deleted: {
                    request_id: requestId,
                    car: `${request.car_make} ${request.car_model}`,
                    part: request.part_description
                }
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
