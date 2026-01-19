// QScrap Driver Rating Modal - Premium Design
import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

const { width, height } = Dimensions.get('window');

interface DriverRatingModalProps {
    visible: boolean;
    driverName: string;
    orderId: string;
    driverId: string;
    onSubmit: (rating: number, comment?: string) => void;
    onSkip: () => void;
}

export const DriverRatingModal: React.FC<DriverRatingModalProps> = ({
    visible,
    driverName,
    orderId,
    driverId,
    onSubmit,
    onSkip,
}) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    const handleStarPress = (star: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRating(star);
    };

    const handleSubmit = () => {
        if (rating === 0) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSubmit(rating, comment.trim() || undefined);
        // Reset for next time
        setRating(0);
        setComment('');
    };

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRating(0);
        setComment('');
        onSkip();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleSkip}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#8D1B3D', '#C9A227']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <Text style={styles.headerTitle}>Rate Your Driver</Text>
                    </LinearGradient>

                    <View style={styles.content}>
                        {/* Driver Info */}
                        <View style={styles.driverInfo}>
                            <Text style={styles.driverEmoji}>🚗</Text>
                            <Text style={styles.driverName}>{driverName}</Text>
                            <Text style={styles.subtitle}>How was your delivery experience?</Text>
                        </View>

                        {/* Star Rating */}
                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => handleStarPress(star)}
                                    style={styles.starButton}
                                >
                                    <Text style={styles.star}>
                                        {star <= rating ? '⭐' : '☆'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Rating Label */}
                        {rating > 0 && (
                            <Text style={styles.ratingLabel}>
                                {rating === 1 && 'Poor'}
                                {rating === 2 && 'Fair'}
                                {rating === 3 && 'Good'}
                                {rating === 4 && 'Very Good'}
                                {rating === 5 && 'Excellent'}
                            </Text>
                        )}

                        {/* Comment Input */}
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment (optional)"
                            placeholderTextColor={Colors.theme.textSecondary}
                            value={comment}
                            onChangeText={setComment}
                            multiline
                            maxLength={150}
                        />

                        {/* Actions */}
                        <View style={styles.actions}>
                            <TouchableOpacity
                                onPress={handleSkip}
                                style={styles.skipButton}
                            >
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={rating === 0}
                                style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                            >
                                <LinearGradient
                                    colors={rating === 0 ? ['#CCCCCC', '#AAAAAA'] : ['#22C55E', '#16A34A']}
                                    style={styles.submitGradient}
                                >
                                    <Text style={styles.submitText}>Submit Rating</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: BorderRadius.xxl,
        width: width * 0.9,
        maxWidth: 400,
        ...Shadows.xl,
    },
    header: {
        padding: Spacing.xl,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    content: {
        padding: Spacing.xl,
    },
    driverInfo: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    driverEmoji: {
        fontSize: 48,
        marginBottom: Spacing.sm,
    },
    driverName: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.theme.text,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: Colors.theme.textSecondary,
        textAlign: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    starButton: {
        padding: Spacing.xs,
    },
    star: {
        fontSize: 40,
    },
    ratingLabel: {
        fontSize: FontSizes.lg,
        fontWeight: '600',
        color: Colors.theme.primary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    commentInput: {
        borderWidth: 1,
        borderColor: Colors.theme.border,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: Colors.theme.text,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: Spacing.xl,
    },
    actions: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    skipButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: Colors.theme.border,
        alignItems: 'center',
    },
    skipText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: Colors.theme.textSecondary,
    },
    submitButton: {
        flex: 2,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    submitText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default DriverRatingModal;
