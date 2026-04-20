import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface OfflineState {
    isOffline: boolean;
    isOnline: boolean;
    connectionType: string | null;
}

/**
 * Hook to detect and monitor offline/online state
 * Uses NetInfo to track network connectivity
 */
export const useOffline = (): OfflineState => {
    const [isOffline, setIsOffline] = useState(false);
    const [connectionType, setConnectionType] = useState<string | null>(null);

    useEffect(() => {
        // Subscribe to network state updates
        const unsubscribe = NetInfo.addEventListener(state => {
            const offline = !state.isConnected || !state.isInternetReachable;
            setIsOffline(offline);
            setConnectionType(state.type);
        });

        // Get initial state
        NetInfo.fetch().then(state => {
            const offline = !state.isConnected || !state.isInternetReachable;
            setIsOffline(offline);
            setConnectionType(state.type);
        });

        return () => unsubscribe();
    }, []);

    return {
        isOffline,
        isOnline: !isOffline,
        connectionType,
    };
};

export default useOffline;
