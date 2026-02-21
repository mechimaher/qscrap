/**
 * QuickBidStore.test.js
 * Contract tests for QuickBidStore.
 *
 * Run with: node --experimental-vm-modules QuickBidStore.test.js
 * Or with Jest: jest QuickBidStore.test.js
 *
 * These tests verify the data model and state machine contracts,
 * not implementation details. If a test breaks after a refactor,
 * the contract was violated — not just an internal detail.
 */

import {
    QuickBidStore,
    SESSION_STATUS,
    ITEM_STATUS,
    AVAILABILITY,
    CONDITION,
    EVENTS,
} from './QuickBidStore.js';


// ─────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────

const GARAGE_ID = 'garage_test_001';

const mockRequests = [
    {
        id: 'req_001',
        partName: 'Alternator',
        partNumber: 'ALT-4501',
        vin: '1HGCM82633A004352',
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        buyerNote: 'Must be original Denso.',
    },
    {
        id: 'req_002',
        partName: 'Front Bumper',
        partNumber: 'FB-9901',
        vin: '2T1BURHE0JC043821',
        make: 'Honda',
        model: 'Civic',
        year: 2019,
        buyerNote: '',
    },
    {
        id: 'req_003',
        partName: 'Engine Mount',
        partNumber: 'EM-2211',
        vin: '5NPEB4AC2BH310736',
        make: 'Hyundai',
        model: 'Elantra',
        year: 2018,
        buyerNote: 'Both sides needed.',
    },
];

// Minimal localStorage mock for non-browser environments
function mockLocalStorage() {
    const store = {};
    return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; },
        _store: store,
    };
}

function makeStore(overrides = {}) {
    return new QuickBidStore({ garageId: GARAGE_ID, ...overrides });
}

async function makeInitializedStore(requests = mockRequests) {
    const store = makeStore();
    await store.init(requests);
    return store;
}


