/**
 * Cancellation Service Errors
 */

export class CancellationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CancellationError';
    }
}

export class CannotCancelError extends CancellationError {
    constructor(reason: string) {
        super(`Cannot cancel: ${reason}`);
        this.name = 'CannotCancelError';
    }
}

export class OrderNotFoundError extends CancellationError {
    constructor(orderId: string) {
        super(`Order not found: ${orderId}`);
        this.name = 'OrderNotFoundError';
    }
}

export class RequestNotFoundError extends CancellationError {
    constructor(requestId: string) {
        super(`Request not found: ${requestId}`);
        this.name = 'RequestNotFoundError';
    }
}

export class BidNotFoundError extends CancellationError {
    constructor(bidId: string) {
        super(`Bid not found: ${bidId}`);
        this.name = 'BidNotFoundError';
    }
}
