/**
 * ConnectionBadge — VVIP G-05
 * Shows socket connection status in header.
 * Surfaces disconnects within 2s, triggers refresh on reconnect.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../contexts/SocketContext';

interface ConnectionBadgeProps {
    /** Callback when reconnection occurs (for triggering data refresh) */
    onReconnect?: () => void;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ onReconnect }) => {
    const { t } = useTranslation();
    const { isConnected, socket } = useSocket();
    const [showBadge, setShowBadge] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const wasDisconnected = useRef(false);

    useEffect(() => {
        let disconnectTimer: NodeJS.Timeout;

        if (!isConnected) {
            // Show badge after 2 seconds of disconnect
            disconnectTimer = setTimeout(() => {
                setShowBadge(true);
                setReconnecting(true);
                wasDisconnected.current = true;
            }, 2000);
        } else {
            setShowBadge(false);
            setReconnecting(false);

            // Trigger refresh callback on reconnect
            if (wasDisconnected.current) {
                wasDisconnected.current = false;
                onReconnect?.();
            }
        }

        return () => clearTimeout(disconnectTimer);
    }, [isConnected, onReconnect]);

    // Pulse animation when reconnecting
    useEffect(() => {
        if (reconnecting) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.5,
                        duration: 800,
                        useNativeDriver: true
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true
                    })
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [reconnecting]);

    if (!showBadge) return null;

    return (
        <Animated.View style={[styles.badge, { opacity: pulseAnim }]}>
            <MaterialCommunityIcons
                name={reconnecting ? "wifi-sync" : "wifi-off"}
                size={14}
                color="#FFF"
            />
            <Text style={styles.text}>
                {reconnecting
                    ? t('connection.reconnecting', 'Reconnecting...')
                    : t('connection.offline', 'Offline')}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 8
    },
    text: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4
    }
});

export default ConnectionBadge;
