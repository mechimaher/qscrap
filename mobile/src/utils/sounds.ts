/**
 * QScrap Notification Sounds Utility
 * 
 * Premium sound feedback for notifications and interactions.
 * Uses expo-av for audio playback.
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

// Sound instances cache
let messageSound: Audio.Sound | null = null;
let successSound: Audio.Sound | null = null;
let alertSound: Audio.Sound | null = null;

// Configure audio mode for notifications
const configureAudio = async () => {
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: false, // Respect silent mode
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
        });
    } catch (error) {
        console.log('Audio config error:', error);
    }
};

/**
 * Play a notification sound with haptic feedback
 * @param type - Type of notification: 'message', 'success', 'alert', 'order'
 */
export const playNotificationSound = async (
    type: 'message' | 'success' | 'alert' | 'order' = 'message'
): Promise<void> => {
    try {
        // Always provide haptic feedback
        switch (type) {
            case 'message':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Vibration.vibrate([0, 100, 50, 100]);
                break;
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Vibration.vibrate(200);
                break;
            case 'alert':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Vibration.vibrate([0, 200, 100, 200]);
                break;
            case 'order':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Vibration.vibrate([0, 100, 50, 100, 50, 100]);
                break;
        }

        // Note: For actual sounds, you would need sound files in assets
        // For now, using haptic + vibration as premium feedback
        // To add sounds later:
        // const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/notification.mp3'));
        // await sound.playAsync();

    } catch (error) {
        console.log('Notification sound error:', error);
    }
};

/**
 * Play a light interaction sound (button taps, selections)
 */
export const playInteractionSound = async (): Promise<void> => {
    try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
        console.log('Interaction sound error:', error);
    }
};

/**
 * Play a medium impact sound (confirmations, important actions)
 */
export const playConfirmationSound = async (): Promise<void> => {
    try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Vibration.vibrate(50);
    } catch (error) {
        console.log('Confirmation sound error:', error);
    }
};

/**
 * Play success completion sound
 */
export const playSuccessSound = async (): Promise<void> => {
    try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Triple vibration pattern for celebration
        Vibration.vibrate([0, 50, 50, 50, 50, 100]);
    } catch (error) {
        console.log('Success sound error:', error);
    }
};

/**
 * Play error feedback
 */
export const playErrorSound = async (): Promise<void> => {
    try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate([0, 100, 50, 300]);
    } catch (error) {
        console.log('Error sound error:', error);
    }
};

/**
 * Play "driver arrived" premium notification
 */
export const playDriverArrivedSound = async (): Promise<void> => {
    try {
        // Premium triple-burst vibration
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 150, 75, 150, 75, 250]);

        // Second burst after delay
        setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 600);
    } catch (error) {
        console.log('Driver arrived sound error:', error);
    }
};

/**
 * Play "new bid" notification
 */
export const playNewBidSound = async (): Promise<void> => {
    try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Ascending pattern
        Vibration.vibrate([0, 50, 30, 75, 30, 100]);
    } catch (error) {
        console.log('New bid sound error:', error);
    }
};

/**
 * Clean up sound resources
 */
export const cleanupSounds = async (): Promise<void> => {
    try {
        if (messageSound) {
            await messageSound.unloadAsync();
            messageSound = null;
        }
        if (successSound) {
            await successSound.unloadAsync();
            successSound = null;
        }
        if (alertSound) {
            await alertSound.unloadAsync();
            alertSound = null;
        }
    } catch (error) {
        console.log('Cleanup sounds error:', error);
    }
};

export default {
    playNotificationSound,
    playInteractionSound,
    playConfirmationSound,
    playSuccessSound,
    playErrorSound,
    playDriverArrivedSound,
    playNewBidSound,
    cleanupSounds,
};
