/**
 * Request Service Errors
 */

export class RequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestError';
    }
}

export class RequestNotFoundError extends RequestError {
    constructor(requestId: string) {
        super(`Request not found: ${requestId}`);
        this.name = 'RequestNotFoundError';
    }
}

export class RequestAccessDeniedError extends RequestError {
    constructor() {
        super('Access denied to this request');
        this.name = 'RequestAccessDeniedError';
    }
}

export class RequestNotCancellableError extends RequestError {
    constructor(status: string) {
        super(`Cannot cancel request with status: ${status}`);
        this.name = 'RequestNotCancellableError';
    }
}

export class RequestHasOrdersError extends RequestError {
    constructor(requestId: string) {
        super(`Cannot delete request ${requestId} - orders exist`);
        this.name = 'RequestHasOrdersError';
    }
}
