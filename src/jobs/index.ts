 * Re - exports all job functions for clean imports
    */

import pool from '../config/db';
import { runWarrantyClaimsSlaJob } from './warranty-claims-sla.job';

export { expireOldRequests, expireCounterOffers } from './expiration.jobs';
export { checkSubscriptions } from './subscription.jobs';
export { autoResolveDisputes } from './dispute.jobs';
export { schedulePendingPayouts, autoProcessPayouts, autoConfirmPayouts } from './payout.jobs';
export { autoConfirmDeliveries } from './order.jobs';
export { cleanupOldData } from './maintenance.jobs';
// abandonStaleInspections removed 2026-02-01 - QC workflow cancelled

// HR-02 & HR-03: Cancellation audit fixes (Jan 30, 2026)
export { runOrphanCleanup, runOrphanCleanupNow } from './orphan-cleanup.job';
export { runSLAAutoCancel, runSLAAutoCancelNow } from './sla-auto-cancel.job';

// Enterprise Infrastructure 10/10 (Feb 2, 2026)
export { processSubscriptionRenewals, sendRenewalReminders, processExpiredSubscriptions } from './billing.job';

// Warranty Claims (Feb 2026)
export { runWarrantyClaimsSlaJob, runWarrantyClaimsSlaJobNow } from './warranty-claims-sla.job';

// [MANDATE] Schedule SLA monitoring independently for high-reliability
setInterval(() => {
    console.log('[SLA-JOB] Running scheduled monitor...');
    runWarrantyClaimsSlaJob(pool).catch(err => console.error('[SLA-JOB] Failed:', err));
}, 6 * 60 * 60 * 1000); // Every 6 hours
