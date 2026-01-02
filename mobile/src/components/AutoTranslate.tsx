import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface AutoTranslateProps {
    text: string;
    sourceLanguage?: 'ar' | 'en' | 'auto';
    showButton?: boolean;
    onTranslationComplete?: (translatedText: string, targetLang: string) => void;
}

interface TranslationResult {
    translatedText: string;
    detectedLanguage: 'ar' | 'en';
    confidence: number;
}

// Common Arabic-English translations for auto parts domain
const COMMON_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
    // Greetings
    'hello': { ar: 'مرحبا', en: 'Hello' },
    'مرحبا': { ar: 'مرحبا', en: 'Hello' },
    'thank you': { ar: 'شكرا', en: 'Thank you' },
    'شكرا': { ar: 'شكرا', en: 'Thank you' },
    'please': { ar: 'من فضلك', en: 'Please' },

    // Driver messages
    "i'm outside": { ar: 'أنا في الخارج', en: "I'm outside" },
    'أنا في الخارج': { ar: 'أنا في الخارج', en: "I'm outside" },
    '5 minutes away': { ar: 'على بعد 5 دقائق', en: '5 minutes away' },
    'على بعد 5 دقائق': { ar: 'على بعد 5 دقائق', en: '5 minutes away' },
    'on my way': { ar: 'في الطريق', en: 'On my way' },
    'في الطريق': { ar: 'في الطريق', en: 'On my way' },
    'arrived': { ar: 'وصلت', en: 'Arrived' },
    'وصلت': { ar: 'وصلت', en: 'Arrived' },
    'delivered': { ar: 'تم التسليم', en: 'Delivered' },
    'تم التسليم': { ar: 'تم التسليم', en: 'Delivered' },

    // Auto parts
    'engine': { ar: 'محرك', en: 'Engine' },
    'محرك': { ar: 'محرك', en: 'Engine' },
    'brake': { ar: 'فرامل', en: 'Brake' },
    'فرامل': { ar: 'فرامل', en: 'Brake' },
    'tire': { ar: 'إطار', en: 'Tire' },
    'إطار': { ar: 'إطار', en: 'Tire' },
    'battery': { ar: 'بطارية', en: 'Battery' },
    'بطارية': { ar: 'بطارية', en: 'Battery' },
    'oil': { ar: 'زيت', en: 'Oil' },
    'زيت': { ar: 'زيت', en: 'Oil' },
    'filter': { ar: 'فلتر', en: 'Filter' },
    'فلتر': { ar: 'فلتر', en: 'Filter' },
    'headlight': { ar: 'مصباح أمامي', en: 'Headlight' },
    'مصباح أمامي': { ar: 'مصباح أمامي', en: 'Headlight' },
    'mirror': { ar: 'مرآة', en: 'Mirror' },
    'مرآة': { ar: 'مرآة', en: 'Mirror' },
    'bumper': { ar: 'صدام', en: 'Bumper' },
    'صدام': { ar: 'صدام', en: 'Bumper' },
    'radiator': { ar: 'رادياتير', en: 'Radiator' },
    'رادياتير': { ar: 'رادياتير', en: 'Radiator' },

    // Status
    'available': { ar: 'متوفر', en: 'Available' },
    'متوفر': { ar: 'متوفر', en: 'Available' },
    'not available': { ar: 'غير متوفر', en: 'Not available' },
    'غير متوفر': { ar: 'غير متوفر', en: 'Not available' },
    'new': { ar: 'جديد', en: 'New' },
    'جديد': { ar: 'جديد', en: 'New' },
    'used': { ar: 'مستعمل', en: 'Used' },
    'مستعمل': { ar: 'مستعمل', en: 'Used' },

    // Questions
    'where are you?': { ar: 'أين أنت؟', en: 'Where are you?' },
    'أين أنت؟': { ar: 'أين أنت؟', en: 'Where are you?' },
    'how much?': { ar: 'كم السعر؟', en: 'How much?' },
    'كم السعر؟': { ar: 'كم السعر؟', en: 'How much?' },
    'when?': { ar: 'متى؟', en: 'When?' },
    'متى؟': { ar: 'متى؟', en: 'When?' },
};

