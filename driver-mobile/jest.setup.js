// Jest Setup File for QScrap Driver App
// Minimal mocks compatible with jest-expo preset
// Senior Dev Note: Only mock what's NOT already mocked by jest-expo

// ========== CRITICAL MOCKS (jest-expo doesn't provide these) ==========

// Mock NativeModules to prevent TurboModuleRegistry issues
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
    get: jest.fn(),
    getEnforcing: jest.fn(() => ({})),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() =>
        Promise.resolve({
            coords: { latitude: 25.2854, longitude: 51.5310 },
        })
    ),
    watchPositionAsync: jest.fn(() => ({
        remove: jest.fn(),
    })),
    startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
    stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
    hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
    Accuracy: {
        Lowest: 1,
        Low: 2,
        Balanced: 3,
        High: 4,
        Highest: 5,
        BestForNavigation: 6,
    },
    ActivityType: {
        Other: 1,
        AutomotiveNavigation: 2,
        Fitness: 3,
        OtherNavigation: 4,
        Airborne: 5,
    },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error',
    },
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
        Heavy: 'heavy',
    },
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn(() =>
        Promise.resolve({
            uri: 'compressed-uri',
            width: 1920,
            height: 1080,
        })
    ),
    SaveFormat: {
        JPEG: 'jpeg',
        PNG: 'png',
    },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
    getInfoAsync: jest.fn(() => Promise.resolve({ size: 1024 })),
    readAsStringAsync: jest.fn(() => Promise.resolve('base64data')),
    copyAsync: jest.fn(() => Promise.resolve({ uri: 'copied-uri' })),
    documentDirectory: 'file:///mock/documents/',
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
    speak: jest.fn(),
    stop: jest.fn(),
    isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
    defineTask: jest.fn(),
    isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
    unregisterTaskAsync: jest.fn(() => Promise.resolve()),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
    MMKV: jest.fn().mockImplementation(() => ({
        set: jest.fn(),
        getString: jest.fn(),
        getNumber: jest.fn(),
        getBoolean: jest.fn(),
        delete: jest.fn(),
    })),
}));

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
    io: jest.fn(() => ({
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
        connected: false,
    })),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    wrap: jest.fn((component) => component),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
}));

// ========== GLOBAL UTILITIES ==========

global.fetch = jest.fn();
global.console = {
    ...global.console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
