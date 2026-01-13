/**
 * RTL (Right-to-Left) Utility Helpers
 * Provides direction-aware styling for Arabic language support
 */

import { I18nManager, StyleSheet, ViewStyle, TextStyle } from 'react-native';

/**
 * Check if app is in RTL mode
 */
export const isRTL = I18nManager.isRTL;

/**
 * Get the flex direction for a row based on RTL setting
 * In RTL mode, rows should be reversed
 */
export const rtlFlexRow = (): ViewStyle => ({
    flexDirection: isRTL ? 'row-reverse' : 'row',
});

/**
 * Get text alignment based on RTL setting
 */
export const rtlTextAlign = (): TextStyle => ({
    textAlign: isRTL ? 'right' : 'left',
});

/**
 * Swap left/right margins/padding based on RTL
 */
export const rtlMargin = (left: number, right: number): ViewStyle => ({
    marginLeft: isRTL ? right : left,
    marginRight: isRTL ? left : right,
});

export const rtlPadding = (left: number, right: number): ViewStyle => ({
    paddingLeft: isRTL ? right : left,
    paddingRight: isRTL ? left : right,
});

/**
 * Get position (left/right) based on RTL setting
 */
export const rtlPosition = (left?: number, right?: number): ViewStyle => {
    if (left !== undefined && right === undefined) {
        return isRTL ? { right: left } : { left };
    }
    if (right !== undefined && left === undefined) {
        return isRTL ? { left: right } : { right };
    }
    return {};
};

/**
 * Icon/arrow direction helper
 * Returns appropriate icon name or rotation for RTL
 */
export const rtlIcon = (ltrIcon: string, rtlIcon: string): string => {
    return isRTL ? rtlIcon : ltrIcon;
};

/**
 * Arrow/chevron direction
 */
export const rtlArrow = (): string => {
    return isRTL ? '←' : '→';
};

export const rtlChevron = (): string => {
    return isRTL ? '‹' : '›';
};

/**
 * Transform styles for RTL layout
 * Swaps left/right properties automatically
 */
export const rtlTransform = (styles: ViewStyle): ViewStyle => {
    if (!isRTL) return styles;

    const transformed: ViewStyle = { ...styles };

    // Swap margins
    if ('marginLeft' in styles || 'marginRight' in styles) {
        transformed.marginLeft = styles.marginRight;
        transformed.marginRight = styles.marginLeft;
    }

    // Swap padding
    if ('paddingLeft' in styles || 'paddingRight' in styles) {
        transformed.paddingLeft = styles.paddingRight;
        transformed.paddingRight = styles.paddingLeft;
    }

    // Swap positions
    if ('left' in styles || 'right' in styles) {
        transformed.left = styles.right;
        transformed.right = styles.left;
    }

    // Swap border radius
    if ('borderTopLeftRadius' in styles || 'borderTopRightRadius' in styles) {
        transformed.borderTopLeftRadius = styles.borderTopRightRadius;
        transformed.borderTopRightRadius = styles.borderTopLeftRadius;
    }
    if ('borderBottomLeftRadius' in styles || 'borderBottomRightRadius' in styles) {
        transformed.borderBottomLeftRadius = styles.borderBottomRightRadius;
        transformed.borderBottomRightRadius = styles.borderBottomLeftRadius;
    }

    return transformed;
};

/**
 * Create RTL-aware StyleSheet
 * Automatically applies RTL transformations to styles
 */
export const createRTLStyles = <T extends StyleSheet.NamedStyles<T>>(
    styles: T
): T => {
    if (!isRTL) return styles;

    const rtlStyles = {} as any;
    for (const key in styles) {
        rtlStyles[key] = rtlTransform(styles[key] as ViewStyle);
    }
    return rtlStyles;
};

export default {
    isRTL,
    rtlFlexRow,
    rtlTextAlign,
    rtlMargin,
    rtlPadding,
    rtlPosition,
    rtlIcon,
    rtlArrow,
    rtlChevron,
    rtlTransform,
    createRTLStyles,
};
