/**
 * QScrap Automated Jobs System - Orchestrator
 * Imports individual job modules and provides master runner
 */

import pool from './db';
import logger from '../utils/logger';

// Import all jobs from modules
import {
    expireOldRequests,
    expireCounterOffers,
    checkSubscriptions,
    autoResolveDisputes,
    schedulePendingPayouts,
    autoProcessPayouts,
    autoConfirmPayouts,
    autoConfirmDeliveries,
    cleanupOldData
    // abandonStaleInspections removed 2026-02-01 - QC workflow cancelled
} from '../jobs';

// ============================================
// MASTER JOB RUNNER
// Runs all jobs in sequence
// ============================================
export async function runAllJobs(): Promise<void> {
    logger.jobStart('runAllJobs');
    const startTime = Date.now();

    try {
        await expireOldRequests(pool);
        await expireCounterOffers(pool);
        await checkSubscriptions(pool);
        await autoResolveDisputes(pool);
        await autoConfirmDeliveries(pool);
        await autoConfirmPayouts(pool);
        // abandonStaleInspections removed - QC workflow cancelled
        await schedulePendingPayouts(pool);
        await autoProcessPayouts(pool);
        await cleanupOldData(pool);

        const duration = Date.now() - startTime;
        logger.jobComplete('runAllJobs', { durationMs: duration });
    } catch (err) {
        logger.error('runAllJobs failed', { error: (err as Error).message });
    }
}

// Export for backwards compatibility
export default {
    runAllJobs,
    // Re-export with pool binding for direct calls
    expireOldRequests: () => expireOldRequests(pool),
    expireCounterOffers: () => expireCounterOffers(pool),
    checkSubscriptions: () => checkSubscriptions(pool),
    autoResolveDisputes: () => autoResolveDisputes(pool),
    autoConfirmDeliveries: () => autoConfirmDeliveries(pool),
    autoConfirmPayouts: () => autoConfirmPayouts(pool),
    // abandonStaleInspections removed - QC workflow cancelled
    schedulePendingPayouts: () => schedulePendingPayouts(pool),
    autoProcessPayouts: () => autoProcessPayouts(pool),
    cleanupOldData: () => cleanupOldData(pool)
};
