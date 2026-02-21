/**
 * @file quick-bid.js
 * @description UI Controller for the Quick Bid Operational Workspace.
 *
 * Changelog from v1 audit:
 *  - FIX [Critical]  isActive moved off store into controller scope (qbIsActive)
 *  - FIX [Critical]  syncWithRequests replaced with store.syncNewRequests()
 *  - FIX [Critical]  QB_* constants bridge via dynamic import (no more undefined globals)
 *  - FIX [Medium]    setTimeout race condition replaced with import-driven init
 *  - FIX [Medium]    Partial submission data loss — only confirmed succeeded IDs
 *  - FIX [Low]       Inline onclick handlers replaced with event delegation
 *  - FIX [Low]       Full re-render on every event replaced with targeted event filter
 */

// ─────────────────────────────────────────────
// MODULE-SCOPED STATE (never on the store)
// ─────────────────────────────────────────────

let qbStore = null;
let qbIsActive = false;

// Populated after dynamic import resolves
let QB_EVENTS = null;
let QB_ITEM_STATUS = null;
let QB_AVAILABILITY = null;
let QB_CONDITION = null;

/**
 * Events that warrant a full table re-render.
 * Input-driven events (PRICE_CHANGED, NOTE_CHANGED) are excluded —
 * the DOM already reflects those changes and a re-render causes flicker.
 */
const RE_RENDER_EVENTS = new Set([
  'SESSION_CREATED',
  'SESSION_RESTORED',
  'SESSION_SUSPENDED',
  'SESSION_DISCARDED',
  'ITEM_AVAILABILITY_CHANGED',  // Toggles disabled states on price/condition fields
  'ITEM_SKIPPED',
  'META_UPDATED',
]);


// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

/**
 * Entry point. Dynamically imports the store module, bridges constants
 * into controller scope, then initializes the store instance.
 *
 * Called once on DOMContentLoaded. Safe to call again after a page
 * navigation if the dashboard is a SPA.
 */
async function initQuickBid() {
  // Expose for dashboard integration
  window.qbIsActive = qbIsActive;

  try {
    const { QuickBidStore, EVENTS, AVAILABILITY, CONDITION, ITEM_STATUS, SESSION_STATUS } =
      await import('./QuickBidStore.js');

    // Bridge named exports into controller-scoped variables
    QB_EVENTS = EVENTS;
    QB_ITEM_STATUS = ITEM_STATUS;
    QB_AVAILABILITY = AVAILABILITY;
    QB_CONDITION = CONDITION;

    const garageId = localStorage.getItem('userId');
    if (!garageId) {
      console.warn('[QuickBidUI] No garageId in localStorage. Aborting init.');
      return;
    }

    qbStore = new QuickBidStore({ garageId });

    // Reactive UI — only re-render on events that require structural DOM changes
    qbStore.on('*', (eventName) => {
      if (qbIsActive && RE_RENDER_EVENTS.has(eventName)) {
        renderQuickBidTable();
      }
    });

    // Log persistence errors visibly during development
    qbStore.on(QB_EVENTS.PERSISTENCE_ERROR, (_, payload) => {
      console.error('[QuickBidUI] Persistence error:', payload);
    });

    // Warn operator if their workspace is stale (>4 hours)
    qbStore.on(QB_EVENTS.STALE_SESSION_DETECTED, (_, { ageMs }) => {
      const hours = Math.round(ageMs / 1000 / 60 / 60);
      showToast(`Your draft workspace is ${hours}h old. Prices may no longer be accurate.`, 'warning');
    });

    await qbStore.init(window.requests || []);
    console.log('[QuickBidUI] Store initialized. Status:', qbStore.getStatus());

    // Attach event delegation after DOM is ready
    attachTableDelegation();

  } catch (err) {
    console.error('[QuickBidUI] Failed to initialize:', err);
  }
}


// ─────────────────────────────────────────────
// TOGGLE
// ─────────────────────────────────────────────

function toggleQuickBidMode() {
  if (!qbStore) {
    console.warn('[QuickBidUI] Store not ready. Cannot toggle mode.');
    return;
  }

  qbIsActive = !qbIsActive;

  const container = document.getElementById('requestsList');
  const toggleBtn = document.getElementById('quickBidToggleBtn');

  if (qbIsActive) {
    container?.classList.add('quick-bid-mode');
    toggleBtn?.classList.add('active');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="bi bi-grid-fill"></i> Standard View';

    // Merge any new requests that arrived since the session was created
    if (window.requests) qbStore.syncNewRequests(window.requests);

    renderQuickBidTable();
  } else {
    container?.classList.remove('quick-bid-mode');
    toggleBtn?.classList.remove('active');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="bi bi-lightning-charge-fill"></i> Quick Bid Mode';

    // Hand back to the standard dashboard renderer
    if (typeof renderRequests === 'function') renderRequests();
  }
}


