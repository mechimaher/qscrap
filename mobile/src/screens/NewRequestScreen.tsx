import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
// QScrap New Request Screen - 2026 Premium Refactored Edition
// No VIN - Uses Saved Vehicles - Stepped Wizard - Modern UI

import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { useToast } from '../components/Toast';

import VehicleSelectionStep from '../components/request/VehicleSelectionStep';
import PartDetailsStep from '../components/request/PartDetailsStep';
import RequestPhotosStep from '../components/request/RequestPhotosStep';
import VehicleIdPhotosStep from '../components/request/VehicleIdPhotosStep';




import { PART_CATEGORIES, PART_SUBCATEGORIES } from '../constants/categoryData';

import { compressImage } from '../utils/imageCompressor';
import { useRequestImages } from '../hooks/useRequestImages';
import { useSubmitRequest } from '../hooks/useSubmitRequest';
import { useRequestForm } from '../hooks/useRequestForm';


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type NewRequestRouteProp = RouteProp<RootStackParamList, 'NewRequest'>;

// Prefill data structure for Order Again functionality
interface PrefillData {
    carMake?: string;
    carModel?: string;
    carYear?: number;
    partDescription?: string;
    partCategory?: string;
    partSubCategory?: string;
    imageUrls?: string[]; // Previous order images to reference
}


