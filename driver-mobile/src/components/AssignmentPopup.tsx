// QScrap Driver App - Assignment Popup Component
// Premium accept/reject popup with 30-second countdown timer
// VVIP cutting-edge feature inspired by Uber/Careem

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Easing,
    Vibration,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playAssignmentAlert } from '../services/SoundService';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../i18n';
import { Colors } from '../constants/theme';
import { Assignment } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COUNTDOWN_SECONDS = 30;

interface AssignmentPopupProps {
    visible: boolean;
    assignment: Assignment | null;
    onAccept: () => void;
    onReject: () => void;
    onTimeout: () => void;
}

export default function AssignmentPopup({
    visible,
    assignment,
    onAccept,
    onReject,
    onTimeout,
}: AssignmentPopupProps) {
    const { colors } = useTheme();
    const { t } = useI18n();
    // Sound is managed by centralized SoundService
    const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
    const progressAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    // Stable ref for onTimeout to prevent countdown timer re-creation
    const onTimeoutRef = useRef(onTimeout);
    onTimeoutRef.current = onTimeout;

    // Reset and start countdown when popup becomes visible
    useEffect(() => {
        if (visible && assignment) {
            setTimeLeft(COUNTDOWN_SECONDS);
            progressAnim.setValue(1);

            // Entry animation
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // Progress bar animation
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: COUNTDOWN_SECONDS * 1000,
                easing: Easing.linear,
                useNativeDriver: false,
            }).start();

            // Pulse animation for urgency
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Vibration pattern + alert sound for notification
            Vibration.vibrate([0, 500, 200, 500]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Play alert sound via centralized SoundService
            playAssignmentAlert();
        } else {
            scaleAnim.setValue(0.8);
        }
    }, [visible, assignment]);

    // Countdown timer — uses ref for onTimeout to keep deps stable
    useEffect(() => {
        if (!visible || !assignment) return;

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onTimeoutRef.current();
                    return 0;
                }
                // Haptic feedback for last 10 seconds
                if (prev <= 10) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [visible, assignment]);

    const handleAccept = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.cancel();
        onAccept();
    };

    const handleReject = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Vibration.cancel();
        onReject();
    };

    if (!assignment) return null;

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const urgencyColor = timeLeft <= 10 ? Colors.danger : timeLeft <= 20 ? Colors.warning : Colors.primary;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.popup,
                        {
                            backgroundColor: colors.surface,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* Countdown Ring */}
                    <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
                        <View style={[styles.timerRing, { borderColor: urgencyColor }]}>
                            <Text style={[styles.timerText, { color: urgencyColor }]}>
                                {timeLeft}
                            </Text>
                            <Text style={[styles.timerLabel, { color: colors.textMuted }]}>
                                {t('seconds')}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Progress Bar */}
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressWidth,
                                    backgroundColor: urgencyColor,
                                },
                            ]}
                        />
                    </View>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.text }]}>
                        <Ionicons name="car-sport" size={22} color={Colors.primary} /> {t('new_assignment')}
                    </Text>

                    {/* Order Info Card */}
                    <View style={[styles.orderCard, { backgroundColor: colors.background }]}>
                        <Text style={[styles.orderNumber, { color: Colors.primary }]}>
                            Order #{assignment.order_number}
                        </Text>
                        <Text style={[styles.partDescription, { color: colors.text }]} numberOfLines={2}>
                            {assignment.part_description}
                        </Text>

                        {/* Vehicle Info */}
                        {(assignment.car_make || assignment.car_model) && (
                            <View style={styles.vehicleRow}>
                                <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
                                <Text style={[styles.vehicleText, { color: colors.textSecondary }]}>
                                    {[assignment.car_make, assignment.car_model].filter(Boolean).join(' ')}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Locations */}
                    <View style={styles.locationsContainer}>
                        {/* Pickup */}
                        <View style={styles.locationItem}>
                            <View style={[styles.locationDot, { backgroundColor: Colors.warning }]}>
                                <Ionicons name="cube" size={18} color="#fff" />
                            </View>
                            <View style={styles.locationInfo}>
                                <Text style={[styles.locationLabel, { color: colors.textMuted }]}>
                                    {t('pickup_from').toUpperCase()}
                                </Text>
                                <Text style={[styles.locationName, { color: colors.text }]} numberOfLines={1}>
                                    {assignment.garage_name}
                                </Text>
                                <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {assignment.pickup_address}
                                </Text>
                            </View>
                        </View>

                        {/* Arrow */}
                        <View style={styles.arrowContainer}>
                            <Ionicons name="arrow-down" size={16} color={colors.textMuted} />
                        </View>

                        {/* Delivery */}
                        <View style={styles.locationItem}>
                            <View style={[styles.locationDot, { backgroundColor: Colors.success }]}>
                                <Ionicons name="home" size={18} color="#fff" />
                            </View>
                            <View style={styles.locationInfo}>
                                <Text style={[styles.locationLabel, { color: colors.textMuted }]}>
                                    {t('deliver_to').toUpperCase()}
                                </Text>
                                <Text style={[styles.locationName, { color: colors.text }]} numberOfLines={1}>
                                    {assignment.customer_name}
                                </Text>
                                <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {assignment.delivery_address}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsContainer}>
                        {/* Reject Button */}
                        <TouchableOpacity
                            style={[styles.rejectButton, { backgroundColor: Colors.danger + '20' }]}
                            onPress={handleReject}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.rejectButtonText, { color: Colors.danger }]}>
                                <Ionicons name="close" size={16} color={Colors.danger} /> {t('reject')}
                            </Text>
                        </TouchableOpacity>

                        {/* Accept Button */}
                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={handleAccept}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[Colors.success, '#059669']}
                                style={styles.acceptGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.acceptButtonText}><Ionicons name="checkmark" size={18} color="#fff" /> {t('accept')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    popup: {
        width: SCREEN_WIDTH - 40,
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
    },
    timerContainer: {
        marginBottom: 16,
    },
    timerRing: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 36,
        fontWeight: '800',
    },
    timerLabel: {
        fontSize: 11,
        marginTop: -4,
    },
    progressBar: {
        width: '100%',
        height: 4,
        borderRadius: 2,
        marginBottom: 20,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
    },
    orderCard: {
        width: '100%',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
    },
    orderNumber: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    partDescription: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    vehicleIcon: {
        fontSize: 16,
    },
    vehicleText: {
        fontSize: 14,
    },
    locationsContainer: {
        width: '100%',
        marginBottom: 20,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    locationDot: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationIcon: {
        fontSize: 18,
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    locationName: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 2,
    },
    locationAddress: {
        fontSize: 13,
        marginTop: 2,
    },
    arrowContainer: {
        paddingLeft: 14,
        paddingVertical: 4,
    },
    arrow: {
        fontSize: 16,
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    rejectButton: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    acceptButton: {
        flex: 2,
        borderRadius: 16,
        overflow: 'hidden',
    },
    acceptGradient: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
