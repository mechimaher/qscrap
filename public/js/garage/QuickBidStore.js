/**
 * QuickBidStore.js
 * Centralized State Container for Quick Bid Sessions
 *
 * Architecture: Event-driven store with localStorage persistence.
 * Single source of truth for all Quick Bid state.
 * Zero external dependencies — pure ES Module.
 *
 * Usage:
 *   import { QuickBidStore } from './QuickBidStore.js';
 *   const store = new QuickBidStore({ garageId: 'g_123' });
 *   await store.init(requestsArray);
 */

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const SESSION_STATUS = Object.freeze({
    DRAFTING: 'DRAFTING',
    SUSPENDED: 'SUSPENDED',
    SUBMITTED: 'SUBMITTED',
    CONFIRMED: 'CONFIRMED',
    DISCARDED: 'DISCARDED',
});

const ITEM_STATUS = Object.freeze({
    UNTOUCHED: 'UNTOUCHED',
    SKIPPED: 'SKIPPED',
    IN_PROGRESS: 'IN_PROGRESS',
    DRAFT_SAVED: 'DRAFT_SAVED',
    READY: 'READY',
    SUBMITTED: 'SUBMITTED',
});

const AVAILABILITY = Object.freeze({
    AVAILABLE: 'AVAILABLE',
    UNAVAILABLE: 'UNAVAILABLE',
    PARTIAL: 'PARTIAL',
});

const CONDITION = Object.freeze({
    NEW: 'NEW',
    USED_EXCELLENT: 'USED_EXCELLENT',
    USED_GOOD: 'USED_GOOD',
    USED_FAIR: 'USED_FAIR',
});

const EVENTS = Object.freeze({
    SESSION_CREATED: 'SESSION_CREATED',
    SESSION_RESTORED: 'SESSION_RESTORED',
    SESSION_SUSPENDED: 'SESSION_SUSPENDED',
    SESSION_SUBMITTED: 'SESSION_SUBMITTED',
    SESSION_CONFIRMED: 'SESSION_CONFIRMED',
    SESSION_DISCARDED: 'SESSION_DISCARDED',
    ITEM_AVAILABILITY_CHANGED: 'ITEM_AVAILABILITY_CHANGED',
    ITEM_PRICE_CHANGED: 'ITEM_PRICE_CHANGED',
    ITEM_CONDITION_CHANGED: 'ITEM_CONDITION_CHANGED',
    ITEM_NOTE_CHANGED: 'ITEM_NOTE_CHANGED',
    ITEM_SKIPPED: 'ITEM_SKIPPED',
    ITEM_PHOTO_ADDED: 'ITEM_PHOTO_ADDED',
    ITEM_PHOTO_REMOVED: 'ITEM_PHOTO_REMOVED',
    META_UPDATED: 'META_UPDATED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    PERSISTENCE_ERROR: 'PERSISTENCE_ERROR',
    STALE_SESSION_DETECTED: 'STALE_SESSION_DETECTED',
});

// Sessions older than this trigger a staleness warning
const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

// Debounce delay for localStorage writes
const PERSIST_DEBOUNCE_MS = 800;


// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function generateId() {
    // Crypto UUID if available, fallback for older environments
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO() {
    return new Date().toISOString();
}

function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}


// ─────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Creates a frozen snapshot of a request object.
 * Isolated from live request mutations after session open.
 */
function createSnapshot(request) {
    return Object.freeze({
        partName: request.partName ?? '',
        partNumber: request.partNumber ?? '',
        vin: request.vin ?? '',
        make: request.make ?? '',
        model: request.model ?? '',
        year: request.year ?? null,
        buyerNote: request.buyerNote ?? '',
    });
}

/**
 * Creates a new QuickBidItem from a raw request object.
 */
function createItem(request) {
    return {
        itemId: generateId(),
        requestId: request.id ?? request.requestId,
        snapshot: createSnapshot(request),
        availability: null,
        price: null,
        condition: null,
        note: '',
        photoRefs: [],
        itemStatus: ITEM_STATUS.UNTOUCHED,
        lastTouched: null,
        validationErrors: [],
    };
}

/**
 * Creates a new session shell.
 */
