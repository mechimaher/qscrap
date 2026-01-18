/**
 * Document HTML Template Generators
 * NOTE: These are kept as-is from the original controller for now
 * Can be further refactored/extracted later if needed
 */

import { DocumentData } from '../services/documents/types';

export function generateBilingualCustomerInvoiceHTML(
    data: DocumentData,
    qrCode: string,
    logoBase64: string
): string {
    // TODO: Extract this from the original controller
    // For now, this is a placeholder that would contain the full HTML template
    return `<!DOCTYPE html><html><body>Customer Invoice Placeholder - Extract from original controller</body></html>`;
}

export function generateGaragePayoutStatementHTML(
    data: DocumentData,
    qrCode: string,
    logoBase64: string
): string {
    // TODO: Extract this from the original controller
    // For now, this is a placeholder that would contain the full HTML template
    return `<!DOCTYPE html><html><body>Garage Statement Placeholder - Extract from original controller</body></html>`;
}
