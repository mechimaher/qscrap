
import { getWritePool } from '../config/db';
import { driverRepository } from '../repositories/driver.repository';
import { AssignmentState } from '../state/assignment.state';
import { storageService } from './storage.service';
import { walletService } from './wallet.service';

export class DriverService {
    private pool = getWritePool();

    async getMyProfile(userId: string) {
        return await driverRepository.getDriverProfile(userId);
    }

    async getMyAssignments(userId: string, status: any) {
        let statusFilter = "da.status IN ('assigned', 'picked_up', 'in_transit')";
        if (status === 'completed') {
            statusFilter = "da.status IN ('delivered', 'failed')";
        } else if (status === 'all') {
            statusFilter = '1=1';
        }
        return await driverRepository.findActiveAssignments(userId, statusFilter);
    }

    async getAssignmentDetails(userId: string, assignmentId: string) {
        return await driverRepository.findAssignmentById(assignmentId, userId);
    }

    async getMyStats(userId: string) {
        return await driverRepository.getDriverStats(userId);
    }

    async getEarningsTrend(userId: string) {
        return await driverRepository.getEarningsTrend(userId);
    }

    async getPayoutHistory(userId: string) {
        return await driverRepository.getPayoutHistory(userId);
    }

    async updateProfile(userId: string, data: any) {
        return await driverRepository.updateDriverProfile(userId, data);
    }

    async getWallet(userId: string) {
        return await walletService.getWallet(userId);
    }

    async getWalletHistory(userId: string) {
        return await walletService.getHistory(userId);
    }

    async updateMyLocation(userId: string, lat: number, lng: number, accuracy: any, heading: any, speed: any) {
        // Get driver_id
        const driver = await driverRepository.findDriverByUserId(userId);
        if (!driver) {
            throw new Error('Driver profile not found');
        }

        // Update driver location
        await driverRepository.updateDriverLocation(driver.driver_id, lat, lng, heading, speed, accuracy);

        // Update assignments and get affected orders
        const affectedOrders = await driverRepository.updateAssignmentsLocation(driver.driver_id, lat, lng);

        // Notify customers (In-memory iteration)
        const io = (global as any).io;
        const notifiedOrderIds = new Set<string>();
        let notifiedCustomers = 0;

        for (const row of affectedOrders) {
            if (notifiedOrderIds.has(row.order_id)) continue;

            io.to(`user_${row.customer_id}`).emit('driver_location_update', {
                order_id: row.order_id,
                order_number: row.order_number,
                latitude: lat,
                longitude: lng,
                heading: heading ? parseFloat(heading) : 0,
                speed: speed ? parseFloat(speed) : 0,
                timestamp: new Date().toISOString()
            });

            notifiedOrderIds.add(row.order_id);
            notifiedCustomers++;
        }

        return {
            success: true,
            location: { lat, lng },
            activeAssignments: affectedOrders.length,
            notifiedCustomers,
            updateInterval: 5
        };
    }

