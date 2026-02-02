/**
 * Subscription Billing Job Module
 * Run daily to process renewals and send reminders
 */

import { Pool } from 'pg';
import { SubscriptionBillingJob } from '../services/subscription/billing.job';
import logger from '../utils/logger';

/**
 * Process subscription renewals
 * Charges saved payment methods for due subscriptions
 * Run at 6 AM Qatar time daily
 */
export async function processSubscriptionRenewals(pool: Pool): Promise<{ processed: number }> {
    logger.jobStart('processSubscriptionRenewals');

    try {
        const billingJob = new SubscriptionBillingJob(pool);
        await billingJob.processRenewals();

        logger.jobComplete('processSubscriptionRenewals', { status: 'complete' });
        return { processed: 0 };
    } catch (error) {
        logger.error('processSubscriptionRenewals failed', { error: (error as Error).message });
        throw error;
    }
}

/**
 * Send subscription renewal reminders
 * Sends reminders at 7, 3, and 1 days before expiry
 * Run at 9 AM Qatar time daily
 */
export async function sendRenewalReminders(pool: Pool): Promise<{ sent: number }> {
    logger.jobStart('sendRenewalReminders');

    try {
        const billingJob = new SubscriptionBillingJob(pool);
        await billingJob.sendRenewalReminders();

        logger.jobComplete('sendRenewalReminders', { status: 'complete' });
        return { sent: 0 };
    } catch (error) {
        logger.error('sendRenewalReminders failed', { error: (error as Error).message });
        throw error;
    }
}

/**
 * Process expired subscriptions
 * Suspends subscriptions 3+ days past due with failed payments
 * Run at 2 AM Qatar time daily
 */
export async function processExpiredSubscriptions(pool: Pool): Promise<{ suspended: number }> {
    logger.jobStart('processExpiredSubscriptions');

    try {
        const billingJob = new SubscriptionBillingJob(pool);
        await billingJob.processExpiredSubscriptions();

        logger.jobComplete('processExpiredSubscriptions', { status: 'complete' });
        return { suspended: 0 };
    } catch (error) {
        logger.error('processExpiredSubscriptions failed', { error: (error as Error).message });
        throw error;
    }
}
