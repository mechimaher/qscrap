// QScrap Driver App - Socket Context
// Provides real-time socket connection and event handling throughout the app

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
    initSocket,
    disconnectSocket,
    getSocket,
    onNewAssignment,
    onAssignmentAccepted,
    onAssignmentRejected,
    onNewMessage,
} from '../services/socket';
import { useAuth } from './AuthContext';
import { Assignment } from '../services/api';
import { stopAssignmentAlert } from '../services/SoundService';
import { error as logError } from '../utils/logger';

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
            logError('[SocketContext] Connection error:', error);
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
        // NOTE: Haptics, vibrations, sounds, and push notifications are
        // already handled in socket.ts inline handlers. These context
        // listeners only manage React UI state to avoid double-firing.

        // NEW ASSIGNMENT - Show popup alert for accept/reject
        onNewAssignment((data) => {
            setNewAssignmentAlert(data);
        });

        // ASSIGNMENT ACCEPTED - No UI state needed (socket.ts handles notification)
        onAssignmentAccepted((_data) => {
            // Refresh handled by screen-level focus listeners
        });

        // ASSIGNMENT REJECTED - No UI state needed (socket.ts handles notification)
        onAssignmentRejected((_data) => {
            // Refresh handled by screen-level focus listeners
        });

        // NEW MESSAGE - Increment unread badge
        onNewMessage((_data) => {
            setUnreadMessages((prev) => prev + 1);
        });
    };

    const dismissAssignmentAlert = useCallback(() => {
        setNewAssignmentAlert(null);
        stopAssignmentAlert(); // Stop the looping alert sound
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
