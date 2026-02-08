/**
 * Finance Dashboard JavaScript
 * Dedicated payout and revenue management for Finance team
 */

const API_URL = '/api';
let token = localStorage.getItem('financeToken') || localStorage.getItem('opsToken');
let socket = null;
let currentSection = 'overview';
let currentPeriod = '30d';

// Batch payment state
let currentGarageFilter = '';
let pendingPayoutsData = [];
let selectedPayoutIds = new Set();

// ==========================================
// UTILITIES
// ==========================================

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    return parseFloat(amount || 0).toLocaleString() + ' QAR';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-QA', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function daysSince(dateStr) {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

/**
 * Get payout type badge HTML
 * Distinguishes between standard payouts and cancellation compensation
 */
function getPayoutTypeBadge(payout) {
    if (payout.payout_type === 'cancellation_compensation') {
        return '<span class="badge badge-warning" title="Garage compensation for customer cancellation"><i class="bi bi-shield-exclamation"></i> Compensation</span>';
    }
    return '<span class="badge badge-info"><i class="bi bi-cash-stack"></i> Standard</span>';
}

/**
 * Get commission display based on payout type
 */
function getCommissionDisplay(payout) {
    if (payout.payout_type === 'cancellation_compensation') {
        return '<span class="text-muted" title="No commission on compensation payouts">Customer cancelled</span>';
    }
    return formatCurrency(payout.commission_amount || payout.platform_fee);
}

// ==========================================
// AUTHENTICATION
// ==========================================

function isAuthorizedUser(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Admin always has access
        if (payload.userType === 'admin') return true;

        // Staff users need finance role for finance dashboard
        if (payload.userType === 'staff') {
            return payload.staffRole === 'finance';
        }

        return false;
    } catch {
        return false;
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, password })
        });
        const data = await res.json();

        if (data.token) {
            if (!isAuthorizedUser(data.token)) {
                showToast('Access denied. Finance access required.', 'error');
                return;
            }
            localStorage.setItem('financeToken', data.token);
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('userType', data.userType);
            localStorage.setItem('finUserName', data.fullName || 'Finance User');
            localStorage.setItem('finUserPhone', data.phoneNumber || '');
            token = data.token;
            showDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

if (token && isAuthorizedUser(token)) {
    showDashboard();
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    // Display logged-in user info
    const userName = localStorage.getItem('finUserName') || 'Finance User';
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const greetingEl = document.getElementById('greetingText');

    if (userNameEl) userNameEl.textContent = userName;
    if (userAvatarEl) userAvatarEl.textContent = userName.charAt(0).toUpperCase();
    if (greetingEl) greetingEl.textContent = `Welcome, ${userName.split(' ')[0]}`;

    // Update datetime
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // Load initial data
    loadOverview();
    loadBadges();

    // Setup navigation
    setupNavigation();

    // Setup socket
    setupSocket();
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('headerDateTime').textContent = now.toLocaleDateString('en-QA', options);
}

function logout() {
    localStorage.removeItem('financeToken');
    location.reload();
}

// ==========================================
// NAVIGATION
// ==========================================

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(section) {
    currentSection = section;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `section${section.charAt(0).toUpperCase() + section.slice(1)}`);
    });

    // Load section data
    switch (section) {
        case 'overview': loadOverview(); break;
        case 'pending': loadPendingPayouts(); break;
        case 'inwarranty': loadInWarrantyPayouts(); break;
        case 'awaiting': loadAwaitingPayouts(); break;
        case 'disputed': loadDisputedPayouts(); break;
        case 'completed': loadCompletedPayouts(); break;
        case 'revenue': loadRevenue(); break;
        case 'pendingRefunds': loadPendingRefunds(); break;
        case 'refunds': loadRefunds(); break;
        case 'compensationReviews': loadCompensationReviews(); break;
    }
}

function refreshCurrentSection() {
    switchSection(currentSection);
    showToast('Refreshed', 'success');
}

// ==========================================
// SOCKET
// ==========================================

function setupSocket() {
    socket = io({ auth: { token } });

    // Connection handlers for data freshness
    socket.on('connect', () => {
        console.log('[Socket] Connected - refreshing data');
        loadBadges();
    });

    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
    });

    socket.on('payout_confirmed', (data) => {
        showToast(`Payment confirmed by ${data.garage_name}`, 'success');
        loadBadges();
        if (currentSection === 'awaiting') loadAwaitingPayouts();
    });

    socket.on('payout_disputed', (data) => {
        showToast(`Payment disputed by ${data.garage_name}!`, 'error');
        loadBadges();
        if (currentSection === 'disputed') loadDisputedPayouts();
    });
}

// ==========================================
// BADGES
// ==========================================

