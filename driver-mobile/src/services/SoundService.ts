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

import { log, warn, error as logError } from '../utils/logger';

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
            // Allow sound to play when app is in background (driver may lock phone)
            staysActiveInBackground: true,
            // Duck other audio while alert plays
            shouldDuckAndroid: true,
        });
        isInitialized = true;
    } catch (err) {
        warn('[Sound] Failed to configure audio mode:', err);
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
        // CRITICAL: Loop for 20 seconds so driver can hear in pocket/noisy vehicle
        // For custom sound file, use: require('../../assets/sounds/assignment_alert.mp3')
        const { sound } = await Audio.Sound.createAsync(
            require('../../assets/sounds/assignment_alert.wav'),
            {
                shouldPlay: true,
                volume: 1.0,      // Maximum volume
                isLooping: true,   // LOOP until dismissed or timeout
            }
        );

        assignmentSound = sound;

        // Auto-stop after 20 seconds to avoid infinite loop
        const stopTimeout = setTimeout(async () => {
            try {
                await sound.stopAsync();
                await sound.unloadAsync();
            } catch { /* ignore */ }
            assignmentSound = null;
        }, 20000);

        // Also cleanup if sound finishes a cycle and is manually stopped
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && !status.isPlaying && !status.isLooping) {
                clearTimeout(stopTimeout);
                sound.unloadAsync().catch(() => { /* ignore */ });
                assignmentSound = null;
            }
        });

    } catch (err) {
        warn('[Sound] Failed to play alert:', err);
        // Don't throw — sound failure should never block assignment flow
    }
}

/**
 * Stop the currently playing assignment alert (called when driver interacts with popup)
 */
export async function stopAssignmentAlert(): Promise<void> {
    if (assignmentSound) {
        try {
            await assignmentSound.stopAsync();
            await assignmentSound.unloadAsync();
        } catch { /* ignore */ }
        assignmentSound = null;
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
