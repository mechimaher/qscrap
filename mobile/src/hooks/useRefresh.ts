import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface UseRefreshOptions {
    onRefresh: () => Promise<void>;
    hapticFeedback?: boolean;
    minimumDuration?: number;
}

interface UseRefreshReturn {
    refreshing: boolean;
    onRefresh: () => Promise<void>;
}

/**
 * Hook for pull-to-refresh functionality with consistent UX.
 * Includes haptic feedback and minimum loading duration.
 * 
 * @example
 * const { refreshing, onRefresh } = useRefresh({
 *   onRefresh: async () => {
 *     await fetchData();
 *   }
 * });
 * 
 * return (
 *   <FlatList
 *     refreshControl={
 *       <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 *     }
 *     {...otherProps}
 *   />
 * );
 */
export const useRefresh = ({
    onRefresh: refreshCallback,
    hapticFeedback = true,
    minimumDuration = 500,
}: UseRefreshOptions): UseRefreshReturn => {
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        if (refreshing) return;

        setRefreshing(true);

        // Haptic feedback on refresh start
        if (hapticFeedback && Platform.OS !== 'web') {
            try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
                // Haptics not available
            }
        }

        const startTime = Date.now();

        try {
            await refreshCallback();
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            // Ensure minimum duration for better UX
            const elapsed = Date.now() - startTime;
            const remaining = minimumDuration - elapsed;

            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, remaining));
            }

            setRefreshing(false);

            // Success haptic feedback
            if (hapticFeedback && Platform.OS !== 'web') {
                try {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (e) {
                    // Haptics not available
                }
            }
        }
    }, [refreshing, refreshCallback, hapticFeedback, minimumDuration]);

    return {
        refreshing,
        onRefresh,
    };
};

export default useRefresh;
