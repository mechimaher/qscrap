// Jest setup file - runs before all tests
process.env.NODE_ENV = 'test';

// Test database configuration
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'sammil_admin';
process.env.DB_PASSWORD = 'sammil_secure_2026';
process.env.DB_NAME = 'qscrap_test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only_32chars';
process.env.REDIS_URL = 'redis://localhost:6379';