// ─────────────────────────────────────────────
// MINIMAL TEST RUNNER
// ─────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
    // Fresh localStorage per test
    global.localStorage = mockLocalStorage();

    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
        failures.push({ name, error: e.message });
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(a, b, message) {
    if (a !== b) throw new Error(`${message} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertThrows(fn, message) {
    try {
        fn();
        throw new Error(`${message} — expected an error but none was thrown`);
    } catch (e) {
        if (e.message.includes('expected an error')) throw e;
        // Error was thrown as expected
    }
}


// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────

console.log('\n🧪 QuickBidStore Contract Tests\n');

// ── Construction ──────────────────────────────

console.log('📦 Construction');

await test('throws if garageId is missing', () => {
    assertThrows(() => new QuickBidStore({}), 'missing garageId');
});

await test('can be constructed with a garageId', () => {
    const store = makeStore();
    assert(store !== null, 'store should exist');
});


// ── Initialization ────────────────────────────

console.log('\n🚀 Initialization');

await test('creates a new session when no stored session exists', async () => {
    const store = await makeInitializedStore();
    assertEqual(store.getStatus(), SESSION_STATUS.DRAFTING, 'status');
});

await test('creates one item per request', async () => {
    const store = await makeInitializedStore();
    const session = store.getSession();
    assertEqual(session.items.length, mockRequests.length, 'item count');
});

await test('all items start as UNTOUCHED', async () => {
    const store = await makeInitializedStore();
    const session = store.getSession();
    const allUntouched = session.items.every(i => i.itemStatus === ITEM_STATUS.UNTOUCHED);
    assert(allUntouched, 'all items should be UNTOUCHED');
});

await test('meta.totalItems matches request count', async () => {
    const store = await makeInitializedStore();
    assertEqual(store.getMeta().totalItems, mockRequests.length, 'totalItems');
});

await test('snapshot is isolated from original request object', async () => {
    const requests = [{ ...mockRequests[0] }];
    const store = await makeInitializedStore(requests);

    requests[0].partName = 'MUTATED';

    const item = store.getItem('req_001');
    assertEqual(item.snapshot.partName, 'Alternator', 'snapshot should be frozen');
});

await test('returns RESTORED when a valid stored session exists', async () => {
    // First init — creates session
    const store1 = makeStore();
    await store1.init(mockRequests);
    store1.suspend(); // Persist suspended state

    // Second init — should restore
    const store2 = makeStore();
    const result = await store2.init(mockRequests);
    assertEqual(result, 'RESTORED', 'should restore');
});

await test('discards stored session if garageId does not match', async () => {
    // Create session for garage A
    const storeA = makeStore();
    await storeA.init(mockRequests);

    // Garage B should not restore garage A's session
    global.localStorage = {
        getItem: () => JSON.stringify({ ...storeA.getSession(), garageId: 'different_garage' }),
        setItem: () => { },
        removeItem: () => { },
    };

    const storeB = makeStore();
    const result = await storeB.init(mockRequests);
    assertEqual(result, 'CREATED', 'should create new, not restore');
});


// ── Item Mutations ────────────────────────────

console.log('\n✏️  Item Mutations');

await test('setAvailability transitions item from UNTOUCHED to IN_PROGRESS or DRAFT_SAVED', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    const item = store.getItem('req_001');
    // Has availability but no price yet → DRAFT_SAVED
    assertEqual(item.itemStatus, ITEM_STATUS.DRAFT_SAVED, 'item status after availability set');
});

await test('setAvailability UNAVAILABLE transitions item to SKIPPED', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.UNAVAILABLE);
    const item = store.getItem('req_001');
    assertEqual(item.itemStatus, ITEM_STATUS.SKIPPED, 'item status');
});

await test('UNAVAILABLE clears price and condition', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 500);
    store.setCondition('req_001', CONDITION.USED_GOOD);
    store.setAvailability('req_001', AVAILABILITY.UNAVAILABLE);

    const item = store.getItem('req_001');
    assert(item.price === null, 'price should be null');
    assert(item.condition === null, 'condition should be null');
});

await test('item becomes READY when all required fields are set', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 350);
    store.setCondition('req_001', CONDITION.USED_EXCELLENT);

    const item = store.getItem('req_001');
    assertEqual(item.itemStatus, ITEM_STATUS.READY, 'item should be READY');
});

await test('setPrice rejects negative values', async () => {
    const store = await makeInitializedStore();
    assertThrows(() => store.setPrice('req_001', -100), 'negative price');
});

await test('setPrice rejects non-numeric strings', async () => {
    const store = await makeInitializedStore();
    assertThrows(() => store.setPrice('req_001', 'free'), 'string price');
});

await test('setPrice accepts null (clearing the price)', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 500);
    store.setPrice('req_001', null);
    const item = store.getItem('req_001');
    assert(item.price === null, 'price should be cleared');
});

await test('setCondition rejects invalid values', async () => {
    const store = await makeInitializedStore();
    assertThrows(() => store.setCondition('req_001', 'MINT_CONDITION'), 'invalid condition');
});

await test('setNote truncates to 500 characters', async () => {
    const store = await makeInitializedStore();
    const longNote = 'x'.repeat(600);
    store.setNote('req_001', longNote);
    const item = store.getItem('req_001');
    assert(item.note.length === 500, 'note should be truncated');
});

await test('addPhoto caps at 5 photos', async () => {
    const store = await makeInitializedStore();
    for (let i = 0; i < 5; i++) {
        store.addPhoto('req_001', `blob:photo_${i}`);
    }
    assertThrows(() => store.addPhoto('req_001', 'blob:photo_6'), 'should reject 6th photo');
});

await test('removePhoto removes by index', async () => {
    const store = await makeInitializedStore();
    store.addPhoto('req_001', 'blob:photo_0');
    store.addPhoto('req_001', 'blob:photo_1');
    store.removePhoto('req_001', 0);

    const item = store.getItem('req_001');
    assertEqual(item.photoRefs.length, 1, 'should have 1 photo remaining');
    assertEqual(item.photoRefs[0], 'blob:photo_1', 'remaining photo should be second one');
});

await test('bulkSetPrices skips SKIPPED items silently', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.UNAVAILABLE);

    store.bulkSetPrices([
        { requestId: 'req_001', price: 999 },
        { requestId: 'req_002', price: 200 },
    ]);

    const skippedItem = store.getItem('req_001');
    const normalItem = store.getItem('req_002');
    assert(skippedItem.price === null, 'skipped item price should remain null');
    assertEqual(normalItem.price, 200, 'normal item should receive price');
});

await test('mutations throw if item requestId does not exist', async () => {
    const store = await makeInitializedStore();
    assertThrows(
        () => store.setAvailability('req_NONEXISTENT', AVAILABILITY.AVAILABLE),
        'nonexistent item'
    );
});


// ── Meta Recomputation ────────────────────────

console.log('\n📊 Meta Recomputation');

await test('meta.readyCount increments when item becomes READY', async () => {
    const store = await makeInitializedStore();
    assertEqual(store.getMeta().readyCount, 0, 'initial readyCount');

    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.NEW);

    assertEqual(store.getMeta().readyCount, 1, 'readyCount after completing item');
});

await test('meta.skippedCount increments when item is SKIPPED', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.UNAVAILABLE);
    assertEqual(store.getMeta().skippedCount, 1, 'skippedCount');
});

await test('meta.draftCount increments for incomplete items', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE); // Has availability, no price
    assertEqual(store.getMeta().draftCount, 1, 'draftCount');
});


// ── Session Lifecycle ─────────────────────────

console.log('\n🔄 Session Lifecycle');

await test('suspend() changes status to SUSPENDED', async () => {
    const store = await makeInitializedStore();
    store.suspend();
    assertEqual(store.getStatus(), SESSION_STATUS.SUSPENDED, 'status');
});

await test('discard() clears the session', async () => {
    const store = await makeInitializedStore();
    store.discard();
    assert(store.getSession() === null, 'session should be null after discard');
});

await test('mutations throw after session is SUBMITTED', async () => {
    const store = await makeInitializedStore();
    // Make one item ready
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.USED_GOOD);
    store.buildSubmissionPayload();

    assertThrows(
        () => store.setPrice('req_001', 200),
        'mutation after submission'
    );
});

await test('isSubmittable returns false with no ready items', async () => {
    const store = await makeInitializedStore();
    assert(!store.isSubmittable(), 'should not be submittable with no ready items');
});

await test('isSubmittable returns true with at least one ready item', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.USED_GOOD);
    assert(store.isSubmittable(), 'should be submittable');
});


// ── Submission ────────────────────────────────

console.log('\n📤 Submission');

await test('buildSubmissionPayload returns invalid if no items are READY', async () => {
    const store = await makeInitializedStore();
    const result = store.buildSubmissionPayload();
    assert(!result.valid, 'should be invalid');
    assert(result.payload === null, 'payload should be null');
});

await test('buildSubmissionPayload includes only READY items', async () => {
    const store = await makeInitializedStore();

    // Make 2 items ready, 1 skipped
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.USED_GOOD);

    store.setAvailability('req_002', AVAILABILITY.AVAILABLE);
    store.setPrice('req_002', 250);
    store.setCondition('req_002', CONDITION.NEW);

    store.setAvailability('req_003', AVAILABILITY.UNAVAILABLE); // Skipped

    const result = store.buildSubmissionPayload();
    assert(result.valid, 'should be valid');
    assertEqual(result.payload.bids.length, 2, 'should have 2 bids');
});

await test('buildSubmissionPayload payload includes all required bid fields', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.USED_GOOD);
    store.setNote('req_001', 'Test note');

    const { payload } = store.buildSubmissionPayload();
    const bid = payload.bids[0];

    assert('requestId' in bid, 'requestId');
    assert('availability' in bid, 'availability');
    assert('price' in bid, 'price');
    assert('condition' in bid, 'condition');
    assert('note' in bid, 'note');
    assert('photos' in bid, 'photos');
});

await test('session status transitions to SUBMITTED after buildSubmissionPayload', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.USED_GOOD);
    store.buildSubmissionPayload();

    assertEqual(store.getStatus(), SESSION_STATUS.SUBMITTED, 'status should be SUBMITTED');
});

await test('confirmSubmission transitions to CONFIRMED', async () => {
    const store = await makeInitializedStore();
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);
    store.setCondition('req_001', CONDITION.USED_GOOD);
    store.buildSubmissionPayload();
    store.confirmSubmission();

    assertEqual(store.getStatus(), SESSION_STATUS.CONFIRMED, 'status');
});


// ── Event System ──────────────────────────────

console.log('\n📡 Event System');

await test('emits META_UPDATED when an item is mutated', async () => {
    const store = await makeInitializedStore();
    let eventFired = false;

    store.on(EVENTS.META_UPDATED, () => { eventFired = true; });
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);

    assert(eventFired, 'META_UPDATED should have fired');
});

await test('emits ITEM_SKIPPED when availability set to UNAVAILABLE', async () => {
    const store = await makeInitializedStore();
    let skippedFired = false;

    store.on(EVENTS.ITEM_SKIPPED, () => { skippedFired = true; });
    store.setAvailability('req_001', AVAILABILITY.UNAVAILABLE);

    assert(skippedFired, 'ITEM_SKIPPED should have fired');
});

await test('wildcard listener receives all events', async () => {
    const store = await makeInitializedStore();
    const received = [];

    store.on('*', (eventName) => received.push(eventName));
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 100);

    assert(received.includes(EVENTS.ITEM_AVAILABILITY_CHANGED), 'should receive availability event');
    assert(received.includes(EVENTS.ITEM_PRICE_CHANGED), 'should receive price event');
    assert(received.includes(EVENTS.META_UPDATED), 'should receive meta event');
});

await test('on() returns an unsubscribe function that works', async () => {
    const store = await makeInitializedStore();
    let count = 0;

    const off = store.on(EVENTS.META_UPDATED, () => { count++; });
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE); // count → 1
    off();
    store.setPrice('req_001', 100); // count should stay 1

    assertEqual(count, 1, 'count should be 1 after unsubscribe');
});

await test('emits STALE_SESSION_DETECTED if session is older than 4 hours', async () => {
    // Manually write a stale session to localStorage
    const staleSession = {
        sessionId: 'stale_session',
        garageId: GARAGE_ID,
        status: SESSION_STATUS.SUSPENDED,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        lastModified: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        items: [],
        meta: { totalItems: 0, readyCount: 0, draftCount: 0, skippedCount: 0 },
    };

    global.localStorage.setItem(`qb_session_${GARAGE_ID}`, JSON.stringify(staleSession));

    let staleDetected = false;
    const store = makeStore();
    store.on(EVENTS.STALE_SESSION_DETECTED, () => { staleDetected = true; });
    await store.init([]);

    assert(staleDetected, 'should detect stale session');
});


// ── Partial Submission ────────────────────────

console.log('\n🔀 Partial Submission');

await test('confirmPartialSubmission marks only succeeded IDs as SUBMITTED', async () => {
    const store = await makeInitializedStore();

    for (const req of mockRequests) {
        store.setAvailability(req.id, AVAILABILITY.AVAILABLE);
        store.setPrice(req.id, 100);
        store.setCondition(req.id, CONDITION.USED_GOOD);
    }

    store.buildSubmissionPayload();
    store.confirmPartialSubmission(['req_001', 'req_002']);

    assertEqual(store.getItem('req_001').itemStatus, ITEM_STATUS.SUBMITTED, 'req_001 SUBMITTED');
    assertEqual(store.getItem('req_002').itemStatus, ITEM_STATUS.SUBMITTED, 'req_002 SUBMITTED');
    assertEqual(store.getItem('req_003').itemStatus, ITEM_STATUS.READY, 'req_003 stays READY');
});

await test('confirmPartialSubmission reverts session to DRAFTING if retryable items remain', async () => {
    const store = await makeInitializedStore();

    for (const req of mockRequests) {
        store.setAvailability(req.id, AVAILABILITY.AVAILABLE);
        store.setPrice(req.id, 100);
        store.setCondition(req.id, CONDITION.USED_GOOD);
    }

    store.buildSubmissionPayload();
    store.confirmPartialSubmission(['req_001']);

    assertEqual(store.getStatus(), SESSION_STATUS.DRAFTING, 'should revert to DRAFTING for retry');
});

await test('confirmPartialSubmission moves to CONFIRMED when all succeeded', async () => {
    const store = await makeInitializedStore();

    for (const req of mockRequests) {
        store.setAvailability(req.id, AVAILABILITY.AVAILABLE);
        store.setPrice(req.id, 100);
        store.setCondition(req.id, CONDITION.USED_GOOD);
    }

    store.buildSubmissionPayload();
    store.confirmPartialSubmission(['req_001', 'req_002', 'req_003']);

    assertEqual(store.getStatus(), SESSION_STATUS.CONFIRMED, 'status should be CONFIRMED');
});


// ── syncNewRequests ───────────────────────────

console.log('\n🔄 syncNewRequests');

await test('adds new requests not already in the session', async () => {
    const store = await makeInitializedStore(mockRequests.slice(0, 2));

    const newRequest = { id: 'req_NEW', partName: 'Gearbox', make: 'Kia', model: 'Sportage', year: 2021 };
    store.syncNewRequests([...mockRequests.slice(0, 2), newRequest]);

    assertEqual(store.getSession().items.length, 3, 'should have 3 items after sync');
});

await test('does not duplicate existing items on sync', async () => {
    const store = await makeInitializedStore(mockRequests);
    store.syncNewRequests(mockRequests);
    assertEqual(store.getSession().items.length, mockRequests.length, 'no duplicates');
});

await test('preserves existing item draft state after sync', async () => {
    const store = await makeInitializedStore(mockRequests.slice(0, 1));
    store.setAvailability('req_001', AVAILABILITY.AVAILABLE);
    store.setPrice('req_001', 750);

    store.syncNewRequests(mockRequests);

    const item = store.getItem('req_001');
    assertEqual(item.price, 750, 'draft price preserved');
    assertEqual(item.availability, AVAILABILITY.AVAILABLE, 'draft availability preserved');
});

await test('syncNewRequests updates meta.totalItems', async () => {
    const store = await makeInitializedStore(mockRequests.slice(0, 1));
    assertEqual(store.getMeta().totalItems, 1, 'initial totalItems');

    store.syncNewRequests(mockRequests);
    assertEqual(store.getMeta().totalItems, 3, 'totalItems after sync');
});


// ─────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.error}`));
}

if (failed > 0) process.exit(1);
