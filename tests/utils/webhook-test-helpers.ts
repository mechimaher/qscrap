
import crypto from 'crypto';

/**
 * Generate a valid Stripe signature for testing webhooks
 * @param payload The raw JSON string payload
 * @param secret The webhook signing secret
 * @returns The structured Stripe-Signature header value
 */
export function generateStripeSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');
    return `t=${timestamp},v1=${signature}`;
}
