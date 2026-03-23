module.exports = {
    testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(expo.*|@expo/.*|react-native|@react-native|@react-navigation|@stripe/.*|@sentry/.*)/)'
    ],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '\\.png$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
        '\\.jpg$': '<rootDir>/src/__tests__/__mocks__/fileMock.js'
    },
    moduleDirectories: ['node_modules', '<rootDir>/src'],
    setupFiles: ['./jest.setup.js'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
    testEnvironment: 'node',
    globals: {
        __DEV__: true
    }
};
