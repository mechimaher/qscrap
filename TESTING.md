# QScrap Testing Guide

Comprehensive testing documentation for the QScrap platform.

---

## 📊 Test Coverage Goals

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Branches** | 70% | ~20% | ⚠️ Needs Work |
| **Functions** | 70% | ~20% | ⚠️ Needs Work |
| **Lines** | 70% | ~20% | ⚠️ Needs Work |
| **Statements** | 70% | ~20% | ⚠️ Needs Work |

---

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

---

## 📋 Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:ci` | Run tests for CI environment |
| `npm run test:unit` | Run only unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:auth` | Run authentication tests |
| `npm run test:middleware` | Run middleware tests |
| `npm run test:services` | Run service layer tests |
| `npm run test:controllers` | Run controller tests |
| `npm run test:contract` | Run contract tests |
| `./scripts/run-tests.sh` | Run tests with bash script |

---

## 🗂️ Test Structure

```
qscrap/
├── src/
│   ├── __tests__/
│   │   ├── setup/
│   │   │   └── jest.setup.ts          # Global test setup & mocks
│   │   └── utils/
│   │       └── test-utils.ts          # Test utilities & factories
│   ├── controllers/__tests__/
│   │   └── auth.controller.test.ts    # Auth controller tests
│   ├── middleware/__tests__/
│   │   ├── auth.middleware.test.ts    # Auth middleware tests
│   │   ├── security.middleware.test.ts # Security middleware tests
│   │   └── csrf.middleware.test.ts    # CSRF middleware tests
│   ├── routes/__tests__/
│   │   ├── auth.test.ts               # Auth route tests
│   │   └── payments.route-precedence.test.ts
│   ├── services/__tests__/
│   │   ├── bid.service.test.ts        # Bid service tests
│   │   ├── loyalty.service.test.ts    # Loyalty service tests
│   │   ├── order.service.test.ts      # Order service tests
│   │   ├── return.service.test.ts     # Return service tests
│   │   ├── cancellation.service.test.ts
│   │   └── subscription.service.test.ts
│   └── security/__tests__/
│       └── websocket-hardening.test.ts
├── tests/
│   └── contract/
│       ├── basic.test.ts              # Basic contract tests
│       └── core-flows.test.ts         # End-to-end flow tests
└── mobile/
    └── src/
        └── __tests__/
            ├── api.test.ts
            ├── apiConfig.test.ts
            ├── integration.test.ts
            └── utils.test.ts
```

---

## 🧪 Test Types

### 1. Unit Tests
Test individual functions and components in isolation.

**Example:**
```typescript
describe('validateBidAmount', () => {
    it('should validate valid bid amount', () => {
        const result = validateBidAmount(100);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(100);
    });

    it('should reject negative amount', () => {
        const result = validateBidAmount(-50);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Bid amount must be greater than zero');
    });
});
```

### 2. Integration Tests
Test interactions between multiple components.

**Example:**
```typescript
describe('Flow: Customer Registration & Login', () => {
    it('should register a new customer', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                full_name: 'Test Customer',
                phone_number: '+97430000001',
                password: 'TestPass123!',
                user_type: 'customer'
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('token');
    });
});
```

### 3. Contract Tests
Verify API endpoints return expected schemas.

**Example:**
```typescript
it('GET /api/health should return valid health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('database');
});
```

---

## 🛠️ Test Utilities

### Test Data Factories

Located in `src/__tests__/utils/test-utils.ts`

```typescript
import {
    generateTestId,
    generateTestPhone,
    generateTestEmail,
    createTestUserData,
    insertTestUser,
    cleanupTestData
} from '../__tests__/utils/test-utils';

// Generate test data
const userId = generateTestId();
const phone = generateTestPhone();
const email = generateTestEmail();

// Insert test user
const userId = await insertTestUser({
    phone_number: '+97430000001',
    user_type: 'customer'
});

// Cleanup after tests
await cleanupTestData({
    userIds: [userId],
    orderIds: [orderId]
});
```

### Custom Jest Matchers

```typescript
// UUID validation
expect('123e4567-e89b-12d3-a456-426614174000').toBeValidUUID();

