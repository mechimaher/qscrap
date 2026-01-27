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
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="bi bi-check-circle"></i> No pending payouts</td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr>
                <td>
                    <input type="checkbox" class="payout-checkbox" 
                           data-payout-id="${p.payout_id}"
                           onchange="handlePayoutCheckbox('${p.payout_id}', this.checked)">
                </td>
                <td><strong>${escapeHTML(p.garage_name)}</strong></td>
                <td>#${escapeHTML(p.order_number)}</td>
                <td>${formatCurrency(p.gross_amount || p.amount)}</td>
                <td>${formatCurrency(p.commission_amount || p.platform_fee)}</td>
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
    const selected = [...document.querySelectorAll('.payout-checkbox:checked')].map(cb => cb.dataset.id);
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
        const row = document.querySelector(`.payout-checkbox[data-id="${id}"]`)?.closest('tr');
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
 * Fetches preview from server and opens modal
 */
async function openBatchPaymentFlow() {
    try {
        showToast('Loading batch preview...', 'info');

        // Build request based on current filter
        const body = {};
        if (currentGarageFilter) {
            body.garage_id = currentGarageFilter;
        } else {
            body.all_pending = true;
        }

        const res = await fetch(`${API_URL}/finance/payouts/batch-preview`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const preview = await res.json();

        if (!res.ok || preview.error) {
            showToast(preview.error || 'Failed to load preview', 'error');
            return;
        }

        if (preview.count === 0) {
            showToast('No pending payouts to process', 'error');
            return;
        }

        // Populate modal with preview data
        document.getElementById('bpPayoutCount').textContent = preview.count;
        document.getElementById('bpTotalAmount').textContent = formatCurrency(preview.total_amount);
        document.getElementById('bpGarageCount').textContent = preview.garages.length;
        document.getElementById('bpCountWarning').textContent = preview.count;

        // Build garage breakdown list
        const garageList = document.getElementById('bpGarageList');
        garageList.innerHTML = preview.garages.map(g => `
            <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);">
                <div>
                    <strong>${escapeHTML(g.garage_name)}</strong>
                    <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">${g.payout_count} payouts</span>
                </div>
                <div style="font-weight: 600; color: var(--accent);">${formatCurrency(g.total)}</div>
            </div>
        `).join('');

        // Set hidden fields
        document.getElementById('bpMode').value = currentGarageFilter ? 'garage' : 'all';
        document.getElementById('bpGarageId').value = currentGarageFilter || '';
        document.getElementById('bpPayoutIds').value = '';

        // Auto-generate reference
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('bpReference').value = `BATCH-${today}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        document.getElementById('bpNotes').value = '';

        // Show modal
        document.getElementById('batchPaymentModal').style.display = 'flex';

    } catch (err) {
        console.error('Failed to open batch payment flow:', err);
        showToast('Failed to load batch info', 'error');
    }
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

    if (mode === 'garage' && garageId) {
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
            loadDashboardStats();
            loadGaragesForFilter();

            // Update badges
            loadAwaitingConfirmation();
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
