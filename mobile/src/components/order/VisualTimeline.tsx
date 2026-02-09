// VisualTimeline - Animated step-by-step order progress
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { getTimelineSteps } from './statusConfig';

const VisualTimeline = ({ status, colors, t }: { status: string; colors: any; t: any }) => {
    const { steps, currentStep } = getTimelineSteps(status, t);
    const lineAnims = useRef(steps.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        lineAnims.forEach((anim, index) => {
            if (index < currentStep) {
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 500,
                    delay: index * 150,
                    useNativeDriver: false,
                }).start();
            }
        });
    }, [currentStep]);

    return (
        <View style={[styles.timelineContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('order.progress')}</Text>

            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const isLast = index === steps.length - 1;

                return (
                    <View key={step.key} style={styles.timelineStep}>
                        <View style={styles.timelineLeft}>
                            <View style={[
                                styles.timelineDot,
                                isCompleted && styles.timelineDotCompleted,
                                isCurrent && styles.timelineDotCurrent,
                            ]}>
                                <Text style={[
                                    styles.timelineDotIcon,
                                    (isCompleted || isCurrent) && { opacity: 1 }
                                ]}>
                                    {isCompleted ? '✓' : step.icon}
                                </Text>
                            </View>
                            {!isLast && (
                                <View style={styles.timelineLineContainer}>
                                    <View style={styles.timelineLineBg} />
                                    <Animated.View style={[
                                        styles.timelineLineFill,
                                        {
                                            height: lineAnims[index].interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%'],
                                            })
                                        }
                                    ]} />
                                </View>
                            )}
                        </View>
                        <View style={styles.timelineContent}>
                            <Text style={[
                                styles.timelineLabel,
                                { color: colors.text },
                                (isCompleted || isCurrent) && styles.timelineLabelActive
                            ]}>
                                {step.label}
                            </Text>
                            {isCurrent && (
                                <View style={styles.currentBadge}>
                                    <Text style={styles.currentBadgeText}>{t('common.current')}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    timelineContainer: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.lg },
    timelineStep: { flexDirection: 'row', minHeight: 60 },
    timelineLeft: { width: 32, alignItems: 'center' },
    timelineDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center' },
    timelineDotCompleted: { backgroundColor: '#22C55E' },
    timelineDotCurrent: { backgroundColor: Colors.primary, borderWidth: 3, borderColor: Colors.primary + '40' },
    timelineDotIcon: { fontSize: 14, opacity: 0.4 },
    timelineLineContainer: { flex: 1, width: 3, alignSelf: 'center', marginVertical: 4, position: 'relative' },
    timelineLineBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#E8E8E8', borderRadius: 1.5 },
    timelineLineFill: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#22C55E', borderRadius: 1.5 },
    timelineContent: { flex: 1, paddingLeft: Spacing.md, paddingBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center' },
    timelineLabel: { fontSize: FontSizes.md, color: '#737373' },
    timelineLabelActive: { fontWeight: '600', color: '#1a1a1a' },
    currentBadge: { marginLeft: Spacing.sm, backgroundColor: Colors.primary + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.md },
    currentBadgeText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },
});

export default VisualTimeline;