async function loadBadges() {
    try {
        const res = await fetch(`${API_URL}/finance/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const stats = data.stats || data;

        updateBadge('pendingBadge', stats.pending_count || 0);
        updateBadge('awaitingBadge', stats.awaiting_count || stats.sent_count || 0);
        updateBadge('disputedBadge', stats.disputed_count || 0);
    } catch (err) {
        console.error('Failed to load badges:', err);
    }
}

function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

// ==========================================
// OVERVIEW
// ==========================================

async function loadOverview() {
    try {
        // Load stats
        const statsRes = await fetch(`${API_URL}/finance/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await statsRes.json();
        const stats = data.stats || data;

        document.getElementById('statTotalRevenue').textContent = formatCurrency(stats.total_revenue || 0);
        document.getElementById('statPendingPayouts').textContent = formatCurrency(stats.pending_payouts || stats.total_pending || 0);
        document.getElementById('statAwaitingConfirm').textContent = formatCurrency(stats.processing_payouts || stats.total_sent || 0);
        document.getElementById('statCompletedPayouts').textContent = formatCurrency(stats.total_paid || stats.total_confirmed || 0);

        // Load loyalty program stats from operations API
        try {
            const loyaltyRes = await fetch(`${API_URL}/operations/dashboard/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const loyaltyData = await loyaltyRes.json();
            if (loyaltyData.stats) {
                const ls = loyaltyData.stats;
                const loyaltyTodayEl = document.getElementById('statLoyaltyToday');
                const loyaltyCountEl = document.getElementById('statLoyaltyCount');
                const loyaltyWeekEl = document.getElementById('statLoyaltyWeek');
                const loyaltyMonthEl = document.getElementById('statLoyaltyMonth');

                if (loyaltyTodayEl) loyaltyTodayEl.textContent = Math.round(parseFloat(ls.loyalty_discounts_today) || 0) + ' QAR';
                if (loyaltyCountEl) loyaltyCountEl.textContent = (parseInt(ls.loyalty_discounts_count_today) || 0) + ' orders';
                if (loyaltyWeekEl) loyaltyWeekEl.textContent = Math.round(parseFloat(ls.loyalty_discounts_week) || 0) + ' QAR';
                if (loyaltyMonthEl) loyaltyMonthEl.textContent = Math.round(parseFloat(ls.loyalty_discounts_month) || 0) + ' QAR';
            }
        } catch (err) {
            console.error('Failed to load loyalty stats:', err);
        }

        // Load recent payouts
        const payoutsRes = await fetch(`${API_URL}/finance/payouts?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const payoutsData = await payoutsRes.json();

        const tbody = document.getElementById('recentPayoutsTable');
        const payouts = payoutsData.payouts || [];

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No recent payouts</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td>${formatCurrency(p.net_amount)}</td>
                <td><span class="status-badge ${p.payout_status || p.status}">${p.payout_status || p.status}</span></td>
                <td>${formatDate(p.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load overview:', err);
    }
}

// ==========================================
// PENDING PAYOUTS
// ==========================================

let pendingPage = 1;

async function loadPendingPayouts(page = 1) {
    pendingPage = page;
    try {
        // Build URL with optional garage filter
        let url = `${API_URL}/finance/payouts?status=pending&page=${page}&limit=20`;
        if (currentGarageFilter) {
            url += `&garage_id=${currentGarageFilter}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('pendingPayoutsTable');
        const payouts = data.payouts || [];

        // Store for later use
        pendingPayoutsData = payouts;

        // Update totals display
        updatePendingTotals(payouts);

        // Clear selection
        selectedPayoutIds.clear();
        const selectAll = document.getElementById('selectAllPending');
        if (selectAll) selectAll.checked = false;

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="bi bi-check-circle"></i> No pending payouts</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr class="${p.payout_type === 'cancellation_compensation' ? 'compensation-row' : ''}">
                <td>
                    <input type="checkbox" class="payout-checkbox" 
                           data-payout-id="${p.payout_id}"
                           onchange="handlePayoutCheckbox('${p.payout_id}', this.checked)">
                </td>
                <td>${getPayoutTypeBadge(p)}</td>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td>${formatCurrency(p.gross_amount || p.amount)}</td>
                <td>${getCommissionDisplay(p)}</td>
                <td style="color: var(--success); font-weight: 600;">${formatCurrency(p.net_amount)}</td>
                <td>${formatDate(p.created_at)}</td>
                <td>
                    <button class="btn btn-success btn-sm send-payout-btn" 
                            data-payout-id="${p.payout_id}" 
                            data-garage-name="${escapeHTML(p.garage_name).replace(/"/g, '&quot;')}" 
                            data-amount="${p.net_amount}">
                        <i class="bi bi-send-check"></i> Send
                    </button>
                    <button class="btn btn-ghost btn-sm hold-payout-btn" data-payout-id="${p.payout_id}">
                        <i class="bi bi-pause-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Add event listeners for send buttons
        tbody.querySelectorAll('.send-payout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openSendPaymentModal(btn.dataset.payoutId, btn.dataset.garageName, parseFloat(btn.dataset.amount));
            });
        });

        // Add event listeners for hold buttons
        tbody.querySelectorAll('.hold-payout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                holdPayout(btn.dataset.payoutId);
            });
        });
    } catch (err) {
        console.error('Failed to load pending payouts:', err);
    }
}

// ==========================================
// IN-WARRANTY PAYOUTS (7-Day Hold)
// ==========================================

async function loadInWarrantyPayouts() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts/in-warranty`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('inWarrantyPayoutsTable');
        const payouts = data.in_warranty_payouts || [];

        // Update badge
        const badge = document.getElementById('inWarrantyCount');
        if (badge) badge.textContent = payouts.length;

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-shield-check"></i> No orders currently in warranty period</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => {
            const daysRemaining = parseInt(p.days_until_eligible) || 0;
            const badgeClass = daysRemaining <= 2 ? 'badge-warning' : 'badge-info';
            return `
            <tr>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td>${formatDate(p.delivered_at)}</td>
                <td>
                    <span class="badge ${badgeClass}">
                        <i class="bi bi-hourglass-split"></i> ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}
                    </span>
                </td>
                <td style="color: var(--success); font-weight: 600;">${formatCurrency(p.net_amount)}</td>
                <td>
                    <span class="badge badge-warning">
                        <i class="bi bi-shield-lock"></i> In Warranty
                    </span>
                </td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        console.error('Failed to load in-warranty payouts:', err);
        showToast('Failed to load in-warranty payouts', 'error');
    }
}

function toggleSelectAll(type) {
    const checked = document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`).checked;
    document.querySelectorAll(`.payout-checkbox`).forEach(cb => cb.checked = checked);
}

async function processBulkPayouts() {
    const selected = [...document.querySelectorAll('.payout-checkbox:checked')].map(cb => cb.dataset.payoutId);
    if (selected.length === 0) {
        showToast('Select at least one payout', 'error');
        return;
    }

    // Confirmation dialog
    if (!confirm(`Process ${selected.length} payout(s)?\n\nThis will send payments to the selected garages and notify them.`)) {
        return;
    }

    // Calculate total amount
    let totalAmount = 0;
    selected.forEach(id => {
        const row = document.querySelector(`.payout-checkbox[data-payout-id="${id}"]`)?.closest('tr');
        if (row) {
            const amountCell = row.querySelectorAll('td')[5];
            if (amountCell) {
                const amountText = amountCell.textContent.replace(/[^\d.]/g, '');
                totalAmount += parseFloat(amountText) || 0;
            }
        }
    });

    // Open bulk payment modal
    openBulkPaymentModal(selected, totalAmount);
}

function openBulkPaymentModal(payoutIds, totalAmount) {
    // Update modal content for bulk
    document.getElementById('spPayoutId').value = payoutIds.join(',');
    document.getElementById('spGarageName').textContent = `${payoutIds.length} garages`;
    document.getElementById('spAmount').textContent = formatCurrency(totalAmount);
    document.getElementById('spPaymentMethod').value = '';
    document.getElementById('spReference').value = '';
    document.getElementById('spNotes').value = '';
    document.getElementById('sendPaymentModal').style.display = 'flex';
}

async function submitSendPayment() {
    const payoutIdValue = document.getElementById('spPayoutId').value;
    const method = document.getElementById('spPaymentMethod').value;
    const reference = document.getElementById('spReference').value;
    const notes = document.getElementById('spNotes').value;

    if (!method || !reference) {
        showToast('Payment method and reference are required', 'error');
        return;
    }

    // Check if bulk or single
    const payoutIds = payoutIdValue.includes(',') ? payoutIdValue.split(',') : [payoutIdValue];

    if (payoutIds.length === 1) {
        // Single payout - original behavior
        try {
            const res = await fetch(`${API_URL}/finance/payouts/${payoutIds[0]}/send`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ payout_method: method, payout_reference: reference, notes })
            });

            const data = await res.json();

            if (res.ok) {
                showToast('Payment sent! Awaiting garage confirmation.', 'success');
                closeSendPaymentModal();
                loadPendingPayouts();
                loadBadges();
            } else {
                showToast(data.error || 'Failed to send payment', 'error');
            }
        } catch (err) {
            showToast('Connection error', 'error');
        }
    } else {
        // Bulk payouts
        showToast(`Processing ${payoutIds.length} payouts...`, 'info');
        let successCount = 0;
        let failCount = 0;
        const errors = []; // Track errors for debugging

        for (const payoutId of payoutIds) {
            try {
                console.log(`[Batch Payout] Processing ${payoutId}...`);
                const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/send`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payout_method: method, payout_reference: reference, notes })
                });

                const data = await res.json();

                if (res.ok) {
                    console.log(`[Batch Payout] ✅ Success for ${payoutId}`);
                    successCount++;
                } else {
                    console.error(`[Batch Payout] ❌ Failed for ${payoutId}:`, data);
                    failCount++;
                    errors.push({ payoutId, error: data.error || 'Unknown error', status: res.status });
                }
            } catch (err) {
                console.error(`[Batch Payout] ❌ Exception for ${payoutId}:`, err);
                failCount++;
                errors.push({ payoutId, error: err.message || 'Network error' });
            }
        }

        closeSendPaymentModal();

        // Show detailed results
        if (failCount === 0) {
            showToast(`✅ All ${successCount} payments sent successfully!`, 'success');
        } else {
            console.error('[Batch Payout] Errors:', errors);
            const errorSummary = errors.slice(0, 3).map(e => `${e.payoutId}: ${e.error}`).join('; ');
            showToast(`⚠️ ${successCount} sent, ${failCount} failed. Errors: ${errorSummary}`, 'error');
        }

        loadPendingPayouts();
        loadBadges();
    }
}

// ==========================================
// SEND PAYMENT MODAL
// ==========================================

function openSendPaymentModal(payoutId, garageName, amount) {
    console.log('openSendPaymentModal called', payoutId, garageName, amount);
    document.getElementById('spPayoutId').value = payoutId;
    document.getElementById('spGarageName').textContent = garageName;
    document.getElementById('spAmount').textContent = formatCurrency(amount);
    document.getElementById('spPaymentMethod').value = '';
    document.getElementById('spReference').value = '';
    document.getElementById('spNotes').value = '';
    const modal = document.getElementById('sendPaymentModal');
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeSendPaymentModal() {
    const modal = document.getElementById('sendPaymentModal');
    modal.style.display = 'none';
    modal.classList.remove('active');
}




async function holdPayout(payoutId) {
    const reason = prompt('Reason for holding this payout:');
    if (!reason) return;

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/hold`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });

        if (res.ok) {
            showToast('Payout placed on hold', 'success');
            loadPendingPayouts();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to hold payout', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ==========================================
// AWAITING CONFIRMATION
// ==========================================

async function loadAwaitingPayouts() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts?status=awaiting_confirmation`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('awaitingPayoutsTable');
        const payouts = data.payouts || [];

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i> No payouts awaiting confirmation</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => {
            const days = daysSince(p.sent_at);
            const urgency = days > 5 ? 'color: var(--danger); font-weight: 600;' : '';
            return `
                <tr>
                    <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                    <td>#${escapeHTML(p.order_number)}</td>
                    <td>${formatCurrency(p.net_amount)}</td>
                    <td>${formatDate(p.sent_at)}</td>
                    <td style="${urgency}">${days} days</td>
                    <td>
                        <button class="btn btn-ghost btn-sm" onclick="resendNotification('${p.payout_id}')">
                            <i class="bi bi-bell"></i> Remind
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load awaiting payouts:', err);
    }
}

async function resendNotification(payoutId) {
    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/remind`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Reminder sent to garage', 'success');
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to send reminder', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ==========================================
// DISPUTED PAYOUTS
// ==========================================

async function loadDisputedPayouts() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts?status=disputed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('disputedPayoutsTable');
        const payouts = data.payouts || [];

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i> No disputed payouts</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr style="background: rgba(239, 68, 68, 0.05);">
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td>${formatCurrency(p.net_amount)}</td>
                <td style="color: var(--danger);">${escapeHTML(p.dispute_reason || 'Not specified')}</td>
                <td>${formatDate(p.disputed_at)}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="resolveDispute('${p.payout_id}', '${escapeHTML(p.garage_name || '')}', ${p.net_amount || 0}, '${escapeHTML(p.dispute_reason || '')}')">
                        <i class="bi bi-shield-check"></i> Resolve
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load disputed payouts:', err);
    }
}

// Store current dispute data for modal
let currentDisputePayout = null;

function resolveDispute(payoutId, garageName, amount, reason) {
    // Open modal with payout data
    currentDisputePayout = { payoutId, garageName, amount, reason };

    document.getElementById('rdPayoutId').value = payoutId;
    document.getElementById('rdGarageName').textContent = garageName || '-';
    document.getElementById('rdAmount').textContent = formatCurrency(amount);
    document.getElementById('rdReason').textContent = reason || 'Not specified';

    // Reset form fields
    document.getElementById('rdResolutionType').value = '';
    document.getElementById('rdNewAmount').value = '';
    document.getElementById('rdPaymentMethod').value = '';
    document.getElementById('rdNewReference').value = '';
    document.getElementById('rdNotes').value = '';
    document.getElementById('rdAmountCorrectionGroup').style.display = 'none';

    document.getElementById('resolveDisputeModal').style.display = 'flex';
}

function closeResolveDisputeModal() {
    document.getElementById('resolveDisputeModal').style.display = 'none';
    currentDisputePayout = null;
}

function toggleAmountCorrection() {
    const resType = document.getElementById('rdResolutionType').value;
    const amountGroup = document.getElementById('rdAmountCorrectionGroup');
    amountGroup.style.display = (resType === 'corrected') ? 'block' : 'none';
}

async function submitDisputeResolution() {
    const payoutId = document.getElementById('rdPayoutId').value;
    const resolution = document.getElementById('rdResolutionType').value;
    const notes = document.getElementById('rdNotes').value.trim();
    const newAmount = document.getElementById('rdNewAmount').value;
    const newMethod = document.getElementById('rdPaymentMethod').value;
    const newReference = document.getElementById('rdNewReference').value.trim();

    // Validation
    if (!resolution) {
        showToast('Please select a resolution type', 'error');
        return;
    }
    if (!notes) {
        showToast('Please provide resolution notes', 'error');
        return;
    }

    try {
        const body = {
            resolution,
            resolution_notes: notes
        };

        // Optional fields
        if (newAmount) body.new_amount = parseFloat(newAmount);
        if (newMethod) body.new_payout_method = newMethod;
        if (newReference) body.new_payout_reference = newReference;

        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/resolve-dispute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            showToast(`Dispute resolved: ${resolution}`, 'success');
            closeResolveDisputeModal();
            loadDisputedPayouts();
            loadBadges();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to resolve dispute', 'error');
        }
    } catch (err) {
        console.error('Resolve dispute error:', err);
        showToast('Connection error', 'error');
    }
}

// ==========================================
// COMPLETED PAYOUTS
// ==========================================

let completedPage = 1;

async function loadCompletedPayouts(page = 1) {
    completedPage = page;
    const fromDate = document.getElementById('completedFromDate')?.value || '';
    const toDate = document.getElementById('completedToDate')?.value || '';

    let url = `${API_URL}/finance/payouts?status=confirmed&page=${page}&limit=20`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('completedPayoutsTable');
        const payouts = data.payouts || [];
        const pagination = data.pagination || { page: 1, pages: 1, total: payouts.length };

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No completed payouts for this period</td></tr>';
            renderPagination('completedPagination', pagination, 'loadCompletedPayouts');
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td style="color: var(--success);">${formatCurrency(p.net_amount)}</td>
                <td>${escapeHTML(p.payout_method || p.payment_method || 'Bank Transfer')}</td>
                <td>${escapeHTML(p.payout_reference || p.reference_number || '-')}</td>
                <td>${formatDate(p.confirmed_at)}</td>
            </tr>
        `).join('');

        // Render pagination
        renderPagination('completedPagination', pagination, 'loadCompletedPayouts');
    } catch (err) {
        console.error('Failed to load completed payouts:', err);
    }
}

function exportCompletedPayouts() {
    const fromDate = document.getElementById('completedFromDate')?.value || '';
    const toDate = document.getElementById('completedToDate')?.value || '';

    let url = `${API_URL}/finance/payouts/export?format=csv&status=confirmed`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;

    showToast('Downloading CSV export...', 'info');

    // Create temporary link to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payouts_${fromDate || 'all'}_${toDate || 'all'}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// REVENUE
// ==========================================

async function loadRevenue() {
    try {
        const res = await fetch(`${API_URL}/finance/revenue?period=${currentPeriod}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Access nested metrics object
        const metrics = data.metrics || {};
        document.getElementById('revTotalOrders').textContent = metrics.orders_completed || 0;
        document.getElementById('revTotalRevenue').textContent = formatCurrency(metrics.total_revenue);
        document.getElementById('revPlatformFees').textContent = formatCurrency(metrics.platform_fees);
        // Net revenue = total_revenue - platform_fees (since total_revenue includes both platform + delivery fees)
        const netRevenue = (metrics.total_revenue || 0) - (metrics.platform_fees || 0);
        document.getElementById('revNetRevenue').textContent = formatCurrency(netRevenue);
    } catch (err) {
        console.error('Failed to load revenue:', err);
    }
}

// Period tabs
document.getElementById('periodTabs')?.addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
        document.querySelectorAll('#periodTabs .tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentPeriod = e.target.dataset.period;
        loadRevenue();
    }
});

// ==========================================
// PENDING REFUNDS (Approval Queue)
// ==========================================

async function loadPendingRefunds() {
    try {
        const res = await fetch(`${API_URL}/finance/refunds/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('pendingRefundsTable');
        const refunds = data.refunds || [];

        // Update badge
        updateBadge('pendingRefundsBadge', refunds.length);

        if (refunds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-check-circle" style="color: var(--success);"></i> No pending refund requests</td></tr>';
            return;
        }

        tbody.innerHTML = refunds.map(r => `
            <tr>
                <td><strong>#${escapeHTML(r.order_number || r.order_id?.slice(0, 8))}</strong></td>
                <td>${escapeHTML(r.customer_name || '-')}</td>
                <td style="color: var(--danger); font-weight: 600;">-${formatCurrency(r.refund_amount)}</td>
                <td>${escapeHTML(r.refund_reason || '-')}</td>
                <td><span class="status-badge status-pending">Support</span></td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-success btn-sm" 
                            onclick="approveRefund('${r.refund_id}', '${escapeHTML(r.order_number || '')}', ${r.refund_amount || 0})" 
                            style="padding: 6px 12px; font-size: 11px;">
                            <i class="bi bi-check-lg"></i> Approve
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="rejectRefund('${r.refund_id}')"
                            style="padding: 6px 12px; font-size: 11px; color: var(--danger);">
                            <i class="bi bi-x-lg"></i> Reject
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load pending refunds:', err);
        document.getElementById('pendingRefundsTable').innerHTML = '<tr><td colspan="7" class="empty-state" style="color: var(--danger);"><i class="bi bi-exclamation-triangle"></i> Failed to load</td></tr>';
    }
}

async function approveRefund(refundId, orderNumber = '', amount = 0) {
    // Show professional confirmation modal with amount preview (100/100 alignment)
    const modalContent = `
        <div style="text-align: center; padding: 20px;">
            <i class="bi bi-arrow-counterclockwise" style="font-size: 48px; color: var(--success); margin-bottom: 16px; display: block;"></i>
            <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1)); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px;">
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Refund Amount</div>
                <div style="font-size: 28px; font-weight: 700; color: #10b981;">${formatCurrency(amount)}</div>
                ${orderNumber ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Order #${orderNumber}</div>` : ''}
            </div>
            <p style="color: var(--text-secondary); margin: 0;">This will process the refund via Stripe immediately.</p>
        </div>
    `;

    // Create modal if QScrapModal exists, otherwise fallback to confirm
    if (typeof QScrapModal !== 'undefined') {
        QScrapModal.create({
            id: 'approve-refund-modal',
            title: 'Confirm Refund Approval',
            headerIcon: 'bi-check-circle',
            headerClass: 'linear-gradient(135deg, #10b981, #059669)',
            content: modalContent,
            size: 'sm',
            actions: [
                {
                    id: 'cancel-approve-btn',
                    text: 'Cancel',
                    class: 'btn btn-ghost',
                    onclick: () => QScrapModal.close('approve-refund-modal')
                },
                {
                    id: 'confirm-approve-btn',
                    text: 'Approve & Process',
                    class: 'btn btn-success',
                    onclick: async () => {
                        QScrapModal.close('approve-refund-modal');
                        await executeRefundApproval(refundId);
                    }
                }
            ]
        });
    } else {
        // Fallback for when modal system is not available
        if (!confirm(`Approve refund of ${formatCurrency(amount)} for Order #${orderNumber}?\n\nThis will process via Stripe immediately.`)) return;
        await executeRefundApproval(refundId);
    }
}

async function executeRefundApproval(refundId) {
    try {
        showToast('Processing refund...', 'info');

        const res = await fetch(`${API_URL}/finance/refunds/${refundId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        if (data.success) {
            showToast('Refund approved and processed!', 'success');
            loadPendingRefunds();
            loadBadges();
        } else {
            showToast(data.error || data.message || 'Failed to approve refund', 'error');
        }
    } catch (err) {
        console.error('Approve refund error:', err);
        showToast('Failed to process refund', 'error');
    }
}

async function rejectRefund(refundId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
        const res = await fetch(`${API_URL}/finance/refunds/${refundId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        const data = await res.json();

        if (data.success) {
            showToast('Refund rejected', 'success');
            loadPendingRefunds();
            loadBadges();
        } else {
            showToast(data.error || 'Failed to reject refund', 'error');
        }
    } catch (err) {
        console.error('Reject refund error:', err);
        showToast('Failed to reject refund', 'error');
    }
}

// ==========================================
// REFUNDS
// ==========================================

let refundsPage = 1;

async function loadRefunds(page = 1) {
    refundsPage = page;
    try {
        // Use dedicated refunds endpoint with pagination
        const res = await fetch(`${API_URL}/finance/refunds?page=${page}&limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('refundsTable');
        const refunds = data.refunds || [];
        const total = data.total || refunds.length;
        const pagination = { page: page, pages: Math.ceil(total / 20) || 1, total: total };

        if (refunds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-check-circle"></i> No refunds processed</td></tr>';
            renderPagination('refundsPagination', pagination, 'loadRefunds');
            return;
        }

        tbody.innerHTML = refunds.map(r => `
            <tr>
                <td>#${escapeHTML(r.order_number || r.order_id?.slice(0, 8))}</td>
                <td>${escapeHTML(r.customer_name || '-')}</td>
                <td style="color: var(--danger); font-weight: 600;">-${formatCurrency(r.refund_amount)}</td>
                <td>${escapeHTML(r.refund_reason || '-')}</td>
                <td><span class="status-badge status-${r.refund_status || 'pending'}">${r.refund_status || 'pending'}</span></td>
                <td>${escapeHTML(r.processed_by_name || 'Finance')}</td>
                <td>${formatDate(r.created_at)}</td>
            </tr>
        `).join('');

        // Render pagination
        renderPagination('refundsPagination', pagination, 'loadRefunds');
    } catch (err) {
        console.error('Failed to load refunds:', err);
        document.getElementById('refundsTable').innerHTML = '<tr><td colspan="7" class="empty-state" style="color: var(--danger);"><i class="bi bi-exclamation-triangle"></i> Failed to load refunds</td></tr>';
    }
}

function openRefundModal() {
    // Reset form
    document.getElementById('refundOrderNumber').value = '';
    document.getElementById('refundOrderDetails').style.display = 'none';
    document.getElementById('submitRefundBtn').disabled = true;

    const modal = document.getElementById('refundModal');
    modal.style.display = 'flex';
    // CSS requires .active class for visibility (opacity/visibility transition)
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeRefundModal() {
    const modal = document.getElementById('refundModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300); // Wait for transition
}

async function searchOrderForRefund() {
    const orderNumber = document.getElementById('refundOrderNumber').value.trim();
    if (!orderNumber) {
        showToast('Enter an order number', 'error');
        return;
    }

    try {
        // Search for order by order_number
        const res = await fetch(`${API_URL}/operations/orders?search=${encodeURIComponent(orderNumber)}&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const orders = data.orders || data || [];
        if (orders.length === 0) {
            showToast('Order not found', 'error');
            return;
        }

        const order = orders[0];

        // Populate order details
        document.getElementById('refundOrderId').textContent = `#${order.order_number}`;
        document.getElementById('refundCustomerName').textContent = order.customer_name || 'Customer';
        document.getElementById('refundGarageName').textContent = order.garage_name || 'Garage';
        document.getElementById('refundOrderAmount').textContent = formatCurrency(order.total_amount);
        document.getElementById('refundOrderIdHidden').value = order.order_id;
        document.getElementById('refundAmount').value = '';
        document.getElementById('refundAmount').max = order.total_amount;
        document.getElementById('refundReason').value = '';
        document.getElementById('refundNotes').value = '';

        // Show order details section
        document.getElementById('refundOrderDetails').style.display = 'block';
        document.getElementById('submitRefundBtn').disabled = false;

        showToast('Order found!', 'success');
    } catch (err) {
        console.error('Error searching order:', err);
        showToast('Failed to search order', 'error');
    }
}

async function submitRefund() {
    const orderId = document.getElementById('refundOrderIdHidden').value;
    const amount = document.getElementById('refundAmount').value;
    const reason = document.getElementById('refundReason').value;
    const method = document.getElementById('refundMethod').value;
    const notes = document.getElementById('refundNotes').value;

    if (!orderId) {
        showToast('Please search for an order first', 'error');
        return;
    }

    if (!amount || parseFloat(amount) <= 0) {
        showToast('Enter a valid refund amount', 'error');
        return;
    }

    if (!reason) {
        showToast('Select a refund reason', 'error');
        return;
    }

    // Confirm action
    const orderNumber = document.getElementById('refundOrderId').textContent;
    if (!confirm(`Process refund of ${formatCurrency(amount)} for ${orderNumber}?\n\nThis will adjust the garage payout and notify them.`)) {
        return;
    }

    try {
        const btn = document.getElementById('submitRefundBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';

        const res = await fetch(`${API_URL}/finance/refund/${orderId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refund_amount: parseFloat(amount),
                refund_reason: reason + (notes ? ` - ${notes}` : ''),
                refund_method: method
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Refund of ${formatCurrency(amount)} processed successfully!`, 'success');
            closeRefundModal();
            loadRefunds();
            loadOverview(); // Refresh stats
        } else {
            showToast(data.error || 'Failed to process refund', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-return-left"></i> Process Refund';
    } catch (err) {
        console.error('Error processing refund:', err);
        showToast('Connection error', 'error');
        document.getElementById('submitRefundBtn').disabled = false;
        document.getElementById('submitRefundBtn').innerHTML = '<i class="bi bi-arrow-return-left"></i> Process Refund';
    }
}

// ==========================================
// EXPORT
// ==========================================

async function exportPayouts() {
    showToast('Generating CSV export...', 'info');

    try {
        // Fetch all completed payouts
        const res = await fetch(`${API_URL}/finance/payouts?status=confirmed&limit=1000`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const payouts = data.payouts || [];

        if (payouts.length === 0) {
            showToast('No payouts to export', 'error');
            return;
        }

        // Generate CSV
        const headers = ['Garage', 'Order #', 'Net Amount', 'Payment Method', 'Reference', 'Date'];
        const rows = payouts.map(p => [
            p.garage_name,
            p.order_number,
            p.net_amount,
            p.payment_method || 'Bank Transfer',
            p.payout_reference || '-',
            new Date(p.confirmed_at || p.created_at).toLocaleDateString()
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qscrap_payouts_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showToast(`Exported ${payouts.length} payouts`, 'success');
    } catch (err) {
        console.error('Export failed:', err);
        showToast('Export failed', 'error');
    }
}

function exportCompletedPayouts() {
    exportPayouts();
}

// ==========================================
// BATCH PAYMENT OPERATIONS
// =========================================

/**
 * Load all garages for filter dropdown
 */
async function loadGaragesForFilter() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts/garages-pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const select = document.getElementById('garageFilter');
        if (!select) return;

        select.innerHTML = '<option value="">All Garages</option>';
        (data.garages || []).forEach(g => {
            // Only show count if there are pending payouts
            const label = g.pending_count > 0
                ? `${escapeHTML(g.garage_name)} (${g.pending_count} - ${formatCurrency(g.pending_total)})`
                : escapeHTML(g.garage_name);
            select.innerHTML += `<option value="${g.garage_id}">${label}</option>`;
        });
    } catch (err) {
        console.error('Failed to load garages for filter:', err);
    }
}

/**
 * Apply garage filter and reload pending payouts
 */
function applyGarageFilter() {
    currentGarageFilter = document.getElementById('garageFilter').value;
    loadPendingPayouts(1);
}

/**
 * Clear garage filter
 */
function clearGarageFilter() {
    document.getElementById('garageFilter').value = '';
    currentGarageFilter = '';
    loadPendingPayouts(1);
}

/**
 * Toggle select all pending payouts checkbox
 */
function toggleSelectAllPending() {
    const selectAll = document.getElementById('selectAllPending');
    const checkboxes = document.querySelectorAll('.payout-checkbox');

    selectedPayoutIds.clear();
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) {
            selectedPayoutIds.add(cb.dataset.payoutId);
        }
    });

    updateSelectedCount();
}

/**
 * Handle individual payout checkbox change
 */
function handlePayoutCheckbox(payoutId, checked) {
    if (checked) {
        selectedPayoutIds.add(payoutId);
    } else {
        selectedPayoutIds.delete(payoutId);
    }

    // Update select all checkbox state
    const checkboxes = document.querySelectorAll('.payout-checkbox');
    const selectAll = document.getElementById('selectAllPending');
    if (selectAll) {
        selectAll.checked = checkboxes.length > 0 && selectedPayoutIds.size === checkboxes.length;
    }

    updateSelectedCount();
}

/**
 * Update selected count display
 */
function updateSelectedCount() {
    const count = selectedPayoutIds.size;
    // Could show a "Send X Selected" button if needed
}

/**
 * Update pending totals display
 */
function updatePendingTotals(payouts) {
    const count = payouts.length;
    const total = payouts.reduce((sum, p) => sum + parseFloat(p.net_amount || 0), 0);

    const countEl = document.getElementById('pendingCountDisplay');
    const amountEl = document.getElementById('pendingAmountDisplay');

    if (countEl) countEl.textContent = count;
    if (amountEl) amountEl.textContent = formatCurrency(total);
}

/**
 * Open batch payment flow
 * Uses already-loaded pendingPayoutsData — no extra API call needed
 */
function openBatchPaymentFlow() {
    if (!pendingPayoutsData || pendingPayoutsData.length === 0) {
        showToast('No pending payouts to process', 'error');
        return;
    }

    // Build garage breakdown from local data
    const garageMap = new Map();
    for (const p of pendingPayoutsData) {
        const existing = garageMap.get(p.garage_id) || {
            garage_id: p.garage_id,
            garage_name: p.garage_name,
            payout_count: 0,
            total: 0
        };
        existing.payout_count++;
        existing.total += parseFloat(p.net_amount) || 0;
        garageMap.set(p.garage_id, existing);
    }
    const garages = [...garageMap.values()];
    const totalAmount = garages.reduce((sum, g) => sum + g.total, 0);
    const totalCount = pendingPayoutsData.length;

    // Populate modal
    document.getElementById('bpPayoutCount').textContent = totalCount;
    document.getElementById('bpTotalAmount').textContent = formatCurrency(totalAmount);
    document.getElementById('bpGarageCount').textContent = garages.length;
    document.getElementById('bpCountWarning').textContent = totalCount;

    // Build garage breakdown list
    const garageList = document.getElementById('bpGarageList');
    garageList.innerHTML = garages.map(g => `
        <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);">
            <div>
                <strong>${escapeHTML(g.garage_name)}</strong>
                <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">${g.payout_count} payouts</span>
            </div>
            <div style="font-weight: 600; color: var(--accent);">${formatCurrency(g.total)}</div>
        </div>
    `).join('');

    // Set hidden fields — pass explicit payout IDs for precision
    const payoutIds = pendingPayoutsData.map(p => p.payout_id);
    document.getElementById('bpMode').value = 'ids';
    document.getElementById('bpGarageId').value = currentGarageFilter || '';
    document.getElementById('bpPayoutIds').value = JSON.stringify(payoutIds);

    // Auto-generate reference
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bpReference').value = `BATCH-${today}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    document.getElementById('bpNotes').value = '';

    // Show modal immediately
    document.getElementById('batchPaymentModal').style.display = 'flex';
}

/**
 * Close batch payment modal
 */
function closeBatchPaymentModal() {
    document.getElementById('batchPaymentModal').style.display = 'none';
}

/**
 * Submit batch payment
 */
async function submitBatchPayment() {
    const reference = document.getElementById('bpReference').value.trim();
    const notes = document.getElementById('bpNotes').value.trim();
    const mode = document.getElementById('bpMode').value;
    const garageId = document.getElementById('bpGarageId').value;

    if (!reference) {
        showToast('Reference number is required', 'error');
        document.getElementById('bpReference').focus();
        return;
    }

    // Build request body
    const body = {
        reference_number: reference,
        notes: notes || undefined,
        confirmed: true  // We're confirming from the modal
    };

    const payoutIdsRaw = document.getElementById('bpPayoutIds').value;
    if (mode === 'ids' && payoutIdsRaw) {
        body.payout_ids = JSON.parse(payoutIdsRaw);
    } else if (mode === 'garage' && garageId) {
        body.garage_id = garageId;
    } else {
        body.all_pending = true;
    }

    // Disable button and show progress
    const submitBtn = document.getElementById('btnSubmitBatch');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';

    try {
        showToast('Processing batch payments...', 'info');

        const res = await fetch(`${API_URL}/finance/payouts/batch-send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const result = await res.json();

        if (result.success) {
            showToast(`✅ ${result.processed_count} payments sent! Total: ${formatCurrency(result.total_amount)}`, 'success');
            closeBatchPaymentModal();

            // Refresh data
            loadPendingPayouts(1);
            loadBadges();
            loadGaragesForFilter();
        } else {
            showToast(result.error || 'Batch processing failed', 'error');
        }
    } catch (err) {
        console.error('Batch payment failed:', err);
        showToast('Failed to process batch payments', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Initialize garage filter on section load
document.addEventListener('DOMContentLoaded', () => {
    // Load garages when dashboard shows
    if (token) {
        loadGaragesForFilter();
        loadGaragesForInvoice();

        // Set default dates for invoice (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const invoiceFrom = document.getElementById('invoiceFromDate');
        const invoiceTo = document.getElementById('invoiceToDate');
        if (invoiceFrom) invoiceFrom.value = thirtyDaysAgo.toISOString().split('T')[0];
        if (invoiceTo) invoiceTo.value = today.toISOString().split('T')[0];
    }
});

// ============================================
// TAX INVOICE / PAYOUT STATEMENT
// ============================================

/**
 * Load garages into the invoice dropdown
 */
async function loadGaragesForInvoice() {
    const select = document.getElementById('invoiceGarageSelect');
    if (!select) return;

    try {
        const res = await fetch(`${API_URL}/finance/payouts/garages-pending`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load garages');

        const data = await res.json();

        // Clear and repopulate
        select.innerHTML = '<option value="">Select Garage</option>';

        // Get all garages (not just with pending)
        for (const g of data.garages) {
            const option = document.createElement('option');
            option.value = g.garage_id;
            option.textContent = g.garage_name;
            select.appendChild(option);
        }
    } catch (err) {
        console.error('Failed to load garages for invoice:', err);
    }
}

/**
 * Download Tax Invoice for a garage within date range
 * @param {string} format - 'pdf' or 'html'
 */
function downloadTaxInvoice(format) {
    const garageId = document.getElementById('invoiceGarageSelect')?.value;
    const fromDate = document.getElementById('invoiceFromDate')?.value;
    const toDate = document.getElementById('invoiceToDate')?.value;

    // Validation
    if (!garageId) {
        showToast('Please select a garage', 'error');
        return;
    }

    if (!fromDate || !toDate) {
        showToast('Please select a date range', 'error');
        return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
        showToast('From date must be before To date', 'error');
        return;
    }

    // Build URL and open in new tab (token will be validated by backend)
    const url = `${API_URL}/finance/payouts/statement/${garageId}?from_date=${fromDate}&to_date=${toDate}&format=${format}`;

    // For authenticated request, we need to fetch and handle response
    showToast('Generating Tax Invoice...', 'info');

    fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => {
                    throw new Error(data.message || data.error || 'Failed to generate invoice');
                });
            }

            const contentType = res.headers.get('content-type');

            if (contentType.includes('application/pdf')) {
                return res.blob().then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `tax-invoice-${fromDate}-${toDate}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    showToast('✅ Tax Invoice downloaded!', 'success');
                });
            } else {
                // HTML - open in new tab
                return res.text().then(html => {
                    const newWindow = window.open('', '_blank');
                    newWindow.document.write(html);
                    newWindow.document.close();
                    showToast('✅ Tax Invoice opened in new tab', 'success');
                });
            }
        })
        .catch(err => {
            console.error('Invoice download failed:', err);
            showToast(err.message || 'Failed to download invoice', 'error');
        });
}

// ============================================
// REFUNDS MANAGEMENT (BRAIN v3.0)
// ============================================
// DUPLICATE REMOVED - loadRefunds is defined at line 1039
// ============================================

async function loadPendingRefunds() {
    try {
        const res = await fetch(`${API_URL}/finance/refunds/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('pendingRefundsTable');
        if (!tbody) return;

        const refunds = data.refunds || [];

        // Update badge
        const badge = document.getElementById('pendingRefundsBadge');
        if (badge) {
            badge.textContent = refunds.length;
            badge.style.display = refunds.length > 0 ? 'inline' : 'none';
        }

        if (refunds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i> No pending refunds</td></tr>';
            return;
        }

        tbody.innerHTML = refunds.map(r => `
            <tr>
                <td>#${escapeHTML(r.order_number || '-')}</td>
                <td>${escapeHTML(r.customer_name || '-')}</td>
                <td>${formatCurrency(r.refund_amount)}</td>
                <td>${escapeHTML(r.refund_reason || '-')}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="approveRefund('${r.refund_id}')">
                        <i class="bi bi-send-check"></i> Process
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="rejectRefund('${r.refund_id}')">
                        <i class="bi bi-x-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load pending refunds:', err);
    }
}

async function approveRefund(refundId) {
    if (!confirm('Process this refund via payment gateway?')) return;

    try {
        const res = await fetch(`${API_URL}/finance/refunds/${refundId}/process`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showToast('Refund processed successfully', 'success');
            loadPendingRefunds();
            loadRefunds();
            loadBadges();
        } else {
            showToast(data.message || data.error || 'Failed to process refund', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function rejectRefund(refundId) {
    const reason = prompt('Reason for rejecting this refund:');
    if (!reason) return;

    try {
        const res = await fetch(`${API_URL}/finance/refunds/${refundId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Refund rejected', 'success');
            loadPendingRefunds();
            loadRefunds();
        } else {
            showToast(data.error || 'Failed to reject refund', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================
// COMPENSATION REVIEWS (Manual Decision)
// ============================================

async function loadCompensationReviews() {
    const table = document.getElementById('compensationReviewsTable');
    if (!table) return;

    table.innerHTML = '<tr><td colspan="8" class="empty-state">Loading...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/finance/compensation-reviews/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();

        if (!data.reviews || data.reviews.length === 0) {
            table.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="bi bi-check-circle"></i> No pending compensation reviews</td></tr>';
            updateBadge('reviewsBadge', 0);
            return;
        }

        updateBadge('reviewsBadge', data.count);

        table.innerHTML = data.reviews.map(r => `
            <tr>
                <td><strong>#${escapeHTML(r.order_number)}</strong></td>
                <td>${escapeHTML(r.garage_name)}</td>
                <td>${escapeHTML(r.customer_name || 'N/A')}</td>
                <td><span class="badge badge-warning">${escapeHTML(r.review_reason || 'changed_mind')}</span></td>
                <td>${escapeHTML(r.reason_text || '-')}</td>
                <td><strong>${formatCurrency(r.potential_compensation)}</strong></td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="approveCompensationReview('${r.payout_id}', '${escapeHTML(r.garage_name)}', ${r.potential_compensation})">
                        <i class="bi bi-check-lg"></i> Approve
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="denyCompensationReview('${r.payout_id}', '${escapeHTML(r.garage_name)}', '${r.garage_id}')">
                        <i class="bi bi-x-lg"></i> Deny
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('loadCompensationReviews error:', err);
        table.innerHTML = '<tr><td colspan="8" class="empty-state">Failed to load reviews</td></tr>';
    }
}

async function approveCompensationReview(payoutId, garageName, amount) {
    if (!confirm(`Approve ${amount.toFixed(2)} QAR compensation for ${garageName}?`)) return;

    const notes = prompt('Optional: Add a note for this approval', '');

    try {
        const res = await fetch(`${API_URL}/finance/compensation-reviews/${payoutId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: notes || 'Approved' })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Compensation approved: ${amount.toFixed(2)} QAR for ${garageName}`, 'success');
            loadCompensationReviews();
            loadBadges();
        } else {
            showToast(data.error || 'Failed to approve', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function denyCompensationReview(payoutId, garageName, garageId) {
    const reason = prompt(`Why deny compensation for ${garageName}?\n\nExamples:\n- Wrong part sent\n- Part was defective\n- Part didn't match description`);

    if (!reason) {
        showToast('Reason is required to deny compensation', 'error');
        return;
    }

    // Ask about penalty
    const applyPenalty = confirm('Apply a penalty to the garage for this fault?');

    let penaltyType = null;
    let penaltyAmount = 0;

    if (applyPenalty) {
        penaltyType = prompt('Penalty type:\n1. wrong_part (100 QAR)\n2. damaged_part (50 QAR)\n3. quality_issue (50 QAR)\n\nEnter type:', 'wrong_part');

        if (penaltyType === 'wrong_part') {
            penaltyAmount = 100;
        } else if (penaltyType === 'damaged_part' || penaltyType === 'quality_issue') {
            penaltyAmount = 50;
        } else {
            penaltyAmount = parseInt(prompt('Enter penalty amount (QAR):', '50')) || 50;
        }
    }

    try {
        const res = await fetch(`${API_URL}/finance/compensation-reviews/${payoutId}/deny`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason,
                apply_penalty: applyPenalty,
                penalty_type: penaltyType,
                penalty_amount: penaltyAmount
            })
        });

        const data = await res.json();

        if (res.ok) {
            let msg = `Compensation denied for ${garageName}`;
            if (applyPenalty) {
                msg += `. Penalty: ${penaltyAmount} QAR`;
            }
            showToast(msg, 'success');
            loadCompensationReviews();
            loadBadges();
        } else {
            showToast(data.error || 'Failed to deny', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}
