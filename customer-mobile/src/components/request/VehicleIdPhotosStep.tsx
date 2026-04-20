import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import PhotoUploadSection from './PhotoUploadSection';

export default function VehicleIdPhotosStep({
    colors,
    t,
    isRTL,
    rtlTextAlign,
    carFrontImage,
    handlePickCarFrontImage,
    handleTakeCarFrontPhoto,
    setCarFrontImage,
    carRearImage,
    handlePickCarRearImage,
    handleTakeCarRearPhoto,
    setCarRearImage,
}: any) {
    return (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <View style={[styles.stepBadge, { backgroundColor: '#F59E0B15' }]}>
                    <Text style={[styles.stepNumber, { color: '#F59E0B' }]}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.vehicleIdPhotos')}
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.helpGaragesIdentify')}
                    </Text>
                </View>
            </View>

            <Text style={[styles.photoLabel, { color: colors.textSecondary, marginBottom: 8, textAlign: rtlTextAlign(isRTL) }]}>
                {t('newRequest.frontView')}
            </Text>
            <PhotoUploadSection
                images={carFrontImage ? [carFrontImage] : []}
                maxImages={1}
                onPickImage={handlePickCarFrontImage}
                onTakePhoto={handleTakeCarFrontPhoto}
                onRemoveImage={() => setCarFrontImage(null)}
                fullWidth
            />

            <Text style={[styles.photoLabel, { color: colors.textSecondary, marginBottom: 8, textAlign: rtlTextAlign(isRTL) }]}>
                {t('newRequest.rearView')}
            </Text>
            <PhotoUploadSection
                images={carRearImage ? [carRearImage] : []}
                maxImages={1}
                onPickImage={handlePickCarRearImage}
                onTakePhoto={handleTakeCarRearPhoto}
                onRemoveImage={() => setCarRearImage(null)}
                fullWidth
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    stepBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: { fontSize: FontSizes.md, fontWeight: '800' },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    sectionSubtitle: { fontSize: FontSizes.sm, marginTop: 2 },
    photoLabel: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: 8 },
});
