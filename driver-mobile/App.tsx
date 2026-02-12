// QScrap Driver App - Main Entry Point
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { Colors } from './src/constants/theme';
import * as Notifications from 'expo-notifications';
import NotificationService from './src/services/notifications';
import { offlineQueue } from './src/services/OfflineQueue';
import { initSoundService } from './src/services/SoundService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { I18nProvider } from './src/i18n';
import { ToastProvider } from './src/components/Toast';
import { NetworkBanner } from './src/components/NetworkBanner';
import { SettingsProvider } from './src/contexts/SettingsContext';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import BiometricSetupScreen from './src/screens/auth/BiometricSetupScreen';
import HomeScreen from './src/screens/tabs/HomeScreen';
import AssignmentsScreen from './src/screens/tabs/AssignmentsScreen';
import ProfileScreen from './src/screens/tabs/ProfileScreen';
import AssignmentDetailScreen from './src/screens/AssignmentDetailScreen';
import ChatScreen from './src/screens/ChatScreen';


import ProofOfDeliveryScreen from './src/screens/ProofOfDeliveryScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';

// Navigation Types
// Navigation ref for deep linking from push notifications
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
    AssignmentDetail: { assignmentId: string };
    Chat: { orderId: string; orderNumber: string; recipientName: string };
    ProofOfDelivery: { assignmentId: string };
    Settings: undefined;
    WebView: { url: string; title: string };
};

export type AuthStackParamList = {
    Login: undefined;
    BiometricSetup: undefined;
};

const AuthStack = (createNativeStackNavigator as any)();
const RootStack = (createNativeStackNavigator as any)();
const Tab = (createBottomTabNavigator as any)();

// Auth Navigator
function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
        </AuthStack.Navigator>
    );
}

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }: any) => ({
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: '#6A6A6A',
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginBottom: 5,
                },
                tabBarStyle: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    position: 'absolute',
                    bottom: 20,
                    marginHorizontal: 16,
                    height: 65,
                    borderRadius: 25,
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    paddingTop: 8,
                },
                tabBarIcon: ({ color, size, focused }: any) => {
                    let iconName: any;
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Assignments') iconName = focused ? 'briefcase' : 'briefcase-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

                    return (
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={iconName} size={24} color={color} />
                            {focused && (
                                <View style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: Colors.primary,
                                    marginTop: 4
                                }} />
                            )}
                        </View>
                    );
                },
            })}
            screenListeners={{
                state: (e: any) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                },
            }}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
            <Tab.Screen name="Assignments" component={AssignmentsScreen} options={{ title: 'Jobs' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        </Tab.Navigator>
    );
}

// Root Navigator
function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigation = React.useRef<any>(null); // Use ref for navigation access if needed outside

    // Initialize Notifications
    React.useEffect(() => {
        if (!isAuthenticated) return;

        const register = async () => {
            const token = await NotificationService.registerForPushNotifications();
            console.log('Push Token:', token);
        };

        register();

        // Process any pending offline requests
        offlineQueue.processQueue();

        // Initialize sound service for assignment alerts
        initSoundService();

        // Handle foreground notifications
        const notificationListener = NotificationService.addNotificationReceivedListener(notification => {
            console.log('Notification Received:', notification);
        });

        // Handle background/tap notifications — deep link to relevant screen
        const responseListener = NotificationService.addNotificationResponseListener(response => {
            const data = response.notification.request.content.data;
            console.log('[App] Notification tapped:', data?.type);

            // Wait for navigation to be ready
            setTimeout(() => {
                if (!navigationRef.isReady()) return;

                if (data?.type === 'new_assignment' || data?.type === 'assignment_updated' || data?.type === 'assignment_cancelled') {
                    if (data?.assignmentId) {
                        navigationRef.navigate('AssignmentDetail' as any, { assignmentId: data.assignmentId });
                    }
                } else if (data?.type === 'chat_message') {
                    if (data?.orderId) {
                        navigationRef.navigate('Chat' as any, {
                            orderId: data.orderId,
                            orderNumber: data.orderNumber || '',
                            recipientName: 'Customer',
                        });
                    }
                } else if (data?.type === 'order_status_updated') {
                    // Reload home screen (already on Main tab)
                    // Navigation handled by HomeScreen focus listener
                }
            }, 300);
        });

        return () => {
            notificationListener.remove();
            responseListener.remove();
        };
    }, [isAuthenticated]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>QScrap Driver</Text>
                <Text style={styles.loadingSubtext}>Loading...</Text>
            </View>
        );
    }

    return (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
                <RootStack.Screen name="Auth" component={AuthNavigator} />
            ) : (
                <>
                    <RootStack.Screen name="Main" component={MainTabs} />
                    <RootStack.Screen name="AssignmentDetail" component={AssignmentDetailScreen} />
                    <RootStack.Screen name="Chat" component={ChatScreen} />


                    {/* VVIP POD Wizard */}
                    <RootStack.Screen
                        name="ProofOfDelivery"
                        component={ProofOfDeliveryScreen}
                        options={{ animation: 'slide_from_right' }}
                    />


                    <RootStack.Screen
                        name="Terms"
                        component={TermsScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                    <RootStack.Screen
                        name="PrivacyPolicy"
                        component={PrivacyPolicyScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                </>
            )}
        </RootStack.Navigator>
    );
}

// Themed App wrapper
function ThemedApp() {
    const { isDarkMode } = useTheme();

    return (
        <>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
            <NetworkBanner />
            <RootNavigator />
        </>
    );
}

// Main App
export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary name="RootApp">
                <SafeAreaProvider>
                    <I18nProvider>
                        <SettingsProvider>
                            <ThemeProvider>
                                <ToastProvider>
                                    <AuthProvider>
                                        <SocketProvider>
                                            <NavigationContainer ref={navigationRef}>
                                                <ThemedApp />
                                            </NavigationContainer>
                                        </SocketProvider>
                                    </AuthProvider>
                                </ToastProvider>
                            </ThemeProvider>
                        </SettingsProvider>
                    </I18nProvider>
                </SafeAreaProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '700',
        marginTop: 16,
    },
    loadingSubtext: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 8,
    },
});
