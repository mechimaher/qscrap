/**
 * SMS Service - Simple integration for critical notifications
 * 
 * Uses Twilio for SMS delivery (Qatar-compliant)
 * Only used for critical financial actions (refunds, payments)
 */

import logger from '../utils/logger';
import { withRetry } from '../utils/retry';

interface SMSOptions {
    to: string;
    message: string;
}

class SMSService {
    private accountSid: string;
    private authToken: string;
    private fromNumber: string;
    private enabled: boolean;

    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
        this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
        this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';
        this.enabled = !!(this.accountSid && this.authToken && this.fromNumber);

        if (!this.enabled) {
            logger.warn('Twilio not configured - SMS notifications disabled');
        }
    }

    /**
     * Send SMS notification
     * Gracefully fails if Twilio not configured
     */
    async send(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.enabled) {
            logger.info('SMS not configured, would send', { to: options.to, message: options.message });
            return { success: false, error: 'SMS not configured' };
        }

        try {
            // Type-safe dynamic import for Twilio
            const twilio = require('twilio') as typeof import('twilio');
            const client = twilio.default(this.accountSid, this.authToken);

            const message = await withRetry<any>(
                () => client.messages.create({
                    body: options.message,
                    from: this.fromNumber,
                    to: options.to
                }),
                { label: 'twilio.sendSms' }
            );

            logger.info('SMS sent', { to: options.to, messageId: message.sid });
            return { success: true, messageId: message.sid };
        } catch (err: any) {
            logger.error('SMS failed', { to: options.to, error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Send refund confirmation SMS
     */
    async sendRefundConfirmation(
        phoneNumber: string,
        orderNumber: string,
        refundAmount: number
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        // Format for Qatar numbers
        const formattedPhone = this.formatQatarPhone(phoneNumber);

        const message = `QScrap: Your refund of ${refundAmount.toFixed(2)} QAR for Order #${orderNumber} has been processed. It may take 5-10 business days to appear on your card.`;

        return this.send({ to: formattedPhone, message });
    }

    /**
     * Format phone number for Qatar
     */
    private formatQatarPhone(phone: string): string {
        // Remove spaces and dashes
        let cleaned = phone.replace(/[\s-]/g, '');

        // Add Qatar country code if not present
        if (!cleaned.startsWith('+')) {
            if (cleaned.startsWith('974')) {
                cleaned = `+${cleaned}`;
            } else {
                cleaned = `+974${cleaned}`;
            }
        }

        return cleaned;
    }
}

// Singleton instance
export const smsService = new SMSService();
