/**
 * UndoToast — VVIP G-01
 * 30-second undo toast component with countdown.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../contexts/LanguageContext';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';

interface UndoToastProps {
    orderId: string;
    orderNumber: string;
    undoDeadline: string;
    onUndoSuccess: () => void;
    onExpire: () => void;
    onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
    orderId,
    orderNumber,
    undoDeadline,
    onUndoSuccess,
    onExpire,
    onDismiss
}) => {
    const { t } = useTranslation();
    const [remaining, setRemaining] = useState(30);
    const [isUndoing, setIsUndoing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const slideAnim = useRef(new Animated.Value(100)).current;
    const progressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Slide in
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();

        // Countdown timer
        const deadline = new Date(undoDeadline).getTime();
        const interval = setInterval(() => {
            const now = Date.now();
            const diff = Math.ceil((deadline - now) / 1000);

            if (diff <= 0) {
                clearInterval(interval);
                setRemaining(0);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                // Slide out then expire
                Animated.timing(slideAnim, {
                    toValue: 100,
                    duration: 300,
                    useNativeDriver: true
                }).start(() => onExpire());
            } else {
                setRemaining(diff);
                progressAnim.setValue(diff / 30);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [undoDeadline]);

    const handleUndo = async () => {
        if (isUndoing || remaining <= 0) return;

        setIsUndoing(true);
        setError(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await api.request(`/api/orders/${orderId}/undo`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'User initiated undo' })
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Slide out then success
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true
            }).start(() => onUndoSuccess());

        } catch (err: any) {
            setIsUndoing(false);
            const message = err.response?.data?.error || 'Undo failed';
            setError(message);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%']
    });

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] }
            ]}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={`${t('order.created')} ${orderNumber}. ${remaining} seconds to undo.`}
            accessibilityLiveRegion="assertive"
        >
            {/* Progress bar */}
            <Animated.View
                style={[styles.progressBar, { width: progressWidth }]}
                accessibilityElementsHidden={true}
            />

            <View style={styles.content}>
                <View style={styles.textContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#22C55E" />
                    <View style={styles.textContent}>
                        <Text style={styles.title}>{t('order.created')}</Text>
                        <Text style={styles.subtitle}>#{orderNumber}</Text>
                    </View>
                </View>

                <View style={styles.actions}>
                    <View
                        style={styles.countdown}
                        accessibilityLabel={`${remaining} seconds remaining`}
                    >
                        <Text style={styles.countdownText}>{remaining}s</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.undoButton, isUndoing && styles.undoButtonDisabled]}
                        onPress={handleUndo}
                        disabled={isUndoing || remaining <= 0}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.undo')}
                        accessibilityHint="Cancels the order you just created"
                        accessibilityState={{ disabled: isUndoing || remaining <= 0 }}
                    >
                        <MaterialCommunityIcons
                            name="undo"
                            size={16}
                            color="#FFF"
                            style={styles.undoIcon}
                        />
                        <Text style={styles.undoText}>
                            {isUndoing ? t('common.loading') : t('common.undo')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <Text
                    style={styles.errorText}
                    accessibilityRole="alert"
                >{error}</Text>
            )}
        </Animated.View>
    );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
        backgroundColor: '#1F2937',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    progressBar: {
        height: 4,
        backgroundColor: '#22C55E'
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16
    },
    textContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    textContent: {
        marginLeft: 12
    },
    title: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600'
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 2
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    countdown: {
        backgroundColor: '#374151',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 12
    },
    countdownText: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums']
    },
    undoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8
    },
    undoButtonDisabled: {
        backgroundColor: '#6B7280'
    },
    undoIcon: {
        marginRight: 4
    },
    undoText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700'
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        textAlign: 'center',
        paddingBottom: 12
    }
});

export default UndoToast;
