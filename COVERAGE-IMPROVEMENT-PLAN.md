# 📊 QScrap Test Coverage Improvement Plan

**Current Status:** 24% average coverage  
**Target:** 70% coverage  
**Gap:** 46% to close

---

## 🎯 **Priority Services for Test Coverage**

### **Tier 1: Quick Wins (50%+ current coverage)**

| Service | Current | Tests Needed | Estimated Effort |
|---------|---------|--------------|------------------|
| **FraudDetectionService** | 56% | +15 tests | 2 hours |
| **RequestService** | 44% | +20 tests | 3 hours |
| **OrderService** | 37% | +18 tests | 3 hours |

**Total Impact:** +10-15% coverage

---

### **Tier 2: Medium Impact (15-30% current)**

| Service | Current | Tests Needed | Estimated Effort |
|---------|---------|--------------|------------------|
| **SearchService** | 15% | +15 tests | 2 hours |
| **VehicleService** | 16% | +12 tests | 2 hours |
| **ReviewsService** | 10% | +10 tests | 2 hours |
| **FinanceServices** | 10% | +25 tests | 4 hours |

**Total Impact:** +15-20% coverage

---

### **Tier 3: High Effort (<10% current)**

| Service | Current | Tests Needed | Estimated Effort |
|---------|---------|--------------|------------------|
| **SupportService** | 9% | +40 tests | 6 hours |
| **SubscriptionService** | 5% | +35 tests | 6 hours |
| **NegotiationService** | 10% | +25 tests | 4 hours |
| **DocumentServices** | 6-13% | +30 tests | 5 hours |

**Total Impact:** +20-25% coverage

---

## 📝 **Test Templates**

### **Template for Service Tests**

```typescript
/**
 * [ServiceName] Tests
 * Coverage Target: 70%
 */

import { [ServiceName] } from '../[path]/[service].service';
import pool from '../../config/db';

jest.mock('../../config/db');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('[ServiceName]', () => {
    let service: [ServiceName];

    beforeEach(() => {
        jest.clearAllMocks();
        service = new [ServiceName](mockPool as any);
    });

    describe('[Method1]', () => {
        it('should [success scenario]', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [...] });

            // Act
            const result = await service.[method](params);

            // Assert
            expect(result).toBeDefined();
        });

        it('should handle [error scenario]', async () => {
            // Arrange
            mockPool.query.mockRejectedValue(new Error('DB error'));

            // Act & Assert
            await expect(service.[method](params))
                .rejects.toThrow('Expected error');
        });
    });
});
```

---

## 🚀 **Implementation Strategy**

### **Week 1: Tier 1 Services**
- [ ] FraudDetectionService (56% → 75%)
- [ ] RequestService (44% → 70%)
- [ ] OrderService (37% → 70%)

**Expected Coverage:** 35-40%

### **Week 2: Tier 2 Services**
- [ ] SearchService (15% → 70%)
- [ ] VehicleService (16% → 70%)
- [ ] ReviewsService (10% → 70%)
- [ ] FinanceServices (10% → 70%)

**Expected Coverage:** 50-55%

### **Week 3: Tier 3 Services**
- [ ] SupportService (9% → 70%)
- [ ] SubscriptionService (5% → 70%)
- [ ] NegotiationService (10% → 70%)

**Expected Coverage:** 65-70%

### **Week 4: Buffer & Polish**
- [ ] Document services
- [ ] Edge cases
- [ ] Integration tests
- [ ] Coverage report verification

**Expected Coverage:** 70%+ ✅

---

## 📊 **Coverage Tracking**

Run weekly to track progress:

```bash
npm run test:coverage
open coverage/index.html
```

**Key Metrics to Monitor:**
- Statements: 24% → 70%
- Branches: 9% → 70%
- Functions: 15% → 70%
- Lines: 22% → 70%

---

## 🎯 **Quick Start Guide**

### **1. Pick a Service**
Choose from Tier 1 for easiest wins.

### **2. Read the Service Code**
Understand the main methods and edge cases.

### **3. Create Test File**
```bash
touch src/services/__tests__/[service].test.ts
```

### **4. Write Tests**
- Success scenarios (60% of tests)
- Error scenarios (25% of tests)
- Edge cases (15% of tests)

### **5. Run Tests**
```bash
npm test -- src/services/__tests__/[service].test.ts
```

### **6. Verify Coverage**
```bash
npm run test:coverage -- --testPathPattern=[service]
```

---

## ✅ **Completed Tests**

| Test File | Coverage Impact | Status |
|-----------|----------------|--------|
| webhook-flows.test.ts | +3% | ✅ Done |
| core-flows.test.ts | +5% | ✅ Done |
| fraud-detection (planned) | +5% | ⏳ Planned |
| request-service (planned) | +8% | ⏳ Planned |

---

## 📈 **Progress Tracker**

```
Current:  ████████░░░░░░░░░░░░ 24%
Target:   ██████████████████████ 70%

Week 1:   ██████████░░░░░░░░░░░░ 35%
Week 2:   ███████████████░░░░░░░ 55%
Week 3:   ███████████████████░░░ 70% ✅
```

---

## 🎓 **Best Practices**

1. **Mock Database Queries**
   ```typescript
   mockPool.query.mockResolvedValue({ rows: [...] });
   ```

2. **Test Edge Cases**
   - Null/undefined inputs
   - Empty arrays
   - Maximum values
   - Database errors

3. **Use Descriptive Names**
   ```typescript
   it('should block garage exceeding rate limit', async () => {
   ```

4. **Clean Up After Tests**
   ```typescript
   afterEach(() => {
       jest.clearAllMocks();
   });
   ```

---

## 📞 **Need Help?**

- Check existing tests in `src/services/__tests__/`
- Review TESTING.md for guidelines
- Look at webhook-flows.test.ts for integration test examples

---

**Last Updated:** February 18, 2026  
**Current Coverage:** 24%  
**Next Milestone:** 35% (Tier 1 complete)