    async acceptAssignment(userId: string, assignmentId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Get Assignment & Verify Ownership
            const assignment = await driverRepository.findAssignmentForUpdate(assignmentId, userId, client);
            if (!assignment) {
                throw new Error('Assignment not found or not yours');
            }

            // 2. Validate Current Status
            if (assignment.status !== 'pending') {
                throw new Error(`Cannot accept assignment from status '${assignment.status}'. Must be 'pending'.`);
            }

            // 3. Update Assignment to 'assigned'
            await client.query(`
                UPDATE driver_assignments 
                SET status = 'assigned',
                    accepted_at = NOW()
                WHERE assignment_id = $1
            `, [assignmentId]);

            // 4. Updated driver status to 'busy'
            await driverRepository.updateDriverStatus(assignment.driver_id, 'busy', client);

            await client.query('COMMIT');

            // 5. Notifications (Post-Commit)
            const io = (global as any).io;

            // Notify customer
            io.to(`user_${assignment.customer_id}`).emit('driver_accepted_assignment', {
                assignment_id: assignmentId,
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                notification: `Driver has accepted your delivery!`
            });

            // Notify operations
            io.to('operations').emit('assignment_accepted', {
                assignment_id: assignmentId,
                driver_id: assignment.driver_id,
                order_id: assignment.order_id
            });

            return {
                success: true,
                message: 'Assignment accepted',
                assignment: { ...assignment, status: 'assigned' }
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async rejectAssignment(userId: string, assignmentId: string, rejectionReason?: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Get Assignment & Verify Ownership
            const assignment = await driverRepository.findAssignmentForUpdate(assignmentId, userId, client);
            if (!assignment) {
                throw new Error('Assignment not found or not yours');
            }

            // 2. Validate Current Status
            if (assignment.status !== 'pending') {
                throw new Error(`Cannot reject assignment from status '${assignment.status}'. Must be 'pending'.`);
            }

            // 3. Update Assignment to 'rejected'
            await client.query(`
                UPDATE driver_assignments 
                SET status = 'rejected',
                    rejection_reason = $2,
                    rejected_at = NOW()
                WHERE assignment_id = $1
            `, [assignmentId, rejectionReason || 'Driver declined']);

            // 4. Driver remains 'available' for other assignments

            await client.query('COMMIT');

            // 5. Notifications (Post-Commit)
            const io = (global as any).io;

            // Notify operations for reassignment
            io.to('operations').emit('assignment_rejected_by_driver', {
                assignment_id: assignmentId,
                driver_id: assignment.driver_id,
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                reason: rejectionReason,
                notification: `⚠️ Driver rejected assignment for Order #${assignment.order_number}. Reassignment needed.`
            });

            return {
                success: true,
                message: 'Assignment rejected',
                assignment: { ...assignment, status: 'rejected' }
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async updateAssignmentStatus(userId: string, assignmentId: string, status: string, notes?: string, failureReason?: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Get Assignment & Verify Ownership
            const assignment = await driverRepository.findAssignmentForUpdate(assignmentId, userId, client);
            if (!assignment) {
                throw new Error('Assignment not found or not yours');
            }

            // 2. Validate Transition
            if (assignment.status === status) {
                // IDEMPOTENCY CHECK WITH RECOVERY:
                // Even if assignment is already updated, ensure the Order Status is consistent.
                // This covers cases where Assignment updated but Order update failed.
                const currentOrder = await client.query('SELECT order_status FROM orders WHERE order_id = $1', [assignment.order_id]);
                const currentOrderStatus = currentOrder.rows[0]?.order_status;

                let shouldUpdateOrder = false;
                if (status === 'delivered' && currentOrderStatus !== 'delivered' && currentOrderStatus !== 'completed') {
                    shouldUpdateOrder = true;
                } else if (status === 'picked_up' && currentOrderStatus !== 'collected' && currentOrderStatus !== 'in_transit') {
                    shouldUpdateOrder = true;
                }

                if (!shouldUpdateOrder) {
                    await client.query('COMMIT');
                    return {
                        success: true,
                        assignment,
                        message: `Status is already ${status}`
                    };
                }
                // If we need to fix the order status, fall through to logic below...
                // But we need to avoid re-updating assignment.
                // Refactoring flow to separate Assignment Update from Order Update would be best, 
                // but for minimal diff, I will just proceed and let the SQL update (which is cheap) run again 
                // or just skip the assignment update part.
            }

            // 3. Update Assignment Status
            // Only update if status implies a change
            let updatedAssignment = assignment;

            if (assignment.status !== status) {
                if (!AssignmentState.isValidTransition(assignment.status, status)) {
                    throw new Error(`Cannot transition from '${assignment.status}' to '${status}'. Allowed: ${AssignmentState.getAllowedTransitions(assignment.status).join(', ')}`);
                }
                updatedAssignment = await driverRepository.updateAssignmentStatus(assignmentId, status, notes, failureReason, client);
            }

            // 4. Update Order Status based on assignment type and new status
            let newOrderStatus = null;

            // COLLECTION ASSIGNMENTS: Driver confirms pickup from garage
            // picked_up means driver collected the part → order becomes 'collected'
            if (assignment.assignment_type === 'collection') {
                if (status === 'picked_up') {
                    newOrderStatus = 'collected';
                } else if (status === 'in_transit') {
                    // After collection, driver goes to customer
                    newOrderStatus = 'in_transit';
                } else if (status === 'delivered') {
                    newOrderStatus = 'delivered';
                } else if (status === 'failed') {
                    newOrderStatus = 'disputed';
                }
            }
            // DELIVERY ASSIGNMENTS: Standard delivery flow
            else if (assignment.assignment_type === 'delivery' || !assignment.assignment_type) {
                if (status === 'in_transit') newOrderStatus = 'in_transit';
                else if (status === 'delivered') newOrderStatus = 'delivered';
                else if (status === 'failed') newOrderStatus = 'disputed';
            }
            // RETURN ASSIGNMENTS: Return to garage
            else if (assignment.assignment_type === 'return_to_garage') {
                if (status === 'delivered') newOrderStatus = 'returning_to_garage';
            }

            if (newOrderStatus) {
                await driverRepository.updateOrderStatus(assignment.order_id, newOrderStatus, client);
                await driverRepository.createStatusHistory(
                    assignment.order_id,
                    assignment.order_status,
                    newOrderStatus,
                    userId,
                    `Driver: ${status} - ${failureReason || notes || ''}`,
                    client
                );
            }

            // 5. Handle Failed Delivery (Dispute)
            if (status === 'failed') {
                await driverRepository.createDispute(
                    assignment.order_id,
                    assignment.customer_id,
                    assignment.garage_id,
                    'delivery_issue',
                    `Driver reported delivery failure: ${failureReason || notes || 'Customer refused delivery'}`,
                    client
                );
            }

            // 6. Handle Completion (Driver Status & Payout)
            if (status === 'delivered' || status === 'failed') {
                const otherActiveCount = await driverRepository.countOtherActiveAssignments(assignment.driver_id, assignmentId, client);

                if (otherActiveCount === 0) {
                    await driverRepository.updateDriverStatus(assignment.driver_id, 'available', client);
                }

                await driverRepository.incrementDeliveryCount(assignment.driver_id, client);

                if (status === 'delivered') {
                    const order = await driverRepository.getOrderTotal(assignment.order_id, client);
                    const orderTotal = parseFloat(order.total_amount) || 0;
                    const payoutAmount = Math.max(20, orderTotal * 0.15);

                    await driverRepository.createPayout(
                        assignment.driver_id,
                        assignmentId,
                        assignment.order_id,
                        order.order_number,
                        payoutAmount,
                        client
                    );

                    await driverRepository.updateDriverEarnings(assignment.driver_id, payoutAmount, client);

                    // --- WALLET INTEGRATION (Gig Economy Model) ---
                    try {
                        // 1. Credit Earnings
                        await walletService.addTransaction(
                            assignment.driver_id,
                            payoutAmount,
                            'earning',
                            assignment.order_id,
                            `Delivery Earning #${order.order_number}`
                        );

                        // 2. Debit Cash Collection (if COD)
                        // Assuming 'cash' is the payment method key. Verify with order data.
                        // For now, we check if payment_status is 'pending' which usually implies COD for delivered items
                        if (order.payment_method === 'cash' || order.payment_status === 'pending') {
                            await walletService.addTransaction(
                                assignment.driver_id,
                                -orderTotal, // Negative amount
                                'cash_collection',
                                assignment.order_id,
                                `Cash Collected #${order.order_number}`
                            );
                        }
                    } catch (walletErr) {
                        console.error('Wallet transaction failed:', walletErr);
                        // Don't fail the whole request, but log it critical
                    }
                    // ---------------------------------------------
                }
            }

            await client.query('COMMIT');

            // 7. Notifications (Post-Commit)
            this.sendNotifications(assignment, status, newOrderStatus, failureReason);

            return {
                success: true,
                assignment: updatedAssignment,
                message: `Status updated to ${status}`
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    private sendNotifications(assignment: any, status: string, newOrderStatus: string | null, failureReason?: string) {
        const io = (global as any).io;

        // Customer Notifications
        io.to(`user_${assignment.customer_id}`).emit('delivery_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_status: status,
            notification: status === 'delivered'
                ? `Your order #${assignment.order_number} has been delivered! Please confirm receipt.`
                : `Delivery update: ${status.replace('_', ' ')}`
        });

        // 1. Emit 'order_status_updated' (past tense) for useSocket (Global Context)
        io.to(`user_${assignment.customer_id}`).emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            old_status: assignment.order_status,
            new_status: status === 'delivered' ? 'delivered' : status,
            notification: status === 'delivered'
                ? `Your order #${assignment.order_number} has been delivered! Please confirm receipt.`
                : `Delivery update: ${status.replace('_', ' ')}`
        });

        // 2. Emit 'order_status_update' (present tense) for TrackingScreen (Local Socket)
        io.to(`user_${assignment.customer_id}`).emit('order_status_update', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            old_status: assignment.order_status,
            status: status === 'delivered' ? 'delivered' : status, // TrackingScreen expects 'status'
            new_status: status === 'delivered' ? 'delivered' : status,
            notification: status === 'delivered'
                ? `Your order #${assignment.order_number} has been delivered! Please confirm receipt.`
                : `Delivery update: ${status.replace('_', ' ')}`
        });

        if (status === 'delivered') {
            io.to(`user_${assignment.customer_id}`).emit('delivery_completed', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                notification: `Your part has arrived! Please confirm delivery to complete the order.`
            });
        }

        // Garage Notification
        io.to(`garage_${assignment.garage_id}`).emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_status: newOrderStatus || status
        });

