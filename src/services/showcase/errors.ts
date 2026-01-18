/**
 * Showcase Services - Custom Error Classes
 */

export class ShowcaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class PartNotFoundError extends ShowcaseError {
    constructor(partId: string) {
        super(`Showcase part not found: ${partId}`);
    }
}

export class UnauthorizedPartAccessError extends ShowcaseError {
    constructor(partId: string, garageId: string) {
        super(`Garage ${garageId} does not own part ${partId}`);
    }
}

export class NoShowcaseAccessError extends ShowcaseError {
    constructor(garageId: string) {
        super(`Garage ${garageId} does not have showcase feature access`);
    }
}

export class InsufficientStockError extends ShowcaseError {
    constructor(partId: string, requested: number, available: number) {
        super(`Insufficient stock for part ${partId}. Requested: ${requested}, Available: ${available}`);
    }
}

export class PartNotActiveError extends ShowcaseError {
    constructor(partId: string) {
        super(`Part ${partId} is not active for purchase`);
    }
}

export function isShowcaseError(error: any): error is ShowcaseError {
    return error instanceof ShowcaseError;
}

export function getHttpStatusForError(error: ShowcaseError): number {
    if (error instanceof PartNotFoundError) {
        return 404;
    }
    if (
        error instanceof UnauthorizedPartAccessError ||
        error instanceof NoShowcaseAccessError ||
        error instanceof InsufficientStockError ||
        error instanceof PartNotActiveError
    ) {
        return 400;
    }
    return 500;
}