function createSession(garageId) {
    return {
        sessionId: generateId(),
        garageId,
        createdAt: nowISO(),
        lastModified: nowISO(),
        status: SESSION_STATUS.DRAFTING,
        items: [],
        meta: {
            totalItems: 0,
            readyCount: 0,
            draftCount: 0,
            skippedCount: 0,
        },
    };
}


// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

/**
 * Validates a single item for submission readiness.
 * Returns an array of error strings (empty = valid).
 */
function validateItem(item) {
    const errors = [];

    if (!item.availability) {
        errors.push('Availability must be set.');
    }

    if (item.availability === AVAILABILITY.AVAILABLE || item.availability === AVAILABILITY.PARTIAL) {
        if (item.price === null || item.price === undefined) {
            errors.push('Price is required when part is available.');
        } else if (typeof item.price !== 'number' || item.price <= 0) {
            errors.push('Price must be a positive number.');
        }

        if (!item.condition) {
            errors.push('Condition must be specified.');
        }
    }

    return errors;
}

/**
 * Computes the derived item status from its current field values.
 * This is the single source of truth for itemStatus derivation.
 */
function deriveItemStatus(item) {
    // Explicit skip takes priority
    if (item.availability === AVAILABILITY.UNAVAILABLE) {
        return ITEM_STATUS.SKIPPED;
    }

    const hasAnyData = item.availability !== null || item.price !== null || item.note !== '';

    if (!hasAnyData) {
        return ITEM_STATUS.UNTOUCHED;
    }

    const errors = validateItem(item);
    if (errors.length === 0) {
        return ITEM_STATUS.READY;
    }

    // Has some data but not complete
    const hasMeaningfulData = item.availability !== null || item.price !== null;
    return hasMeaningfulData ? ITEM_STATUS.DRAFT_SAVED : ITEM_STATUS.IN_PROGRESS;
}

/**
 * Recomputes session meta counts from current items array.
 */
function computeMeta(items) {
    return items.reduce(
        (meta, item) => {
            meta.totalItems++;
            if (item.itemStatus === ITEM_STATUS.READY) meta.readyCount++;
            if (item.itemStatus === ITEM_STATUS.DRAFT_SAVED || item.itemStatus === ITEM_STATUS.IN_PROGRESS) meta.draftCount++;
            if (item.itemStatus === ITEM_STATUS.SKIPPED) meta.skippedCount++;
            return meta;
        },
        { totalItems: 0, readyCount: 0, draftCount: 0, skippedCount: 0 }
    );
}


// ─────────────────────────────────────────────
// MAIN STORE CLASS
// ─────────────────────────────────────────────

export class QuickBidStore {
    /**
     * @param {object} config
     * @param {string} config.garageId - Required. Authenticated garage ID.
     * @param {object} [config.serverAdapter] - Optional. Adapter for server validation calls.
     *   Shape: { checkRequestsOpen(ids): Promise<string[]>, checkGarageEligible(id): Promise<boolean> }
     */
    constructor({ garageId, serverAdapter = null } = {}) {
        if (!garageId) throw new Error('[QuickBidStore] garageId is required.');

        this._garageId = garageId;
        this._storageKey = `qb_session_${garageId}`;
        this._serverAdapter = serverAdapter;
        this._session = null;
        this._listeners = new Map(); // eventName → Set of callbacks
        this._persistDebounced = debounce(this._persist.bind(this), PERSIST_DEBOUNCE_MS);
    }


    // ───────────────────────────────────────────
    // INITIALIZATION
    // ───────────────────────────────────────────

    /**
     * Initialize the store. Attempts to restore a suspended session first.
     * If no valid session exists, creates a new one from the provided requests.
     *
     * @param {object[]} requests - Array of open request objects from the server.
     * @returns {Promise<'RESTORED'|'CREATED'>}
     */
    async init(requests = []) {
        const existing = this._loadFromStorage();

        if (existing && this._isRestorable(existing)) {
            await this._restoreSession(existing, requests);
            return 'RESTORED';
        }

        this._createSession(requests);
        return 'CREATED';
    }


    // ───────────────────────────────────────────
    // SESSION LIFECYCLE
    // ───────────────────────────────────────────

    _createSession(requests) {
        this._session = createSession(this._garageId);
        this._session.items = requests.map(createItem);
        this._session.meta = computeMeta(this._session.items);

        this._persist();
        this._emit(EVENTS.SESSION_CREATED, { session: this._getSnapshot() });
    }

