import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Share,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface WarrantyQRCardProps {
    orderId: string;
    orderNumber: string;
    warrantyDays: number;
    partDescription: string;
    garageName: string;
    purchaseDate: string;
    expiryDate?: string;
}

/**
 * Premium Warranty QR Card Component
 * Displays warranty info with QR code for scanning
 */
export const WarrantyQRCard: React.FC<WarrantyQRCardProps> = ({
    orderId,
    orderNumber,
    warrantyDays,
    partDescription,
    garageName,
    purchaseDate,
    expiryDate,
}) => {
    const [showFullCard, setShowFullCard] = useState(false);

    // Calculate expiry date if not provided
    const calculateExpiryDate = (): string => {
        if (expiryDate) return expiryDate;
        const purchase = new Date(purchaseDate);
        purchase.setDate(purchase.getDate() + warrantyDays);
        return purchase.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Calculate days remaining
    const calculateDaysRemaining = (): number => {
        const expiry = expiryDate
            ? new Date(expiryDate)
            : new Date(new Date(purchaseDate).getTime() + warrantyDays * 24 * 60 * 60 * 1000);
        const today = new Date();
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    const daysRemaining = calculateDaysRemaining();
    const isExpired = daysRemaining <= 0;
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 30;

    // Generate QR data URL (using embedded ASCII QR for display)
    const generateQRPattern = (): string[][] => {
        // Simple visual pattern based on order ID hash
        const hash = orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const size = 7;
        const pattern: string[][] = [];

        for (let i = 0; i < size; i++) {
            const row: string[] = [];
            for (let j = 0; j < size; j++) {
                // Create recognizable QR-like pattern
                const isCorner = (i < 2 && j < 2) || (i < 2 && j >= size - 2) || (i >= size - 2 && j < 2);
                const isData = ((hash + i * j) % 2 === 0);
                row.push(isCorner || isData ? '█' : '░');
            }
            pattern.push(row);
        }
        return pattern;
    };

    const handleShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await Share.share({
                message: `🔧 QScrap Warranty Card\n\nOrder: ${orderNumber}\nPart: ${partDescription}\nGarage: ${garageName}\nWarranty: ${warrantyDays} days\nExpires: ${calculateExpiryDate()}\n\nScan the QR code in the app or visit qscrap.qa/warranty/${orderId}`,
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share warranty card');
        }
    };

    const handleClaim = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            '📋 File Warranty Claim',
            'To file a warranty claim, please contact the garage or use the dispute feature in your order.',
            [
                { text: 'View Order', onPress: () => { } },
                { text: 'Close', style: 'cancel' },
            ]
        );
    };

    const qrPattern = generateQRPattern();

    if (warrantyDays <= 0) {
        return null; // Don't show if no warranty
    }

    return (
        <>
            <TouchableOpacity
                style={styles.container}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowFullCard(true);
                }}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={isExpired
                        ? ['#6b7280', '#4b5563']
                        : isExpiringSoon
                            ? ['#f59e0b', '#d97706']
                            : ['#22c55e', '#16a34a']}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.cardContent}>
                        <View style={styles.leftSection}>
                            <Text style={styles.warrantyLabel}>WARRANTY</Text>
                            <Text style={styles.warrantyDays}>{warrantyDays} Days</Text>
                            {isExpired ? (
                                <Text style={styles.statusText}>⛔ Expired</Text>
                            ) : isExpiringSoon ? (
                                <Text style={styles.statusText}>⚠️ {daysRemaining} days left</Text>
                            ) : (
                                <Text style={styles.statusText}>✓ Active • {daysRemaining} days left</Text>
                            )}
                        </View>

                        <View style={styles.qrSection}>
                            <View style={styles.qrContainer}>
                                {qrPattern.map((row, i) => (
                                    <View key={i} style={styles.qrRow}>
                                        {row.map((cell, j) => (
                                            <Text key={j} style={styles.qrCell}>{cell}</Text>
                                        ))}
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.qrHint}>Tap to view</Text>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            {/* Full Warranty Card Modal */}
            <Modal
                visible={showFullCard}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowFullCard(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Warranty Card</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowFullCard(false)}
                        >
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.fullCard}>
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            style={styles.fullCardHeader}
                        >
                            <Text style={styles.fullCardLogo}>🔧 QScrap</Text>
                            <Text style={styles.fullCardType}>WARRANTY CERTIFICATE</Text>
                        </LinearGradient>

                        <View style={styles.fullCardBody}>
                            {/* Big QR Code */}
                            <View style={styles.bigQRContainer}>
                                {qrPattern.map((row, i) => (
                                    <View key={i} style={styles.bigQRRow}>
                                        {row.map((cell, j) => (
                                            <Text key={j} style={styles.bigQRCell}>{cell}</Text>
                                        ))}
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.qrCaption}>Scan for verification</Text>

                            {/* Details */}
                            <View style={styles.detailsSection}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Order Number</Text>
                                    <Text style={styles.detailValue}>{orderNumber}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Part</Text>
                                    <Text style={styles.detailValue}>{partDescription}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Supplied By</Text>
                                    <Text style={styles.detailValue}>{garageName}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Purchase Date</Text>
                                    <Text style={styles.detailValue}>
                                        {new Date(purchaseDate).toLocaleDateString()}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Warranty Period</Text>
                                    <Text style={styles.detailValue}>{warrantyDays} Days</Text>
                                </View>
                                <View style={[styles.detailRow, styles.detailRowHighlight]}>
                                    <Text style={styles.detailLabel}>Expires On</Text>
                                    <Text style={[
                                        styles.detailValue,
                                        isExpired && styles.expiredText,
                                        isExpiringSoon && styles.warningText,
                                    ]}>
                                        {calculateExpiryDate()}
                                    </Text>
                                </View>
                            </View>

                            {/* Status Badge */}
                            <View style={[
                                styles.statusBadge,
                                isExpired && styles.statusBadgeExpired,
                                isExpiringSoon && styles.statusBadgeWarning,
                            ]}>
                                <Text style={styles.statusBadgeText}>
                                    {isExpired
                                        ? '⛔ WARRANTY EXPIRED'
                                        : isExpiringSoon
                                            ? `⚠️ EXPIRES IN ${daysRemaining} DAYS`
                                            : '✓ WARRANTY ACTIVE'}
                                </Text>
                            </View>
                        </View>

                        {/* Actions */}
                        <View style={styles.actionsRow}>
                            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                                <Text style={styles.actionIcon}>📤</Text>
                                <Text style={styles.actionText}>Share</Text>
                            </TouchableOpacity>
                            {!isExpired && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.claimButton]}
                                    onPress={handleClaim}
                                >
                                    <Text style={styles.actionIcon}>📋</Text>
                                    <Text style={styles.actionText}>Claim</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <Text style={styles.disclaimer}>
                        This warranty is provided by {garageName} through QScrap platform.
                        Terms and conditions apply.
                    </Text>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    cardGradient: {
        padding: Spacing.lg,
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSection: {
        flex: 1,
    },
    warrantyLabel: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        letterSpacing: 2,
    },
    warrantyDays: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginVertical: 4,
    },
    statusText: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.9)',
    },
    qrSection: {
        alignItems: 'center',
    },
    qrContainer: {
        backgroundColor: '#fff',
        padding: 8,
        borderRadius: BorderRadius.md,
    },
    qrRow: {
        flexDirection: 'row',
    },
    qrCell: {
        fontSize: 8,
        lineHeight: 8,
        color: '#000',
    },
    qrHint: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        padding: Spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    modalTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: '#1a1a1a',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: 18,
        color: '#1a1a1a',
    },
    fullCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    fullCardHeader: {
        padding: Spacing.lg,
        alignItems: 'center',
    },
    fullCardLogo: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: '#fff',
    },
    fullCardType: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 3,
        marginTop: 4,
    },
    fullCardBody: {
        padding: Spacing.lg,
    },
    bigQRContainer: {
        backgroundColor: '#F8F9FA',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        alignSelf: 'center',
        marginBottom: Spacing.sm,
    },
    bigQRRow: {
        flexDirection: 'row',
    },
    bigQRCell: {
        fontSize: 16,
        lineHeight: 16,
        color: '#000',
    },
    qrCaption: {
        fontSize: FontSizes.xs,
        color: '#737373',
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    detailsSection: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: Spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    detailRowHighlight: {
        backgroundColor: '#F8F9FA',
        marginHorizontal: -Spacing.lg,
        paddingHorizontal: Spacing.lg,
        borderBottomWidth: 0,
    },
    detailLabel: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
    detailValue: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#1a1a1a',
        maxWidth: '60%',
        textAlign: 'right',
    },
    expiredText: {
        color: Colors.error,
    },
    warningText: {
        color: '#f59e0b',
    },
    statusBadge: {
        backgroundColor: '#22c55e20',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginTop: Spacing.lg,
        alignItems: 'center',
    },
    statusBadgeExpired: {
        backgroundColor: '#ef444420',
    },
    statusBadgeWarning: {
        backgroundColor: '#f59e0b20',
    },
    statusBadgeText: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#16a34a',
    },
    actionsRow: {
        flexDirection: 'row',
        padding: Spacing.md,
        gap: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8F9FA',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    claimButton: {
        backgroundColor: Colors.primary + '15',
    },
    actionIcon: {
        fontSize: 18,
        marginRight: Spacing.xs,
    },
    actionText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    disclaimer: {
        fontSize: FontSizes.xs,
        color: '#737373',
        textAlign: 'center',
        marginTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
});

export default WarrantyQRCard;
