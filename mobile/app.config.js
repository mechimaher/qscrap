/**
 * QScrap Mobile App Configuration
 * 
 * Converted from app.json to app.config.js to support environment variables.
 * This allows secure management of API keys via .env files or EAS Secrets.
 */

module.exports = ({ config }) => {
    return {
        ...config,
        name: 'QScrap',
        slug: 'qa-qscrap-app',
        version: '1.1.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        scheme: 'qscrap',
        owner: 'mechimaher',
        runtimeVersion: {
            policy: 'appVersion',
        },
        updates: {
            url: 'https://u.expo.dev/47b26c9d-3bd0-4470-8543-dd303a49b287',
            fallbackToCacheTimeout: 30000,
        },
        splash: {
            image: './assets/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#8D1B3D',
        },
        notification: {
            icon: './assets/notification-icon.png',
            color: '#8D1B3D',
            androidMode: 'default',
            androidCollapsedTitle: 'QScrap',
        },
        ios: {
            bundleIdentifier: 'qa.qscrap.app',
            buildNumber: '1',
            supportsTablet: true,
            usesAppleSignIn: false,
            config: {
                usesNonExemptEncryption: false,
            },
            infoPlist: {
                NSCameraUsageDescription: 'QScrap needs camera access to take photos of car parts for your spare parts requests',
                NSPhotoLibraryUsageDescription: 'QScrap needs photo library access to upload images of car parts you\'re looking for',
                NSLocationWhenInUseUsageDescription: 'QScrap needs your location to find nearby garages and calculate accurate delivery fees for your area',
                UIBackgroundModes: ['fetch', 'remote-notification'],
            },
            entitlements: {
                'aps-environment': 'production',
            },
        },
        android: {
            package: 'qa.qscrap.app',
            versionCode: 1,
            adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: '#FFFFFF',
            },
            permissions: [
                'android.permission.CAMERA',
                'android.permission.READ_EXTERNAL_STORAGE',
                'android.permission.READ_MEDIA_IMAGES',
                'android.permission.ACCESS_FINE_LOCATION',
                'android.permission.ACCESS_COARSE_LOCATION',
                'android.permission.INTERNET',
                'android.permission.VIBRATE',
                'android.permission.RECEIVE_BOOT_COMPLETED',
                'android.permission.SCHEDULE_EXACT_ALARM',
                'android.permission.POST_NOTIFICATIONS',
            ],
            useNextNotificationsApi: true,
            config: {
                googleMaps: {
                    // Read from environment variable, fallback to existing key for backwards compatibility
                    apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBtetLMBqtW1TNNsBFWi5Xa4LTy1GEbwYw',
                },
            },
        },
        web: {
            favicon: './assets/favicon.png',
        },
        plugins: [
            'expo-secure-store',
            [
                'expo-notifications',
                {
                    icon: './assets/notification-icon.png',
                    color: '#8D1B3D',
                    defaultChannel: 'default',
                },
            ],
            [
                'expo-location',
                {
                    locationAlwaysAndWhenInUsePermission: 'QScrap needs your location to find nearby garages and calculate delivery fees.',
                },
            ],
            [
                'expo-image-picker',
                {
                    photosPermission: 'QScrap needs photo library access to upload part images.',
                },
            ],
            [
                'expo-build-properties',
                {
                    android: {
                        compileSdkVersion: 35,
                        targetSdkVersion: 35,
                        minSdkVersion: 24,
                        buildToolsVersion: '35.0.0',
                        kotlinVersion: '2.1.20',
                        usesCleartextTraffic: false,
                    },
                    ios: {
                        deploymentTarget: '15.1',
                        useFrameworks: 'static',
                    },
                },
            ],
            'expo-localization',
            [
                '@stripe/stripe-react-native',
                {
                    merchantIdentifier: 'merchant.qa.qscrap.app',
                    enableGooglePay: true,
                },
            ],
            'expo-font',
            [
                '@sentry/react-native',
                {
                    organization: 'qscrap',
                    project: 'qscrap-customer',
                },
            ],
        ],
        extra: {
            privacyPolicyUrl: 'https://qscrap.qa/privacy',
            termsOfServiceUrl: 'https://qscrap.qa/terms',
            supportEmail: 'support@qscrap.qa',
            // Make environment variables available to app via Constants.expoConfig.extra
            GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
            STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            eas: {
                projectId: '47b26c9d-3bd0-4470-8543-dd303a49b287',
            },
        },
    };
};
