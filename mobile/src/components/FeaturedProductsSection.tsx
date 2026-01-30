/**
 * Featured Products Section
 * 
 * Premium horizontal carousel showcasing featured products from Enterprise garages.
 * Displays on the customer home screen to drive B2B value and showcase premium inventory.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, Product } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { API_BASE_URL, UPLOAD_BASE_URL } from '../config/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;
const CARD_MARGIN = Spacing.sm;

interface FeaturedProductsSectionProps {
    onProductPress?: (product: Product) => void;
}

import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

export default function FeaturedProductsSection({ onProductPress }: FeaturedProductsSectionProps) {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            setError(false);
            const data = await api.getFeaturedProducts(6);
            setProducts(data.products || []);
        } catch (err) {
            console.log('[FeaturedProducts] Failed to load:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    // Don't render section if no products or error
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
            </View>
        );
    }

    if (error || products.length === 0) {
        return null; // Hide section if no featured products
    }

    const getImageUrl = (url: string) => {
        if (!url) return 'https://placehold.co/300x200?text=No+Image';
        return url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
    };

    const renderProduct = ({ item }: { item: Product }) => (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface }]}
            activeOpacity={0.9}
            onPress={() => onProductPress?.(item)}
        >
            {/* Product Image */}
            <Image
                source={{ uri: getImageUrl(item.image_urls?.[0]) }}
                style={[styles.image, { backgroundColor: colors.border }]}
                resizeMode="cover"
            />

            {/* Featured Badge */}
            {item.is_featured && (
                <LinearGradient
                    colors={['#eab308', '#f59e0b']}
                    style={[styles.featuredBadge, isRTL ? { left: 'auto', right: 0, borderTopLeftRadius: 0, borderBottomRightRadius: 0, borderTopRightRadius: BorderRadius.lg, borderBottomLeftRadius: BorderRadius.lg } : {}]}
                >
                    <Text style={styles.featuredBadgeText}>⭐ {t('home.featured')}</Text>
                </LinearGradient>
            )}

            {/* Enterprise Badge */}
            {item.plan_code === 'enterprise' && (
                <View style={[styles.enterpriseBadge, isRTL ? { right: 'auto', left: Spacing.sm } : {}]}>
                    <Text style={styles.enterpriseBadgeText}>{t('home.enterprise')}</Text>
                </View>
            )}

            {/* Product Info */}
            <View style={styles.info}>
                <Text style={[styles.title, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.garage, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={1}>{item.garage_name}</Text>

                <View style={[styles.footer, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Text style={styles.price}>{item.price} {t('common.qar')}</Text>
                    <View style={[styles.conditionBadge, { backgroundColor: colors.border }, item.condition === 'new' && styles.conditionNew]}>
                        <Text style={[styles.conditionText, { color: colors.textSecondary }, item.condition === 'new' && styles.conditionTextNew]}>
                            {t(`common.condition.${item.condition}`)}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>🏆 {t('home.featuredParts')}</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>{t('home.premiumGarages')}</Text>
            </View>

            <FlatList
                data={products}
                renderItem={renderProduct}
                keyExtractor={(item) => item.product_id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
                decelerationRate="fast"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.xl,
    },
    loadingContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    sectionSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    listContent: {
        paddingHorizontal: Spacing.lg,
    },
    card: {
        width: CARD_WIDTH,
        marginRight: CARD_MARGIN * 2,
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    image: {
        width: '100%',
        height: 150,
        backgroundColor: '#f0f0f0',
    },
    featuredBadge: {
        position: 'absolute',
        top: Spacing.sm,
        left: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    featuredBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#000',
    },
    enterpriseBadge: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    enterpriseBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#eab308',
        letterSpacing: 0.5,
    },
    info: {
        padding: Spacing.md,
    },
    title: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    garage: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: Colors.primary,
    },
    conditionBadge: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    conditionNew: {
        backgroundColor: '#dcfce7',
    },
    conditionText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
    },
    conditionTextNew: {
        color: '#16a34a',
    },
});