    async _restoreSession(stored, liveRequests) {
        // Check staleness
        const ageMs = Date.now() - new Date(stored.lastModified).getTime();
        if (ageMs > STALE_THRESHOLD_MS) {
            this._emit(EVENTS.STALE_SESSION_DETECTED, { ageMs, threshold: STALE_THRESHOLD_MS });
        }

        // Server validation if adapter available
        if (this._serverAdapter) {
            const storedRequestIds = stored.items.map(i => i.requestId);

            // Check which requests are still open
            let openIds = storedRequestIds;
            try {
                openIds = await this._serverAdapter.checkRequestsOpen(storedRequestIds);
            } catch (e) {
                console.warn('[QuickBidStore] Could not validate open requests. Proceeding with stored data.', e);
            }

            // Remove items whose requests are now closed
            const closedIds = new Set(storedRequestIds.filter(id => !openIds.includes(id)));
            if (closedIds.size > 0) {
                stored.items = stored.items.filter(item => !closedIds.has(item.requestId));
            }

            // Check garage eligibility
            try {
                const eligible = await this._serverAdapter.checkGarageEligible(this._garageId);
                if (!eligible) {
                    this.discard();
                    throw new Error('[QuickBidStore] Garage is no longer eligible. Session discarded.');
                }
            } catch (e) {
                if (e.message.includes('no longer eligible')) throw e;
                console.warn('[QuickBidStore] Could not validate garage eligibility.', e);
            }

            // Merge in any NEW requests not in stored session
            const storedIds = new Set(stored.items.map(i => i.requestId));
            const newRequests = liveRequests.filter(r => !storedIds.has(r.id ?? r.requestId));
            stored.items = [...stored.items, ...newRequests.map(createItem)];
        }

        // Recompute derived state (in case of schema changes)
        stored.items = stored.items.map(item => ({
            ...item,
            itemStatus: deriveItemStatus(item),
        }));
        stored.meta = computeMeta(stored.items);
        stored.status = SESSION_STATUS.DRAFTING;

        this._session = stored;
        this._persist();
        this._emit(EVENTS.SESSION_RESTORED, { session: this._getSnapshot() });
    }

    /**
     * Suspend the session (operator leaving the desk / closing tab).
     * Session is preserved in localStorage for later restoration.
     */
    suspend() {
        this._assertStatus([SESSION_STATUS.DRAFTING]);
        this._session.status = SESSION_STATUS.SUSPENDED;
        this._session.lastModified = nowISO();
        this._persist();
        this._emit(EVENTS.SESSION_SUSPENDED, { sessionId: this._session.sessionId });
    }

    /**
     * Permanently discard the session and clear localStorage.
     */
    discard() {
        this._session = null;
        try {
            localStorage.removeItem(this._storageKey);
        } catch (e) {
            this._emit(EVENTS.PERSISTENCE_ERROR, { operation: 'discard', error: e.message });
        }
        this._emit(EVENTS.SESSION_DISCARDED, {});
    }

    /**
     * Mark session as submitted (after server accepts payload).
     * All READY items transition to SUBMITTED.
     */
    confirmSubmission() {
        this._assertStatus([SESSION_STATUS.SUBMITTED]);
        this._session.status = SESSION_STATUS.CONFIRMED;
        this._session.lastModified = nowISO();

        this._session.items = this._session.items.map(item =>
            item.itemStatus === ITEM_STATUS.READY
                ? { ...item, itemStatus: ITEM_STATUS.SUBMITTED }
                : item
        );

        this._persist();
        this._emit(EVENTS.SESSION_CONFIRMED, { session: this._getSnapshot() });
    }

