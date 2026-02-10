import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlTextAlign } from '../utils/rtl';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';

interface TimelineStep {
    key: string;
    label: string;
    icon: string;
    timestamp?: string;
}

interface StatusTimelineProps {
    currentStatus: string;
    steps?: TimelineStep[];
}

// Default step keys — labels come from i18n, provided at runtime
const DEFAULT_STEP_KEYS = [
    'confirmed', 'preparing', 'ready_for_pickup', 'picked_up',
    'in_transit', 'arriving', 'delivered', 'completed',
];

const DEFAULT_ICONS = ['✓', '📦', '🏭', '🚗', '🛣️', '🏁', '📬', '👑'];

// Map order statuses to timeline index
// Premium 8-step journey: confirmed → preparing → ready → picked → transit → arriving → delivered → completed
const STATUS_MAP: Record<string, number> = {
    'confirmed': 0,
    'preparing': 1,
    'ready_for_pickup': 2,
    'ready_for_collection': 2,
    'collected': 3,
    'picked_up': 3,
    'qc_in_progress': 3,
    'qc_passed': 3,
    'in_transit': 4,
    'arriving': 5,
    'delivered': 6,
    'completed': 7,
};

/**
 * Premium Animated Status Timeline
 * Shows order progress with animated transitions
 */
export const StatusTimeline: React.FC<StatusTimelineProps> = ({
    currentStatus,
    steps,
}) => {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    // Explicit i18n key map — avoids fragile camelCase conversion
    const LABEL_KEYS: Record<string, string> = {
        confirmed: 'tracking.statusOrderConfirmed',
        preparing: 'tracking.statusPreparing',
        ready_for_pickup: 'tracking.statusReadyForPickup',
        picked_up: 'tracking.statusPickedUp',
        in_transit: 'tracking.statusInTransit',
        arriving: 'tracking.statusArrivingSoon',
        delivered: 'tracking.statusDelivered',
        completed: 'tracking.statusCompleted',
    };

    // Build localized steps if not provided externally
    const localizedSteps: TimelineStep[] = steps || DEFAULT_STEP_KEYS.map((key, i) => ({
        key,
        label: t(LABEL_KEYS[key] as any) || key,
        icon: DEFAULT_ICONS[i],
    }));

    const currentIndex = STATUS_MAP[currentStatus] ?? 0;

    // Animation for the current step indicator
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation for current step
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        // Glow animation
        const glow = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: false,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false,
                }),
            ])
        );
        glow.start();

        return () => {
            pulse.stop();
            glow.stop();
        };
    }, [currentIndex]);

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.8],
    });

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t('tracking.orderProgress')}</Text>

            <View style={styles.timeline}>
                {localizedSteps.map((step, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isPending = index > currentIndex;

                    return (
                        <View key={step.key} style={styles.stepRow}>
                            {/* Connector line (not for first item) */}
                            {index > 0 && (
                                <View style={styles.connectorContainer}>
                                    <View
                                        style={[
                                            styles.connector,
                                            { backgroundColor: colors.border },
                                            isCompleted && styles.connectorCompleted,
                                            isCurrent && styles.connectorActive,
                                        ]}
                                    />
                                </View>
                            )}

                            {/* Step node */}
                            <View style={styles.stepContent}>
                                <Animated.View
                                    style={[
                                        styles.nodeContainer,
                                        isCurrent && { transform: [{ scale: pulseAnim }] },
                                    ]}
                                >
                                    {/* Glow effect for current step */}
                                    {isCurrent && (
                                        <Animated.View
                                            style={[
                                                styles.nodeGlow,
                                                { opacity: glowOpacity }
                                            ]}
                                        />
                                    )}

                                    <View
                                        style={[
                                            styles.node,
                                            { backgroundColor: colors.border },
                                            isCompleted && styles.nodeCompleted,
                                            isCurrent && styles.nodeCurrent,
                                            isPending && [styles.nodePending, { backgroundColor: colors.surface, borderColor: colors.border }],
                                        ]}
                                    >
                                        <Text style={[
                                            styles.nodeIcon,
                                            isPending && styles.nodeIconPending,
                                        ]}>
                                            {isCompleted ? '✓' : step.icon}
                                        </Text>
                                    </View>
                                </Animated.View>

                                {/* Step label */}
                                <View style={styles.labelContainer}>
                                    <Text
                                        style={[
                                            styles.stepLabel,
                                            { color: colors.text },
                                            isCurrent && styles.stepLabelCurrent,
                                            isPending && { color: colors.textSecondary },
                                        ]}
                                    >
                                        {step.label}
                                    </Text>
                                    {step.timestamp && (
                                        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>{step.timestamp}</Text>
                                    )}
                                    {isCurrent && (
                                        <Text style={styles.currentLabel}>{t('tracking.statusNow')}</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginTop: Spacing.md,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: Spacing.lg,
    },
    timeline: {
        paddingLeft: Spacing.xs,
    },
    stepRow: {
        marginBottom: 0,
    },
    connectorContainer: {
        position: 'absolute',
        left: 15,
        top: -20,
        width: 2,
        height: 20,
    },
    connector: {
        width: 2,
        height: '100%',
    },
    connectorCompleted: {
        backgroundColor: Colors.primary,
    },
    connectorActive: {
        backgroundColor: Colors.primary,
    },
    stepContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    nodeContainer: {
        position: 'relative',
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nodeGlow: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
    },
    node: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    nodeCompleted: {
        backgroundColor: Colors.primary,
    },
    nodeCurrent: {
        backgroundColor: Colors.primary,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    nodePending: {
        borderWidth: 2,
    },
    nodeIcon: {
        fontSize: 14,
    },
    nodeIconPending: {
        opacity: 0.5,
    },
    labelContainer: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    stepLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    stepLabelCompleted: {
    },
    stepLabelCurrent: {
        color: Colors.primary,
        fontWeight: '600',
    },
    stepLabelPending: {
        color: Colors.dark.textSecondary,
    },
    timestamp: {
        fontSize: 11,
        marginTop: 2,
    },
    currentLabel: {
        fontSize: 10,
        color: Colors.primary,
        fontWeight: '700',
        marginTop: 2,
    },
});

export default StatusTimeline;
