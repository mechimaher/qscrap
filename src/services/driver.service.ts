
import { getWritePool } from '../config/db';
import { driverRepository } from '../repositories/driver.repository';
import { AssignmentState } from '../state/assignment.state';
import { storageService } from './storage.service';

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
                location: {
                    lat,
                    lng,
                    accuracy: accuracy ? parseFloat(accuracy) : null,
                    heading: heading ? parseFloat(heading) : null,
                    speed: speed ? parseFloat(speed) : null
                },
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
            if (!AssignmentState.isValidTransition(assignment.status, status)) {
                throw new Error(`Cannot transition from '${assignment.status}' to '${status}'. Allowed: ${AssignmentState.getAllowedTransitions(assignment.status).join(', ')}`);
            }

            // 3. Update Assignment Status
            const updatedAssignment = await driverRepository.updateAssignmentStatus(assignmentId, status, notes, failureReason, client);

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

        io.to(`user_${assignment.customer_id}`).emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            old_status: assignment.order_status,
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
