module.exports = {
    preset: 'jest-expo',
    testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
    transform: {
        '^.+\\.(ts|tsx)$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!.*\\.js$|react-native|react-native-web|expo.*|@expo/.*|@expo-google-fonts/.*|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-mmkv|expo-modules-core)',
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
    globals: {
        __DEV__: true,
        'ts-jest': {
            tsconfig: {
                jsx: 'react-jsx',
                esModuleInterop: true,
                allowJs: true,
                moduleResolution: 'node',
                resolveJsonModule: true,
                isolatedModules: true,
            },
        },
    },
    modulePathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/android/',
        '<rootDir>/ios/',
    ],
};
