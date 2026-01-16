import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

interface QuickService {
    id: string;
    title: string;
    titleAr: string;
    icon: string;
    price: string;
    priceAr: string;
    duration: string;
    durationAr: string;
    description: string;
    descriptionAr: string;
    gradient: readonly [string, string];
    priority: number;
}

const QUICK_SERVICES: QuickService[] = [
    {
        id: 'battery',
        title: 'Battery Change',
        titleAr: 'تغيير البطارية',
        icon: '🔋',
        price: '150-250 QAR',
        priceAr: '150-250 ريال',
        duration: '30 mins',
        durationAr: '30 دقيقة',
        description: 'Dead battery? We come to you',
        descriptionAr: 'بطارية فارغة؟ نأتي إليك',
        gradient: ['#FEF3C7', '#FCD34D'],
        priority: 1,
    },
    {
        id: 'diagnostic',
        title: 'Computer Diagnostic',
        titleAr: 'فحص كمبيوتر السيارة',
        icon: '💻',
        price: '100-150 QAR',
        priceAr: '100-150 ريال',
        duration: '20 mins',
        durationAr: '20 دقيقة',
        description: 'Check engine light? Get OBD scan',
        descriptionAr: 'لمبة المحرك مضيئة؟ فحص شامل',
        gradient: ['#E0E7FF', '#C7D2FE'],
        priority: 1,
    },
    {
        id: 'electrician',
        title: 'Auto Electrician',
        titleAr: 'كهربائي سيارات',
        icon: '⚡',
        price: '80-200 QAR',
        priceAr: '80-200 ريال',
        duration: '45 mins',
        durationAr: '45 دقيقة',
        description: 'Lights, wiring, sensors fixed',
        descriptionAr: 'إصلاح الأنوار والأسلاك والحساسات',
        gradient: ['#FEF9C3', '#FDE047'],
        priority: 1,
    },
    {
        id: 'wash',
        title: 'Home Car Wash',
        titleAr: 'غسيل السيارة في المنزل',
        icon: '🧼',
        price: '80-120 QAR',
        priceAr: '80-120 ريال',
        duration: '45 mins',
        durationAr: '45 دقيقة',
        description: 'Premium wash at your location',
        descriptionAr: 'غسيل متميز في موقعك',
        gradient: ['#DBEAFE', '#93C5FD'],
        priority: 2,
    },
    {
        id: 'oil',
        title: 'Oil Change',
        titleAr: 'تغيير الزيت',
        icon: '🛢️',
        price: '120-200 QAR',
        priceAr: '120-200 ريال',
        duration: '30 mins',
        durationAr: '30 دقيقة',
        description: 'Engine oil + filter replacement',
        descriptionAr: 'تغيير زيت المحرك + الفلتر',
        gradient: ['#FEE2E2', '#FCA5A5'],
        priority: 2,
    },
    {
        id: 'tire',
        title: 'Tire Service',
        titleAr: 'خدمة الإطارات',
        icon: '🛞',
        price: '50-150 QAR',
        priceAr: '50-150 ريال',
        duration: '20 mins',
        durationAr: '20 دقيقة',
        description: 'Flat tire? Emergency assistance',
        descriptionAr: 'إطار فارغ؟ مساعدة طارئة',
        gradient: ['#E0E7FF', '#A5B4FC'],
        priority: 1,
    },
    {
        id: 'ac',
        title: 'AC Gas Refill',
        titleAr: 'تعبئة غاز المكيف',
        icon: '❄️',
        price: '200-300 QAR',
        priceAr: '200-300 ريال',
        duration: '45 mins',
        durationAr: '45 دقيقة',
        description: 'Cool air in Qatar heat',
        descriptionAr: 'هواء بارد في حرارة قطر',
        gradient: ['#CCFBF1', '#5EEAD4'],
        priority: 2,
    },
    {
        id: 'breakdown',
        title: '🚨 Breakdown',
        titleAr: '🚨 عطل',
        icon: '🚨',
        price: 'Free Quote',
        priceAr: 'تقييم مجاني',
        duration: 'ASAP',
        durationAr: 'فورا',
        description: "Car won't start? We diagnose",
        descriptionAr: 'السيارة لا تعمل؟ نشخص المشكلة',
        gradient: ['#FEE2E2', '#EF4444'],
        priority: 1,
    },
];

