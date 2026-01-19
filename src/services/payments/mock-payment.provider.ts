// QScrap Mock Payment Provider
// High-quality mock implementation with realistic behavior
// Production-grade validation and security standards

import crypto from 'crypto';
import {
    PaymentProvider,
    PaymentRequest,
    PaymentResponse,
    RefundRequest,
    RefundResponse,
    TransactionStatus,
    CardBrand,
    CardValidationResult
} from './payment.interface';

// ============================================================================
// TEST CARD NUMBERS (Industry standard test cards)
// ============================================================================
export const TEST_CARDS = {
    SUCCESS: '4242424242424242',           // Visa - Success
    DECLINED: '4000000000000002',          // Visa - Generic decline
    INSUFFICIENT_FUNDS: '4000000000000341',// Visa - Insufficient funds
    CARD_EXPIRED: '4000000000000069',      // Visa - Expired card
    CARD_INVALID: '4000000000000127',      // Visa - Invalid CVC
    REQUIRES_3DS: '4000002500003155',      // Visa - 3D Secure required
    MASTERCARD_SUCCESS: '5555555555554444',// Mastercard - Success
    AMEX_SUCCESS: '378282246310005',       // Amex - Success
    DISCOVER_SUCCESS: '6011111111111117',  // Discover - Success
} as const;

// ============================================================================
// MOCK PAYMENT PROVIDER CLASS
// ============================================================================

export class MockPaymentProvider implements PaymentProvider {

    /**
     * Process a payment with realistic simulation
     */
    async processPayment(data: PaymentRequest): Promise<PaymentResponse> {
        const startTime = Date.now();

        try {
            // 1. Validate card details
            const validation = this.validateCardDetails(data.paymentMethod);
            if (!validation.isValid) {
                return this.createFailureResponse(
                    'invalid_card',
                    validation.errors[0] || 'Card validation failed'
                );
            }

            // 2. Simulate realistic network delay (300-800ms)
            await this.simulateProcessingDelay();

            // 3. Determine scenario based on card number
            const scenario = this.getTestScenario(data.paymentMethod.cardNumber!);

            // 4. Execute scenario
            const response = await this.executeScenario(scenario, data);

            const processingTime = Date.now() - startTime;
            console.log(`[MockPayment] Processed in ${processingTime}ms - Status: ${response.status}`);

            return response;

        } catch (error: any) {
            console.error('[MockPayment] Processing error:', error);
            return this.createFailureResponse(
                'processing_error',
                error.message || 'Payment processing failed'
            );
        }
    }

    /**
     * Process a refund transaction
     */
    async refundPayment(request: RefundRequest): Promise<RefundResponse> {
        // Simulate delay
        await this.simulateProcessingDelay(200, 400);

        // Mock refund always succeeds
        return {
            success: true,
            refundId: `ref_${crypto.randomUUID().substring(0, 8)}`,
            amount: request.amount || 0,
            message: 'Refund processed successfully'
        };
    }

    /**
     * Verify transaction status (mock always returns cached status)
     */
    async verifyTransaction(transactionId: string): Promise<TransactionStatus> {
        // In mock, we don't have external provider, so return placeholder
        return {
            transactionId,
            status: 'success',
            amount: 0,
            refundedAmount: 0,
            createdAt: new Date()
        };
    }

