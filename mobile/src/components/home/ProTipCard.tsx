// ProTipCard - Tappable tip card with animated lightbulb
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

const ProTipCard = ({ navigation }: { navigation: any }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.6)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            delay: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('NewRequest');
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
            activeOpacity={1}
        >
            <Animated.View style={[
                styles.proTipCard,
                { opacity: fadeAnim, backgroundColor: colors.surface, transform: [{ scale: scaleAnim }], flexDirection: rtlFlexDirection(isRTL) }
            ]}>
                <View style={[styles.proTipIconWrapper, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>
                    <Animated.Text style={[styles.proTipIcon, { opacity: glowAnim }]}>💡</Animated.Text>
                </View>
                <View style={styles.proTipContent}>
                    <Text style={[styles.proTipTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('home.proTip')}</Text>
                    <Text style={[styles.proTipText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('home.proTipMessage')} {isRTL ? '←' : '→'}
                    </Text>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    proTipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        marginHorizontal: Spacing.md,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.secondary + '50',
    },
    proTipIconWrapper: { marginRight: Spacing.sm },
    proTipIcon: { fontSize: 22 },
    proTipContent: { flex: 1 },
    proTipTitle: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.secondary, marginBottom: 1 },
    proTipText: { fontSize: 11, lineHeight: 14 },
});

export default ProTipCard;