    /**
     * Confirm only a subset of bids as submitted (partial success after API calls).
     * Items whose requestId is NOT in succeededIds remain in READY state
     * so the operator can retry them without re-entering data.
     *
     * @param {string[]} succeededIds - requestId values that the server accepted.
     */
    confirmPartialSubmission(succeededIds) {
        this._assertStatus([SESSION_STATUS.SUBMITTED]);

        const succeededSet = new Set(succeededIds);

        this._session.items = this._session.items.map(item => {
            if (succeededSet.has(item.requestId) && item.itemStatus === ITEM_STATUS.READY) {
                return { ...item, itemStatus: ITEM_STATUS.SUBMITTED };
            }
            // Failed items: revert to READY so operator can retry
            if (!succeededSet.has(item.requestId) && item.itemStatus === ITEM_STATUS.READY) {
                return { ...item };
            }
            return item;
        });

        // If any items remain READY, revert session to DRAFTING so mutations are allowed
        const hasRetryable = this._session.items.some(i => i.itemStatus === ITEM_STATUS.READY);
        this._session.status = hasRetryable ? SESSION_STATUS.DRAFTING : SESSION_STATUS.CONFIRMED;
        this._session.meta = computeMeta(this._session.items);
        this._session.lastModified = nowISO();

        this._persist();
        this._emit(EVENTS.META_UPDATED, { meta: { ...this._session.meta } });
        this._emit(EVENTS.SESSION_CONFIRMED, {
            session: this._getSnapshot(),
            partial: true,
            succeededIds,
        });
    }

    /**
     * Merge newly arrived requests into an active session.
     * Requests already in the session are untouched (their draft state is preserved).
     * New requests are added as UNTOUCHED items at the end of the list.
     *
     * Called by the UI when the dashboard receives new requests while
     * Quick Bid mode is already open.
     *
     * @param {object[]} liveRequests - Full current array of open requests.
     */
    syncNewRequests(liveRequests) {
        if (!this._session) return;

        const storedIds = new Set(this._session.items.map(i => i.requestId));
        const newItems = liveRequests
            .filter(r => !storedIds.has(r.id ?? r.requestId))
            .map(createItem);

        if (newItems.length === 0) return;

        this._session.items = [...this._session.items, ...newItems];
        this._session.meta = computeMeta(this._session.items);
        this._session.lastModified = nowISO();

        this._persistDebounced();
        this._emit(EVENTS.META_UPDATED, { meta: { ...this._session.meta } });
    }


    // ───────────────────────────────────────────
    // ITEM MUTATIONS
    // All mutations follow the same pattern:
    //   1. Find item
    //   2. Apply change
    //   3. Recompute itemStatus
    //   4. Recompute meta
    //   5. Emit specific event
    //   6. Schedule persist (debounced)
    // ───────────────────────────────────────────

    /**
     * Set availability for an item.
     * @param {string} requestId
     * @param {string} availability - One of AVAILABILITY values
     */
    setAvailability(requestId, availability) {
        if (!Object.values(AVAILABILITY).includes(availability)) {
            throw new Error(`[QuickBidStore] Invalid availability: ${availability}`);
        }

        const item = this._mutateItem(requestId, draft => {
            draft.availability = availability;
            // If marked unavailable, clear price/condition (they're irrelevant)
            if (availability === AVAILABILITY.UNAVAILABLE) {
                draft.price = null;
                draft.condition = null;
            }
        });

        this._emit(EVENTS.ITEM_AVAILABILITY_CHANGED, { requestId, availability, item });

        if (availability === AVAILABILITY.UNAVAILABLE) {
            this._emit(EVENTS.ITEM_SKIPPED, { requestId });
        }
    }

    /**
     * Set price for an item.
     * @param {string} requestId
     * @param {number|null} price
     */
    setPrice(requestId, price) {
        const parsed = price === null ? null : parseFloat(price);

        if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
            throw new Error(`[QuickBidStore] Invalid price: ${price}`);
        }

        const item = this._mutateItem(requestId, draft => {
            draft.price = parsed;
        });

