"use strict";
/**
 * QScrap State Machine
 *
 * Centralized state transition validator for all entities.
 * Ensures only valid state transitions occur, preventing logic bugs.
 *
 * Premium 2026: Comprehensive state management with clear transition rules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSPECTION_TRANSITIONS = exports.DELIVERY_TRANSITIONS = exports.PAYOUT_TRANSITIONS = exports.DISPUTE_TRANSITIONS = exports.BID_TRANSITIONS = exports.ORDER_TRANSITIONS = void 0;
exports.canTransitionOrder = canTransitionOrder;
exports.canTransitionBid = canTransitionBid;
exports.canTransitionDispute = canTransitionDispute;
exports.canTransitionPayout = canTransitionPayout;
exports.adminOverride = adminOverride;
// ============================================
// ORDER STATUS TRANSITIONS
// ============================================
exports.ORDER_TRANSITIONS = {
    // Initial state
    'confirmed': ['preparing', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops'],
    // Garage preparing
    'preparing': ['ready_for_pickup', 'cancelled_by_garage', 'cancelled_by_ops'],
    // Ready for collection
    'ready_for_pickup': ['collected', 'ready_for_collection', 'cancelled_by_ops'],
    'ready_for_collection': ['collected', 'cancelled_by_ops'],
    // QC Flow
    'collected': ['qc_in_progress', 'cancelled_by_ops'],
    'qc_in_progress': ['qc_passed', 'qc_failed'],
    'qc_passed': ['in_transit'],
    'qc_failed': ['returning_to_garage'],
    // Return flow
    'returning_to_garage': ['ready_for_pickup', 'cancelled_by_ops'],
    // Delivery flow
    'in_transit': ['delivered'],
    'delivered': ['completed', 'disputed'],
    // Terminal states (no further transitions except admin override)
    'completed': ['disputed'], // Customer can still dispute after completing
    'disputed': ['refunded', 'completed'], // Resolution options
    'refunded': [], // Final state
    'cancelled_by_customer': [], // Final state
    'cancelled_by_garage': [], // Final state
    'cancelled_by_ops': [], // Final state
};
// ============================================
// BID STATUS TRANSITIONS
// ============================================
exports.BID_TRANSITIONS = {
    'pending': ['accepted', 'rejected', 'withdrawn', 'expired'],
    'accepted': [], // Final state
    'rejected': [], // Final state
    'withdrawn': [], // Final state
    'expired': [], // Final state
};
// ============================================
// DISPUTE STATUS TRANSITIONS
// ============================================
exports.DISPUTE_TRANSITIONS = {
    'pending': ['contested', 'accepted', 'resolved', 'auto_resolved', 'cancelled'],
    'contested': ['refund_approved', 'refund_denied', 'resolved', 'auto_resolved'],
    'accepted': ['refund_approved', 'resolved'],
    'refund_approved': ['resolved'],
    'refund_denied': ['resolved'],
    'auto_resolved': [], // Final state
    'resolved': [], // Final state
    'cancelled': [], // Final state
};
// ============================================
// PAYOUT STATUS TRANSITIONS
// ============================================
exports.PAYOUT_TRANSITIONS = {
    'pending': ['processing', 'on_hold', 'cancelled'],
    'processing': ['awaiting_confirmation', 'failed'],
    'awaiting_confirmation': ['completed', 'disputed'],
    'completed': [], // Final state
    'disputed': ['completed', 'failed'],
    'failed': ['pending'], // Can retry
    'on_hold': ['pending', 'cancelled'],
    'cancelled': [], // Final state
};
// ============================================
// DELIVERY ASSIGNMENT TRANSITIONS
// ============================================
exports.DELIVERY_TRANSITIONS = {
    'assigned': ['picked_up', 'failed'],
    'picked_up': ['in_transit', 'failed'],
    'in_transit': ['delivered', 'failed'],
    'delivered': [], // Final state
    'failed': ['assigned'], // Can be reassigned
};
// ============================================
// INSPECTION STATUS TRANSITIONS
// ============================================
exports.INSPECTION_TRANSITIONS = {
    'pending': ['in_progress'],
    'in_progress': ['passed', 'failed', 'pending'], // Can be reset if abandoned
    'passed': [], // Final state
    'failed': [], // Final state
};
/**
 * Check if an order status transition is valid
 */
function canTransitionOrder(from, to) {
    const allowed = exports.ORDER_TRANSITIONS[from];
    if (!allowed) {
        return {
            valid: false,
            error: `Unknown order status: ${from}`
        };
    }
    if (!allowed.includes(to)) {
        return {
            valid: false,
            error: `Invalid transition: ${from} → ${to}`,
            allowedTransitions: allowed
        };
    }
    return { valid: true };
}
/**
 * Check if a bid status transition is valid
 */
function canTransitionBid(from, to) {
    const allowed = exports.BID_TRANSITIONS[from];
    if (!allowed) {
        return { valid: false, error: `Unknown bid status: ${from}` };
    }
    if (!allowed.includes(to)) {
        return {
            valid: false,
            error: `Invalid bid transition: ${from} → ${to}`,
            allowedTransitions: allowed
        };
    }
    return { valid: true };
}
/**
 * Check if a dispute status transition is valid
 */
function canTransitionDispute(from, to) {
    const allowed = exports.DISPUTE_TRANSITIONS[from];
    if (!allowed) {
        return { valid: false, error: `Unknown dispute status: ${from}` };
    }
    if (!allowed.includes(to)) {
        return {
            valid: false,
            error: `Invalid dispute transition: ${from} → ${to}`,
            allowedTransitions: allowed
        };
    }
    return { valid: true };
}
/**
 * Check if a payout status transition is valid
 */
function canTransitionPayout(from, to) {
    const allowed = exports.PAYOUT_TRANSITIONS[from];
    if (!allowed) {
        return { valid: false, error: `Unknown payout status: ${from}` };
    }
    if (!allowed.includes(to)) {
        return {
            valid: false,
            error: `Invalid payout transition: ${from} → ${to}`,
            allowedTransitions: allowed
        };
    }
    return { valid: true };
}
/**
 * Admin override - allows any transition
 * Use with caution and always log the override
 */
function adminOverride(entityType, from, to) {
    console.warn(`[STATE-MACHINE] Admin override: ${entityType} ${from} → ${to}`);
    return { valid: true };
}
// ============================================
// EXPORTS
// ============================================
exports.default = {
    ORDER_TRANSITIONS: exports.ORDER_TRANSITIONS,
    BID_TRANSITIONS: exports.BID_TRANSITIONS,
    DISPUTE_TRANSITIONS: exports.DISPUTE_TRANSITIONS,
    PAYOUT_TRANSITIONS: exports.PAYOUT_TRANSITIONS,
    DELIVERY_TRANSITIONS: exports.DELIVERY_TRANSITIONS,
    INSPECTION_TRANSITIONS: exports.INSPECTION_TRANSITIONS,
    canTransitionOrder,
    canTransitionBid,
    canTransitionDispute,
    canTransitionPayout,
    adminOverride
};