// ─────────────────────────────────────────────
// RENDERER
// ─────────────────────────────────────────────

function renderQuickBidTable() {
  const container = document.getElementById('requestsList');
  if (!container || !qbStore) return;

  const session = qbStore.getSession();
  const meta = qbStore.getMeta();
  if (!session) return;

  const submittable = qbStore.isSubmittable();

  // ── Toolbar ──────────────────────────────────
  let html = `
    <div class="quick-bid-layout">
      <div class="quick-bid-toolbar">
        <div class="qb-stats">
          <span class="badge badge-ready">${meta.readyCount} Ready</span>
          <span class="badge badge-progress">${meta.draftCount} In Yard</span>
          <span class="badge badge-skipped">${meta.skippedCount} Skipped</span>
        </div>
        <button
          class="btn btn-primary"
          id="qbSubmitBtn"
          data-action="submit-all"
          ${!submittable ? 'disabled' : ''}
          style="background: #22C55E; border-color: #16A34A;">
          <i class="bi bi-send-check-fill"></i> Submit ${meta.readyCount} Bid${meta.readyCount !== 1 ? 's' : ''} Now
        </button>
      </div>

      <div class="qb-table-scroll">
        <table class="qb-table">
          <thead>
            <tr>
              <th>Request Snapshot</th>
              <th style="width:120px;">Stock?</th>
              <th style="width:140px;">Price (QAR)</th>
              <th style="width:160px;">Condition</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
  `;

  // ── Rows ─────────────────────────────────────
  session.items.forEach(item => {
    const s = item.snapshot;
    const isSkipped = item.itemStatus === QB_ITEM_STATUS.SKIPPED;
    const isReady = item.itemStatus === QB_ITEM_STATUS.READY;
    // Price and condition fields are only active when availability is AVAILABLE
    const fieldsDisabled = item.availability !== QB_AVAILABILITY.AVAILABLE;

    html += `
      <tr class="qb-row status-${item.itemStatus.toLowerCase()}" data-id="${item.requestId}">

        <td>
          <div class="qb-item-main">
            <strong>${escapeHTML(s.make)} ${escapeHTML(s.model)} ${s.year ? `(${s.year})` : ''}</strong>
            <span>${escapeHTML(s.partName)}</span>
            ${s.partNumber ? `<small class="qb-part-no">${escapeHTML(s.partNumber)}</small>` : ''}
            ${s.vin ? `
              <small class="qb-vin" title="Click to copy" data-action="copy-vin" data-vin="${escapeHTML(s.vin)}">
                VIN: ${escapeHTML(s.vin)} <i class="bi bi-clipboard" style="font-size:10px;"></i>
              </small>` : ''}
            ${s.buyerNote ? `
              <p class="qb-buyer-note">"${escapeHTML(s.buyerNote)}"</p>` : ''}
          </div>
        </td>

        <td>
          <div class="qb-avail-toggle">
            <button
              class="qb-chip ${item.availability === QB_AVAILABILITY.AVAILABLE ? 'active chip-yes' : ''}"
              data-action="set-available"
              title="Mark as in stock">
              Yes
            </button>
            <button
              class="qb-chip ${item.availability === QB_AVAILABILITY.UNAVAILABLE ? 'active chip-no' : ''}"
              data-action="set-unavailable"
              title="Mark as not in stock">
              No
            </button>
          </div>
        </td>

        <td>
          <input
            type="number"
            class="qb-field qb-price"
            value="${item.price ?? ''}"
            placeholder="0.00"
            min="0"
            step="0.01"
            data-action="set-price"
            ${fieldsDisabled ? 'disabled' : ''}>
        </td>

        <td>
          <select
            class="qb-field qb-condition"
            data-action="set-condition"
            ${fieldsDisabled ? 'disabled' : ''}>
            <option value="" ${!item.condition ? 'selected' : ''} disabled>Select...</option>
            <option value="NEW"            ${item.condition === 'NEW' ? 'selected' : ''}>Brand New</option>
            <option value="USED_EXCELLENT" ${item.condition === 'USED_EXCELLENT' ? 'selected' : ''}>Used – Excellent</option>
            <option value="USED_GOOD"      ${item.condition === 'USED_GOOD' ? 'selected' : ''}>Used – Good</option>
            <option value="USED_FAIR"      ${item.condition === 'USED_FAIR' ? 'selected' : ''}>Used – Fair</option>
          </select>
        </td>

        <td>
          <input
            type="text"
            class="qb-field qb-note"
            value="${escapeHTML(item.note)}"
            placeholder="Internal / buyer note..."
            maxlength="500"
            data-action="set-note">
        </td>

      </tr>
    `;
  });

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
}


