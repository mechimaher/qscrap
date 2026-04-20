module.exports = {
    testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx',
                esModuleInterop: true,
                allowJs: true,
                strict: true,
                moduleResolution: 'node',
                resolveJsonModule: true,
                isolatedModules: true,
            },
        }],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(expo-secure-store|expo-haptics|expo-image|expo-linear-gradient|expo-location|expo-notifications|expo-linking|expo-device|expo-font|expo-status-bar|expo-file-system)/)',
    ],
    moduleNameMapper: {
        '\\.png$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
        '\\.jpg$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
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
    },
};
