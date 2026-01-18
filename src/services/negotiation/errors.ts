/**
 * Negotiation Services - Custom Errors
 */

export class NegotiationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class NegotiationLimitReachedError extends NegotiationError {
    constructor(bidId: string) {
        super(`Maximum negotiation rounds (3) reached for bid ${bidId}`);
    }
}

export class BidNotPendingError extends NegotiationError {
    constructor(bidId: string, currentStatus: string) {
        super(`Bid ${bidId} is not in pending status (current: ${currentStatus})`);
    }
}

export function isNegotiationError(error: any): error is NegotiationError {
    return error instanceof NegotiationError;
}

export function getHttpStatusForError(error: NegotiationError): number {
    if (error instanceof NegotiationLimitReachedError || error instanceof BidNotPendingError) {
        return 400;
    }
    return 500;
}
