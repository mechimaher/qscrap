// VVIP G-03: App State Refresh Hook
// Automatically refreshes critical data when app resumes from background
// Prevents stale data display after switching apps

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseAppStateRefreshOptions {
    /**
     * Function to call when app becomes active (from background/inactive)
     */
    onRefresh: () => void | Promise<void>;

    /**
     * Minimum time in ms that app must be in background before triggering refresh
     * Default: 30000 (30 seconds)
     */
    minBackgroundTimeMs?: number;

    /**
     * Whether the hook is enabled
     * Default: true
     */
    enabled?: boolean;
}

/**
 * Hook that triggers a refresh callback when the app resumes from background
 * 
 * @example
 * ```tsx
 * useAppStateRefresh({
 *   onRefresh: () => fetchOrders(),
 *   minBackgroundTimeMs: 60000, // 1 minute
 * });
 * ```
 */
export function useAppStateRefresh({
    onRefresh,
    minBackgroundTimeMs = 30000,
    enabled = true,
}: UseAppStateRefreshOptions): void {
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const backgroundTimestamp = useRef<number | null>(null);
    const isRefreshing = useRef(false);

    const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
        // Track when app goes to background
        if (
            appState.current === 'active' &&
            (nextAppState === 'background' || nextAppState === 'inactive')
        ) {
            backgroundTimestamp.current = Date.now();
            console.log('[AppStateRefresh] App went to background');
        }

        // App became active from background
        if (
            appState.current.match(/inactive|background/) &&
            nextAppState === 'active'
        ) {
            const timeInBackground = backgroundTimestamp.current
                ? Date.now() - backgroundTimestamp.current
                : 0;

            console.log(`[AppStateRefresh] App resumed after ${timeInBackground}ms`);

            // Only refresh if app was in background long enough
            if (timeInBackground >= minBackgroundTimeMs && !isRefreshing.current) {
                isRefreshing.current = true;
                console.log('[AppStateRefresh] Triggering refresh...');

                try {
                    await onRefresh();
                } catch (error) {
                    console.error('[AppStateRefresh] Refresh failed:', error);
                } finally {
                    isRefreshing.current = false;
                }
            }

            backgroundTimestamp.current = null;
        }

        appState.current = nextAppState;
    }, [onRefresh, minBackgroundTimeMs]);

    useEffect(() => {
        if (!enabled) return;

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [enabled, handleAppStateChange]);
}

/**
 * Simplified hook that just returns whether app just resumed
 * Useful for triggering refetch in React Query or SWR
 */
export function useAppResumed(minBackgroundTimeMs = 30000): boolean {
    const isResumed = useRef(false);
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const backgroundTimestamp = useRef<number | null>(null);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (
                appState.current === 'active' &&
                (nextAppState === 'background' || nextAppState === 'inactive')
            ) {
                backgroundTimestamp.current = Date.now();
            }

            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                const timeInBackground = backgroundTimestamp.current
                    ? Date.now() - backgroundTimestamp.current
                    : 0;

                isResumed.current = timeInBackground >= minBackgroundTimeMs;
                backgroundTimestamp.current = null;
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [minBackgroundTimeMs]);

    return isResumed.current;
}

export default useAppStateRefresh;
