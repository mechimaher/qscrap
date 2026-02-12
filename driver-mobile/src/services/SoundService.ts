/**
 * QScrap Driver App - Sound Service
 * 
 * Enterprise alert sounds for assignment notifications.
 * Uses expo-av Audio API for reliable playback even when app is in foreground.
 * 
 * Alert pattern inspired by Talabat/Uber/Facebook Messenger:
 * - Loud, attention-grabbing chime for new assignments
 * - Plays alongside vibration + haptics for maximum driver awareness
 */

import { Audio } from 'expo-av';

let assignmentSound: Audio.Sound | null = null;
let isInitialized = false;

/**
 * Initialize audio mode for driver alerts
 * Must be called once at app startup
 */
export async function initSoundService(): Promise<void> {
    if (isInitialized) return;

    try {
        await Audio.setAudioModeAsync({
            // CRITICAL: Allow sound to play even in silent mode (driver may have phone on silent)
            playsInSilentModeIOS: true,
            // Allow sound to interrupt other audio (music, podcasts)
            staysActiveInBackground: false,
            // Duck other audio while alert plays
            shouldDuckAndroid: true,
        });
        isInitialized = true;
    } catch (err) {
        console.warn('[Sound] Failed to configure audio mode:', err);
    }
}

/**
 * Play the assignment alert sound
 * High-priority chime that plays even when phone is on silent (iOS)
 * 
 * Uses the built-in expo-av default sound which is a clear notification tone.
 * For custom sound, replace require() path with a custom .wav/.mp3 asset.
 */
export async function playAssignmentAlert(): Promise<void> {
    try {
        // Ensure audio mode is set
        if (!isInitialized) await initSoundService();

        // Unload previous sound if exists (prevent memory leak)
        if (assignmentSound) {
            try {
                await assignmentSound.unloadAsync();
            } catch { /* ignore */ }
            assignmentSound = null;
        }

        // Load and play the alert sound
        // Using a programmatic tone via the notification system
        // For custom sound file, use: require('../../assets/sounds/assignment_alert.mp3')
        const { sound } = await Audio.Sound.createAsync(
            require('../../assets/sounds/assignment_alert.wav'),
            {
                shouldPlay: true,
                volume: 1.0,      // Maximum volume
                isLooping: false,  // Play once
            }
        );

        assignmentSound = sound;

        // Auto-cleanup after playback finishes
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
                sound.unloadAsync().catch(() => { /* ignore */ });
                assignmentSound = null;
            }
        });

    } catch (err) {
        console.warn('[Sound] Failed to play alert:', err);
        // Don't throw — sound failure should never block assignment flow
    }
}

/**
 * Cleanup on app shutdown
 */
export async function disposeSoundService(): Promise<void> {
    if (assignmentSound) {
        try {
            await assignmentSound.unloadAsync();
        } catch { /* ignore */ }
        assignmentSound = null;
    }
    isInitialized = false;
}
