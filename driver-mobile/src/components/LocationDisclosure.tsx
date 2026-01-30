// QScrap Driver App - Location Permission Disclosure
// H3 FIX: Required disclosure screen before requesting background location
// Google Play Policy: Must explain why background location is needed

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';

interface LocationDisclosureProps {
    visible: boolean;
    onAccept: () => void;
    onDecline: () => void;
}

/**
 * Location Disclosure Modal - Required by Google Play before requesting background location
 * Must be shown BEFORE calling requestBackgroundPermissionsAsync()
 */
export function LocationDisclosure({ visible, onAccept, onDecline }: LocationDisclosureProps) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Icon */}
                        <Text style={styles.icon}>📍</Text>

                        {/* Title */}
                        <Text style={styles.title}>
                            Background Location Access
                        </Text>

                        {/* Explanation */}
                        <Text style={styles.description}>
                            QScrap Driver needs access to your location <Text style={styles.bold}>even when the app is closed or not in use</Text> for the following reasons:
                        </Text>

                        {/* Reasons */}
                        <View style={styles.reasonsContainer}>
                            <View style={styles.reason}>
                                <Text style={styles.reasonIcon}>🚚</Text>
                                <Text style={styles.reasonText}>
                                    <Text style={styles.bold}>Real-time delivery tracking:</Text> Customers can see your location during active deliveries
                                </Text>
                            </View>

                            <View style={styles.reason}>
                                <Text style={styles.reasonIcon}>📱</Text>
                                <Text style={styles.reasonText}>
                                    <Text style={styles.bold}>New assignment alerts:</Text> Receive notifications for nearby pickup requests even when driving
                                </Text>
                            </View>

                            <View style={styles.reason}>
                                <Text style={styles.reasonIcon}>🛡️</Text>
                                <Text style={styles.reasonText}>
                                    <Text style={styles.bold}>Driver safety:</Text> Operations can locate you in case of emergencies
                                </Text>
                            </View>
                        </View>

                        {/* Privacy note */}
                        <Text style={styles.privacyNote}>
                            Your location is only shared during active deliveries and when you are set to "Available".
                            We never sell your location data to third parties.
                        </Text>

                        {/* Privacy link */}
                        <Text style={styles.privacyLink}>
                            Read our full Privacy Policy at qscrap.qa/privacy
                        </Text>
                    </ScrollView>

                    {/* Buttons */}
                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={styles.declineButton}
                            onPress={onDecline}
                        >
                            <Text style={styles.declineText}>Not Now</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={onAccept}
                        >
                            <LinearGradient
                                colors={[Colors.primary, Colors.primaryDark]}
                                style={styles.acceptGradient}
                            >
                                <Text style={styles.acceptText}>Allow Location</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        maxHeight: '85%',
        width: '100%',
    },
    icon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    description: {
        fontSize: 15,
        color: '#4a4a4a',
        lineHeight: 22,
        marginBottom: 20,
    },
    bold: {
        fontWeight: '600',
        color: '#1a1a1a',
    },
    reasonsContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    reason: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    reasonIcon: {
        fontSize: 20,
        marginRight: 12,
        marginTop: 2,
    },
    reasonText: {
        flex: 1,
        fontSize: 14,
        color: '#4a4a4a',
        lineHeight: 20,
    },
    privacyNote: {
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 18,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    privacyLink: {
        fontSize: 13,
        color: Colors.primary,
        textDecorationLine: 'underline',
        marginBottom: 20,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    declineButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    declineText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    acceptButton: {
        flex: 2,
        borderRadius: 12,
        overflow: 'hidden',
    },
    acceptGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    acceptText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default LocationDisclosure;
