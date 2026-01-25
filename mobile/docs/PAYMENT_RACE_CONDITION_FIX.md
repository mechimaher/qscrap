# Payment Screen Race Condition Fix

## Issue Description
When switching from "Cash on Delivery" to "Pay Full Amount" on the PaymentScreen, users encountered an "Unexpected Error". However, reloading the screen directly with "Pay Full Amount" selected worked correctly.

## Root Cause
**Race Condition in Payment Initialization**

The PaymentScreen had **two concurrent useEffect hooks** that could both trigger `initializePayment()` simultaneously when switching payment types:

1. **Lines 103-107**: Checks `if (orderId && !clientSecret)` and calls `initializePayment()`
2. **Lines 109-132**: Triggers on `[applyDiscount, paymentType]` changes and also calls `initializePayment()`

### The Race Condition Flow:
```
User clicks "Pay Full Amount"
  ↓
setPaymentType('full') is called
  ↓
setClientSecret(null) is called (line 414)
  ↓
BOTH useEffect hooks detect changes simultaneously:
  - Hook 1 (line 103): Sees !clientSecret → calls initializePayment()
  - Hook 2 (line 109): Sees paymentType changed → calls initializePayment()
  ↓
Two concurrent API calls to backend
  ↓
Backend receives conflicting requests
  ↓
"An unexpected error" returned
```

When reloading the screen directly with "Pay Full Amount", there's no switching action, so only one initialization occurs cleanly.

## Solution Implemented

### 1. **Added Initialization Guard with useRef** (Lines 71-72)
```typescript
// Track if initialization is in progress to prevent race conditions
const isInitializing = useRef(false);
```

### 2. **Guard Logic in initializePayment()** (Lines 135-139, 203)
```typescript
const initializePayment = async () => {
    // Prevent concurrent initialization calls
    if (isInitializing.current) {
        console.log('[Payment] ⚠️ Initialization already in progress, skipping...');
        return;
    }

    isInitializing.current = true;
    setIsCreatingOrder(true);
    try {
        // ... payment logic
    } finally {
        setIsCreatingOrder(false);
        isInitializing.current = false; // Reset guard
    }
};
```

### 3. **Debounce Timer for Payment Type Changes** (Lines 126-131)
```typescript
// Debounce re-initialization to prevent race conditions when switching rapidly
const timer = setTimeout(() => {
    initializePayment();
}, 300);

return () => clearTimeout(timer);
```

## How It Works

1. **Guard Check**: When `initializePayment()` is called, it first checks if initialization is already in progress
2. **Skip Concurrent Calls**: If another initialization is running, the function returns early
3. **Debounce**: The 300ms delay ensures rapid switches don't trigger multiple calls
4. **Cleanup**: The timer cleanup in the useEffect return prevents stale calls

## Testing Checklist

- [ ] Switch from "Cash on Delivery" to "Pay Full Amount" - should work without error
- [ ] Switch from "Pay Full Amount" to "Cash on Delivery" - should work without error
- [ ] Rapidly toggle between payment types - should handle gracefully
- [ ] Direct load with "Pay Full Amount" - should continue working
- [ ] Toggle loyalty discount while switching payment types - should work correctly

## Files Modified
- `/home/user/qscrap.qa/mobile/src/screens/PaymentScreen.tsx`

## Complexity: 8/10
This fix addresses a subtle race condition that only manifests during user interaction (switching payment types), not on initial load. The solution uses React refs and debouncing to ensure atomic payment initialization.
