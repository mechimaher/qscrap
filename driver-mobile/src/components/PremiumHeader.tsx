// QScrap Driver App - Premium Header Component
// Consistent header with back navigation, title, and optional actions

import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, FontWeights, BorderRadius } from '../constants/theme';

interface PremiumHeaderProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBackPress?: () => void;
    rightAction?: ReactNode;
    style?: ViewStyle;
    transparent?: boolean;
}

export function PremiumHeader({
    title,
    subtitle,
    showBack = true,
    onBackPress,
    rightAction,
    style,
    transparent = false,
}: PremiumHeaderProps) {
    const navigation = useNavigation();

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onBackPress) {
            onBackPress();
        } else {
            navigation.goBack();
        }
    };

    return (
        <View style={[
            styles.header,
            !transparent && styles.headerSolid,
            style,
        ]}>
            {/* Left - Back Button */}
            <View style={styles.leftSection}>
                {showBack && (
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.backIcon,
                            transparent && styles.backIconLight,
                        ]}>←</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Center - Title */}
            <View style={styles.centerSection}>
                <Text style={[
                    styles.title,
                    transparent && styles.titleLight,
                ]} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[
                        styles.subtitle,
                        transparent && styles.subtitleLight,
                    ]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {/* Right - Actions */}
            <View style={styles.rightSection}>
                {rightAction}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
    },
    headerSolid: {
        backgroundColor: Colors.theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.theme.border,
    },
    leftSection: {
        width: 48,
        alignItems: 'flex-start',
    },
    centerSection: {
        flex: 1,
        alignItems: 'center',
    },
    rightSection: {
        width: 48,
        alignItems: 'flex-end',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.full,
    },
    backIcon: {
        fontSize: 24,
        color: Colors.theme.text,
    },
    backIconLight: {
        color: '#fff',
    },
    title: {
        fontSize: 18,
        fontWeight: FontWeights.bold,
        color: Colors.theme.text,
    },
    titleLight: {
        color: '#fff',
    },
    subtitle: {
        fontSize: 12,
        color: Colors.theme.textMuted,
        marginTop: 2,
    },
    subtitleLight: {
        color: 'rgba(255,255,255,0.7)',
    },
});

export default PremiumHeader;
