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

        for (const payoutId of payoutIds) {
            try {
                const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/send`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payout_method: method, payout_reference: reference, notes })
                });

                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        closeSendPaymentModal();

        if (failCount === 0) {
            showToast(`All ${successCount} payments sent successfully!`, 'success');
        } else {
            showToast(`${successCount} sent, ${failCount} failed`, successCount > 0 ? 'warning' : 'error');
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
                <td>${escapeHTML(p.payout_method || p.payment_method || 'Bank Transfer')}</td>
                <td>${escapeHTML(p.payout_reference || p.reference_number || '-')}</td>
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
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i> No refunds processed</td></tr>';
            return;
        }

        tbody.innerHTML = refunds.map(r => `
            <tr>
                <td>#${escapeHTML(r.order_number || r.order_id?.slice(0, 8))}</td>
                <td>${escapeHTML(r.customer_name || '-')}</td>
                <td style="color: var(--danger); font-weight: 600;">-${formatCurrency(r.amount || r.refund_amount)}</td>
                <td>${escapeHTML(r.reason || r.refund_reason || '-')}</td>
                <td>${escapeHTML(r.created_by || 'Finance')}</td>
                <td>${formatDate(r.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load refunds:', err);
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
