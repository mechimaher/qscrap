// WelcomeNewUser - Empty state card for first-time users
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { rtlTextAlign } from '../../utils/rtl';
import { Ionicons } from '@expo/vector-icons';

const WelcomeNewUser = ({ onGetStarted }: { onGetStarted: () => void }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[
            styles.welcomeCard,
            {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
                backgroundColor: colors.surface,
            }
        ]}>
            <LinearGradient
                colors={['rgba(141, 27, 61, 0.05)', 'rgba(201, 162, 39, 0.1)']}
                style={styles.welcomeGradient}
            >
                <Ionicons name="sparkles" size={48} color={Colors.primary} style={{ marginBottom: Spacing.sm }} />
                <Text style={[styles.welcomeTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('home.welcomeNewUser') || 'Welcome to QScrap!'}
                </Text>
                <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('home.startFirstRequest') || 'Find your first car part from verified Qatar suppliers'}
                </Text>
                <TouchableOpacity
                    style={[styles.welcomeButton, { backgroundColor: Colors.primary }]}
                    onPress={onGetStarted}
                    accessibilityLabel={t('home.getStarted') || 'Get Started'}
                    accessibilityRole="button"
                >
                    <Text style={styles.welcomeButtonText}>
                        {t('home.getStarted') || 'Get Started'}
                    </Text>
                </TouchableOpacity>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    welcomeCard: {
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    welcomeGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
    },
    welcomeEmoji: {
        fontSize: 48,
        marginBottom: Spacing.sm,
    },
    welcomeTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    welcomeSubtitle: {
        fontSize: FontSizes.sm,
        textAlign: 'center',
        marginBottom: Spacing.md,
        lineHeight: 20,
    },
    welcomeButton: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    welcomeButtonText: {
        color: '#FFFFFF',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
});

export default WelcomeNewUser;
