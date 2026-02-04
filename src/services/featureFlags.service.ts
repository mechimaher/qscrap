/**
 * Feature Flags Service — VVIP QA-SRE-S1
 * Lightweight feature flag system for canary rollouts.
 */

import logger from '../utils/logger';

export interface FeatureFlag {
    name: string;
    enabled: boolean;
    rolloutPercentage: number;  // 0-100
    enabledUserIds?: string[];  // Explicit allowlist
    disabledUserIds?: string[]; // Explicit blocklist
    createdAt: Date;
    updatedAt: Date;
}

// In-memory flag store (production would use Redis/DB)
const flags: Map<string, FeatureFlag> = new Map();

// Initialize default flags
function initDefaultFlags() {
    // G-01: 30-Second Undo Window
    flags.set('undo_grace_window', {
        name: 'undo_grace_window',
        enabled: true,
        rolloutPercentage: 100, // Full rollout after Sprint 1
        enabledUserIds: [],
        disabledUserIds: [],
        createdAt: new Date('2026-02-04'),
        updatedAt: new Date()
    });

    // G-04: Human Status Labels
    flags.set('human_status_labels', {
        name: 'human_status_labels',
        enabled: true,
        rolloutPercentage: 100,
        enabledUserIds: [],
        disabledUserIds: [],
        createdAt: new Date('2026-02-04'),
        updatedAt: new Date()
    });

    // G-05: Connection Badge
    flags.set('connection_badge', {
        name: 'connection_badge',
        enabled: true,
        rolloutPercentage: 100,
        enabledUserIds: [],
        disabledUserIds: [],
        createdAt: new Date('2026-02-04'),
        updatedAt: new Date()
    });

    logger.info('Feature flags initialized', { count: flags.size });
}

// Initialize on module load
initDefaultFlags();

/**
 * Check if a feature is enabled for a specific user
 */
export function isFeatureEnabled(flagName: string, userId?: string): boolean {
    const flag = flags.get(flagName);

    if (!flag || !flag.enabled) {
        return false;
    }

    // Check explicit blocklist
    if (userId && flag.disabledUserIds?.includes(userId)) {
        return false;
    }

    // Check explicit allowlist
    if (userId && flag.enabledUserIds?.includes(userId)) {
        return true;
    }

    // Percentage-based rollout using userId hash
    if (flag.rolloutPercentage < 100 && userId) {
        const hash = hashUserId(userId);
        return (hash % 100) < flag.rolloutPercentage;
    }

    return flag.rolloutPercentage === 100;
}

/**
 * Get feature flag configuration
 */
export function getFlag(flagName: string): FeatureFlag | undefined {
    return flags.get(flagName);
}

/**
 * Update feature flag (for admin use)
 */
export function updateFlag(flagName: string, updates: Partial<FeatureFlag>): boolean {
    const flag = flags.get(flagName);
    if (!flag) return false;

    Object.assign(flag, updates, { updatedAt: new Date() });
    flags.set(flagName, flag);

    logger.info('Feature flag updated', { flagName, updates });
    return true;
}

/**
 * Set rollout percentage for gradual rollout
 */
export function setRolloutPercentage(flagName: string, percentage: number): boolean {
    if (percentage < 0 || percentage > 100) return false;
    return updateFlag(flagName, { rolloutPercentage: percentage });
}

/**
 * Get all flags (for admin dashboard)
 */
export function getAllFlags(): FeatureFlag[] {
    return Array.from(flags.values());
}

/**
 * Simple hash function for consistent user bucketing
 */
function hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

export default {
    isFeatureEnabled,
    getFlag,
    updateFlag,
    setRolloutPercentage,
    getAllFlags
};
