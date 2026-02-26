module.exports = {
    preset: 'jest-expo',
    testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
    transform: {
        '^.+\\.(ts|tsx)$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!.*\\.js$|react-native|react-native-web|expo.*|@expo/.*|@expo-google-fonts/.*|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-mmkv|expo-modules-core|react-native-reanimated)',
    ],
    moduleNameMapper: {
        '\\.png$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
        '\\.jpg$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
        '\\.jpeg$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
    },
    setupFiles: ['./jest.setup.js'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
    ],
    testEnvironment: 'node',
    modulePathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/android/',
        '<rootDir>/ios/',
    ],
    // Force exit to prevent hanging
    forceExit: true,
    // Detect open handles
    detectOpenHandles: true,
    // Timeout for tests
    testTimeout: 10000,
    // Clear mocks between tests
    clearMocks: true,
};
