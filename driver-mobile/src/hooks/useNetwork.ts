import { useState, useEffect, useCallback } from 'react';
// @ts-ignore - NetInfo types are bundled with the package
import NetInfo from '@react-native-community/netinfo';

// Define types locally since package types may not resolve
interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
}

interface NetworkState {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string | null;
    isWifi: boolean;
    isCellular: boolean;
}

/**
 * Hook to monitor network connectivity status.
 * Returns current connection state and provides retry functionality.
 */
export const useNetwork = () => {
    const [state, setState] = useState<NetworkState>({
        isConnected: true,
        isInternetReachable: null,
        type: null,
        isWifi: false,
        isCellular: false,
    });

    useEffect(() => {
        // Get initial state
        NetInfo.fetch().then((netState: NetInfoState) => {
            setState({
                isConnected: netState.isConnected ?? true,
                isInternetReachable: netState.isInternetReachable,
                type: netState.type,
                isWifi: netState.type === 'wifi',
                isCellular: netState.type === 'cellular',
            });
        });

        // Subscribe to changes
        const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
            setState({
                isConnected: netState.isConnected ?? true,
                isInternetReachable: netState.isInternetReachable,
                type: netState.type,
                isWifi: netState.type === 'wifi',
                isCellular: netState.type === 'cellular',
            });
        });

        return () => unsubscribe();
    }, []);

    const refresh = useCallback(async () => {
        const netState = await NetInfo.fetch();
        setState({
            isConnected: netState.isConnected ?? true,
            isInternetReachable: netState.isInternetReachable,
            type: netState.type,
            isWifi: netState.type === 'wifi',
            isCellular: netState.type === 'cellular',
        });
        return netState.isConnected ?? true;
    }, []);

    return {
        ...state,
        refresh,
    };
};

export default useNetwork;
