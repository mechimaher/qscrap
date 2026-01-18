/**
 * Order Services - Custom Error Classes
 */

export class OrderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class OrderNotFoundError extends OrderError {
    constructor(orderId: string) {
        super(`Order not found: ${orderId}`);
    }
}

export class UnauthorizedOrderAccessError extends OrderError {
    constructor(orderId: string, userId: string) {
        super(`User ${userId} does not have access to order ${orderId}`);
    }
}

export class InvalidStatusTransitionError extends OrderError {
    constructor(currentStatus: string, newStatus: string) {
        super(`Cannot transition from "${currentStatus}" to "${newStatus}"`);
    }
}

export class OrderNotCompletedError extends OrderError {
    constructor(orderId: string) {
        super(`Order ${orderId} is not in completed status`);
    }
}

export class OrderNotDeliveredError extends OrderError {
    constructor(orderId: string) {
        super(`Order ${orderId} is not in delivered status`);
    }
}

export class InvalidRatingError extends OrderError {
    constructor(rating: number) {
        super(`Invalid rating: ${rating}. Must be between 1 and 5`);
    }
}

export function isOrderError(error: any): error is OrderError {
    return error instanceof OrderError;
}

export function getHttpStatusForError(error: OrderError): number {
    if (error instanceof OrderNotFoundError) {
        return 404;
    }
    if (
        error instanceof UnauthorizedOrderAccessError ||
        error instanceof InvalidStatusTransitionError ||
        error instanceof OrderNotCompletedError ||
        error instanceof OrderNotDeliveredError ||
        error instanceof InvalidRatingError
    ) {
        return 400;
    }
    return 500;
}
