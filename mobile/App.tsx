// QScrap Customer App - Premium React Native with Full Features
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './src/contexts/LanguageContext';
import { SocketProvider, useSocketContext } from './src/hooks/useSocket';
import { Colors } from './src/constants/theme';
import NotificationOverlay from './src/components/NotificationOverlay';
import { ToastProvider } from './src/components/Toast';
import { Address } from './src/services/api';
import { BadgeCountsProvider, useBadgeCounts } from './src/hooks/useBadgeCounts';

// Import Auth screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import VerifyOTPScreen from './src/screens/auth/VerifyOTPScreen';

// Import Tab screens
import HomeScreen from './src/screens/tabs/HomeScreen';
import RequestsScreen from './src/screens/tabs/RequestsScreen';
import OrdersScreen from './src/screens/tabs/OrdersScreen';
import ProfileScreen from './src/screens/tabs/ProfileScreen';

// Import Modal/Stack screens
import NewRequestScreen from './src/screens/NewRequestScreen';
import RequestDetailScreen from './src/screens/RequestDetailScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import TrackingScreen from './src/screens/TrackingScreen';
import ChatScreen from './src/screens/ChatScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import AddressesScreen from './src/screens/AddressesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CounterOfferScreen from './src/screens/CounterOfferScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SupportScreen from './src/screens/SupportScreen';
// TicketChatScreen removed - replaced with WhatsApp-first support
// VIN screens removed - not used
import PaymentScreen from './src/screens/PaymentScreen';
import DeliveryConfirmationScreen from './src/screens/DeliveryConfirmationScreen';
import DeliveryTrackingScreen from './src/screens/DeliveryTrackingScreen';
import MyVehiclesScreen from './src/screens/MyVehiclesScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  NewRequest: {
    prefill?: {
      carMake?: string;
      carModel?: string;
      carYear?: number;
      partDescription?: string;
      partCategory?: string;
      partSubCategory?: string;
    };
    deliveryLocation?: {
      lat: number;
      lng: number;
      address: string;
    };
  } | undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  RequestDetail: { requestId: string };
  OrderDetail: { orderId: string };
  Tracking: { orderId: string; orderNumber: string; deliveryAddress?: string };
  Chat: { orderId: string; orderNumber: string; recipientName: string; recipientType: 'driver' | 'garage' };
  EditProfile: undefined;
  Addresses: { onSelect?: (address: Address) => void } | undefined;
  Settings: undefined;
  CounterOffer: { bidId: string; garageName: string; currentAmount: number; partDescription: string; garageCounterId?: string | null; requestId: string };
  Notifications: undefined;
  Support: undefined;
  TicketChat: { ticketId: string };
  // VIN Scanner - removed (unused)
  // Payment & Escrow
  Payment: {
    bidId: string;
    garageName: string;
    partPrice: number;
    deliveryFee: number;
    partDescription: string;
    _cacheKey?: string; // Cache-busting key
  };
  DeliveryTracking: { orderId: string };
  DeliveryConfirmation: { order?: any; escrow?: any };
  // Vehicles
  MyVehicles: undefined;
  // Temporary / Mixed
  Rewards: undefined;
  Requests: undefined;
  Orders: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyOTP: {
    email: string;
    full_name: string;
    phone_number: string;
    password: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Requests: undefined;
  Orders: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Tab Navigator with premium styling and badge counts
function MainTabs() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { requestsBadge, ordersBadge, profileBadge } = useBadgeCounts();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarBadgeStyle: {
          backgroundColor: Colors.primary,
          color: '#fff',
          fontSize: 10,
          fontWeight: '700',
          minWidth: 18,
          height: 18,
          borderRadius: 9,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{
          tabBarLabel: t('nav.requests'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🔍</Text>,
          tabBarBadge: requestsBadge,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: t('nav.orders'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>📦</Text>,
          tabBarBadge: ordersBadge,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>👤</Text>,
          tabBarBadge: profileBadge,
        }}
      />
    </Tab.Navigator>
  );
}

// Auth Navigator
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
    </AuthStack.Navigator>
  );
}

// Root Navigator with all screens
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>QScrap</Text>
      </View>
    );
  }

  return (
    <>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />

            {/* Request Flow */}
            <RootStack.Screen
              name="NewRequest"
              component={NewRequestScreen}
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <RootStack.Screen
              name="RequestDetail"
              component={RequestDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="CounterOffer"
              component={CounterOfferScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Order Flow */}
            <RootStack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Tracking"
              component={TrackingScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
            />
            <RootStack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Profile/Settings */}
            <RootStack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Addresses"
              component={AddressesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Support"
              component={SupportScreen}
              options={{ animation: 'slide_from_right' }}
            />
            {/* TicketChat removed - using WhatsApp-first support */}

            {/* VIN Scanner Flow - removed (unused) */}

            {/* Legal Screens */}
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

            {/* Payment & Escrow Flow */}
            <RootStack.Screen
              name="Payment"
              component={PaymentScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="DeliveryTracking"
              component={DeliveryTrackingScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
            />
            <RootStack.Screen
              name="DeliveryConfirmation"
              component={DeliveryConfirmationScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Vehicles */}
            <RootStack.Screen
              name="MyVehicles"
              component={MyVehiclesScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right'
              }}
            />
          </>
        )}
      </RootStack.Navigator>

      {/* Notification Overlay - Shows above all screens when authenticated */}
      {isAuthenticated && <NotificationOverlay />}
    </>
  );
}

// Main App with all providers
export default function App() {
  // Load Inter fonts for VVIP typography
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Show loading screen while fonts load
  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>QScrap</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <SocketProvider>
                <BadgeCountsProvider>
                  <ToastProvider>
                    <NavigationContainer>
                      <ThemedApp />
                    </NavigationContainer>
                  </ToastProvider>
                </BadgeCountsProvider>
              </SocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Themed wrapper component to access theme context
function ThemedApp() {
  const { isDarkMode } = useTheme();
  const { isAuthenticated } = useAuth();
  const { connect, disconnect } = useSocketContext();

  // Manage socket connection based on auth state
  React.useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 16,
  },
});