/**
 * Detect language from text
 */
const detectLanguage = (text: string): { language: 'ar' | 'en'; confidence: number } => {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F]/;
    const arabicChars = (text.match(arabicPattern) || []).length;
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) return { language: 'en', confidence: 0.5 };

    const arabicRatio = arabicChars / totalChars;

    if (arabicRatio > 0.3) {
        return { language: 'ar', confidence: Math.min(arabicRatio + 0.3, 1) };
    }
    return { language: 'en', confidence: Math.min((1 - arabicRatio) + 0.3, 1) };
};

/**
 * Translate text using local dictionary + pattern matching
 * In production, integrate with Google Translate API
 */
const translateText = async (text: string, targetLang: 'ar' | 'en'): Promise<TranslationResult> => {
    const lowerText = text.toLowerCase().trim();
    const { language: detectedLang, confidence } = detectLanguage(text);

    // If already in target language, return as is
    if (detectedLang === targetLang) {
        return {
            translatedText: text,
            detectedLanguage: detectedLang,
            confidence,
        };
    }

    // Check common translations
    const directTranslation = COMMON_TRANSLATIONS[lowerText];
    if (directTranslation) {
        return {
            translatedText: directTranslation[targetLang],
            detectedLanguage: detectedLang,
            confidence: 1,
        };
    }

    // Word-by-word translation for partial matches
    const words = text.split(/\s+/);
    const translatedWords = words.map(word => {
        const lowerWord = word.toLowerCase();
        const translation = COMMON_TRANSLATIONS[lowerWord];
        return translation ? translation[targetLang] : word;
    });

    const translatedText = translatedWords.join(' ');

    // If no translation found, add placeholder note
    if (translatedText === text) {
        return {
            translatedText: targetLang === 'ar'
                ? `[ترجمة غير متوفرة] ${text}`
                : `[Translation unavailable] ${text}`,
            detectedLanguage: detectedLang,
            confidence: 0.3,
        };
    }

    return {
        translatedText,
        detectedLanguage: detectedLang,
        confidence: 0.8,
    };
};

/**
 * Premium Auto-Translate Component
 * Shows original text with expandable translation
 */