    /**
     * Get provider name
     */
    getProviderName(): string {
        return 'mock';
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    /**
     * Validate card details using Luhn algorithm and format checks
     */
    private validateCardDetails(method: PaymentRequest['paymentMethod']): CardValidationResult {
        const errors: string[] = [];

        // Check card number
        if (!method.cardNumber) {
            errors.push('Card number is required');
        } else {
            const cleaned = method.cardNumber.replace(/\s/g, '');

            // Length check
            if (cleaned.length < 13 || cleaned.length > 19) {
                errors.push('Card number must be 13-19 digits');
            }

            // Luhn algorithm check
            if (!this.validateLuhn(cleaned)) {
                errors.push('Invalid card number (failed Luhn check)');
            }
        }

        // Check expiry
        if (!method.cardExpiry) {
            errors.push('Card expiry is required');
        } else {
            const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
            if (!expiryRegex.test(method.cardExpiry)) {
                errors.push('Card expiry must be in MM/YY format');
            } else {
                const [month, year] = method.cardExpiry.split('/').map(Number);
                const expiry = new Date(2000 + year, month - 1); // Last day would be better but this is simple
                if (expiry < new Date()) {
                    errors.push('Card has expired');
                }
            }
        }

        // Check CVV
        if (!method.cardCVV) {
            errors.push('CVV is required');
        } else {
            const cvvRegex = /^[0-9]{3,4}$/;
            if (!cvvRegex.test(method.cardCVV)) {
                errors.push('CVV must be 3-4 digits');
            }
        }

        // Check cardholder name
        if (!method.cardholderName) {
            errors.push('Cardholder name is required');
        } else if (method.cardholderName.length < 2 || method.cardholderName.length > 50) {
            errors.push('Cardholder name must be 2-50 characters');
        }

        const brand = method.cardNumber ? this.detectCardBrand(method.cardNumber) : undefined;

        return {
            isValid: errors.length === 0,
            errors,
            brand
        };
    }

    /**
     * Luhn algorithm for card number validation
     */
    private validateLuhn(cardNumber: string): boolean {
        const digits = cardNumber.replace(/\D/g, '').split('').map(Number);

        if (digits.length === 0) return false;

        let sum = 0;
        let isEven = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = digits[i];

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    /**
     * Detect card brand from number
     */
    private detectCardBrand(cardNumber: string): CardBrand {
        const cleaned = cardNumber.replace(/\s/g, '');

        if (/^4/.test(cleaned)) return 'visa';
        if (/^5[1-5]/.test(cleaned)) return 'mastercard';
        if (/^3[47]/.test(cleaned)) return 'amex';
        if (/^6(?:011|5)/.test(cleaned)) return 'discover';

        return 'unknown';
    }

    /**
     * Determine test scenario based on card number
     */
    private getTestScenario(cardNumber: string): string {
        const cleaned = cardNumber.replace(/\s/g, '');

        // Match against test card numbers
        if (cleaned === TEST_CARDS.SUCCESS || cleaned === TEST_CARDS.MASTERCARD_SUCCESS ||
            cleaned === TEST_CARDS.AMEX_SUCCESS || cleaned === TEST_CARDS.DISCOVER_SUCCESS) {
            return 'success';
        }
        if (cleaned === TEST_CARDS.DECLINED) return 'declined';
        if (cleaned === TEST_CARDS.INSUFFICIENT_FUNDS) return 'insufficient_funds';
        if (cleaned === TEST_CARDS.CARD_EXPIRED) return 'card_expired';
        if (cleaned === TEST_CARDS.CARD_INVALID) return 'invalid_cvc';
        if (cleaned === TEST_CARDS.REQUIRES_3DS) return '3d_secure';

        // Default to success for any valid card
        return 'success';
    }

    /**
     * Execute payment scenario
     */
    private async executeScenario(scenario: string, data: PaymentRequest): Promise<PaymentResponse> {
        const transactionId = crypto.randomUUID();
        const providerTxId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        switch (scenario) {
            case 'success':
                return {
                    success: true,
                    transactionId,
                    status: 'success',
                    providerTransactionId: providerTxId,
                    message: 'Payment processed successfully',
                    metadata: {
                        cardBrand: this.detectCardBrand(data.paymentMethod.cardNumber!),
                        cardLast4: data.paymentMethod.cardNumber!.slice(-4)
                    }
                };

            case 'declined':
                return this.createFailureResponse('card_declined', 'Your card was declined');

            case 'insufficient_funds':
                return this.createFailureResponse('insufficient_funds', 'Insufficient funds on card');

            case 'card_expired':
                return this.createFailureResponse('card_expired', 'Your card has expired');

            case 'invalid_cvc':
                return this.createFailureResponse('invalid_cvc', 'Invalid CVV/CVC code');

            case '3d_secure':
                // Special case: requires action
                return {
                    success: false,
                    transactionId,
                    status: 'pending',
                    message: '3D Secure authentication required',
                    errorCode: 'requires_3ds',
                    metadata: {
                        authUrl: 'https://mock-3ds.example.com/auth'
                    }
                };

            default:
                return {
                    success: true,
                    transactionId,
                    status: 'success',
                    providerTransactionId: providerTxId,
                    message: 'Payment processed successfully'
                };
        }
    }

    /**
     * Create standardized failure response
     */
    private createFailureResponse(errorCode: string, message: string): PaymentResponse {
        return {
            success: false,
            transactionId: crypto.randomUUID(),
            status: 'failed',
            errorCode,
            message
        };
    }

    /**
     * Simulate realistic processing delay
     */
    private async simulateProcessingDelay(minMs: number = 300, maxMs: number = 800): Promise<void> {
        const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}
