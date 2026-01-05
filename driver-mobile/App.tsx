// QScrap Driver App - Main Entry Point
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { Colors } from './src/constants/theme';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import HomeScreen from './src/screens/tabs/HomeScreen';
import AssignmentsScreen from './src/screens/tabs/AssignmentsScreen';
import EarningsScreen from './src/screens/tabs/EarningsScreen';
import ProfileScreen from './src/screens/tabs/ProfileScreen';
import AssignmentDetailScreen from './src/screens/AssignmentDetailScreen';
import ChatScreen from './src/screens/ChatScreen';

// Navigation Types
export type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
    AssignmentDetail: { assignmentId: string };
    Chat: { orderId: string; orderNumber: string; recipientName: string };
    DeliveryConfirmation: { assignmentId: string };
    Settings: undefined;
};

export type AuthStackParamList = {
    Login: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Assignments: undefined;
    Earnings: undefined;
    Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main Tab Navigator with premium driver styling
function MainTabs() {
    const { colors } = useTheme();

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
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🏠</Text>,
                }}
            />
            <Tab.Screen
                name="Assignments"
                component={AssignmentsScreen}
                options={{
                    tabBarLabel: 'Tasks',
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>📋</Text>,
                }}
            />
            <Tab.Screen
                name="Earnings"
                component={EarningsScreen}
                options={{
                    tabBarLabel: 'Earnings',
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>💰</Text>,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>👤</Text>,
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
        </AuthStack.Navigator>
    );
}

// Root Navigator
function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();

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
            <RootNavigator />
        </>
    );
}

// Main App
export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <SocketProvider>
                            <NavigationContainer>
                                <ThemedApp />
                            </NavigationContainer>
                        </SocketProvider>
                    </AuthProvider>
                </ThemeProvider>
            </SafeAreaProvider>
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
