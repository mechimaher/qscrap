// Urgency Indicator Component - Real-time Viewer Count
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSocketContext } from '../hooks/useSocket';
import { FontSizes, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface UrgencyIndicatorProps {
    requestId: string;
}

export const UrgencyIndicator: React.FC<UrgencyIndicatorProps> = ({ requestId }) => {
    const [viewerCount, setViewerCount] = useState(0);
    const { socket } = useSocketContext();

    useEffect(() => {
        if (!socket) return;

        // Join tracking for this request
        socket.emit('track_request_view', { request_id: requestId });

        // Listen for viewer count updates
        socket.on('viewer_count_update', (data: { request_id: string; count: number }) => {
            if (data.request_id === requestId) {
                setViewerCount(data.count);
            }
        });

        return () => {
            socket.off('viewer_count_update');
            // Optionally emit untrack event
            socket.emit('untrack_request_view', { request_id: requestId });
        };
    }, [socket, requestId]);

    // Only show if more than 1 viewer (don't count self)
    if (viewerCount <= 1) return null;

    return (
        <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.container}
        >
            <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
            >
                <Text style={styles.icon}>👀</Text>
                <Text style={styles.text}>
                    {viewerCount} viewing now
                </Text>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: 'flex-start',
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        gap: 4,
        ...Shadows.sm,
    },
    icon: {
        fontSize: 14,
    },
    text: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default UrgencyIndicator;