        this._emit(EVENTS.ITEM_PRICE_CHANGED, { requestId, price: parsed, item });
    }

    /**
     * Set condition for an item.
     * @param {string} requestId
     * @param {string} condition - One of CONDITION values
     */
    setCondition(requestId, condition) {
        if (!Object.values(CONDITION).includes(condition)) {
            throw new Error(`[QuickBidStore] Invalid condition: ${condition}`);
        }

        const item = this._mutateItem(requestId, draft => {
            draft.condition = condition;
        });

        this._emit(EVENTS.ITEM_CONDITION_CHANGED, { requestId, condition, item });
    }

    /**
     * Set operator note for an item.
     * @param {string} requestId
     * @param {string} note
     */
    setNote(requestId, note) {
        const item = this._mutateItem(requestId, draft => {
            draft.note = String(note).slice(0, 500); // 500 char cap
        });

        this._emit(EVENTS.ITEM_NOTE_CHANGED, { requestId, note: item.note, item });
    }

    /**
     * Add a photo reference (blob URL or object URL) to an item.
     * @param {string} requestId
     * @param {string} photoRef - Local blob URL
     */
    addPhoto(requestId, photoRef) {
        const item = this._mutateItem(requestId, draft => {
            if (draft.photoRefs.length >= 5) {
                throw new Error('[QuickBidStore] Maximum 5 photos per item.');
            }
            draft.photoRefs = [...draft.photoRefs, photoRef];
        });

        this._emit(EVENTS.ITEM_PHOTO_ADDED, { requestId, photoRef, item });
    }

    /**
     * Remove a photo reference by index.
     * @param {string} requestId
     * @param {number} photoIndex
     */
    removePhoto(requestId, photoIndex) {
        const item = this._mutateItem(requestId, draft => {
            draft.photoRefs = draft.photoRefs.filter((_, i) => i !== photoIndex);
        });

        this._emit(EVENTS.ITEM_PHOTO_REMOVED, { requestId, photoIndex, item });
    }

    /**
     * Bulk-apply a price to multiple items at once (Quick Bid core feature).
     * Only applies to AVAILABLE/PARTIAL items. Skips SKIPPED items silently.
     * @param {Array<{requestId: string, price: number}>} pricePairs
     */
    bulkSetPrices(pricePairs) {
        pricePairs.forEach(({ requestId, price }) => {
            const item = this._findItem(requestId);
            if (!item || item.itemStatus === ITEM_STATUS.SKIPPED) return;
            this.setPrice(requestId, price);
        });
    }


    // ───────────────────────────────────────────
    // SUBMISSION
    // ───────────────────────────────────────────

    /**
     * Validate all items and build the submission payload.
     * Does NOT submit to server — caller is responsible for the API call.
     *
     * @returns {{ valid: boolean, payload: object|null, errors: object }}
     */
    buildSubmissionPayload() {
        this._assertStatus([SESSION_STATUS.DRAFTING]);

        const readyItems = this._session.items.filter(i => i.itemStatus === ITEM_STATUS.READY);
        const errorMap = {};
        let isValid = true;

        // Re-validate all ready items at submission boundary
        readyItems.forEach(item => {
            const errors = validateItem(item);
            if (errors.length > 0) {
                isValid = false;
                errorMap[item.requestId] = errors;
                // Write errors back to item
                this._mutateItem(item.requestId, draft => {
                    draft.validationErrors = errors;
                });
            }
        });

        if (!isValid) {
            this._emit(EVENTS.VALIDATION_FAILED, { errors: errorMap });
            return { valid: false, payload: null, errors: errorMap };
        }

        if (readyItems.length === 0) {
            return {
                valid: false,
                payload: null,
                errors: { _session: ['No items are ready for submission.'] },
            };
        }

        const payload = {
            sessionId: this._session.sessionId,
            garageId: this._session.garageId,
            submittedAt: nowISO(),
            bids: readyItems.map(item => ({
                requestId: item.requestId,
                availability: item.availability,
                price: item.price,
                condition: item.condition,
                note: item.note,
                photos: item.photoRefs, // Resolved URLs expected by caller pre-submission
            })),
        };

        // Transition session to SUBMITTED state
        this._session.status = SESSION_STATUS.SUBMITTED;
        this._session.lastModified = nowISO();
        this._persist();

        this._emit(EVENTS.SESSION_SUBMITTED, { payload });
        return { valid: true, payload, errors: {} };
    }


    // ───────────────────────────────────────────
    // READ API (Selectors)
    // ───────────────────────────────────────────

    /** Returns a deep clone of the full session (safe for external consumers). */
    getSession() {
        return this._session ? deepClone(this._session) : null;
    }

    /** Returns session meta counts. */
    getMeta() {
        return this._session ? { ...this._session.meta } : null;
    }

    /** Returns current session status string. */
    getStatus() {
        return this._session?.status ?? null;
    }

    /** Returns a single item by requestId (deep clone). */
    getItem(requestId) {
        const item = this._findItem(requestId);
        return item ? deepClone(item) : null;
    }

    /** Returns all items filtered by status. */
    getItemsByStatus(status) {
        if (!this._session) return [];
        return deepClone(this._session.items.filter(i => i.itemStatus === status));
    }

    /** Returns all items ready for submission. */
    getReadyItems() {
        return this.getItemsByStatus(ITEM_STATUS.READY);
    }

    /** Returns true if session has at least one READY item. */
    isSubmittable() {
        return this._session?.meta.readyCount > 0 &&
            this._session?.status === SESSION_STATUS.DRAFTING;
    }


    // ───────────────────────────────────────────
    // EVENT SYSTEM
    // ───────────────────────────────────────────

    /**
     * Subscribe to store events.
     * @param {string} eventName - One of EVENTS constants, or '*' for all.
     * @param {function} callback - Receives (eventName, payload).
     * @returns {function} Unsubscribe function.
     */
    on(eventName, callback) {
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }
        this._listeners.get(eventName).add(callback);

        // Return unsubscribe function
        return () => {
            this._listeners.get(eventName)?.delete(callback);
        };
    }

    _emit(eventName, payload) {
        // Specific listeners
        this._listeners.get(eventName)?.forEach(cb => {
            try { cb(eventName, payload); }
            catch (e) { console.error(`[QuickBidStore] Listener error on ${eventName}:`, e); }
        });

        // Wildcard listeners
        this._listeners.get('*')?.forEach(cb => {
            try { cb(eventName, payload); }
            catch (e) { console.error(`[QuickBidStore] Wildcard listener error:`, e); }
        });
    }


    // ───────────────────────────────────────────
    // INTERNAL HELPERS
    // ───────────────────────────────────────────

    _findItem(requestId) {
        return this._session?.items.find(i => i.requestId === requestId) ?? null;
    }

    /**
     * Core mutation helper. Applies a mutator function to a draft item,
     * then recomputes itemStatus and session meta.
     *
     * @param {string} requestId
     * @param {function} mutator - Receives the item draft (mutate in place).
     * @returns {object} The updated item (not cloned — for internal use only).
     */
    _mutateItem(requestId, mutator) {
        this._assertStatus([SESSION_STATUS.DRAFTING]);
        const item = this._findItem(requestId);

        if (!item) {
            throw new Error(`[QuickBidStore] Item not found for requestId: ${requestId}`);
        }

        mutator(item);
        item.lastTouched = nowISO();
        item.validationErrors = []; // Clear stale errors on mutation
        item.itemStatus = deriveItemStatus(item);

        // Recompute session-level meta
        this._session.meta = computeMeta(this._session.items);
        this._session.lastModified = nowISO();

        this._emit(EVENTS.META_UPDATED, { meta: { ...this._session.meta } });
        this._persistDebounced();

        return item;
    }

    _assertStatus(allowedStatuses) {
        if (!this._session) {
            throw new Error('[QuickBidStore] Store is not initialized. Call init() first.');
        }
        if (!allowedStatuses.includes(this._session.status)) {
            throw new Error(
                `[QuickBidStore] Operation not allowed in status: ${this._session.status}. ` +
                `Allowed: ${allowedStatuses.join(', ')}`
            );
        }
    }

    _getSnapshot() {
        return deepClone(this._session);
    }

    _isRestorable(stored) {
        return (
            stored &&
            stored.garageId === this._garageId &&
            [SESSION_STATUS.DRAFTING, SESSION_STATUS.SUSPENDED].includes(stored.status)
        );
    }


    // ───────────────────────────────────────────
    // PERSISTENCE
    // ───────────────────────────────────────────

    _persist() {
        if (!this._session) return;

        try {
            localStorage.setItem(this._storageKey, JSON.stringify(this._session));
        } catch (e) {
            // localStorage can throw if storage quota exceeded
            this._emit(EVENTS.PERSISTENCE_ERROR, { operation: 'persist', error: e.message });
        }
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            this._emit(EVENTS.PERSISTENCE_ERROR, { operation: 'load', error: e.message });
            return null;
        }
    }
}


// ─────────────────────────────────────────────
// NAMED EXPORTS (constants available to consumers)
// ─────────────────────────────────────────────

export { SESSION_STATUS, ITEM_STATUS, AVAILABILITY, CONDITION, EVENTS };
