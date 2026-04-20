// QScrap Mobile - Jest Setup File
// Global mocks for Expo and React Native modules

// Mock react-native (must be first since other mocks depend on it)
jest.mock('react-native', () => {
    const React = require('react');
    const MockView = (props) => React.createElement('View', props, props.children);
    const MockText = (props) => React.createElement('Text', props, props.children);
    const MockTouchableOpacity = (props) => React.createElement('TouchableOpacity', props, props.children);
    const MockScrollView = (props) => React.createElement('ScrollView', props, props.children);
    const MockTextInput = (props) => React.createElement('TextInput', props);
    const MockImage = (props) => React.createElement('Image', props);
    const MockFlatList = (props) => React.createElement('FlatList', props);
    const MockActivityIndicator = (props) => React.createElement('ActivityIndicator', props);
    return {
        View: MockView,
        Text: MockText,
        TouchableOpacity: MockTouchableOpacity,
        ScrollView: MockScrollView,
        TextInput: MockTextInput,
        Image: MockImage,
        FlatList: MockFlatList,
        ActivityIndicator: MockActivityIndicator,
        StyleSheet: { create: (s) => s, flatten: (s) => s, hairlineWidth: 1 },
        Platform: { OS: 'android', select: (obj) => obj.android || obj.default },
        Dimensions: { get: () => ({ width: 375, height: 812 }) },
        Animated: {
            View: MockView,
            Text: MockText,
            ScrollView: MockScrollView,
            Value: jest.fn(() => ({
                setValue: jest.fn(),
                interpolate: jest.fn(() => ({ __getValue: jest.fn() })),
            })),
            timing: jest.fn(() => ({ start: jest.fn() })),
            spring: jest.fn(() => ({ start: jest.fn() })),
            parallel: jest.fn(() => ({ start: jest.fn() })),
            sequence: jest.fn(() => ({ start: jest.fn() })),
            event: jest.fn(),
        },
        Alert: { alert: jest.fn() },
        Linking: { openURL: jest.fn() },
        AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
        I18nManager: { isRTL: false, forceRTL: jest.fn() },
        Keyboard: { dismiss: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) },
        PixelRatio: { get: () => 2, roundToNearestPixel: (v) => v },
        StatusBar: { setBarStyle: jest.fn() },
        Switch: MockView,
    };
});

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-image
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return {
        Image: View,
    };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
    const { View } = require('react-native');
    return {
        LinearGradient: View,
    };
});

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({
        coords: { latitude: 25.2854, longitude: 51.531 },
    }),
    reverseGeocodeAsync: jest.fn().mockResolvedValue([{ city: 'Doha', country: 'Qatar' }]),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setNotificationHandler: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
    openURL: jest.fn(),
    createURL: jest.fn((path) => `qscrap://${path}`),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
    isDevice: true,
    brand: 'TestDevice',
    modelName: 'TestModel',
    osName: 'android',
}));

// Mock expo-font
jest.mock('expo-font', () => ({
    useFonts: jest.fn(() => [true, null]),
    isLoaded: jest.fn(() => true),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: View,
        SafeAreaProvider: View,
        useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    };
});

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiGet: jest.fn().mockResolvedValue([]),
}));

// Mock @stripe/stripe-react-native
jest.mock('@stripe/stripe-react-native', () => ({
    StripeProvider: ({ children }) => children,
    useStripe: () => ({
        initPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
        presentPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
        confirmPayment: jest.fn().mockResolvedValue({ error: null }),
    }),
    CardField: 'CardField',
}));

// Mock socket.io-client
jest.mock('socket.io-client', () => {
    const mockSocket = {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        connected: true,
        id: 'test-socket-id',
    };
    return { io: jest.fn(() => mockSocket) };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
    }),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
    const { View, TouchableOpacity } = require('react-native');
    return {
        Swipeable: View,
        DrawerLayout: View,
        State: {},
        ScrollView: View,
        Slider: View,
        Switch: View,
        TextInput: View,
        ToolbarAndroid: View,
        ViewPagerAndroid: View,
        DrawerLayoutAndroid: View,
        WebView: View,
        NativeViewGestureHandler: View,
        TapGestureHandler: View,
        FlingGestureHandler: View,
        ForceTouchGestureHandler: View,
        LongPressGestureHandler: View,
        PanGestureHandler: View,
        PinchGestureHandler: View,
        RotationGestureHandler: View,
        RawButton: TouchableOpacity,
        BaseButton: TouchableOpacity,
        RectButton: TouchableOpacity,
        BorderlessButton: TouchableOpacity,
        FlatList: View,
        gestureHandlerRootHOC: jest.fn((component) => component),
        Directions: {},
        GestureHandlerRootView: View,
    };
});

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
    StatusBar: 'StatusBar',
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
    documentDirectory: '/mock/documents/',
    cacheDirectory: '/mock/cache/',
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: View,
        Marker: View,
        Callout: View,
        PROVIDER_GOOGLE: 'google',
    };
});

// Mock @react-navigation
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        dispatch: jest.fn(),
        reset: jest.fn(),
        setOptions: jest.fn(),
    }),
    useFocusEffect: jest.fn((cb) => cb()),
    useRoute: () => ({ params: {} }),
    useIsFocused: () => true,
}));

jest.mock('@react-navigation/native-stack', () => ({
    createNativeStackNavigator: jest.fn(() => ({
        Navigator: 'Navigator',
        Screen: 'Screen',
    })),
}));

// Suppress console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
    if (
        typeof args[0] === 'string' &&
        (args[0].includes('Animated') ||
            args[0].includes('useNativeDriver') ||
            args[0].includes('NativeModule'))
    ) {
        return;
    }
    originalWarn(...args);
};

// Mock global fetch
global.fetch = jest.fn();
