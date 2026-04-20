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
import { useTranslation } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

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
const QUICK_REPLY_KEYS: Record<string, Array<{ id: string; translationKey: string; emoji: string; category: string }>> = {
    // Customer sending to Driver
    forDriver: [
        { id: '1', translationKey: 'quickReplies.waitingOutside', emoji: 'home-outline', category: 'location' },
        { id: '2', translationKey: 'quickReplies.callWhenArrive', emoji: 'call-outline', category: 'help' },
        { id: '3', translationKey: 'quickReplies.meetAtGate', emoji: 'enter-outline', category: 'location' },
        { id: '4', translationKey: 'quickReplies.howLongUntilArrive', emoji: 'time-outline', category: 'time' },
        { id: '5', translationKey: 'quickReplies.onSecondFloor', emoji: 'business-outline', category: 'location' },
        { id: '6', translationKey: 'quickReplies.deliverToSecurity', emoji: 'shield-outline', category: 'location' },
        { id: '7', translationKey: 'quickReplies.ringDoorbell', emoji: 'notifications-outline', category: 'help' },
        { id: '8', translationKey: 'quickReplies.thankYou', emoji: 'heart-outline', category: 'greeting' },
    ],

    // Customer sending to Garage
    forGarage: [
        { id: '1', translationKey: 'quickReplies.partStillAvailable', emoji: 'help-circle-outline', category: 'status' },
        { id: '2', translationKey: 'quickReplies.confirmPartNumber', emoji: 'keypad-outline', category: 'help' },
        { id: '3', translationKey: 'quickReplies.whenReadyPickup', emoji: 'time-outline', category: 'time' },
        { id: '4', translationKey: 'quickReplies.includeWarranty', emoji: 'clipboard-outline', category: 'help' },
        { id: '5', translationKey: 'quickReplies.sendMorePhotos', emoji: 'camera-outline', category: 'help' },
        { id: '6', translationKey: 'quickReplies.whatCondition', emoji: 'search-outline', category: 'status' },
        { id: '7', translationKey: 'quickReplies.priceNegotiable', emoji: 'cash-outline', category: 'help' },
        { id: '8', translationKey: 'quickReplies.thankYouHelp', emoji: 'heart-outline', category: 'greeting' },
    ],

    // Driver/Staff sending to Customer  
    forCustomer: [
        { id: '1', translationKey: 'quickReplies.fiveMinAway', emoji: 'car-sport-outline', category: 'time' },
        { id: '2', translationKey: 'quickReplies.arrivedLocation', emoji: 'location-outline', category: 'location' },
        { id: '3', translationKey: 'quickReplies.comeOutside', emoji: 'walk-outline', category: 'help' },
        { id: '4', translationKey: 'quickReplies.waitingAtGate', emoji: 'enter-outline', category: 'location' },
        { id: '5', translationKey: 'quickReplies.triedCalling', emoji: 'call-outline', category: 'status' },
        { id: '6', translationKey: 'quickReplies.shareExactLocation', emoji: 'map-outline', category: 'location' },
        { id: '7', translationKey: 'quickReplies.inWhiteCar', emoji: 'car-outline', category: 'help' },
        { id: '8', translationKey: 'quickReplies.deliveryComplete', emoji: 'checkmark-circle-outline', category: 'greeting' },
        { id: '9', translationKey: 'quickReplies.onMyWayPickup', emoji: 'navigate-outline', category: 'status' },
        { id: '10', translationKey: 'quickReplies.trafficDelay', emoji: 'warning-outline', category: 'time' },
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
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Get appropriate replies based on recipient
    const getReplies = (): QuickReply[] => {
        const keySet = recipientType === 'driver' ? QUICK_REPLY_KEYS.forDriver
            : recipientType === 'garage' ? QUICK_REPLY_KEYS.forGarage
                : QUICK_REPLY_KEYS.forCustomer;
        return keySet.map(item => ({
            id: item.id,
            text: t(item.translationKey),
            emoji: item.emoji,
            category: item.category as QuickReply['category'],
        }));
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
        { key: null, label: t('quickReplies.all'), icon: 'chatbubbles-outline' as const },
        { key: 'status', label: t('quickReplies.status'), icon: 'information-circle-outline' as const },
        { key: 'location', label: t('quickReplies.location'), icon: 'location-outline' as const },
        { key: 'time', label: t('quickReplies.time'), icon: 'time-outline' as const },
        { key: 'help', label: t('quickReplies.help'), icon: 'bulb-outline' as const },
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
                        <Ionicons name={cat.icon} size={14} color={selectedCategory === cat.key ? Colors.primary : '#525252'} style={{ marginRight: 4 }} />
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
                        <Ionicons name={reply.emoji as any} size={16} color={CATEGORY_COLORS[reply.category]} style={{ marginRight: Spacing.xs }} />
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
        color: '#525252',
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
        color: '#1a1a1a',
        fontWeight: '500',
        maxWidth: 180,
    },
});

export default QuickReplies;
