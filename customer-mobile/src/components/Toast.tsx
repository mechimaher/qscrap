import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastContextType {
    show: (config: ToastConfig) => void;
    hide: () => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Toast notification system with multiple types and animations.
 * Provides success, error, warning, and info toasts.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const [visible, setVisible] = useState(false);
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const insets = useSafeAreaInsets();

    const show = useCallback((config: ToastConfig) => {
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setToast(config);
        setVisible(true);

        // Premium Tactile Feedback
        if (config.type === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (config.type === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (config.type === 'warning') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
            Haptics.selectionAsync();
        }

        // Animate in
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto hide
        const duration = config.duration || 4000;
        timeoutRef.current = setTimeout(() => {
            hide();
        }, duration);
    }, [translateY, opacity]);

    const hide = useCallback(() => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setToast(null);
        });
    }, [translateY, opacity]);

    const success = useCallback((title: string, message?: string) => {
        show({ type: 'success', title, message });
    }, [show]);

    const error = useCallback((title: string, message?: string) => {
        show({ type: 'error', title, message });
    }, [show]);

    const warning = useCallback((title: string, message?: string) => {
        show({ type: 'warning', title, message });
    }, [show]);

    const info = useCallback((title: string, message?: string) => {
        show({ type: 'info', title, message });
    }, [show]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const getToastStyles = () => {
        if (!toast) return {};

        switch (toast.type) {
            case 'success':
                return { backgroundColor: Colors.dark.success };
            case 'error':
                return { backgroundColor: Colors.dark.danger };
            case 'warning':
                return { backgroundColor: Colors.dark.warning };
            case 'info':
                return { backgroundColor: Colors.dark.info };
            default:
                return { backgroundColor: Colors.dark.primary };
        }
    };

    const getIcon = (): keyof typeof Ionicons.glyphMap => {
        if (!toast) return 'information-circle';
        switch (toast.type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'close-circle';
            case 'warning':
                return 'warning';
            case 'info':
                return 'information-circle';
            default:
                return 'information-circle';
        }
    };

    return (
        <ToastContext.Provider value={{ show, hide, success, error, warning, info }}>
            {children}
            {visible && toast && (
                <Animated.View
                    style={[
                        styles.container,
                        { top: insets.top + Spacing.md },
                        { transform: [{ translateY }], opacity },
                    ]}
                >
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={hide}
                        style={[styles.toast, getToastStyles(), Shadows.lg]}
                    >
                        <Ionicons name={getIcon()} size={24} color="#fff" style={styles.icon} />
                        <View style={styles.textContainer}>
                            <Text style={styles.title}>{toast.title}</Text>
                            {toast.message && (
                                <Text style={styles.message}>{toast.message}</Text>
                            )}
                        </View>
                        {toast.action && (
                            <TouchableOpacity
                                onPress={() => {
                                    toast.action?.onPress();
                                    hide();
                                }}
                                style={styles.actionButton}
                            >
                                <Text style={styles.actionText}>{toast.action.label}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={hide} style={styles.closeButton}>
                            <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Standalone Toast component for direct usage
export const Toast: React.FC<ToastConfig & { onDismiss?: () => void }> = ({
    type,
    title,
    message,
    onDismiss,
}) => {
    const getStyles = () => {
        switch (type) {
            case 'success':
                return { backgroundColor: Colors.dark.success };
            case 'error':
                return { backgroundColor: Colors.dark.danger };
            case 'warning':
                return { backgroundColor: Colors.dark.warning };
            case 'info':
                return { backgroundColor: Colors.dark.info };
            default:
                return { backgroundColor: Colors.dark.primary };
        }
    };

    const getIcon = (): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'close-circle';
            case 'warning':
                return 'warning';
            case 'info':
                return 'information-circle';
            default:
                return 'information-circle';
        }
    };

    return (
        <View style={[styles.toast, getStyles(), Shadows.lg]}>
            <Ionicons name={getIcon()} size={24} color="#fff" style={styles.icon} />
            <View style={styles.textContainer}>
                <Text style={styles.title}>{title}</Text>
                {message && <Text style={styles.message}>{message}</Text>}
            </View>
            {onDismiss && (
                <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 9999,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        minHeight: 56,
    },
    icon: {
        marginEnd: Spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    message: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: FontSize.sm,
        marginTop: 2,
    },
    actionButton: {
        marginStart: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: BorderRadius.sm,
    },
    actionText: {
        color: '#fff',
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    closeButton: {
        marginStart: Spacing.sm,
        padding: Spacing.xs,
    },
});

export default Toast;
