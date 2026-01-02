import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface QuickReply {
    id: string;
    text: string;
    emoji: string;
    category: 'status' | 'location' | 'time' | 'help' | 'greeting';
}

interface QuickRepliesProps {
    recipientType: 'driver' | 'garage' | 'customer';
    onSelectReply: (text: string) => void;
}

// Context-aware quick replies based on recipient type
const QUICK_REPLIES: Record<string, QuickReply[]> = {
    // Customer sending to Driver
    forDriver: [
        { id: '1', text: "I'm waiting outside", emoji: '🏠', category: 'location' },
        { id: '2', text: "Please call when you arrive", emoji: '📞', category: 'help' },
        { id: '3', text: "I'll meet you at the gate", emoji: '🚪', category: 'location' },
        { id: '4', text: "How long until you arrive?", emoji: '⏱️', category: 'time' },
        { id: '5', text: "I'm on the 2nd floor", emoji: '🏢', category: 'location' },
        { id: '6', text: "Can you deliver to security?", emoji: '👮', category: 'location' },
        { id: '7', text: "Please ring the doorbell", emoji: '🔔', category: 'help' },
        { id: '8', text: "Thank you!", emoji: '🙏', category: 'greeting' },
    ],

    // Customer sending to Garage
    forGarage: [
        { id: '1', text: "Is the part still available?", emoji: '❓', category: 'status' },
        { id: '2', text: "Can you confirm the part number?", emoji: '🔢', category: 'help' },
        { id: '3', text: "When will it be ready for pickup?", emoji: '⏱️', category: 'time' },
        { id: '4', text: "Does this include warranty?", emoji: '📋', category: 'help' },
        { id: '5', text: "Can you send more photos?", emoji: '📸', category: 'help' },
        { id: '6', text: "What's the condition?", emoji: '🔍', category: 'status' },
        { id: '7', text: "Is the price negotiable?", emoji: '💰', category: 'help' },
        { id: '8', text: "Thank you for your help!", emoji: '🙏', category: 'greeting' },
    ],

    // Driver/Staff sending to Customer  
    forCustomer: [
        { id: '1', text: "I'm 5 minutes away", emoji: '🚗', category: 'time' },
        { id: '2', text: "I've arrived at your location", emoji: '📍', category: 'location' },
        { id: '3', text: "Please come outside", emoji: '🚶', category: 'help' },
        { id: '4', text: "I'm waiting at the gate", emoji: '🚪', category: 'location' },
        { id: '5', text: "I tried calling but no answer", emoji: '📞', category: 'status' },
        { id: '6', text: "Can you share your exact location?", emoji: '🗺️', category: 'location' },
        { id: '7', text: "I'm in a white car", emoji: '🚙', category: 'help' },
        { id: '8', text: "Delivery complete. Thank you!", emoji: '✅', category: 'greeting' },
        { id: '9', text: "On my way to pickup the part", emoji: '🏭', category: 'status' },
        { id: '10', text: "Traffic delay, will be there in 10 min", emoji: '🚦', category: 'time' },
    ],
};

const CATEGORY_COLORS: Record<string, string> = {
    status: '#3b82f6',
    location: '#10b981',
    time: '#f59e0b',
    help: '#8b5cf6',
    greeting: '#ec4899',
};

/**
 * Premium Quick Replies Component
 * Context-aware quick reply templates for chat
 */
export const QuickReplies: React.FC<QuickRepliesProps> = ({
    recipientType,
    onSelectReply,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Get appropriate replies based on recipient
    const getReplies = () => {
        switch (recipientType) {
            case 'driver':
                return QUICK_REPLIES.forDriver;
            case 'garage':
                return QUICK_REPLIES.forGarage;
            case 'customer':
                return QUICK_REPLIES.forCustomer;
            default:
                return QUICK_REPLIES.forDriver;
        }
    };

    const replies = getReplies();
    const filteredReplies = selectedCategory
        ? replies.filter(r => r.category === selectedCategory)
        : replies;

    const handleSelect = (reply: QuickReply) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectReply(reply.text);
    };

    const categories = [
        { key: null, label: 'All', emoji: '📝' },
        { key: 'status', label: 'Status', emoji: '📊' },
        { key: 'location', label: 'Location', emoji: '📍' },
        { key: 'time', label: 'Time', emoji: '⏱️' },
        { key: 'help', label: 'Help', emoji: '💡' },
    ];

    return (
        <View style={styles.container}>
            {/* Category Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContent}
            >
                {categories.map(cat => (
                    <TouchableOpacity
                        key={cat.key || 'all'}
                        style={[
                            styles.categoryTab,
                            selectedCategory === cat.key && styles.categoryTabActive,
                        ]}
                        onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedCategory(cat.key);
                        }}
                    >
                        <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                        <Text style={[
                            styles.categoryLabel,
                            selectedCategory === cat.key && styles.categoryLabelActive,
                        ]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Quick Reply Chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.repliesScroll}
                contentContainerStyle={styles.repliesContent}
            >
                {filteredReplies.map(reply => (
                    <TouchableOpacity
                        key={reply.id}
                        style={[
                            styles.replyChip,
                            { borderColor: CATEGORY_COLORS[reply.category] + '40' }
                        ]}
                        onPress={() => handleSelect(reply)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.replyEmoji}>{reply.emoji}</Text>
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
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    categoryScroll: {
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    categoryContent: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        gap: Spacing.xs,
    },
    categoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        backgroundColor: '#F5F5F5',
        marginRight: Spacing.xs,
    },
    categoryTabActive: {
        backgroundColor: Colors.primary + '15',
    },
    categoryEmoji: {
        fontSize: 14,
        marginRight: 4,
    },
    categoryLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '500',
        color: '#525252', // Previously Colors.dark.textSecondary
    },
    categoryLabelActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    repliesScroll: {
        maxHeight: 50,
    },
    repliesContent: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    replyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1.5,
        marginRight: Spacing.sm,
        ...Shadows.sm,
    },
    replyEmoji: {
        fontSize: 16,
        marginRight: Spacing.xs,
    },
    replyText: {
        fontSize: FontSizes.sm,
        color: '#1a1a1a', // Previously Colors.dark.text
        fontWeight: '500',
        maxWidth: 180,
    },
});

export default QuickReplies;
