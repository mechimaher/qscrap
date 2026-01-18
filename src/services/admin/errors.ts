/**
 * Admin Services - Custom Error Classes
 * Type-safe error handling for admin operations
 */

// ============================================
// BASE ADMIN ERROR
// ============================================

export class AdminError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// ============================================
// GARAGE APPROVAL ERRORS
// ============================================

export class GarageNotFoundError extends AdminError {
    constructor(garageId: string) {
        super(`Garage not found: ${garageId}`);
    }
}

export class GarageAlreadyProcessedError extends AdminError {
    constructor(garageId: string, currentStatus: string) {
        super(`Garage ${garageId} already processed with status: ${currentStatus}`);
    }
}

export class InvalidApprovalStatusError extends AdminError {
    constructor(status: string) {
        super(`Invalid approval status: ${status}`);
    }
}

export class DemoAlreadyExpiredError extends AdminError {
    constructor(garageId: string, expiredAt: Date) {
        super(`Demo for garage ${garageId} already expired at ${expiredAt.toISOString()}`);
    }
}

// ============================================
// SUBSCRIPTION ERRORS
// ============================================

export class PlanNotFoundError extends AdminError {
    constructor(planId: number) {
        super(`Subscription plan not found: ${planId}`);
    }
}

export class SubscriptionNotFoundError extends AdminError {
    constructor(garageId: string) {
        super(`No active subscription found for garage: ${garageId}`);
    }
}

export class RequestAlreadyProcessedError extends AdminError {
    constructor(requestId: string, status: string) {
        super(`Subscription request ${requestId} already processed with status: ${status}`);
    }
}

export class InvalidCommissionRateError extends AdminError {
    constructor(rate: number) {
        super(`Invalid commission rate: ${rate}. Must be between 0 and 100.`);
    }
}

// ============================================
// USER MANAGEMENT ERRORS
// ============================================

export class UserNotFoundError extends AdminError {
    constructor(userId: string) {
        super(`User not found: ${userId}`);
    }
}

export class UserAlreadySuspendedError extends AdminError {
    constructor(userId: string) {
        super(`User ${userId} is already suspended`);
    }
}

export class UserAlreadyActiveError extends AdminError {
    constructor(userId: string) {
        super(`User ${userId} is already active`);
    }
}

export class InvalidUserTypeError extends AdminError {
    constructor(userType: string) {
        super(`Invalid user type: ${userType}. Must be customer, garage, driver, or staff.`);
    }
}

export class WeakPasswordError extends AdminError {
    constructor() {
        super('Password must be at least 8 characters long');
    }
}

export class DuplicateEmailError extends AdminError {
    constructor(email: string) {
        super(`Email already exists: ${email}`);
    }
}

export class DuplicatePhoneError extends AdminError {
    constructor(phone: string) {
        super(`Phone number already exists: ${phone}`);
    }
}

// ============================================
// AUDIT ERRORS
// ============================================

export class InvalidActionTypeError extends AdminError {
    constructor(actionType: string) {
        super(`Invalid action type: ${actionType}`);
    }
}

// ============================================
// ERROR TYPE GUARDS
// ============================================

export function isAdminError(error: any): error is AdminError {
    return error instanceof AdminError;
}

// ============================================
// HTTP STATUS MAPPING
// ============================================

export function getHttpStatusForError(error: AdminError): number {
    // 404 Not Found
    if (
        error instanceof GarageNotFoundError ||
        error instanceof PlanNotFoundError ||
        error instanceof SubscriptionNotFoundError ||
        error instanceof UserNotFoundError
    ) {
        return 404;
    }

    // 400 Bad Request
    if (
        error instanceof GarageAlreadyProcessedError ||
        error instanceof InvalidApprovalStatusError ||
        error instanceof DemoAlreadyExpiredError ||
        error instanceof RequestAlreadyProcessedError ||
        error instanceof InvalidCommissionRateError ||
        error instanceof UserAlreadySuspendedError ||
        error instanceof UserAlreadyActiveError ||
        error instanceof InvalidUserTypeError ||
        error instanceof WeakPasswordError ||
        error instanceof InvalidActionTypeError
    ) {
        return 400;
    }

    // 409 Conflict
    if (
        error instanceof DuplicateEmailError ||
        error instanceof DuplicatePhoneError
    ) {
        return 409;
    }

    // Default 500
    return 500;
}
