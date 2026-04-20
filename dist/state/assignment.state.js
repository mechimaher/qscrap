"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentState = void 0;
class AssignmentState {
    static VALID_TRANSITIONS = {
        'assigned': ['picked_up', 'in_transit'], // Can skip picked_up
        'picked_up': ['in_transit'],
        'in_transit': ['delivered', 'failed'],
        'delivered': [], // Terminal state
        'failed': [] // Terminal state
    };
    static isValidTransition(currentStatus, newStatus) {
        const allowed = this.VALID_TRANSITIONS[currentStatus];
        return allowed ? allowed.includes(newStatus) : false;
    }
    static getAllowedTransitions(currentStatus) {
        return this.VALID_TRANSITIONS[currentStatus] || [];
    }
}
exports.AssignmentState = AssignmentState;
