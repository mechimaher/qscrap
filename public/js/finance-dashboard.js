/**
 * Finance Dashboard JavaScript
 * Dedicated payout and revenue management for Finance team
 */

const API_URL = '/api';
let token = localStorage.getItem('financeToken') || localStorage.getItem('opsToken');
let socket = null;
let currentSection = 'overview';
let currentPeriod = '30d';

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

// ==========================================
// AUTHENTICATION
// ==========================================

function isAuthorizedUser(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return ['admin', 'operations', 'finance'].includes(payload.userType);
    } catch {
        return false;
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone_number = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number, password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
            if (!isAuthorizedUser(data.token)) {
                showToast('Access denied. Finance access required.', 'error');
                return;
            }
            token = data.token;
            localStorage.setItem('financeToken', token);
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
        case 'awaiting': loadAwaitingPayouts(); break;
        case 'disputed': loadDisputedPayouts(); break;
        case 'completed': loadCompletedPayouts(); break;
        case 'revenue': loadRevenue(); break;
        case 'refunds': loadRefunds(); break;
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

        updateBadge('pendingBadge', data.pending_count || 0);
        updateBadge('awaitingBadge', data.sent_count || 0);
        updateBadge('disputedBadge', data.disputed_count || 0);
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
        const stats = await statsRes.json();

        document.getElementById('statTotalRevenue').textContent = formatCurrency(stats.total_revenue || 0);
        document.getElementById('statPendingPayouts').textContent = formatCurrency(stats.total_pending || 0);
        document.getElementById('statAwaitingConfirm').textContent = formatCurrency(stats.total_sent || 0);
        document.getElementById('statCompletedPayouts').textContent = formatCurrency(stats.total_confirmed || 0);

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
                <td><span class="status-badge ${p.status}">${p.status}</span></td>
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
        const res = await fetch(`${API_URL}/finance/payouts?status=pending&page=${page}&limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('pendingPayoutsTable');
        const payouts = data.payouts || [];

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="bi bi-check-circle"></i> No pending payouts</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr>
                <td><input type="checkbox" class="payout-checkbox" data-id="${p.payout_id}"></td>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td>${formatCurrency(p.amount)}</td>
                <td>${formatCurrency(p.platform_fee)}</td>
                <td style="color: var(--success); font-weight: 600;">${formatCurrency(p.net_amount)}</td>
                <td>${formatDate(p.created_at)}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="openSendPaymentModal('${p.payout_id}', '${escapeHTML(p.garage_name)}', ${p.net_amount})">
                        <i class="bi bi-send-check"></i> Send
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="holdPayout('${p.payout_id}')">
                        <i class="bi bi-pause-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load pending payouts:', err);
    }
}

function toggleSelectAll(type) {
    const checked = document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`).checked;
    document.querySelectorAll(`.payout-checkbox`).forEach(cb => cb.checked = checked);
}

async function processBulkPayouts() {
    const selected = [...document.querySelectorAll('.payout-checkbox:checked')].map(cb => cb.dataset.id);
    if (selected.length === 0) {
        showToast('Select at least one payout', 'error');
        return;
    }
    // TODO: Implement bulk processing
    showToast(`Processing ${selected.length} payouts...`, 'info');
}

// ==========================================
// SEND PAYMENT MODAL
// ==========================================

function openSendPaymentModal(payoutId, garageName, amount) {
    document.getElementById('spPayoutId').value = payoutId;
    document.getElementById('spGarageName').textContent = garageName;
    document.getElementById('spAmount').textContent = formatCurrency(amount);
    document.getElementById('spPaymentMethod').value = '';
    document.getElementById('spReference').value = '';
    document.getElementById('spNotes').value = '';
    document.getElementById('sendPaymentModal').style.display = 'flex';
}

function closeSendPaymentModal() {
    document.getElementById('sendPaymentModal').style.display = 'none';
}

async function submitSendPayment() {
    const payoutId = document.getElementById('spPayoutId').value;
    const method = document.getElementById('spPaymentMethod').value;
    const reference = document.getElementById('spReference').value;
    const notes = document.getElementById('spNotes').value;

    if (!method || !reference) {
        showToast('Payment method and reference are required', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/send`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_method: method, reference_number: reference, notes })
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
        const res = await fetch(`${API_URL}/finance/payouts?status=sent`, {
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
    showToast('Reminder sent to garage', 'success');
    // TODO: Implement actual notification resend
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
                    <button class="btn btn-primary btn-sm" onclick="resolveDispute('${p.payout_id}')">
                        <i class="bi bi-check-lg"></i> Resolve
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load disputed payouts:', err);
    }
}

async function resolveDispute(payoutId) {
    const resolution = prompt('Resolution notes:');
    if (!resolution) return;

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/resolve-dispute`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution })
        });

        if (res.ok) {
            showToast('Dispute resolved', 'success');
            loadDisputedPayouts();
            loadBadges();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to resolve dispute', 'error');
        }
    } catch (err) {
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

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No completed payouts for this period</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td style="color: var(--success);">${formatCurrency(p.net_amount)}</td>
                <td>${escapeHTML(p.payment_method || 'Bank Transfer')}</td>
                <td>${escapeHTML(p.reference_number || '-')}</td>
                <td>${formatDate(p.confirmed_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load completed payouts:', err);
    }
}

function exportCompletedPayouts() {
    showToast('Exporting to CSV...', 'info');
    // TODO: Implement CSV export
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

        document.getElementById('revTotalOrders').textContent = data.total_orders || 0;
        document.getElementById('revTotalRevenue').textContent = formatCurrency(data.total_revenue);
        document.getElementById('revPlatformFees').textContent = formatCurrency(data.platform_fees);
        document.getElementById('revNetRevenue').textContent = formatCurrency(data.net_revenue);
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
// REFUNDS
// ==========================================

async function loadRefunds() {
    try {
        const res = await fetch(`${API_URL}/finance/transactions?type=refund`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('refundsTable');
        const refunds = data.transactions || data.refunds || [];

        if (refunds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No refunds</td></tr>';
            return;
        }

        tbody.innerHTML = refunds.map(r => `
            <tr>
                <td>#${escapeHTML(r.order_number)}</td>
                <td>${escapeHTML(r.customer_name)}</td>
                <td style="color: var(--danger);">-${formatCurrency(r.amount)}</td>
                <td>${escapeHTML(r.reason)}</td>
                <td>${escapeHTML(r.created_by)}</td>
                <td>${formatDate(r.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load refunds:', err);
    }
}

function openRefundModal() {
    // TODO: Implement refund creation modal
    showToast('Refund creation coming soon', 'info');
}

// ==========================================
// EXPORT
// ==========================================

function exportPayouts() {
    showToast('Preparing CSV export...', 'info');
    // TODO: Implement full export
}
