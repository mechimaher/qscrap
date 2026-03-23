import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import PhotoUploadSection from './PhotoUploadSection';

export default function RequestPhotosStep({
    colors,
    t,
    isRTL,
    rtlTextAlign,
    images,
    handlePickImage,
    handleTakePhoto,
    handleRemoveImage
}: any) {
    return (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <View style={[styles.stepBadge, { backgroundColor: '#22C55E15' }]}>
                    <Text style={[styles.stepNumber, { color: '#22C55E' }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.photosOptional')}
                    </Text>
                    <Text
                        style={[
                            styles.sectionSubtitle,
                            { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }
                        ]}
                    >
                        {t('newRequest.addUpTo5')}
                    </Text>
                </View>
            </View>

            <PhotoUploadSection
                images={images}
                maxImages={5}
                onPickImage={handlePickImage}
                onTakePhoto={handleTakePhoto}
                onRemoveImage={handleRemoveImage}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md
    },
    stepBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    stepNumber: { fontSize: FontSizes.md, fontWeight: '800' },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    sectionSubtitle: { fontSize: FontSizes.sm, marginTop: 2 }
});
