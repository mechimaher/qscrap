/**
 * Document Service Errors
 */

export class DocumentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DocumentError';
    }
}

export class DocumentNotFoundError extends DocumentError {
    constructor(documentId: string) {
        super(`Document not found: ${documentId}`);
        this.name = 'DocumentNotFoundError';
    }
}

export class DocumentAccessDeniedError extends DocumentError {
    constructor(reason: string = 'Access denied') {
        super(reason);
        this.name = 'DocumentAccessDeniedError';
    }
}

export class DocumentGenerationError extends DocumentError {
    constructor(reason: string) {
        super(`Document generation failed: ${reason}`);
        this.name = 'DocumentGenerationError';
    }
}

export class PDFGenerationError extends DocumentError {
    constructor(reason: string) {
        super(`PDF generation failed: ${reason}`);
        this.name = 'PDFGenerationError';
    }
}