// ─────────────────────────────────────────────
// EVENT DELEGATION
// ─────────────────────────────────────────────

/**
 * Single delegated listener on the #requestsList container.
 * Handles all user interactions in the Quick Bid table.
 * Attached once on init — survives innerHTML re-renders.
 */
function attachTableDelegation() {
  const container = document.getElementById('requestsList');
  if (!container) return;

  // ── Click actions ────────────────────────────
  container.addEventListener('click', (e) => {
    if (!qbIsActive || !qbStore) return;

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const row = actionEl.closest('[data-id]');
    const requestId = row?.dataset.id;

    switch (action) {
      case 'set-available':
        qbStore.setAvailability(requestId, QB_AVAILABILITY.AVAILABLE);
        break;

      case 'set-unavailable':
        qbStore.setAvailability(requestId, QB_AVAILABILITY.UNAVAILABLE);
        break;

      case 'copy-vin': {
        const vin = actionEl.dataset.vin;
        navigator.clipboard?.writeText(vin).then(() => {
          showToast(`VIN copied: ${vin}`, 'info');
        });
        break;
      }

      case 'submit-all':
        handleQuickBidSubmit();
        break;
    }
  });

  // ── Change actions (inputs & selects) ────────
  container.addEventListener('change', (e) => {
    if (!qbIsActive || !qbStore) return;

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const row = actionEl.closest('[data-id]');
    const requestId = row?.dataset.id;

    switch (action) {
      case 'set-price': {
        const val = e.target.value.trim();
        qbStore.setPrice(requestId, val === '' ? null : parseFloat(val));
        break;
      }

      case 'set-condition':
        if (e.target.value) qbStore.setCondition(requestId, e.target.value);
        break;

      case 'set-note':
        qbStore.setNote(requestId, e.target.value);
        break;
    }
  });
}


// ─────────────────────────────────────────────
// SUBMISSION
// ─────────────────────────────────────────────

async function handleQuickBidSubmit() {
  if (!qbStore) return;

  const { valid, payload, errors } = qbStore.buildSubmissionPayload();

  if (!valid) {
    showToast('Some bids have missing fields. Please review before submitting.', 'error');
    console.warn('[QuickBidUI] Validation errors:', errors);
    return;
  }

  // Disable submit button for the duration of the operation
  const btn = document.getElementById('qbSubmitBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Submitting...';
  }

  showToast(`Submitting ${payload.bids.length} bid${payload.bids.length !== 1 ? 's' : ''}...`, 'info');

  // Track per-bid outcomes for partial confirmation
  const succeededIds = [];
  const failedIds = [];

  for (const bid of payload.bids) {
    try {
      const formData = new FormData();
      formData.append('request_id', bid.requestId);
      formData.append('bid_amount', bid.price);
      formData.append('part_condition', bid.condition.toLowerCase());
      formData.append('warranty_days', 7);
      formData.append('notes', bid.note);

      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${window.token}` },
        body: formData,
      });

      if (res.ok) {
        succeededIds.push(bid.requestId);
      } else {
        const body = await res.json().catch(() => ({}));
        console.warn(`[QuickBidUI] Bid failed for ${bid.requestId}:`, res.status, body);
        failedIds.push(bid.requestId);
      }
    } catch (err) {
      console.error(`[QuickBidUI] Network error for ${bid.requestId}:`, err);
      failedIds.push(bid.requestId);
    }
  }

  // ── Partial confirmation ──────────────────────
  // Only mark succeeded bids as confirmed. Failed bids stay in READY
  // state so the operator can retry without re-entering data.
  if (succeededIds.length > 0) {
    qbStore.confirmPartialSubmission(succeededIds);
    showToast(`${succeededIds.length} bid${succeededIds.length !== 1 ? 's' : ''} submitted successfully.`, 'success');

    // Refresh the main dashboard lists
    if (typeof loadBids === 'function') loadBids();
    if (typeof loadRequests === 'function') loadRequests();
  }

  if (failedIds.length > 0) {
    showToast(
      `${failedIds.length} bid${failedIds.length !== 1 ? 's' : ''} failed. They remain in your workspace for retry.`,
      'error'
    );
  }

  renderQuickBidTable();
}


// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

/**
 * XSS-safe HTML escaping.
 * Defined here as a fallback; if the host dashboard already provides
 * a global escapeHTML, this will be overridden at runtime — that's fine.
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────

/**
 * No setTimeout. Dynamic import handles the timing dependency cleanly.
 * The store module is guaranteed to be loaded before initQuickBid resolves.
 */
document.addEventListener('DOMContentLoaded', initQuickBid);
