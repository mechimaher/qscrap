import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
    Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface VoiceRecorderProps {
    onRecordingComplete: (uri: string, duration: number) => void;
    disabled?: boolean;
}

interface VoiceMessagePlayerProps {
    uri: string;
    duration: number;
    isOwnMessage?: boolean;
}

/**
 * Premium Voice Recorder Component
 * Hold-to-record with animated UI feedback
 */
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    onRecordingComplete,
    disabled = false,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const recording = useRef<Audio.Recording | null>(null);
    const durationTimer = useRef<NodeJS.Timeout | null>(null);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkPermissions();
        return () => {
            stopRecording();
            if (durationTimer.current) {
                clearInterval(durationTimer.current);
            }
        };
    }, []);

    // Pulse animation during recording
    useEffect(() => {
        if (isRecording) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();

            // Wave animation
            const wave = Animated.loop(
                Animated.timing(waveAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            );
            wave.start();

            return () => {
                pulse.stop();
                wave.stop();
            };
        } else {
            pulseAnim.setValue(1);
            waveAnim.setValue(0);
        }
    }, [isRecording]);

    const checkPermissions = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            setHasPermission(status === 'granted');
        } catch (error) {
            console.log('Permission error:', error);
            setHasPermission(false);
        }
    };

    const startRecording = async () => {
        if (!hasPermission) {
            Alert.alert(
                'Permission Required',
                'Microphone access is needed to record voice messages.',
                [{ text: 'OK' }]
            );
            return;
        }

        try {
            // Configure audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Start recording
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recording.current = newRecording;
            setIsRecording(true);
            setRecordingDuration(0);

            // Start duration timer
            durationTimer.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.log('Recording start error:', error);
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async () => {
        if (!recording.current) return;

        try {
            if (durationTimer.current) {
                clearInterval(durationTimer.current);
                durationTimer.current = null;
            }

            await recording.current.stopAndUnloadAsync();
            const uri = recording.current.getURI();
            const duration = recordingDuration;

            recording.current = null;
            setIsRecording(false);

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            if (uri && duration > 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onRecordingComplete(uri, duration);
            } else {
                // Too short, discard
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
        } catch (error) {
            console.log('Recording stop error:', error);
            setIsRecording(false);
        }
    };

    const cancelRecording = async () => {
        if (!recording.current) return;

        try {
            if (durationTimer.current) {
                clearInterval(durationTimer.current);
                durationTimer.current = null;
            }

            await recording.current.stopAndUnloadAsync();
            recording.current = null;
            setIsRecording(false);
            setRecordingDuration(0);

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.log('Recording cancel error:', error);
            setIsRecording(false);
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const waveOpacity = waveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 0],
    });

    const waveScale = waveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2],
    });

    if (isRecording) {
        return (
            <View style={styles.recordingContainer}>
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelRecording}
                >
                    <Text style={styles.cancelIcon}>✕</Text>
                </TouchableOpacity>

                <View style={styles.recordingCenter}>
                    <Animated.View style={[
                        styles.waveRing,
                        {
                            opacity: waveOpacity,
                            transform: [{ scale: waveScale }]
                        }
                    ]} />
                    <Animated.View style={[
                        styles.recordingIndicator,
                        { transform: [{ scale: pulseAnim }] }
                    ]}>
                        <Text style={styles.micIcon}>🎙️</Text>
                    </Animated.View>
                </View>

                <View style={styles.recordingInfo}>
                    <Text style={styles.recordingLabel}>Recording...</Text>
                    <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
                </View>

                <TouchableOpacity
                    style={styles.sendButton}
                    onPress={stopRecording}
                >
                    <LinearGradient
                        colors={['#22c55e', '#16a34a']}
                        style={styles.sendGradient}
                    >
                        <Text style={styles.sendIcon}>➤</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.micButton, disabled && styles.micButtonDisabled]}
            onPress={startRecording}
            disabled={disabled}
        >
            <Text style={styles.micButtonIcon}>🎤</Text>
        </TouchableOpacity>
    );
};

/**
 * Voice Message Player Component
 * Plays recorded voice messages with progress indicator
 */
export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
    uri,
    duration,
    isOwnMessage = false,
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const playSound = async () => {
        try {
            if (sound) {
                await sound.unloadAsync();
            }

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
            });

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setIsPlaying(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.log('Playback error:', error);
        }
    };

    const stopSound = async () => {
        if (sound) {
            await sound.stopAsync();
            setIsPlaying(false);
            setPlaybackPosition(0);
            progressAnim.setValue(0);
        }
    };

    const onPlaybackStatusUpdate = (status: Audio.SoundStatus) => {
        if (status.isLoaded) {
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackPosition(0);
                progressAnim.setValue(0);
            } else if (status.positionMillis !== undefined && status.durationMillis) {
                const progress = status.positionMillis / status.durationMillis;
                setPlaybackPosition(Math.floor(status.positionMillis / 1000));
                progressAnim.setValue(progress);
            }
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[
            styles.playerContainer,
            isOwnMessage ? styles.playerOwn : styles.playerOther
        ]}>
            <TouchableOpacity
                style={styles.playButton}
                onPress={isPlaying ? stopSound : playSound}
            >
                <Text style={styles.playIcon}>
                    {isPlaying ? '⏸️' : '▶️'}
                </Text>
            </TouchableOpacity>

            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                    <Animated.View style={[
                        styles.progressBar,
                        isOwnMessage ? styles.progressOwn : styles.progressOther,
                        { width: progressWidth }
                    ]} />
                </View>
                <Text style={[
                    styles.playerDuration,
                    isOwnMessage && styles.playerDurationOwn
                ]}>
                    {formatDuration(isPlaying ? playbackPosition : duration)}
                </Text>
            </View>

            <View style={styles.waveformContainer}>
                {[...Array(8)].map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.waveformBar,
                            { height: 8 + (Math.random() * 12) },
                            isOwnMessage ? styles.waveformOwn : styles.waveformOther,
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    // Recorder styles
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    micButtonDisabled: {
        opacity: 0.5,
    },
    micButtonIcon: {
        fontSize: 20,
    },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    cancelButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelIcon: {
        fontSize: 16,
        color: Colors.error,
    },
    recordingCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    waveRing: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.error,
    },
    recordingIndicator: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    micIcon: {
        fontSize: 24,
    },
    recordingInfo: {
        alignItems: 'center',
        marginHorizontal: Spacing.md,
    },
    recordingLabel: {
        fontSize: FontSizes.xs,
        color: Colors.error,
        fontWeight: '500',
    },
    durationText: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        fontVariant: ['tabular-nums'],
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    sendGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendIcon: {
        fontSize: 18,
        color: '#fff',
    },
    // Player styles
    playerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
        borderRadius: BorderRadius.lg,
        minWidth: 180,
    },
    playerOwn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    playerOther: {
        backgroundColor: '#F5F5F5',
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIcon: {
        fontSize: 16,
    },
    progressContainer: {
        flex: 1,
        marginHorizontal: Spacing.sm,
    },
    progressTrack: {
        height: 3,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    },
    progressOwn: {
        backgroundColor: '#fff',
    },
    progressOther: {
        backgroundColor: Colors.primary,
    },
    playerDuration: {
        fontSize: FontSizes.xs,
        color: '#525252',
        marginTop: 4,
    },
    playerDurationOwn: {
        color: 'rgba(255,255,255,0.8)',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    waveformBar: {
        width: 3,
        borderRadius: 2,
    },
    waveformOwn: {
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    waveformOther: {
        backgroundColor: Colors.primary + '40',
    },
});

export default VoiceRecorder;
