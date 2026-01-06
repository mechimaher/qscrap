import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Hook to track app foreground/background state.
 * Useful for refreshing data when app comes to foreground.
 */
export const useAppState = () => {
    const appState = useRef(AppState.currentState);
    const [currentState, setCurrentState] = useState<AppStateStatus>(appState.current);
    const [isActive, setIsActive] = useState(appState.current === 'active');

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            appState.current = nextAppState;
            setCurrentState(nextAppState);
            setIsActive(nextAppState === 'active');
        });

        return () => subscription.remove();
    }, []);

    return {
        appState: currentState,
        isActive,
        isBackground: currentState === 'background',
        isInactive: currentState === 'inactive',
    };
};

/**
 * Hook that triggers a callback when app comes to foreground.
 * 
 * @param callback - Function to call when app becomes active
 * @param deps - Dependencies for the callback
 */
export const useOnForeground = (callback: () => void, deps: any[] = []) => {
    const { isActive } = useAppState();
    const prevIsActive = useRef(isActive);

    useEffect(() => {
        // Only trigger if transitioning from background to active
        if (isActive && !prevIsActive.current) {
            callback();
        }
        prevIsActive.current = isActive;
    }, [isActive, ...deps]);
};

/**
 * Hook that triggers a callback when app goes to background.
 * 
 * @param callback - Function to call when app goes to background
 * @param deps - Dependencies for the callback
 */
export const useOnBackground = (callback: () => void, deps: any[] = []) => {
    const { isActive } = useAppState();
    const prevIsActive = useRef(isActive);

    useEffect(() => {
        // Only trigger if transitioning from active to background
        if (!isActive && prevIsActive.current) {
            callback();
        }
        prevIsActive.current = isActive;
    }, [isActive, ...deps]);
};

export default useAppState;
