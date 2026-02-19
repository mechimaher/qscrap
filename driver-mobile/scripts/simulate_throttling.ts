
// Simulation script for LocationService throttling logic
// Run with: npx ts-node scripts/simulate_throttling.ts

/* MOCKS */
const mockOfflineQueue = {
    enqueue: async (endpoint: string, method: string, data: any) => {
        console.log(`[Queue] Enqueued: ${endpoint} at ${data.timestamp}`);
    }
};

const API_ENDPOINTS = { UPDATE_LOCATION: '/driver/location' };

// Mock TaskManager.defineTask to implement our test harness
let definedTask: any = null;
const TaskManager = {
    defineTask: (name: string, callback: any) => {
        console.log(`[System] Task defined: ${name}`);
        definedTask = callback;
    }
};

/* COPIED LOGIC FROM LocationService.ts (Simulated) */
const LOCATION_TASK_NAME = 'background-location-task';
let lastUpdateTimestamp = 0;
const MIN_UPDATE_INTERVAL = 30 * 1000; // 30s

// We wrap the logic in a function we can call
function startService() {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
        if (error) {
            console.error('[LocationService] Background task error:', error);
            return;
        }
        if (data) {
            const { locations } = data;
            const location = locations[0];
            if (location) {
                // THROTTLING LOGIC
                const now = Date.now();
                console.log(`[Task] Update received at ${now}. Last: ${lastUpdateTimestamp}. Diff: ${now - lastUpdateTimestamp}`);

                if (now - lastUpdateTimestamp < MIN_UPDATE_INTERVAL) {
                    console.log('[Task] Dropped (Throttled)');
                    return;
                }
                lastUpdateTimestamp = now;

                await mockOfflineQueue.enqueue(
                    API_ENDPOINTS.UPDATE_LOCATION,
                    'POST',
                    {
                        lat: location.coords.latitude,
                        timestamp: location.timestamp
                    }
                );
            }
        }
    });
}

/* TEST EXECUTION */
async function runTest() {
    console.log('--- Starting Throttling Simulation ---');
    startService();

    if (!definedTask) {
        console.error('Task was not defined!');
        return;
    }

    // SCENARIO 1: First update (Should pass)
    console.log('\n--- Scenario 1: Initial Update ---');
    await definedTask({
        data: { locations: [{ coords: { latitude: 10, longitude: 10 }, timestamp: Date.now() }] }
    });

    // SCENARIO 2: Rapid update 5s later (Should be dropped)
    console.log('\n--- Scenario 2: Rapid Update (5s later) ---');
    // Fast forward time? We mocked Date.now() in our logic above... wait, we used actual Date.now().
    // Since we cannot easily mock Date.now() globally without a library, 
    // let's just manually mess with lastUpdateTimestamp for the test or sleep?
    // Sleeping 30s is too long.
    // Let's modify the logic above to use a `getTime()` helper we can mock?
    // No, better: we will just overwrite `Date.now` for this process.

    const realDateNow = Date.now;
    let virtualTime = realDateNow();
    Date.now = () => virtualTime;

    // Reset verify
    lastUpdateTimestamp = virtualTime; // Pretend we just updated
    console.log(`[Setup] Time set to ${virtualTime}`);

    virtualTime += 5000; // +5s
    await definedTask({
        data: { locations: [{ coords: { latitude: 10, longitude: 10 }, timestamp: virtualTime }] }
    });

    // SCENARIO 3: Update 31s later (Should pass)
    console.log('\n--- Scenario 3: Valid Update (31s later) ---');
    virtualTime += 26000; // +26s (Total +31s from start)
    await definedTask({
        data: { locations: [{ coords: { latitude: 10, longitude: 10 }, timestamp: virtualTime }] }
    });

    console.log('\n--- Test Complete ---');
}

runTest();
