// VVIP G-02: Wait State Reassurance Component
// Reduces customer anxiety while waiting for bids with calming messages and elapsed time

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../contexts/LanguageContext';
import { ViewerBadge } from './ViewerBadge';

interface WaitStateReassuranceProps {
    createdAt: string;
    viewerCount?: number;
    colors: {
        surface: string;
        text: string;
        textSecondary: string;
    };
}

// Rotating encouraging messages
const getReassuranceMessage = (elapsedMinutes: number, t: (key: string) => string): { emoji: string; message: string } => {
    if (elapsedMinutes < 5) {
        return { emoji: '🔍', message: t('waitState.searchingGarages') };
    } else if (elapsedMinutes < 15) {
        return { emoji: '🛠️', message: t('waitState.garagesReviewing') };
    } else if (elapsedMinutes < 30) {
        return { emoji: '📋', message: t('waitState.preparingQuotes') };
    } else if (elapsedMinutes < 60) {
        return { emoji: '⏳', message: t('waitState.stillSearching') };
    } else {
        return { emoji: '🔔', message: t('waitState.notifyWhenReady') };
    }
};

const formatElapsedTime = (createdAt: string, t: (key: string, params?: any) => string): string => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return t('waitState.elapsedDays', { days: diffDays, hours: diffHours % 24 });
    } else if (diffHours > 0) {
        return t('waitState.elapsedHours', { hours: diffHours, minutes: diffMinutes % 60 });
    } else if (diffMinutes > 0) {
        return t('waitState.elapsedMinutes', { minutes: diffMinutes });
    }
    return t('waitState.justNow');
};

export const WaitStateReassurance: React.FC<WaitStateReassuranceProps> = ({
    createdAt,
    viewerCount,
    colors,
}) => {
    const { t } = useTranslation();
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    const dotAnim = useRef(new Animated.Value(0)).current;
    const [elapsedTime, setElapsedTime] = useState('');
    const [reassurance, setReassurance] = useState({ emoji: '🔍', message: '' });

    // Pulse animation for the searching indicator
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.3,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Dot animation for "searching..."
    useEffect(() => {
        Animated.loop(
            Animated.timing(dotAnim, {
                toValue: 3,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: false,
            })
        ).start();
    }, []);

    // Update elapsed time every minute
    useEffect(() => {
        const updateTime = () => {
            setElapsedTime(formatElapsedTime(createdAt, t));
            const diffMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
            setReassurance(getReassuranceMessage(diffMinutes, t));
        };

        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, [createdAt, t]);

    const dots = dotAnim.interpolate({
        inputRange: [0, 1, 2, 3],
        outputRange: ['', '.', '..', '...'],
    });

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            {/* Animated searching indicator */}
            <Animated.View style={[styles.pulseContainer, { opacity: pulseAnim }]}>
                <LinearGradient
                    colors={['#8D1B3D', '#C9A227']}
                    style={styles.pulseCircle}
                >
                    <Text style={styles.pulseEmoji}>{reassurance.emoji}</Text>
                </LinearGradient>
            </Animated.View>

            {/* Main message */}
            <Text style={[styles.mainMessage, { color: colors.text }]}>
                {t('waitState.waitingForOffers')}
            </Text>

            {/* Reassurance message */}
            <Text style={[styles.reassuranceText, { color: colors.textSecondary }]}>
                {reassurance.message}
            </Text>

            {/* Viewer count if available */}
            {viewerCount !== undefined && viewerCount > 0 && (
                <View style={styles.viewerBadge}>
                    <ViewerBadge viewerCount={viewerCount} size="medium" />
                </View>
            )}

            {/* Elapsed time */}
            <View style={styles.elapsedContainer}>
                <Text style={[styles.elapsedLabel, { color: colors.textSecondary }]}>
                    {t('waitState.requestPosted')}
                </Text>
                <Text style={[styles.elapsedTime, { color: colors.text }]}>
                    {elapsedTime}
                </Text>
            </View>

            {/* Helpful tips */}
            <View style={[styles.tipContainer, { borderTopColor: colors.textSecondary + '20' }]}>
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    💡 {t('waitState.tip')}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    pulseContainer: {
        marginBottom: 16,
    },
    pulseCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseEmoji: {
        fontSize: 36,
    },
    mainMessage: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    reassuranceText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    viewerBadge: {
        backgroundColor: '#8D1B3D15',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 16,
    },
    viewerText: {
        color: '#8D1B3D',
        fontSize: 14,
        fontWeight: '600',
    },
    elapsedContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    elapsedLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    elapsedTime: {
        fontSize: 16,
        fontWeight: '600',
    },
    tipContainer: {
        borderTopWidth: 1,
        paddingTop: 16,
        width: '100%',
    },
    tipText: {
        fontSize: 13,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

export default WaitStateReassurance;
