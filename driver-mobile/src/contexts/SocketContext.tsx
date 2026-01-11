// QScrap Driver App - Socket Context
// Provides real-time socket connection and event handling throughout the app

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Alert, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
    initSocket,
    disconnectSocket,
    getSocket,
    onNewAssignment,
    onAssignmentUpdated,
    onAssignmentCancelled,
    onNewMessage,
} from '../services/socket';
import { useAuth } from './AuthContext';
import { Assignment } from '../services/api';

interface SocketContextType {
    isConnected: boolean;
    newAssignmentAlert: Assignment | null;
    unreadMessages: number;
    dismissAssignmentAlert: () => void;
    reconnect: () => Promise<void>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, driver } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [newAssignmentAlert, setNewAssignmentAlert] = useState<Assignment | null>(null);
    const [unreadMessages, setUnreadMessages] = useState(0);

    // Connect/disconnect based on auth state
    useEffect(() => {
        if (isAuthenticated && driver) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [isAuthenticated, driver]);

    const connect = async () => {
        try {
            const socket = await initSocket();
            if (socket) {
                // If already connected, sync state immediately
                if (socket.connected) {
                    setIsConnected(true);
                }

                socket.on('connect', () => setIsConnected(true));
                socket.on('disconnect', () => setIsConnected(false));

                setupEventListeners();
            }
        } catch (error) {
            console.error('[SocketContext] Connection error:', error);
        }
    };

    const disconnect = () => {
        disconnectSocket();
        setIsConnected(false);
    };

    const reconnect = async () => {
        disconnect();
        await connect();
    };

    const setupEventListeners = () => {
        // NEW ASSIGNMENT - Vibrate and show alert
        onNewAssignment((data) => {
            console.log('[SocketContext] New assignment:', data);

            // Strong haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate([0, 250, 100, 250]); // Pattern vibration

            // Set alert for display
            setNewAssignmentAlert(data);
        });

        // ASSIGNMENT UPDATED
        onAssignmentUpdated((data) => {
            console.log('[SocketContext] Assignment updated:', data);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        });

        // ASSIGNMENT CANCELLED
        onAssignmentCancelled((data) => {
            console.log('[SocketContext] Assignment cancelled:', data);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            Alert.alert(
                '⚠️ Assignment Cancelled',
                `Order #${data.order_number} has been cancelled.\n\nReason: ${data.reason || 'No reason provided'}`,
                [{ text: 'OK' }]
            );
        });

        // NEW MESSAGE
        onNewMessage((data) => {
            console.log('[SocketContext] New message:', data);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setUnreadMessages((prev) => prev + 1);
        });
    };

    const dismissAssignmentAlert = useCallback(() => {
        setNewAssignmentAlert(null);
    }, []);

    return (
        <SocketContext.Provider
            value={{
                isConnected,
                newAssignmentAlert,
                unreadMessages,
                dismissAssignmentAlert,
                reconnect,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}
