import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type AppStateCallback = (state: AppStateStatus) => void;

interface UseAppStateReturn {
    appState: AppStateStatus;
    isActive: boolean;
    isBackground: boolean;
    isInactive: boolean;
}

/**
 * Hook to monitor app state (active, background, inactive).
 * Useful for pausing/resuming operations based on app visibility.
 * 
 * @example
 * const { isActive, isBackground } = useAppState();
 * 
 * useEffect(() => {
 *   if (isActive) {
 *     refreshData();
 *   }
 * }, [isActive]);
 * 
 * // With callbacks
 * useAppStateWithCallbacks({
 *   onForeground: () => refreshData(),
 *   onBackground: () => saveState(),
 * });
 */
export const useAppState = (): UseAppStateReturn => {
    const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            setAppState(nextAppState);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    return {
        appState,
        isActive: appState === 'active',
        isBackground: appState === 'background',
        isInactive: appState === 'inactive',
    };
};

interface AppStateCallbacks {
    onForeground?: () => void;
    onBackground?: () => void;
    onInactive?: () => void;
}

/**
 * Hook with callbacks for app state changes.
 * Provides a cleaner API for handling state transitions.
 */
export const useAppStateWithCallbacks = ({
    onForeground,
    onBackground,
    onInactive,
}: AppStateCallbacks): AppStateStatus => {
    const appState = useRef<AppStateStatus>(AppState.currentState);

    const handleAppStateChange = useCallback(
        (nextAppState: AppStateStatus) => {
            const prevState = appState.current;

            if (prevState !== 'active' && nextAppState === 'active') {
                onForeground?.();
            } else if (nextAppState === 'background') {
                onBackground?.();
            } else if (nextAppState === 'inactive') {
                onInactive?.();
            }

            appState.current = nextAppState;
        },
        [onForeground, onBackground, onInactive]
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [handleAppStateChange]);

    return appState.current;
};

export default useAppState;
