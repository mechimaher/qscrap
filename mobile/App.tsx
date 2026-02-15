// QScrap Customer App - Premium React Native with Full Features
import React from 'react';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as NotificationService from './src/services/notifications';
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

// Initialize Sentry — must be called before any React rendering
Sentry.init({
  dsn: 'https://0acc3f0a5f3bfffa51705b265d7ca596@o4510826572873728.ingest.de.sentry.io/4510890998825040',
  // Performance monitoring — sample 20% of transactions in production
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  // Only send errors in production builds
  enabled: !__DEV__,
  // Attach screenshots to error reports for visual context
  attachScreenshot: true,
  // Environment tag
  environment: __DEV__ ? 'development' : 'production',
  // Enrich errors with device context
  enableAutoSessionTracking: true,
  // Filter out noisy network errors that aren't real bugs
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || '';
    if (message.includes('Network request failed') || message.includes('AbortError')) {
      return null;
    }
    return event;
  },
});

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
import RequestDetailScreenBase from './src/screens/RequestDetailScreen';
import OrderDetailScreenBase from './src/screens/OrderDetailScreen';
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
// DeliveryTrackingScreen removed — consolidated into TrackingScreen
import MyVehiclesScreen from './src/screens/MyVehiclesScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';

// E2: Wrap critical screens with error boundaries for graceful degradation
import { withErrorBoundary } from './src/components';
const RequestDetailScreen = withErrorBoundary(RequestDetailScreenBase, { screenName: 'Request Details' });
const OrderDetailScreen = withErrorBoundary(OrderDetailScreenBase, { screenName: 'Order Details' });

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
  Tracking: { orderId: string; orderNumber?: string; deliveryAddress?: string };
  Chat: { orderId: string; orderNumber: string; recipientName: string; recipientType: 'driver' | 'garage' };
  EditProfile: undefined;
  Addresses: { onSelect?: (address: Address) => void } | undefined;
  Settings: undefined;
  CounterOffer: { bidId: string; garageName: string; currentAmount: number; partDescription: string; garageCounterId?: string | null; requestId: string };
  Notifications: undefined;
  Support: undefined;
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
  // DeliveryTracking removed — consolidated into Tracking
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

// Navigation ref for deep linking from notification taps
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{
          tabBarLabel: t('nav.requests'),
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
          tabBarBadge: requestsBadge,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: t('nav.orders'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
          tabBarBadge: ordersBadge,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
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
            {/* Delivery Confirmation */}
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

// Main App with all providers — wrapped with Sentry for automatic error capture
export default Sentry.wrap(function App() {
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
                    <NavigationContainer ref={navigationRef}>
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
});

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

  // Notification tap deep linking — navigate to relevant screen
  React.useEffect(() => {
    const subscription = NotificationService.addNotificationResponseListener(response => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      if (!data?.type || !navigationRef.isReady()) return;

      switch (data.type) {
        case 'new_bid':
        case 'bid_updated':
        case 'counter_offer':
        case 'counter_offer_accepted':
        case 'counter_offer_final':
        case 'request_expired':
        case 'bid_withdrawn':
          if (data.requestId) {
            navigationRef.navigate('RequestDetail', { requestId: data.requestId });
          }
          break;
        case 'order_update':
        case 'driver_assigned':
        case 'order_delivered':
        case 'order_cancelled':
          if (data.orderId) {
            navigationRef.navigate('OrderDetail', { orderId: data.orderId });
          }
          break;
        case 'chat_message':
          if (data.orderId) {
            navigationRef.navigate('Chat', {
              orderId: data.orderId,
              orderNumber: data.orderNumber || '',
              recipientName: data.senderName || '',
              recipientType: data.senderType === 'driver' ? 'driver' : 'garage',
            });
          }
          break;
        case 'support_reply':
          navigationRef.navigate('Support');
          break;
      }
    });

    return () => subscription.remove();
  }, []);

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
