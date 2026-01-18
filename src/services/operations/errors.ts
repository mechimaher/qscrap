/**
 * Operations Service Errors
 */

export class OperationsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OperationsError';
    }
}

export class OrderNotFoundError extends OperationsError {
    constructor(orderId: string) {
        super(`Order not found: ${orderId}`);
        this.name = 'OrderNotFoundError';
    }
}

export class DisputeNotFoundError extends OperationsError {
    constructor(disputeId: string) {
        super(`Dispute not found: ${disputeId}`);
        this.name = 'DisputeNotFoundError';
    }
}

export class InvalidStatusTransitionError extends OperationsError {
    constructor(from: string, to: string) {
        super(`Invalid status transition from ${from} to ${to}`);
        this.name = 'InvalidStatusTransitionError';
    }
}
