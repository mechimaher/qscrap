import { log, warn, error as logError } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

interface NetworkState {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    connectionType: string | null;
    isWifi: boolean;
    isCellular: boolean;
}

interface UseNetworkReturn extends NetworkState {
    refresh: () => Promise<void>;
}

/**
 * Hook to monitor network connectivity status.
 * Provides real-time updates on connection changes.
 * 
 * @example
 * const { isConnected, isInternetReachable, refresh } = useNetwork();
 * 
 * if (!isConnected) {
 *   return <OfflineScreen onRetry={refresh} />;
 * }
 */
export const useNetwork = (): UseNetworkReturn => {
    const [state, setState] = useState<NetworkState>({
        isConnected: true,
        isInternetReachable: true,
        connectionType: null,
        isWifi: false,
        isCellular: false,
    });

    const updateState = useCallback((netInfoState: NetInfoState) => {
        setState({
            isConnected: netInfoState.isConnected ?? true,
            isInternetReachable: netInfoState.isInternetReachable,
            connectionType: netInfoState.type,
            isWifi: netInfoState.type === 'wifi',
            isCellular: netInfoState.type === 'cellular',
        });
    }, []);

    const refresh = useCallback(async () => {
        try {
            const netInfoState = await NetInfo.fetch();
            updateState(netInfoState);
        } catch (error) {
            logError('Failed to fetch network state:', error);
        }
    }, [updateState]);

    useEffect(() => {
        // Get initial state
        refresh();

        // Subscribe to network changes
        const unsubscribe: NetInfoSubscription = NetInfo.addEventListener(updateState);

        return () => {
            unsubscribe();
        };
    }, [refresh, updateState]);

    return {
        ...state,
        refresh,
    };
};

export default useNetwork;
