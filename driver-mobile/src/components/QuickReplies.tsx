import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface QuickReply {
    text: string;
    emoji?: string;
}

interface QuickRepliesProps {
    onSelectReply: (text: string) => void;
    recipientType?: 'customer' | 'garage' | 'operations';
}

const DRIVER_QUICK_REPLIES: QuickReply[] = [
    { text: "I'm on my way!", emoji: '🚗' },
    { text: 'Arrived at pickup location', emoji: '📍' },
    { text: 'Package picked up successfully', emoji: '📦' },
    { text: 'On my way to delivery address', emoji: '🛣️' },
    { text: "I'm nearby, please come outside", emoji: '🏠' },
    { text: 'Delivered successfully!', emoji: '✅' },
    { text: 'Please call me', emoji: '📞' },
    { text: 'Can you share your location?', emoji: '📍' },
    { text: 'Traffic delay, will be there soon', emoji: '🚦' },
    { text: 'Having trouble finding the address', emoji: '🤔' },
];

const CUSTOMER_SPECIFIC: QuickReply[] = [
    { text: 'Thank you for your order!', emoji: '🙏' },
    { text: 'I will wait for 5 minutes', emoji: '⏱️' },
];

/**
 * Premium quick replies component for driver chat.
 * Shows contextual quick action buttons for common messages.
 */
export const QuickReplies: React.FC<QuickRepliesProps> = ({
    onSelectReply,
    recipientType = 'customer',
}) => {
    const replies = recipientType === 'customer'
        ? [...DRIVER_QUICK_REPLIES, ...CUSTOMER_SPECIFIC]
        : DRIVER_QUICK_REPLIES;

    const handlePress = (text: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectReply(text);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Quick Replies</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {replies.map((reply, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.replyButton}
                        onPress={() => handlePress(reply.text)}
                        activeOpacity={0.7}
                    >
                        {reply.emoji && <Text style={styles.emoji}>{reply.emoji}</Text>}
                        <Text style={styles.replyText} numberOfLines={1}>
                            {reply.text}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.sm,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    label: {
        fontSize: FontSize.xs,
        color: '#999',
        marginLeft: Spacing.md,
        marginBottom: Spacing.xs,
        fontWeight: '500',
    },
    scrollContent: {
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    replyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: Colors.primary + '20',
        gap: Spacing.xs,
    },
    emoji: {
        fontSize: 14,
    },
    replyText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: '500',
        maxWidth: 180,
    },
});

export default QuickReplies;
