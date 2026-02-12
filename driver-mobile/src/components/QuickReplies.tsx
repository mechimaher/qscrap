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
import { Ionicons } from '@expo/vector-icons';

interface QuickReply {
    text: string;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
}

interface QuickRepliesProps {
    onSelectReply: (text: string) => void;
    recipientType?: 'customer' | 'garage' | 'operations';
}

const DRIVER_QUICK_REPLIES: QuickReply[] = [
    { text: "I'm on my way!", icon: 'car-outline' },
    { text: 'Arrived at pickup location', icon: 'location-outline' },
    { text: 'Package picked up successfully', icon: 'cube-outline' },
    { text: 'On my way to delivery address', icon: 'navigate-outline' },
    { text: "I'm nearby, please come outside", icon: 'home-outline' },
    { text: 'Delivered successfully!', icon: 'checkmark-circle-outline' },
    { text: 'Please call me', icon: 'call-outline' },
    { text: 'Can you share your location?', icon: 'location-outline' },
    { text: 'Traffic delay, will be there soon', icon: 'warning-outline' },
    { text: 'Having trouble finding the address', icon: 'help-circle-outline' },
];

const CUSTOMER_SPECIFIC: QuickReply[] = [
    { text: 'Thank you for your order!', icon: 'heart-outline' },
    { text: 'I will wait for 5 minutes', icon: 'time-outline' },
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
                        {reply.icon && <Ionicons name={reply.icon} size={14} color={Colors.primary} />}
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
