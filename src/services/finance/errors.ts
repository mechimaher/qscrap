/**
 * Finance Services - Custom Error Classes
 * Type-safe error handling for payout, refund, and revenue operations
 */

// ============================================
// BASE ERROR
// ============================================

export class FinanceError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'FinanceError';
        Object.setPrototypeOf(this, FinanceError.prototype);
    }
}

// ============================================
// PAYOUT ERRORS
// ============================================

export class PayoutNotFoundError extends FinanceError {
    constructor(payoutId: string) {
        super(`Payout ${payoutId} not found`, 'PAYOUT_NOT_FOUND');
        this.name = 'PayoutNotFoundError';
        Object.setPrototypeOf(this, PayoutNotFoundError.prototype);
    }
}

export class InvalidPayoutStatusError extends FinanceError {
    constructor(
        public payoutId: string,
        public currentStatus: string,
        public requiredStatuses: string[]
    ) {
        super(
            `Invalid payout status: ${currentStatus}. Expected one of: ${requiredStatuses.join(', ')}`,
            'INVALID_PAYOUT_STATUS'
        );
        this.name = 'InvalidPayoutStatusError';
        Object.setPrototypeOf(this, InvalidPayoutStatusError.prototype);
    }
}

export class PayoutAlreadyProcessedError extends FinanceError {
    constructor(payoutId: string, status: string) {
        super(
            `Payout ${payoutId} already processed with status: ${status}`,
            'PAYOUT_ALREADY_PROCESSED'
        );
        this.name = 'PayoutAlreadyProcessedError';
        Object.setPrototypeOf(this, PayoutAlreadyProcessedError.prototype);
    }
}

export class UnauthorizedPayoutAccessError extends FinanceError {
    constructor(userId: string, payoutId: string) {
        super(
            `User ${userId} is not authorized to access payout ${payoutId}`,
            'UNAUTHORIZED_PAYOUT_ACCESS'
        );
        this.name = 'UnauthorizedPayoutAccessError';
        Object.setPrototypeOf(this, UnauthorizedPayoutAccessError.prototype);
    }
}

export class InvalidPasswordError extends FinanceError {
    constructor() {
        super('Invalid password provided', 'INVALID_PASSWORD');
        this.name = 'InvalidPasswordError';
        Object.setPrototypeOf(this, InvalidPasswordError.prototype);
    }
}

export class BulkOperationError extends FinanceError {
    constructor(
        message: string,
        public successCount: number,
        public failureCount: number,
        public errors: string[]
    ) {
        super(message, 'BULK_OPERATION_ERROR');
        this.name = 'BulkOperationError';
        Object.setPrototypeOf(this, BulkOperationError.prototype);
    }
}

// ============================================
// REFUND ERRORS
// ============================================

export class RefundNotFoundError extends FinanceError {
    constructor(refundId: string) {
        super(`Refund ${refundId} not found`, 'REFUND_NOT_FOUND');
        this.name = 'RefundNotFoundError';
        Object.setPrototypeOf(this, RefundNotFoundError.prototype);
    }
}

export class OrderNotFoundError extends FinanceError {
    constructor(orderId: string) {
        super(`Order ${orderId} not found`, 'ORDER_NOT_FOUND');
        this.name = 'OrderNotFoundError';
        Object.setPrototypeOf(this, OrderNotFoundError.prototype);
    }
}

export class InvalidRefundAmountError extends FinanceError {
    constructor(requestedAmount: number, maxAmount: number) {
        super(
            `Refund amount ${requestedAmount} exceeds order total ${maxAmount}`,
            'INVALID_REFUND_AMOUNT'
        );
        this.name = 'InvalidRefundAmountError';
        Object.setPrototypeOf(this, InvalidRefundAmountError.prototype);
    }
}

export class RefundAlreadyProcessedError extends FinanceError {
    constructor(orderId: string) {
        super(
            `Refund already processed for order ${orderId}`,
            'REFUND_ALREADY_PROCESSED'
        );
        this.name = 'RefundAlreadyProcessedError';
        Object.setPrototypeOf(this, RefundAlreadyProcessedError.prototype);
    }
}

// ============================================
// REVENUE ERRORS
// ============================================

export class InvalidPeriodError extends FinanceError {
    constructor(period: string, validPeriods: string[]) {
        super(
            `Invalid period: ${period}. Valid periods: ${validPeriods.join(', ')}`,
            'INVALID_PERIOD'
        );
        this.name = 'InvalidPeriodError';
        Object.setPrototypeOf(this, InvalidPeriodError.prototype);
    }
}

export class TransactionNotFoundError extends FinanceError {
    constructor(transactionId: string) {
        super(`Transaction ${transactionId} not found`, 'TRANSACTION_NOT_FOUND');
        this.name = 'TransactionNotFoundError';
        Object.setPrototypeOf(this, TransactionNotFoundError.prototype);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Type guard to check if error is a FinanceError
 */
export function isFinanceError(error: unknown): error is FinanceError {
    return error instanceof FinanceError;
}

/**
 * Get HTTP status code for FinanceError
 */
export function getHttpStatusForError(error: FinanceError): number {
    switch (error.code) {
        case 'PAYOUT_NOT_FOUND':
        case 'REFUND_NOT_FOUND':
        case 'ORDER_NOT_FOUND':
        case 'TRANSACTION_NOT_FOUND':
            return 404;

        case 'UNAUTHORIZED_PAYOUT_ACCESS':
            return 403;

        case 'INVALID_PASSWORD':
            return 401;

        case 'INVALID_PAYOUT_STATUS':
        case 'PAYOUT_ALREADY_PROCESSED':
        case 'INVALID_REFUND_AMOUNT':
        case 'REFUND_ALREADY_PROCESSED':
        case 'INVALID_PERIOD':
        case 'BULK_OPERATION_ERROR':
            return 400;

        default:
            return 500;
    }
}
