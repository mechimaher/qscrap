// QuickActions - Premium quick action grid buttons
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Linking, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Spacing, BorderRadius, FontSizes, FontFamily } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';
import { CONTACT } from '../../constants/contacts';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.lg * 3) / 2;

const QuickActions = ({ navigation }: { navigation: any }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: 700,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                delay: 700,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const ActionButton = ({
        emoji,
        label,
        bgColor,
        onPress
    }: {
        emoji: string;
        label: string;
        bgColor: string;
        onPress: () => void;
    }) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;

        return (
            <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
                onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
                activeOpacity={1}
                accessibilityLabel={label}
                accessibilityRole="button"
            >
                <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleAnim }], backgroundColor: colors.surface }]}>
                    <View style={[styles.actionIconBg, { backgroundColor: bgColor }]}>
                        <Ionicons name={emoji as any} size={22} color="#525252" />
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.textSecondary, textAlign: 'center' }]}>{label}</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Animated.View style={[
            styles.actionsSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
            <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('home.quickActions')}</Text>
            <View style={[styles.actionsGrid, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <ActionButton
                    emoji="clipboard-outline"
                    label={t('nav.newRequest')}
                    bgColor="#E8F5E9"
                    onPress={() => navigation.navigate('NewRequest')}
                />
                <ActionButton
                    emoji="car-sport-outline"
                    label={t('nav.myVehicles')}
                    bgColor="#E3F2FD"
                    onPress={() => navigation.navigate('MyVehicles')}
                />
                <ActionButton
                    emoji="chatbubble-ellipses-outline"
                    label={t('nav.support')}
                    bgColor="#FFF3E0"
                    onPress={() => Linking.openURL(`https://wa.me/${CONTACT.SUPPORT_PHONE_RAW}?text=Hi%20QScrap%20Support`)}
                />
                <ActionButton
                    emoji="settings-outline"
                    label={t('nav.settings')}
                    bgColor="#F3E5F5"
                    onPress={() => navigation.navigate('Settings')}
                />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    actionsSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
    sectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        fontFamily: FontFamily.semibold,
        marginBottom: Spacing.sm,
    },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    actionCard: {
        width: cardWidth,
        backgroundColor: '#fff',
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    actionIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    actionEmoji: { fontSize: 22 },
    actionLabel: { fontSize: FontSizes.xs, fontWeight: '600' },
});

export default QuickActions;
