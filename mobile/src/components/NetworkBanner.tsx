import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts';
import { Spacing, FontSize, BorderRadius } from '../constants';

interface NetworkBannerProps {
    isConnected: boolean;
    onRetry?: () => void;
}

/**
 * Animated network status banner that shows when offline.
 * Slides in from top and provides retry option.
 */
export const NetworkBanner: React.FC<NetworkBannerProps> = ({
    isConnected,
    onRetry,
}) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-60)).current;
    const [wasOffline, setWasOffline] = React.useState(false);

    useEffect(() => {
        if (!isConnected) {
            setWasOffline(true);
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();
        } else if (wasOffline) {
            // Show "back online" briefly, then hide
            setTimeout(() => {
                Animated.timing(translateY, {
                    toValue: -60,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    setWasOffline(false);
                });
            }, 2000);
        }
    }, [isConnected, wasOffline, translateY]);

    if (isConnected && !wasOffline) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                    backgroundColor: isConnected ? colors.success : colors.danger,
                    transform: [{ translateY }],
                },
            ]}
        >
            <View style={styles.content}>
                <Ionicons
                    name={isConnected ? 'checkmark-circle' : 'cloud-offline'}
                    size={20}
                    color="#fff"
                />
                <Text style={styles.text}>
                    {isConnected ? 'Back online' : 'No internet connection'}
                </Text>
                {!isConnected && onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                        <Ionicons name="refresh" size={16} color="#fff" />
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    text: {
        color: '#fff',
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginLeft: Spacing.sm,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: Spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    retryText: {
        color: '#fff',
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginLeft: Spacing.xs,
    },
});

export default NetworkBanner;