export default function NewRequestScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<NewRequestRouteProp>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    // Condition options with translations
    const CONDITION_OPTIONS = [
        { value: 'any', label: t('newRequest.anyCondition'), icon: 'sync-outline', color: '#6B7280' },
        { value: 'new', label: t('newRequest.newOnly'), icon: 'sparkles', color: '#22C55E' },
        { value: 'used', label: t('newRequest.usedOnly'), icon: 'leaf-outline', color: '#F59E0B' },
    ];


    const prefillData = route.params?.prefill;
    const initialDeliveryLocation = route.params?.deliveryLocation;

    const {
        selectedVehicle,
        setSelectedVehicle,
        handleVehiclesLoaded,
        partCategory,
        setPartCategory,
        partSubCategory,
        setPartSubCategory,
        availableSubCategories,
        partDescription,
        setPartDescription,
        partNumber,
        setPartNumber,
        condition,
        setCondition,
        quantity,
        setQuantity,
        side,
        setSide,
        deliveryLocation,
    } = useRequestForm({ prefillData, initialDeliveryLocation, t, toast });

    const {
        images,
        carFrontImage,
        carRearImage,
        setCarFrontImage,
        setCarRearImage,
        handlePickImage,
        handleTakePhoto,
        handleRemoveImage,
        handlePickCarFrontImage,
        handlePickCarRearImage,
        handleTakeCarFrontPhoto,
        handleTakeCarRearPhoto,
    } = useRequestImages(t, toast);

    const { isSubmitting, handleSubmit } = useSubmitRequest({
        selectedVehicle,
        partDescription,
        quantity,
        side,
        partCategory,
        partSubCategory,
        partNumber,
        condition,
        deliveryLocation,
        images,
        carFrontImage,
        carRearImage,
        t,
        toast,
        navigation,
    });

    const handleVehicleSelect = (vehicle: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedVehicle(vehicle);
    };

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // VIN is now required for submission
    const hasVIN = selectedVehicle?.vin_number && selectedVehicle.vin_number.length === 17;
    const canSubmit = selectedVehicle && hasVIN && partDescription.trim().length > 10;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Premium Header */}
                <Animated.View
                    style={[
                        styles.header,
                        { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) },
                        { opacity: fadeAnim },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.closeButton}
                    >
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('newRequest.title')}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            {t('newRequest.subtitle')}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </Animated.View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View
                        style={{
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }}
                    >
                        {/* Pro Tip Header Banner - Just-in-time guidance */}
                        <Animated.View style={[styles.proTipBanner, { backgroundColor: '#FFF8E1', flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.proTipIcon, isRTL && { marginRight: 0, marginLeft: Spacing.md }]}></Text>
                            <View style={styles.proTipContent}>
                                <Text style={[styles.proTipTitle, { textAlign: rtlTextAlign(isRTL) }]}>{t('newRequest.proTipTitle')}</Text>
                                <Text style={[styles.proTipText, { textAlign: rtlTextAlign(isRTL) }]}>
                                    {t('newRequest.proTipText')}
                                </Text>
                            </View>
                        </Animated.View>


                        <VehicleSelectionStep
                            colors={colors}
                            t={t}
                            isRTL={isRTL}
                            rtlFlexDirection={rtlFlexDirection}
                            rtlTextAlign={rtlTextAlign}
                            selectedVehicle={selectedVehicle}
                            handleVehicleSelect={handleVehicleSelect}
                            handleVehiclesLoaded={handleVehiclesLoaded}
                            navigation={navigation}
                        />

                        <PartDetailsStep
                            colors={colors}
                            t={t}
                            isRTL={isRTL}
                            rtlFlexDirection={rtlFlexDirection}
                            rtlTextAlign={rtlTextAlign}
                            partCategory={partCategory}
                            setPartCategory={setPartCategory}
                            availableSubCategories={availableSubCategories}
                            partSubCategory={partSubCategory}
                            setPartSubCategory={setPartSubCategory}
                            partDescription={partDescription}
                            setPartDescription={setPartDescription}
                            quantity={quantity}
                            setQuantity={setQuantity}
                            side={side}
                            setSide={setSide}
                            partNumber={partNumber}
                            setPartNumber={setPartNumber}
                            condition={condition}
                            setCondition={setCondition}
                            CONDITION_OPTIONS={CONDITION_OPTIONS}
                        />

                        <RequestPhotosStep
                            colors={colors}
                            t={t}
                            isRTL={isRTL}
                            rtlTextAlign={rtlTextAlign}
                            images={images}
                            handlePickImage={handlePickImage}
                            handleTakePhoto={handleTakePhoto}
                            handleRemoveImage={handleRemoveImage}
                        />

                        <VehicleIdPhotosStep
                            colors={colors}
                            t={t}
                            isRTL={isRTL}
                            rtlTextAlign={rtlTextAlign}
                            carFrontImage={carFrontImage}
                            handlePickCarFrontImage={handlePickCarFrontImage}
                            handleTakeCarFrontPhoto={handleTakeCarFrontPhoto}
                            setCarFrontImage={setCarFrontImage}
                            carRearImage={carRearImage}
                            handlePickCarRearImage={handlePickCarRearImage}
                            handleTakeCarRearPhoto={handleTakeCarRearPhoto}
                            setCarRearImage={setCarRearImage}
                        />

                        <View style={{ height: 120 }} />
                    </Animated.View>
                </ScrollView>

                {/* Submit Button - Fixed at bottom */}
                <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        style={[
                            styles.submitButton,
                            !canSubmit && styles.submitButtonDisabled,
                        ]}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={
                                canSubmit && !isSubmitting
                                    ? [Colors.primary, '#B31D4A']
                                    : ['#9CA3AF', '#6B7280']
                            }
                            style={[styles.submitGradient, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.submitText}>{t('newRequest.submitRequest')}</Text>
                                    <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                    {!canSubmit && (
                        <Text style={[styles.footerHint, { color: colors.textMuted }]}>
                            {!selectedVehicle
                                ? t('newRequest.footerHint.selectVehicle')
                                : !hasVIN
                                    ? t('newRequest.footerHint.vinRequired')
                                    : t('newRequest.footerHint.description')}
                        </Text>
                    )}
                </View>
            </KeyboardAvoidingView >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIcon: { fontSize: 24 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    headerSubtitle: { fontSize: FontSizes.xs, marginTop: 2 },
    scrollView: { flex: 1 },
    scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    // Pro Tip Banner
    proTipBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(201, 162, 39, 0.3)',
        gap: Spacing.sm,
    },
    proTipIcon: { fontSize: 22 },
    proTipContent: { flex: 1 },
    proTipTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: '#92400E', marginBottom: 2, textAlign: 'left' }, // rtlTextAlign applied inline
    proTipText: { fontSize: FontSizes.sm, color: '#78350F', lineHeight: 18, textAlign: 'left' }, // rtlTextAlign applied inline
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
        borderTopWidth: 1,
    },
    submitButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    submitText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    submitIcon: {
        color: '#fff',
        fontSize: FontSizes.xl,
    },
    footerHint: {
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
});
