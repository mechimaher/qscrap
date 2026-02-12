import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection } from '../utils/rtl';
import { Colors, Spacing } from '../constants';

const PRIVACY_URL = 'https://qscrap.qa/privacy.html';

/**
 * Privacy Policy Screen
 * Loads live privacy policy from website — single source of truth.
 * Updates instantly without app release.
 */
export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>{t('settings.privacyPolicy')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {hasError ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
                        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                            {t('errors.networkError')}
                        </Text>
                        <TouchableOpacity
                            style={[styles.retryButton, { backgroundColor: Colors.primary }]}
                            onPress={() => { setHasError(false); setIsLoading(true); }}
                        >
                            <Text style={styles.retryText}>{t('common.retry')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <WebView
                        source={{ uri: PRIVACY_URL }}
                        onLoadStart={() => setIsLoading(true)}
                        onLoadEnd={() => setIsLoading(false)}
                        onError={() => { setIsLoading(false); setHasError(true); }}
                        style={{ flex: 1, backgroundColor: colors.background }}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {isLoading && !hasError && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    backButton: { padding: 4, width: 40 },
    title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
    content: { flex: 1, position: 'relative' },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.85)',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
