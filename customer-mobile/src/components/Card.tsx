import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';

type CardVariant = 'default' | 'outlined' | 'elevated';

interface CardProps {
    children: React.ReactNode;
    variant?: CardVariant;
    onPress?: () => void;
    style?: ViewStyle;
    disabled?: boolean;
    accessibilityLabel?: string;
}

interface CardHeaderProps {
    title: string;
    subtitle?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    rightElement?: React.ReactNode;
}

interface CardSectionProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

/**
 * Flexible card component with header, content, and footer sections.
 * Supports multiple variants and optional press handler.
 */
export const Card: React.FC<CardProps> & {
    Header: React.FC<CardHeaderProps>;
    Content: React.FC<CardSectionProps>;
    Footer: React.FC<CardSectionProps>;
} = ({
    children,
    variant = 'default',
    onPress,
    style,
    disabled = false,
    accessibilityLabel,
}) => {
        const { colors } = useTheme();

        const getCardStyle = (): ViewStyle => {
            const baseStyle: ViewStyle = {
                backgroundColor: colors.surface,
                borderRadius: BorderRadius.lg,
                overflow: 'hidden',
            };

            switch (variant) {
                case 'outlined':
                    return {
                        ...baseStyle,
                        borderWidth: 1,
                        borderColor: colors.border,
                    };
                case 'elevated':
                    return {
                        ...baseStyle,
                        ...Shadows.lg,
                    };
                default:
                    return {
                        ...baseStyle,
                        ...Shadows.sm,
                    };
            }
        };

        const content = <View style={[getCardStyle(), style]}>{children}</View>;

        if (onPress) {
            return (
                <TouchableOpacity
                    onPress={onPress}
                    disabled={disabled}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    accessibilityState={{ disabled }}
                >
                    {content}
                </TouchableOpacity>
            );
        }

        return content;
    };

// Card Header Component
const CardHeader: React.FC<CardHeaderProps> = ({
    title,
    subtitle,
    icon,
    iconColor,
    rightElement,
}) => {
    const { colors } = useTheme();

    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {icon && (
                    <View style={[styles.iconContainer, { backgroundColor: (iconColor || colors.primary) + '20' }]}>
                        <Ionicons name={icon} size={20} color={iconColor || colors.primary} />
                    </View>
                )}
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>
            {rightElement && <View style={styles.headerRight}>{rightElement}</View>}
        </View>
    );
};

// Card Content Component
const CardContent: React.FC<CardSectionProps> = ({ children, style }) => {
    return <View style={[styles.content, style]}>{children}</View>;
};

// Card Footer Component
const CardFooter: React.FC<CardSectionProps> = ({ children, style }) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.footer, { borderTopColor: colors.border }, style]}>
            {children}
        </View>
    );
};

// Attach sub-components
Card.Header = CardHeader;
Card.Content = CardContent;
Card.Footer = CardFooter;

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    headerText: {
        flex: 1,
    },
    headerRight: {
        marginLeft: Spacing.md,
    },
    title: {
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: FontSize.sm,
        marginTop: 2,
    },
    content: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderTopWidth: 1,
    },
});

export default Card;