export default function QuickServicesScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [selectedService, setSelectedService] = useState<string | null>(null);

    const handleServicePress = (service: QuickService) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Navigate to booking confirmation screen
        (navigation as any).navigate('QuickServiceBooking', {
            service: {
                type: service.id,
                name: service.title,
                icon: service.icon,
                priceRange: service.price,
                duration: service.duration,
            }
        });
    };

    const ServiceCard = ({ service }: { service: QuickService }) => {
        const isEmergency = service.id === 'breakdown';

        return (
            <TouchableOpacity
                onPress={() => handleServicePress(service)}
                activeOpacity={0.8}
                style={styles.cardWrapper}
            >
                <LinearGradient
                    colors={service.gradient as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.serviceCard, isEmergency && styles.emergencyCard]}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.serviceIcon}>{service.icon}</Text>
                        </View>
                        {isEmergency && (
                            <View style={styles.emergencyBadge}>
                                <Text style={styles.emergencyText}>PRIORITY</Text>
                            </View>
                        )}
                    </View>

                    <Text style={[styles.serviceTitle, isEmergency && styles.emergencyTitle]}>
                        {service.title}
                    </Text>
                    <Text style={styles.serviceDesc} numberOfLines={2}>
                        {service.description}
                    </Text>

                    <View style={styles.cardFooter}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>💰</Text>
                            <Text style={styles.infoText}>{service.price}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>⏱️</Text>
                            <Text style={styles.infoText}>{service.duration}</Text>
                        </View>
                    </View>

                    {isEmergency && (
                        <View style={styles.emergencyPulse} />
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>⚡ Quick Services</Text>
                        <Text style={styles.headerSubtitle}>
                            Fast, reliable automotive help
                        </Text>
                    </View>
                </View>

                {/* Emergency First */}
                <View style={styles.emergencySection}>
                    <Text style={styles.sectionTitle}>🚨 Emergency Service</Text>
                    <ServiceCard service={QUICK_SERVICES.find(s => s.id === 'breakdown')!} />
                </View>

                {/* Regular Services */}
                <View style={styles.servicesSection}>
                    <Text style={styles.sectionTitle}>🔧 Popular Services</Text>
                    <View style={styles.servicesGrid}>
                        {QUICK_SERVICES.filter(s => s.id !== 'breakdown').map((service) => (
                            <ServiceCard key={service.id} service={service} />
                        ))}
                    </View>
                </View>

                {/* How It Works */}
                <View style={styles.howItWorksSection}>
                    <Text style={styles.sectionTitle}>📋 How It Works</Text>
                    <View style={styles.stepCard}>
                        <View style={styles.stepRow}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>1</Text>
                            </View>
                            <Text style={styles.stepText}>Choose your service</Text>
                        </View>
                        <View style={styles.stepRow}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>2</Text>
                            </View>
                            <Text style={styles.stepText}>Confirm your location</Text>
                        </View>
                        <View style={styles.stepRow}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>3</Text>
                            </View>
                            <Text style={styles.stepText}>Professional arrives at your location</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.xl,
    },
    header: {
        padding: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSizes.xxxl,
        fontWeight: '800',
        color: Colors.primary,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: FontSizes.md,
        color: '#525252',
    },
    emergencySection: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    servicesSection: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.md,
    },
    servicesGrid: {
        gap: Spacing.md,
    },
    cardWrapper: {
        marginBottom: Spacing.sm,
    },
    serviceCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.md,
        position: 'relative',
        overflow: 'hidden',
    },
    emergencyCard: {
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    serviceIcon: {
        fontSize: 32,
    },
    emergencyBadge: {
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
    serviceTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    emergencyTitle: {
        color: '#DC2626',
    },
    serviceDesc: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginBottom: Spacing.md,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoLabel: {
        fontSize: 16,
    },
    infoText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    emergencyPulse: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#EF4444',
        opacity: 0.1,
    },
    howItWorksSection: {
        paddingHorizontal: Spacing.lg,
    },
    stepCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.sm,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    stepNumberText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    stepText: {
        flex: 1,
        fontSize: FontSizes.md,
        color: '#1a1a1a',
    },
});
