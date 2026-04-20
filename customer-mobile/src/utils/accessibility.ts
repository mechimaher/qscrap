/**
 * Accessibility Utilities — WCAG 2.1 AA Compliance
 * Centralized accessibility helpers for consistent implementation.
 */

import { AccessibilityRole } from 'react-native';

/**
 * Common accessibility props interface
 */
export interface A11yProps {
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: {
        disabled?: boolean;
        selected?: boolean;
        checked?: boolean | 'mixed';
        busy?: boolean;
        expanded?: boolean;
    };
}

/**
 * Generate accessibility props for buttons
 */
export function buttonA11y(
    label: string,
    options?: {
        hint?: string;
        disabled?: boolean;
        selected?: boolean;
    }
): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'button',
        accessibilityLabel: label,
        accessibilityHint: options?.hint,
        accessibilityState: {
            disabled: options?.disabled,
            selected: options?.selected,
        },
    };
}

/**
 * Generate accessibility props for links
 */
export function linkA11y(label: string, hint?: string): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'link',
        accessibilityLabel: label,
        accessibilityHint: hint,
    };
}

/**
 * Generate accessibility props for headers
 */
export function headerA11y(label: string): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'header',
        accessibilityLabel: label,
    };
}

/**
 * Generate accessibility props for images
 */
export function imageA11y(description: string): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel: description,
    };
}

/**
 * Generate accessibility props for text inputs
 */
export function inputA11y(
    label: string,
    options?: {
        hint?: string;
        disabled?: boolean;
    }
): A11yProps {
    return {
        accessible: true,
        accessibilityLabel: label,
        accessibilityHint: options?.hint,
        accessibilityState: {
            disabled: options?.disabled,
        },
    };
}

/**
 * Generate accessibility props for checkboxes/switches
 */
export function toggleA11y(
    label: string,
    checked: boolean,
    hint?: string
): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'switch',
        accessibilityLabel: label,
        accessibilityHint: hint,
        accessibilityState: {
            checked,
        },
    };
}

/**
 * Generate accessibility props for progress indicators
 */
export function progressA11y(
    label: string,
    busy: boolean = true
): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'progressbar',
        accessibilityLabel: label,
        accessibilityState: {
            busy,
        },
    };
}

/**
 * Generate accessibility props for alerts/notifications
 */
export function alertA11y(message: string): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'alert',
        accessibilityLabel: message,
    };
}

/**
 * Generate accessibility props for tabs
 */
export function tabA11y(
    label: string,
    selected: boolean,
    index: number,
    total: number
): A11yProps {
    return {
        accessible: true,
        accessibilityRole: 'tab',
        accessibilityLabel: `${label}, tab ${index + 1} of ${total}`,
        accessibilityState: {
            selected,
        },
    };
}

/**
 * Generate accessibility props for list items
 */
export function listItemA11y(
    label: string,
    index?: number,
    total?: number
): A11yProps {
    const positionLabel =
        index !== undefined && total !== undefined
            ? `, item ${index + 1} of ${total}`
            : '';
    return {
        accessible: true,
        accessibilityLabel: `${label}${positionLabel}`,
    };
}

export default {
    buttonA11y,
    linkA11y,
    headerA11y,
    imageA11y,
    inputA11y,
    toggleA11y,
    progressA11y,
    alertA11y,
    tabA11y,
    listItemA11y,
};
