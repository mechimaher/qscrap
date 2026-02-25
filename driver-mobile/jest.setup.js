// Jest Setup File for QScrap Driver App
// Mocks for React Native and Expo modules

// Mock React Native modules
jest.mock('react-native', () => {
    const actual = jest.requireActual('react-native');
    return {
        ...actual,
        Alert: {
            alert: jest.fn(),
        },
        Platform: {
            ...actual.Platform,
            OS: 'android',
        },
        FlatList: jest.fn().mockImplementation(({ data, renderItem, keyExtractor }) => {
            // Very simple FlatList mock that just renders the items
            if (!data || !renderItem) return null;
            return data.map((item, index) => {
                const key = keyExtractor ? keyExtractor(item, index) : index;
                return renderItem({ item, index });
            });
        }),
    };
});

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() =>
        Promise.resolve({
            coords: { latitude: 25.2854, longitude: 51.5310 },
        })
    ),
    watchPositionAsync: jest.fn(() => ({
        remove: jest.fn(),
    })),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-camera
jest.mock('expo-camera', () => ({
    CameraView: 'CameraView',
    useCameraPermissions: jest.fn(() => [true, jest.fn()]),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
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
    })),
}));

// Mock zustand
jest.mock('zustand', () => {
    const actual = jest.requireActual('zustand');
    return {
        ...actual,
        create: jest.fn((createState) => {
            const store = createState(jest.fn(), jest.fn());
            return jest.fn(() => store);
        }),
    };
});

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
    getInfoAsync: jest.fn(() => Promise.resolve({ size: 1024 })),
    readAsStringAsync: jest.fn(() => Promise.resolve('base64data')),
    copyAsync: jest.fn(() => Promise.resolve({ uri: 'copied-uri' })),
    documentDirectory: 'file:///mock/documents/',
}));

// Mock expo-image-manipulator (for image compression tests)
jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn((uri, actions, options) =>
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

// Global test utilities
global.fetch = jest.fn();
global.console = {
    ...global.console,
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock VirtualizedList to fix react-native imports
jest.mock('@react-native/virtualized-lists', () => {
    return {
        VirtualizedList: jest.fn().mockImplementation(({ children }) => children || null),
    };
});

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    wrap: jest.fn((component) => component),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    configureScope: jest.fn(),
    setTag: jest.fn(),
    setUser: jest.fn(),
}));
