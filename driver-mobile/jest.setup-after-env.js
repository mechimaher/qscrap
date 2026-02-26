// Jest Setup After Env - Test cleanup hooks
// This file runs AFTER the test environment is set up
// Use this for afterEach, afterAll, beforeEach, beforeAll hooks

// Clean up all mocks after each test to prevent open handles
afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset all mocks to their initial state
    jest.resetAllMocks();
    
    // Clear all timers (prevents timeout leaks)
    jest.clearAllTimers();
});

// Final cleanup after all tests
afterAll(async () => {
    // Wait for any pending promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Force garbage collection of mocks
    jest.resetModules();
});
