import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useTheme } from '../contexts';
import { Colors } from '../constants';
import * as storage from '../utils/storage';

// Screens - Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Screens - Tabs
import HomeScreen from '../screens/tabs/HomeScreen';
import RequestsScreen from '../screens/tabs/RequestsScreen';
import OrdersScreen from '../screens/tabs/OrdersScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import SupportScreen from '../screens/SupportScreen';

// Screens - Detail
import RequestDetailScreen from '../screens/RequestDetailScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import DeliveryTrackingScreen from '../screens/DeliveryTrackingScreen';
import CancellationPreviewScreen from '../screens/CancellationPreviewScreen';
import DisputeScreen from '../screens/DisputeScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsScreen from '../screens/TermsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

// Screens - Profile & Account
import NewRequestScreen from '../screens/NewRequestScreen';
import AddressesScreen from '../screens/AddressesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChatScreen from '../screens/ChatScreen';
import CounterOfferScreen from '../screens/CounterOfferScreen';

// Repair Marketplace Screens
import RepairRequestScreen from '../screens/RepairRequestScreen';
import MyRepairsScreen from '../screens/MyRepairsScreen';

// Quick Services Screens
import QuickServicesScreen from '../screens/QuickServicesScreen';
import QuickServiceBookingScreen from '../screens/QuickServiceBookingScreen';
import QuickServiceTrackingScreen from '../screens/QuickServiceTrackingScreen';

// Stacks
export type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
    MainTabs: undefined;
    Login: undefined;
    Register: undefined;
    // Quick Services
    QuickServices: undefined;
    QuickServiceBooking: { service: { type: string; name: string; icon: string; priceRange: string; duration: string } };
    QuickServiceTracking: { requestId: string };
    // Request & Order Flow
    NewRequest: undefined;
    RequestDetails: { requestId: string };
    OrderDetails: { orderId: string };
    DeliveryTracking: { orderId: string };
    CancellationPreview: { orderId: string };
    Dispute: { orderId: string };
    CounterOffer: { bidId: string; requestId: string; currentAmount: number; garageName: string };
    Chat: { orderId?: string; requestId?: string; garageId?: string };
    // Profile & Account
    Addresses: undefined;
    Notifications: undefined;
    EditProfile: undefined;
    Settings: undefined;
    // Legal
    PrivacyPolicy: undefined;
    Terms: undefined;
    // Repair Marketplace
    RepairRequest: undefined;
    MyRepairs: undefined;
    RepairDetail: { request_id: string };
};

export type MainTabParamList = {
    Home: undefined;
    Requests: undefined;
    Orders: undefined;
    Profile: undefined;
    Support: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Tab Navigator
const MainTabs: React.FC = () => {
    const { colors, isDark } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    paddingTop: 8,
                    paddingBottom: 8,
                    height: 65,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 2,
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'home';

                    switch (route.name) {
                        case 'Home':
                            iconName = focused ? 'home' : 'home-outline';
                            break;
                        case 'Requests':
                            iconName = focused ? 'list' : 'list-outline';
                            break;
                        case 'Orders':
                            iconName = focused ? 'cube' : 'cube-outline';
                            break;
                        case 'Profile':
                            iconName = focused ? 'person' : 'person-outline';
                            break;
                        case 'Support':
                            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                            break;
                    }

                    return <Ionicons name={iconName} size={24} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
            <Tab.Screen name="Requests" component={RequestsScreen} options={{ tabBarLabel: 'Requests' }} />
            <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: 'Orders' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
            <Tab.Screen name="Support" component={SupportScreen} options={{ tabBarLabel: 'Support' }} />
        </Tab.Navigator>
    );
};

// Auth Stack
const AuthStack: React.FC = () => {
    const { colors } = useTheme();

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
        </Stack.Navigator>
    );
};

// Main Stack
const MainStack: React.FC = () => {
    const { colors } = useTheme();
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            {/* Quick Services */}
            <Stack.Screen name="QuickServices" component={QuickServicesScreen} />
            <Stack.Screen name="QuickServiceBooking" component={QuickServiceBookingScreen} />
            <Stack.Screen name="QuickServiceTracking" component={QuickServiceTrackingScreen} />
            {/* Request & Order Flow */}
            <Stack.Screen name="NewRequest" component={NewRequestScreen} />
            <Stack.Screen name="RequestDetails" component={RequestDetailScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailScreen} />
            <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
            <Stack.Screen name="CancellationPreview" component={CancellationPreviewScreen} />
            <Stack.Screen name="Dispute" component={DisputeScreen} />
            <Stack.Screen name="CounterOffer" component={CounterOfferScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            {/* Profile & Account */}
            <Stack.Screen name="Addresses" component={AddressesScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            {/* Legal */}
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            {/* Repair Marketplace */}
            <Stack.Screen name="RepairRequest" component={RepairRequestScreen} />
            <Stack.Screen name="MyRepairs" component={MyRepairsScreen} />
        </Stack.Navigator>
    );
};

import { createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Root Navigator
const AppNavigator: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const { isDark, colors } = useTheme();
    const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
    const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

    // Deep Linking & Notification Handling
    useEffect(() => {
        // Handle notification taps
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            const type = data?.type;

            console.log('[AppNavigator] Notification tapped:', type, data);

            if (navigationRef.isReady()) {
                // Handle different notification types
                if (type === 'bid_accepted' || type === 'order_update' || type === 'order_created' || type === 'delivery_update') {
                    const orderId = data?.order_id || data?.orderId;
                    if (orderId) {
                        // Navigate to Order Details
                        navigationRef.navigate('OrderDetails', { orderId });
                    }
                } else if (type === 'new_bid' || type === 'bid_update') {
                    const requestId = data?.request_id || data?.requestId;
                    if (requestId) {
                        // Navigate to Request Details
                        navigationRef.navigate('RequestDetails', { requestId });
                    }
                } else if (type === 'message') {
                    // Optionally navigate to chat if supported
                    // navigationRef.navigate('Support');
                }
            }
        });

        return () => subscription.remove();
    }, []);

    // Check if onboarding has been completed
    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const onboardingComplete = await storage.getItem<boolean>(storage.StorageKey.ONBOARDING_COMPLETE);
                setShowOnboarding(!onboardingComplete);
            } catch (error) {
                console.error('Error checking onboarding status:', error);
                setShowOnboarding(false);
            } finally {
                setIsCheckingOnboarding(false);
            }
        };

        checkOnboarding();
    }, []);

    // Custom themes for navigation
    const LightNavigationTheme = {
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            primary: Colors.light.primary,
            background: Colors.light.background,
            card: Colors.light.surface,
            text: Colors.light.text,
            border: Colors.light.border,
        },
    };

    const DarkNavigationTheme = {
        ...DarkTheme,
        colors: {
            ...DarkTheme.colors,
            primary: Colors.dark.primary,
            background: Colors.dark.background,
            card: Colors.dark.surface,
            text: Colors.dark.text,
            border: Colors.dark.border,
        },
    };

    // Loading state
    if (isLoading || isCheckingOnboarding) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 20, color: colors.text, fontSize: 16 }}>Loading QScrap...</Text>
            </View>
        );
    }

    // Show onboarding for first-time users
    if (showOnboarding && !isAuthenticated) {
        return (
            <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
        );
    }

    return (
        <NavigationContainer
            ref={navigationRef}
            theme={isDark ? DarkNavigationTheme : LightNavigationTheme}
        >
            {isAuthenticated ? <MainStack /> : <AuthStack />}
        </NavigationContainer>
    );
};

export default AppNavigator;
