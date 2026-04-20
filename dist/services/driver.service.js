"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverService = exports.DriverService = void 0;
const db_1 = require("../config/db");
const driver_repository_1 = require("../repositories/driver.repository");
const assignment_state_1 = require("../state/assignment.state");
const storage_service_1 = require("./storage.service");
class DriverService {
    pool = (0, db_1.getWritePool)();
    async getMyProfile(userId) {
        return await driver_repository_1.driverRepository.getDriverProfile(userId);
    }
    async getMyAssignments(userId, status) {
        let statusFilter = "da.status IN ('assigned', 'picked_up', 'in_transit')";
        if (status === 'completed') {
            statusFilter = "da.status IN ('delivered', 'failed')";
        }
        else if (status === 'all') {
            statusFilter = '1=1';
        }
        return await driver_repository_1.driverRepository.findActiveAssignments(userId, statusFilter);
    }
    async getAssignmentDetails(userId, assignmentId) {
        return await driver_repository_1.driverRepository.findAssignmentById(assignmentId, userId);
    }
    async getMyStats(userId) {
        return await driver_repository_1.driverRepository.getDriverStats(userId);
    }
    async updateMyLocation(userId, lat, lng, accuracy, heading, speed) {
        // Get driver_id
        const driver = await driver_repository_1.driverRepository.findDriverByUserId(userId);
        if (!driver) {
            throw new Error('Driver profile not found');
        }
        // Update driver location
        await driver_repository_1.driverRepository.updateDriverLocation(driver.driver_id, lat, lng);
        // Update assignments and get affected orders
        const affectedOrders = await driver_repository_1.driverRepository.updateAssignmentsLocation(driver.driver_id, lat, lng);
        // Notify customers (In-memory iteration)
        const io = global.io;
        const notifiedOrderIds = new Set();
        let notifiedCustomers = 0;
        for (const row of affectedOrders) {
            if (notifiedOrderIds.has(row.order_id))
                continue;
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
    async updateAssignmentStatus(userId, assignmentId, status, notes, failureReason) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Get Assignment & Verify Ownership
            const assignment = await driver_repository_1.driverRepository.findAssignmentForUpdate(assignmentId, userId, client);
            if (!assignment) {
                throw new Error('Assignment not found or not yours');
            }
            // 2. Validate Transition
            if (!assignment_state_1.AssignmentState.isValidTransition(assignment.status, status)) {
                throw new Error(`Cannot transition from '${assignment.status}' to '${status}'. Allowed: ${assignment_state_1.AssignmentState.getAllowedTransitions(assignment.status).join(', ')}`);
            }
            // 3. Update Assignment Status
            const updatedAssignment = await driver_repository_1.driverRepository.updateAssignmentStatus(assignmentId, status, notes, failureReason, client);
            // 4. Update Order Status
            let newOrderStatus = null;
            if (assignment.assignment_type === 'delivery' || assignment.assignment_type === 'collection' || !assignment.assignment_type) {
                if (status === 'in_transit')
                    newOrderStatus = 'in_transit';
                else if (status === 'delivered')
                    newOrderStatus = 'delivered';
                else if (status === 'failed')
                    newOrderStatus = 'disputed';
            }
            else if (assignment.assignment_type === 'return_to_garage') {
                if (status === 'delivered')
                    newOrderStatus = 'returning_to_garage';
            }
            if (newOrderStatus) {
                await driver_repository_1.driverRepository.updateOrderStatus(assignment.order_id, newOrderStatus, client);
                await driver_repository_1.driverRepository.createStatusHistory(assignment.order_id, assignment.order_status, newOrderStatus, userId, `Driver: ${status} - ${failureReason || notes || ''}`, client);
            }
            // 5. Handle Failed Delivery (Dispute)
            if (status === 'failed') {
                await driver_repository_1.driverRepository.createDispute(assignment.order_id, assignment.customer_id, assignment.garage_id, 'delivery_issue', `Driver reported delivery failure: ${failureReason || notes || 'Customer refused delivery'}`, client);
            }
            // 6. Handle Completion (Driver Status & Payout)
            if (status === 'delivered' || status === 'failed') {
                const otherActiveCount = await driver_repository_1.driverRepository.countOtherActiveAssignments(assignment.driver_id, assignmentId, client);
                if (otherActiveCount === 0) {
                    await driver_repository_1.driverRepository.updateDriverStatus(assignment.driver_id, 'available', client);
                }
                await driver_repository_1.driverRepository.incrementDeliveryCount(assignment.driver_id, client);
                if (status === 'delivered') {
                    const order = await driver_repository_1.driverRepository.getOrderTotal(assignment.order_id, client);
                    const orderTotal = parseFloat(order.total_amount) || 0;
                    const payoutAmount = Math.max(20, orderTotal * 0.15);
                    await driver_repository_1.driverRepository.createPayout(assignment.driver_id, assignmentId, assignment.order_id, order.order_number, payoutAmount, client);
                    await driver_repository_1.driverRepository.updateDriverEarnings(assignment.driver_id, payoutAmount, client);
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
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    sendNotifications(assignment, status, newOrderStatus, failureReason) {
        const io = global.io;
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
    async uploadProof(userId, assignmentId, photoBase64, signatureBase64, notes) {
        // Verify ownership
        const assignment = await driver_repository_1.driverRepository.findAssignmentById(assignmentId, userId);
        if (!assignment) {
            throw new Error('Assignment not found or not yours');
        }
        // Upload to storage
        const photoResult = await storage_service_1.storageService.uploadBase64(photoBase64, 'proofs');
        let signatureUrl = null;
        if (signatureBase64) {
            const signatureResult = await storage_service_1.storageService.uploadBase64(signatureBase64, 'signatures');
            signatureUrl = signatureResult.url;
        }
        // Save to DB
        const updatedAssignment = await driver_repository_1.driverRepository.saveDeliveryProof(assignmentId, photoResult.url, signatureUrl, notes);
        return {
            success: true,
            message: 'Proof of delivery uploaded',
            assignment: updatedAssignment
        };
    }
    async toggleAvailability(userId, status) {
        if (status === 'offline') {
            const activeCount = await driver_repository_1.driverRepository.countActiveAssignmentsForUser(userId);
            if (activeCount > 0) {
                throw new Error(`Cannot go offline with ${activeCount} active deliveries`);
            }
        }
        const driver = await driver_repository_1.driverRepository.updateDriverStatusByUserId(userId, status);
        if (!driver) {
            throw new Error('Driver not found');
        }
        // Notify operations
        const io = global.io;
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
exports.DriverService = DriverService;
exports.driverService = new DriverService();