// Qatar phone validation
expect('+97430000001').toBeQatarPhone();

// Standard error response
expect(response).toBeStandardError();

// Standard success response
expect(response).toBeStandardSuccess();
```

---

## 📝 Writing Tests

### Best Practices

1. **Use descriptive test names**
```typescript
it('should reject registration with invalid phone number', () => {
    // ...
});
```

2. **Arrange-Act-Assert pattern**
```typescript
it('should create order from bid', async () => {
    // Arrange
    const params = { bidId: '...', customerId: '...' };

    // Act
    const result = await createOrderFromBid(params);

    // Assert
    expect(result.order).toBeDefined();
    expect(result.totalAmount).toBe(175);
});
```

3. **Clean up test data**
```typescript
afterAll(async () => {
    await cleanupTestData({ userIds: [testUserId] });
});
```

4. **Mock external dependencies**
```typescript
jest.mock('../../config/db');
jest.mock('../../services/email.service');
jest.mock('stripe');
```

5. **Test edge cases**
```typescript
it('should handle zero amount', () => { ... });
it('should handle null values', () => { ... });
it('should handle undefined', () => { ... });
it('should handle maximum value', () => { ... });
```

---

## 🔧 Configuration

### Jest Config (`jest.config.json`)

```json
{
    "coverageThreshold": {
        "global": {
            "branches": 70,
            "functions": 70,
            "lines": 70,
            "statements": 70
        }
    },
    "testTimeout": 30000,
    "coverageReporters": ["text", "lcov", "html", "clover"]
}
```

### Test Environment

Tests run with:
- `NODE_ENV=test`
- Separate test database (`qscrap_test`)
- Mocked Redis and external services
- 30 second timeout for integration tests

---

## 🐛 Debugging Tests

### Run specific test file
```bash
npm test -- auth.controller.test.ts
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="should reject invalid"
```

### Run with verbose output
```bash
npm test -- --verbose
```

### Debug with Node inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Clear Jest cache
```bash
npm run test:clear
```

---

## 📈 Coverage Reports

### View HTML Report
```bash
npm run test:coverage
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Coverage Thresholds

Current thresholds in `jest.config.json`:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

---

## 🎯 Testing Checklist

Before submitting code:

- [ ] New features have unit tests
- [ ] Critical flows have integration tests
- [ ] Edge cases are covered
- [ ] Error scenarios are tested
- [ ] Tests pass locally
- [ ] Coverage hasn't decreased significantly
- [ ] Mock external services appropriately
- [ ] Clean up test data after tests

---

## 🚨 Common Issues

### "Too many open files"
```bash
# Increase file descriptor limit
ulimit -n 4096
```

### Database connection errors
```bash
# Ensure test database exists
createdb -U postgres qscrap_test

# Or set environment variables
export TEST_DB_HOST=localhost
export TEST_DB_NAME=qscrap_test
```

### Tests timing out
```bash
# Increase timeout for specific test
jest.setTimeout(60000);

# Or run with longer timeout
npm test -- --testTimeout=60000
```

### Mock not working
```typescript
// Make sure to mock before import
jest.mock('../../config/db');
import pool from '../../config/db';

// Reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
});
```

---

## 📚 Test Files Reference

### Core Tests

| File | Coverage | Description |
|------|----------|-------------|
| `auth.controller.test.ts` | Auth | Login, register, token refresh |
| `auth.middleware.test.ts` | Middleware | JWT validation, role checks |
| `security.middleware.test.ts` | Middleware | Headers, sanitization |
| `bid.service.test.ts` | Service | Bid creation, validation |
| `order.service.test.ts` | Service | Order lifecycle |
| `loyalty.service.test.ts` | Service | Points, rewards, tiers |
| `core-flows.test.ts` | Integration | End-to-end user flows |

---

## 🎓 Learning Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

---

**Last Updated:** February 18, 2026
**Version:** 2.0
