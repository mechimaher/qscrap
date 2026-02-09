// DriverCard - Live driver info with call action
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Order } from '../../services/api';
import { Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { rtlTextAlign } from '../../utils/rtl';

const DriverCard = ({ order, onCall, t, isRTL }: { order: Order; onCall: () => void; t: any; isRTL: boolean }) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.driverCard}>
            <LinearGradient
                colors={['rgba(34, 197, 94, 0.1)', 'rgba(34, 197, 94, 0.05)']}
                style={styles.driverGradient}
            >
                <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                        <Text style={styles.driverAvatarText}>🚗</Text>
                        <Animated.View style={[
                            styles.liveDot,
                            { opacity: pulseAnim }
                        ]} />
                    </View>
                    <View style={isRTL ? { marginRight: Spacing.md } : { marginLeft: Spacing.md }}>
                        <Text style={[styles.driverLabel, { textAlign: rtlTextAlign(isRTL) }]}>{t('common.yourDriver')}</Text>
                        <Text style={[styles.driverName, { textAlign: rtlTextAlign(isRTL) }]}>{order.driver_name}</Text>
                    </View>
                    {
                        order.driver_phone && (
                            <TouchableOpacity style={[styles.callButton, { marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }]} onPress={onCall}>
                                <Text style={styles.callIcon}>📞</Text>
                                <Text style={styles.callText}>{t('common.call')}</Text>
                            </TouchableOpacity>
                        )
                    }
                </View>
            </LinearGradient >
        </View >
    );
};

const styles = StyleSheet.create({
    driverCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: '#22C55E' },
    driverGradient: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
    driverInfo: { flexDirection: 'row', alignItems: 'center' },
    driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, ...Shadows.sm },
    driverAvatarText: { fontSize: 24 },
    liveDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
    driverLabel: { fontSize: FontSizes.sm, color: '#525252' },
    driverName: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a' },
    callButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, ...Shadows.sm },
    callIcon: { fontSize: 16, marginRight: Spacing.xs },
    callText: { color: '#fff', fontWeight: '700' },
});

export default DriverCard;
