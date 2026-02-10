/**
 * RTL (Right-to-Left) Utilities for Arabic Language Support
 * Provides helper functions for RTL-aware styling
 */

import { ViewStyle, TextStyle, FlexStyle } from 'react-native';

/**
 * Get the flex direction for row layouts
 * Flips from 'row' to 'row-reverse' for RTL languages
 */
export const rtlFlexDirection = (isRTL: boolean): FlexStyle['flexDirection'] =>
    isRTL ? 'row-reverse' : 'row';

/**
 * Get the text alignment
 * Flips from 'left' to 'right' for RTL languages
 */
export const rtlTextAlign = (isRTL: boolean): TextStyle['textAlign'] =>
    isRTL ? 'right' : 'left';

/**
 * Get combined text style with alignment AND writing direction
 * Use on text containers to ensure full LTR restoration after AR→EN switch
 */
export const rtlTextStyle = (isRTL: boolean): Pick<TextStyle, 'textAlign' | 'writingDirection'> => ({
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
});

/**
 * Get the opposite text alignment (for end-aligned text)
 */
export const rtlTextAlignEnd = (isRTL: boolean): TextStyle['textAlign'] =>
    isRTL ? 'left' : 'right';

/**
 * Get RTL-aware horizontal margin
 * Swaps marginLeft and marginRight for RTL
 */
export const rtlMarginHorizontal = (
    isRTL: boolean,
    start: number,
    end: number = 0
): Pick<ViewStyle, 'marginLeft' | 'marginRight'> =>
    isRTL
        ? { marginLeft: end, marginRight: start }
        : { marginLeft: start, marginRight: end };

/**
 * Get RTL-aware horizontal padding
 * Swaps paddingLeft and paddingRight for RTL
 */
export const rtlPaddingHorizontal = (
    isRTL: boolean,
    start: number,
    end: number = 0
): Pick<ViewStyle, 'paddingLeft' | 'paddingRight'> =>
    isRTL
        ? { paddingLeft: end, paddingRight: start }
        : { paddingLeft: start, paddingRight: end };

/**
 * Get RTL-aware absolute positioning
 * Swaps left and right for RTL
 */
export const rtlPosition = (
    isRTL: boolean,
    start: number
): Pick<ViewStyle, 'left' | 'right'> =>
    isRTL
        ? { right: start, left: undefined }
        : { left: start, right: undefined };

/**
 * Get RTL-aware icon/chevron character
 * Returns appropriate directional character based on language
 */
export const rtlChevron = (isRTL: boolean, type: 'forward' | 'back' = 'forward'): string => {
    if (type === 'forward') {
        return isRTL ? '‹' : '›';
    }
    return isRTL ? '›' : '‹';
};

/**
 * Get RTL-aware arrow character
 */
export const rtlArrow = (isRTL: boolean, type: 'forward' | 'back' = 'forward'): string => {
    if (type === 'forward') {
        return isRTL ? '←' : '→';
    }
    return isRTL ? '→' : '←';
};

/**
 * Get justify content for align items at start/end
 */
export const rtlJustifyContent = (
    isRTL: boolean,
    position: 'start' | 'end'
): FlexStyle['justifyContent'] => {
    if (position === 'start') {
        return isRTL ? 'flex-end' : 'flex-start';
    }
    return isRTL ? 'flex-start' : 'flex-end';
};

/**
 * Get align self for start/end alignment
 */
export const rtlAlignSelf = (
    isRTL: boolean,
    position: 'start' | 'end'
): FlexStyle['alignSelf'] => {
    if (position === 'start') {
        return isRTL ? 'flex-end' : 'flex-start';
    }
    return isRTL ? 'flex-start' : 'flex-end';
};

/**
 * Transform rotation for RTL (flip horizontally)
 * Useful for icons that should mirror in RTL
 */
export const rtlScaleX = (isRTL: boolean): { transform: [{ scaleX: number }] } => ({
    transform: [{ scaleX: isRTL ? -1 : 1 }]
});

/**
 * Create RTL-aware styles object
 * Takes a style object and returns RTL-adjusted version
 */
export const rtlStyle = <T extends ViewStyle | TextStyle>(
    isRTL: boolean,
    ltrStyle: T,
    rtlOverrides?: Partial<T>
): T => {
    if (!isRTL) return ltrStyle;

    const style: any = { ...ltrStyle };

    // Auto-flip flexDirection if it's 'row'
    if (style.flexDirection === 'row') {
        style.flexDirection = 'row-reverse';
    }

    // Auto-flip textAlign if it's 'left'
    if (style.textAlign === 'left') {
        style.textAlign = 'right';
    } else if (style.textAlign === 'right') {
        style.textAlign = 'left';
    }

    // Swap margins
    if (style.marginLeft !== undefined && style.marginRight === undefined) {
        style.marginRight = style.marginLeft;
        delete style.marginLeft;
    } else if (style.marginRight !== undefined && style.marginLeft === undefined) {
        style.marginLeft = style.marginRight;
        delete style.marginRight;
    }

    // Swap paddings
    if (style.paddingLeft !== undefined && style.paddingRight === undefined) {
        style.paddingRight = style.paddingLeft;
        delete style.paddingLeft;
    } else if (style.paddingRight !== undefined && style.paddingLeft === undefined) {
        style.paddingLeft = style.paddingRight;
        delete style.paddingRight;
    }

    // Apply any explicit RTL overrides
    if (rtlOverrides) {
        Object.assign(style, rtlOverrides);
    }

    return style as T;
};

/**
 * Get writing direction style
 */
export const rtlWritingDirection = (isRTL: boolean): { writingDirection: 'ltr' | 'rtl' } => ({
    writingDirection: isRTL ? 'rtl' : 'ltr'
});

/**
 * Constants for RTL-aware styling
 */
export const RTL = {
    // Use in flexDirection
    row: (isRTL: boolean) => (isRTL ? 'row-reverse' : 'row') as FlexStyle['flexDirection'],

    // Use in textAlign
    start: (isRTL: boolean) => (isRTL ? 'right' : 'left') as TextStyle['textAlign'],
    end: (isRTL: boolean) => (isRTL ? 'left' : 'right') as TextStyle['textAlign'],
};