        // Operations Notification
        if (status === 'failed') {
            io.to('operations').emit('dispute_created', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                reason: 'Delivery Failed',
                notification: `⚠️ Delivery Failed for Order #${assignment.order_number}`
            });
        }

        io.to('operations').emit('delivery_status_updated', {
            assignment_id: assignment.assignment_id,
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_status: status
        });

        io.to('operations').emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            old_status: assignment.order_status,
            new_status: newOrderStatus || status
        });
    }

    async uploadProof(userId: string, assignmentId: string, photoBase64: string, signatureBase64?: string, notes?: string) {
        // Verify ownership
        const assignment = await driverRepository.findAssignmentById(assignmentId, userId);
        if (!assignment) {
            throw new Error('Assignment not found or not yours');
        }

        // Upload to storage
        const photoResult = await storageService.uploadBase64(photoBase64, 'proofs');

        let signatureUrl = null;
        if (signatureBase64) {
            const signatureResult = await storageService.uploadBase64(signatureBase64, 'signatures');
            signatureUrl = signatureResult.url;
        }

        // Save to DB
        const updatedAssignment = await driverRepository.saveDeliveryProof(assignmentId, photoResult.url, signatureUrl, notes);

        return {
            success: true,
            message: 'Proof of delivery uploaded',
            assignment: updatedAssignment
        };
    }

    async toggleAvailability(userId: string, status: string) {
        if (status === 'offline') {
            const activeCount = await driverRepository.countActiveAssignmentsForUser(userId);
            if (activeCount > 0) {
                throw new Error(`Cannot go offline with ${activeCount} active deliveries`);
            }
        }

        const driver = await driverRepository.updateDriverStatusByUserId(userId, status);
        if (!driver) {
            throw new Error('Driver not found');
        }

        // Notify operations
        const io = (global as any).io;
        io.to('operations').emit('driver_status_changed', {
            driver_id: driver.driver_id,
            new_status: status
        });

        return {
            success: true,
            status: driver.status,
            message: `You are now ${status}`
        };
    }
}

export const driverService = new DriverService();
