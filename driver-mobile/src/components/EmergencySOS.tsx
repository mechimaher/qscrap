/**
 * QScrap Driver App - Emergency SOS Button
 * Critical safety feature for drivers in emergency situations
 * Sends location and alert to operations immediately
 * 
 * Usage: Hold for 3 seconds to activate (prevents accidental triggers)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { api } from '../../services/api';

interface EmergencySOSProps {
    onSOSTriggered?: () => void;
}

export const EmergencySOS: React.FC<EmergencySOSProps> = ({
    onSOSTriggered,
}) => {
    const [isPressed, setIsPressed] = useState(false);
    const [progress, setProgress] = useState(0);
    const progressAnim = React.useRef(new Animated.Value(0)).current;

    const handlePressIn = () => {
        setIsPressed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Animate progress
        Animated.timing(progressAnim, {
            toValue: 100,
            duration: 3000, // 3 seconds hold
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                triggerSOS();
            }
        });
    };

    const handlePressOut = () => {
        if (!isPressed) return;
        
        setIsPressed(false);
        setProgress(0);
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    };

    const triggerSOS = async () => {
        setIsPressed(false);
        setProgress(0);
        progressAnim.setValue(0);

        try {
            // Get current location with high accuracy
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
                timeout: 10000,
            });

            // Show confirmation alert
            Alert.alert(
                '🚨 EMERGENCY ALERT',
                `This will send your location to operations immediately.\n\nLocation:\n${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        },
                    },
                    {
                        text: 'SEND SOS',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                // Send SOS to operations
                                await api.sendSOS({
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude,
                                    accuracy: location.coords.accuracy || 0,
                                    timestamp: new Date().toISOString(),
                                });

                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                
                                Alert.alert(
                                    '✅ SOS Sent',
                                    'Help is on the way. Operations has been notified with your location. Stay on the line.',
                                    [{ text: 'OK' }]
                                );

                                onSOSTriggered?.();
                            } catch (error) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                Alert.alert(
                                    'Error',
                                    'Failed to send SOS. Please call emergency services directly.',
                                    [{ text: 'OK' }]
                                );
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            setIsPressed(false);
            setProgress(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            
            Alert.alert(
                'Location Error',
                'Unable to get your location. Please call emergency services directly.',
                [{ text: 'OK' }]
            );
        }
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.sosButton}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                delayLongPress={3000}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Emergency SOS Button"
                accessibilityHint="Hold for 3 seconds to send emergency alert"
            >
                <LinearGradient
                    colors={['#EF4444', '#DC2626', '#991B1B']}
                    style={styles.sosGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Progress overlay */}
                    <Animated.View
                        style={[
                            styles.progressOverlay,
                            { width: progressWidth },
                        ]}
                    />
                    
                    <View style={styles.content}>
                        <Ionicons name="warning" size={32} color="#fff" />
                        <Text style={styles.sosText}>
                            {isPressed ? 'Hold to Cancel...' : 'SOS Emergency'}
                        </Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
            
            <Text style={styles.instructionText}>
                Hold for 3 seconds to send emergency alert
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: Spacing.lg,
    },
    sosButton: {
        width: 160,
        height: 160,
        borderRadius: 80,
        overflow: 'hidden',
        ...Shadows.xl,
    },
    sosGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    sosText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
    instructionText: {
        fontSize: 12,
        color: '#666',
        marginTop: Spacing.md,
        textAlign: 'center',
    },
});

export default EmergencySOS;
