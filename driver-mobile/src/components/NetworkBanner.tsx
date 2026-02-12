// QScrap Driver App - Network Status Banner
// Shows a subtle warning banner when the device loses internet connectivity

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useI18n } from '../i18n';

export function NetworkBanner() {
    const { t } = useI18n();
    const [isConnected, setIsConnected] = useState(true);
    const slideAnim = useRef(new Animated.Value(-50)).current;

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const connected = state.isConnected ?? true;
            setIsConnected(connected);

            Animated.timing(slideAnim, {
                toValue: connected ? -50 : 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });

        return () => unsubscribe();
    }, []);

    if (isConnected) return null;

    return (
        <Animated.View
            style={[
                styles.banner,
                { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
            <Text style={styles.text}>{t('no_internet')}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 20,
        right: 20,
        backgroundColor: Colors.danger,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
