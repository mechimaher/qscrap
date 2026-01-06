import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../constants/theme';

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

const TOAST_ICONS: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
};

const TOAST_COLORS: Record<ToastType, string> = {
    success: Colors.success,
    error: Colors.danger,
    warning: Colors.warning,
    info: Colors.secondary,
};

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
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setToast(config);
        setVisible(true);

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
                        style={[styles.toast, { backgroundColor: TOAST_COLORS[toast.type] }, Shadows.lg]}
                    >
                        <View style={styles.iconContainer}>
                            <Text style={styles.icon}>{TOAST_ICONS[toast.type]}</Text>
                        </View>
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
                            <Text style={styles.closeIcon}>×</Text>
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
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    icon: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '700',
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
        marginLeft: Spacing.md,
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
        marginLeft: Spacing.sm,
        padding: Spacing.xs,
    },
    closeIcon: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '300',
    },
});

export default ToastProvider;
