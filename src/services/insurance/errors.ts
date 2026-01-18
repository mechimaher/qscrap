/**
 * Insurance Service Errors
 */

export class InsuranceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InsuranceError';
    }
}

export class ClaimNotFoundError extends InsuranceError {
    constructor(claimId: string) {
        super(`Claim not found: ${claimId}`);
        this.name = 'ClaimNotFoundError';
    }
}

export class MOIReportNotFoundError extends InsuranceError {
    constructor(claimId: string) {
        super(`MOI report not found for claim: ${claimId}`);
        this.name = 'MOIReportNotFoundError';
    }
}

export class InvalidClaimStatusError extends InsuranceError {
    constructor(status: string) {
        super(`Invalid claim status: ${status}`);
        this.name = 'InvalidClaimStatusError';
    }
}
