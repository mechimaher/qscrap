import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;
const CARD_MARGIN = Spacing.md;

interface QuickService {
    id: string;
    title: string;
    icon: string;
    price: string;
    duration: string;
    gradient: readonly [string, string];
    isEmergency?: boolean;
}

const QUICK_SERVICES: QuickService[] = [
    {
        id: 'breakdown',
        title: 'Breakdown Service',
        icon: '🚨',
        price: '70-100 QAR',
        duration: '30 mins',
        gradient: ['#FEE2E2', '#EF4444'],
        isEmergency: true,
    },
    {
        id: 'battery',
        title: 'Battery Change',
        icon: '🔋',
        price: '150-250 QAR',
        duration: '30 mins',
        gradient: ['#FEF3C7', '#FCD34D'],
    },
    {
        id: 'diagnostic',
        title: 'Computer Diagnostic',
        icon: '💻',
        price: '100-150 QAR',
        duration: '20 mins',
        gradient: ['#E0E7FF', '#C7D2FE'],
    },
    {
        id: 'tire',
        title: 'Tire Service',
        icon: '🛞',
        price: '50-150 QAR',
        duration: '20 mins',
        gradient: ['#E0E7FF', '#A5B4FC'],
    },
    {
        id: 'electrician',
        title: 'Auto Electrician',
        icon: '⚡',
        price: '80-200 QAR',
        duration: '45 mins',
        gradient: ['#FEF9C3', '#FDE047'],
    },
    {
        id: 'oil',
        title: 'Oil Change',
        icon: '🛢️',
        price: '120-200 QAR',
        duration: '30 mins',
        gradient: ['#FEE2E2', '#FCA5A5'],
    },
    {
        id: 'ac',
        title: 'AC Gas Refill',
        icon: '❄️',
        price: '200-300 QAR',
        duration: '45 mins',
        gradient: ['#CCFBF1', '#5EEAD4'],
    },
    {
        id: 'wash',
        title: 'Home Car Wash',
        icon: '🧼',
        price: '80-120 QAR',
        duration: '45 mins',
        gradient: ['#DBEAFE', '#93C5FD'],
    },
];

interface QuickServicesBannerProps {
    onServicePress: (serviceId: string, serviceName: string, icon: string, priceRange: string, duration: string) => void;
    onViewAll: () => void;
}

export default function QuickServicesBanner({ onServicePress, onViewAll }: QuickServicesBannerProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                delay: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const ServiceCard = ({ service }: { service: QuickService }) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;

        const handlePressIn = () => {
            Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
        };

        const handlePressOut = () => {
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        };

        const handlePress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onServicePress(service.id, service.title, service.icon, service.price, service.duration);
        };

        return (
            <TouchableOpacity
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                style={styles.cardTouchable}
            >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <LinearGradient
                        colors={service.gradient as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.serviceCard,
                            service.isEmergency && styles.emergencyCard,
                        ]}
                    >
                        {service.isEmergency && (
                            <View style={styles.emergencyBadge}>
                                <Text style={styles.emergencyText}>PRIORITY</Text>
                            </View>
                        )}

                        <View style={styles.iconContainer}>
                            <Text style={styles.serviceIcon}>{service.icon}</Text>
                        </View>

                        <Text style={[styles.serviceTitle, service.isEmergency && styles.emergencyTitle]}>
                            {service.title}
                        </Text>

                        <View style={styles.infoContainer}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoIcon}>💰</Text>
                                <Text style={styles.infoText}>{service.price}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoIcon}>⏱️</Text>
                                <Text style={styles.infoText}>{service.duration}</Text>
                            </View>
                        </View>

                        <View style={styles.bookButton}>
                            <Text style={styles.bookButtonText}>Book Now →</Text>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>⚡ Quick Services</Text>
                    <Text style={styles.headerSubtitle}>On-demand help, wherever you are</Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onViewAll();
                    }}
                    style={styles.viewAllButton}
                >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Text style={styles.viewAllArrow}>→</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                snapToInterval={CARD_WIDTH + CARD_MARGIN}
                decelerationRate="fast"
                snapToAlignment="start"
            >
                {QUICK_SERVICES.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                ))}
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.primary,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewAllText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    viewAllArrow: {
        fontSize: FontSizes.md,
        color: Colors.primary,
        fontWeight: '600',
    },
    scrollContent: {
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.lg,
    },
    cardTouchable: {
        marginRight: CARD_MARGIN,
    },
    serviceCard: {
        width: CARD_WIDTH,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.lg,
        position: 'relative',
    },
    emergencyCard: {
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    emergencyBadge: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        backgroundColor: '#EF4444',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    emergencyText: {
        color: '#fff',
        fontSize: FontSizes.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
    serviceIcon: {
        fontSize: 36,
    },
    serviceTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.sm,
    },
    emergencyTitle: {
        color: '#DC2626',
    },
    infoContainer: {
        marginBottom: Spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    infoIcon: {
        fontSize: 16,
    },
    infoText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#525252',
    },
    bookButton: {
        backgroundColor: 'rgba(138,21,56,0.15)',
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    bookButtonText: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
});