export const AutoTranslate: React.FC<AutoTranslateProps> = ({
    text,
    sourceLanguage = 'auto',
    showButton = true,
    onTranslationComplete,
}) => {
    const [isTranslating, setIsTranslating] = useState(false);
    const [translation, setTranslation] = useState<TranslationResult | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [userPreferredLang, setUserPreferredLang] = useState<'ar' | 'en'>('en');

    const expandAnim = useState(new Animated.Value(0))[0];

    const handleTranslate = useCallback(async () => {
        if (isTranslating) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsTranslating(true);

        try {
            // Simulate API delay for smooth UX
            await new Promise(resolve => setTimeout(resolve, 300));

            const detected = detectLanguage(text);
            const targetLang = detected.language === 'ar' ? 'en' : 'ar';

            const result = await translateText(text, targetLang);
            setTranslation(result);
            setUserPreferredLang(targetLang);

            // Expand animation
            setIsExpanded(true);
            Animated.spring(expandAnim, {
                toValue: 1,
                friction: 8,
                tension: 100,
                useNativeDriver: false,
            }).start();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (onTranslationComplete) {
                onTranslationComplete(result.translatedText, targetLang);
            }
        } catch (error) {
            console.log('Translation error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsTranslating(false);
        }
    }, [text, isTranslating, onTranslationComplete]);

    const toggleExpand = () => {
        Haptics.selectionAsync();
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);

        Animated.spring(expandAnim, {
            toValue: newExpanded ? 1 : 0,
            friction: 8,
            tension: 100,
            useNativeDriver: false,
        }).start();
    };

    const translationHeight = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 60],
    });

    const detectedLang = detectLanguage(text);
    const languageLabel = detectedLang.language === 'ar' ? 'العربية' : 'English';

    return (
        <View style={styles.container}>
            {/* Original Text */}
            <Text style={[
                styles.originalText,
                detectedLang.language === 'ar' && styles.arabicText
            ]}>
                {text}
            </Text>

            {/* Translate Button */}
            {showButton && (
                <View style={styles.actions}>
                    {!translation ? (
                        <TouchableOpacity
                            style={styles.translateButton}
                            onPress={handleTranslate}
                            disabled={isTranslating}
                        >
                            {isTranslating ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <>
                                    <Text style={styles.translateIcon}>🌐</Text>
                                    <Text style={styles.translateText}>
                                        {detectedLang.language === 'ar' ? 'Translate' : 'ترجم'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.toggleButton}
                            onPress={toggleExpand}
                        >
                            <Text style={styles.toggleIcon}>
                                {isExpanded ? '▼' : '▶'}
                            </Text>
                            <Text style={styles.toggleText}>
                                {isExpanded ? 'Hide' : 'Show'} translation
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Language Badge */}
                    <View style={styles.languageBadge}>
                        <Text style={styles.languageText}>{languageLabel}</Text>
                    </View>
                </View>
            )}

            {/* Translation Result */}
            {translation && (
                <Animated.View style={[styles.translationContainer, { height: translationHeight }]}>
                    <View style={styles.translationContent}>
                        <Text style={[
                            styles.translatedText,
                            userPreferredLang === 'ar' && styles.arabicText
                        ]}>
                            {translation.translatedText}
                        </Text>
                        {translation.confidence < 0.7 && (
                            <Text style={styles.confidenceHint}>
                                (Auto-translated)
                            </Text>
                        )}
                    </View>
                </Animated.View>
            )}
        </View>
    );
};

/**
 * Inline translate button for chat messages
 */
export const TranslateButton: React.FC<{
    text: string;
    onTranslated: (translatedText: string) => void;
}> = ({ text, onTranslated }) => {
    const [isTranslating, setIsTranslating] = useState(false);

    const handlePress = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsTranslating(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const detected = detectLanguage(text);
            const targetLang = detected.language === 'ar' ? 'en' : 'ar';
            const result = await translateText(text, targetLang);
            onTranslated(result.translatedText);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.log('Translation error:', error);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <TouchableOpacity
            style={styles.inlineButton}
            onPress={handlePress}
            disabled={isTranslating}
        >
            {isTranslating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
                <Text style={styles.inlineIcon}>🌐</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
    },
    originalText: {
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        lineHeight: 22,
    },
    arabicText: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xs,
        gap: Spacing.sm,
    },
    translateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    translateIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    translateText: {
        fontSize: FontSizes.xs,
        color: Colors.primary,
        fontWeight: '500',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleIcon: {
        fontSize: 10,
        color: '#525252',
        marginRight: 4,
    },
    toggleText: {
        fontSize: FontSizes.xs,
        color: '#525252',
    },
    languageBadge: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: Spacing.xs,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    languageText: {
        fontSize: 10,
        color: '#737373',
        fontWeight: '500',
    },
    translationContainer: {
        overflow: 'hidden',
    },
    translationContent: {
        backgroundColor: Colors.primary + '10',
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xs,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    translatedText: {
        fontSize: FontSizes.sm,
        color: '#1a1a1a',
        lineHeight: 20,
    },
    confidenceHint: {
        fontSize: FontSizes.xs,
        color: '#737373',
        fontStyle: 'italic',
        marginTop: 2,
    },
    inlineButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inlineIcon: {
        fontSize: 14,
    },
});

export default AutoTranslate;
