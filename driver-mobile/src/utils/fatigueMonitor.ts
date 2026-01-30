// QScrap Driver App - Driver Fatigue Monitoring
// P2 Enhancement: Monitors driver shift duration and provides fatigue alerts
// Safety feature to protect drivers and customers

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

// Constants for fatigue thresholds (based on Qatar labor law and safety best practices)
const SHIFT_WARNING_HOURS = 8;      // Warning at 8 hours
const SHIFT_CRITICAL_HOURS = 10;    // Critical alert at 10 hours
const SHIFT_MAX_HOURS = 12;         // Strongly recommend break at 12 hours
const REST_PERIOD_HOURS = 8;        // Required rest period between shifts
const STORAGE_KEY = 'qscrap_driver_shift_data';

interface ShiftData {
    shiftStartTime: string | null;
    lastBreakTime: string | null;
    totalActiveMinutes: number;
    alertsShown: {
        warning: boolean;
        critical: boolean;
        max: boolean;
    };
}

interface FatigueStatus {
    level: 'fresh' | 'normal' | 'tired' | 'fatigued' | 'critical';
    hoursWorked: number;
    message: string;
    shouldShowAlert: boolean;
    alertType?: 'warning' | 'critical' | 'max';
}

// Default state
const defaultShiftData: ShiftData = {
    shiftStartTime: null,
    lastBreakTime: null,
    totalActiveMinutes: 0,
    alertsShown: {
        warning: false,
        critical: false,
        max: false,
    },
};

let shiftData: ShiftData = { ...defaultShiftData };

/**
 * Load shift data from storage
 */
export async function loadShiftData(): Promise<ShiftData> {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);

            // Check if the shift data is from a previous day (reset if needed)
            if (parsed.shiftStartTime) {
                const shiftStart = new Date(parsed.shiftStartTime);
                const now = new Date();
                const hoursSinceStart = (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

                // If more than 24 hours since shift start, reset
                if (hoursSinceStart > 24) {
                    console.log('[Fatigue] Shift data stale (>24h), resetting');
                    await saveShiftData(defaultShiftData);
                    return defaultShiftData;
                }
            }

            shiftData = parsed;
            return shiftData;
        }
    } catch (err) {
        console.error('[Fatigue] Failed to load shift data:', err);
    }
    return defaultShiftData;
}

/**
 * Save shift data to storage
 */
async function saveShiftData(data: ShiftData): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        shiftData = data;
    } catch (err) {
        console.error('[Fatigue] Failed to save shift data:', err);
    }
}

/**
 * Start a new shift when driver goes online
 */
export async function startShift(): Promise<void> {
    const now = new Date();

    // Check if there's an existing shift that should be continued
    if (shiftData.shiftStartTime) {
        const shiftStart = new Date(shiftData.shiftStartTime);
        const hoursSinceStart = (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

        // If less than rest period since last active, continue the shift
        if (hoursSinceStart < REST_PERIOD_HOURS) {
            console.log('[Fatigue] Continuing existing shift');
            return;
        }
    }

    // Start new shift
    await saveShiftData({
        shiftStartTime: now.toISOString(),
        lastBreakTime: null,
        totalActiveMinutes: 0,
        alertsShown: { warning: false, critical: false, max: false },
    });

    console.log('[Fatigue] New shift started at', now.toISOString());
}

/**
 * End the shift when driver goes offline
 */
export async function endShift(): Promise<void> {
    if (!shiftData.shiftStartTime) return;

    const now = new Date();
    const shiftStart = new Date(shiftData.shiftStartTime);
    const activeMinutes = Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60));

    await saveShiftData({
        ...shiftData,
        lastBreakTime: now.toISOString(),
        totalActiveMinutes: shiftData.totalActiveMinutes + activeMinutes,
    });

    console.log('[Fatigue] Shift paused. Total active:', shiftData.totalActiveMinutes, 'minutes');
}

/**
 * Get current fatigue status
 */
export function getFatigueStatus(): FatigueStatus {
    if (!shiftData.shiftStartTime) {
        return {
            level: 'fresh',
            hoursWorked: 0,
            message: 'Ready to drive',
            shouldShowAlert: false,
        };
    }

    const now = new Date();
    const shiftStart = new Date(shiftData.shiftStartTime);
    const hoursWorked = (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

    // Determine fatigue level
    if (hoursWorked >= SHIFT_MAX_HOURS) {
        return {
            level: 'critical',
            hoursWorked,
            message: `You've been driving for ${Math.floor(hoursWorked)} hours. Please take a break for your safety.`,
            shouldShowAlert: !shiftData.alertsShown.max,
            alertType: 'max',
        };
    }

    if (hoursWorked >= SHIFT_CRITICAL_HOURS) {
        return {
            level: 'fatigued',
            hoursWorked,
            message: `${Math.floor(hoursWorked)} hours on shift. Consider taking a break soon.`,
            shouldShowAlert: !shiftData.alertsShown.critical,
            alertType: 'critical',
        };
    }

    if (hoursWorked >= SHIFT_WARNING_HOURS) {
        return {
            level: 'tired',
            hoursWorked,
            message: `${Math.floor(hoursWorked)} hours active. Stay alert!`,
            shouldShowAlert: !shiftData.alertsShown.warning,
            alertType: 'warning',
        };
    }

    if (hoursWorked >= 4) {
        return {
            level: 'normal',
            hoursWorked,
            message: `${Math.floor(hoursWorked)} hours on shift`,
            shouldShowAlert: false,
        };
    }

    return {
        level: 'fresh',
        hoursWorked,
        message: 'Ready and alert',
        shouldShowAlert: false,
    };
}

/**
 * Show fatigue alert if needed
 */
export async function checkAndShowFatigueAlert(): Promise<void> {
    const status = getFatigueStatus();

    if (!status.shouldShowAlert || !status.alertType) return;

    // Mark alert as shown
    await saveShiftData({
        ...shiftData,
        alertsShown: {
            ...shiftData.alertsShown,
            [status.alertType]: true,
        },
    });

    // Haptic feedback based on severity
    if (status.level === 'critical') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (status.level === 'fatigued') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Show appropriate alert
    const title = status.level === 'critical'
        ? '⚠️ Fatigue Alert'
        : status.level === 'fatigued'
            ? '😴 Rest Recommended'
            : '🕐 Shift Update';

    Alert.alert(
        title,
        status.message,
        [
            { text: 'Take a Break', onPress: () => endShift(), style: 'default' },
            { text: 'Continue', style: 'cancel' },
        ]
    );
}

/**
 * Get color for fatigue indicator
 */
export function getFatigueColor(level: FatigueStatus['level']): string {
    switch (level) {
        case 'fresh': return '#22c55e';      // Green
        case 'normal': return '#84cc16';     // Lime
        case 'tired': return '#eab308';      // Yellow
        case 'fatigued': return '#f97316';   // Orange
        case 'critical': return '#ef4444';   // Red
        default: return '#94a3b8';           // Gray
    }
}

/**
 * Reset shift data (for testing or after long rest)
 */
export async function resetShiftData(): Promise<void> {
    await saveShiftData(defaultShiftData);
    console.log('[Fatigue] Shift data reset');
}

export default {
    loadShiftData,
    startShift,
    endShift,
    getFatigueStatus,
    checkAndShowFatigueAlert,
    getFatigueColor,
    resetShiftData,
};
