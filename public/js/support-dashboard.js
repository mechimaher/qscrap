/**
 * Customer Resolution Center JavaScript
 * Aligned with backend: support.service.ts, support.controller.ts, support.routes.ts
 * Tables: customer_notes, resolution_logs
 * APIs: /api/support/customer-360, /api/support/quick-action, /api/support/notes, /api/support/resolution-logs
 */

const API_URL = '/api';
let token = localStorage.getItem('supportToken') || localStorage.getItem('opsToken');
let socket = null;
let currentSection = 'resolution';

// Current state
let currentCustomer = null;
let currentOrder = null;

// ==========================================
// UTILITIES
// ==========================================

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'}"></i> ${escapeHTML(message)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function formatCurrency(amount) {
    return (parseFloat(amount) || 0).toFixed(0) + ' QAR';
}

// ==========================================
// AUTHENTICATION
// ==========================================

function isAuthorizedUser(token) {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // JWT uses userType not role
        return ['admin', 'superadmin', 'operations', 'cs_admin', 'support'].includes(payload.userType);
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
        if (data.token && isAuthorizedUser(data.token)) {
            token = data.token;
            localStorage.setItem('supportToken', token);
            showDashboard();
        } else if (data.token) {
            showToast('Access denied. Operations/Support role required.', 'error');
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

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('userName').textContent = payload.name || 'Support';
        document.getElementById('userAvatar').textContent = (payload.name || 'S')[0].toUpperCase();
    } catch { }

    setupNavigation();
    setupSocket();
    loadReviews();

    // Focus search input
    setTimeout(() => document.getElementById('customerSearch')?.focus(), 100);
}

function logout() {
    localStorage.removeItem('supportToken');
    location.reload();
}

// ==========================================
// NAVIGATION
// ==========================================

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });
}

function switchSection(section) {
    currentSection = section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section${section.charAt(0).toUpperCase() + section.slice(1)}`)?.classList.add('active');

    if (section === 'reviews') loadReviews();
}

// ==========================================
// SOCKET
// ==========================================

function setupSocket() {
    try {
        socket = io({ auth: { token } });
        socket.on('connect', () => console.log('Socket connected'));
        socket.emit('join_room', 'operations');
        socket.emit('join_room', 'support');
    } catch (e) {
        console.log('Socket not available');
    }
}

// ==========================================
// CUSTOMER 360 LOOKUP
// Calls: GET /api/support/customer-360/:query
// ==========================================

async function searchCustomer() {
    const query = document.getElementById('customerSearch').value.trim();
    if (!query) {
        showToast('Please enter a phone, name, or order number', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/support/customer-360/${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 404) {
                showToast('Customer not found', 'error');
                return;
            }
            throw new Error('Search failed');
        }

        const data = await res.json();
        currentCustomer = data.customer;
        renderCustomerProfile(data);
        renderOrders(data.orders);
        renderNotes(data.notes);
        renderResolutionLog(data.resolutions);

    } catch (err) {
        console.error('Search error:', err);
        showToast('Search failed', 'error');
    }
}

function renderCustomerProfile(data) {
    const c = data.customer;
    const loyaltyClass = (c.loyalty_tier || 'bronze').toLowerCase();

    document.getElementById('customerProfile').innerHTML = `
        <div class="customer-profile">
            <div class="customer-name">${escapeHTML(c.full_name)}</div>
            <div class="customer-contact">
                📱 <a href="tel:${c.phone_number}">${c.phone_number}</a>
                ${c.email ? `<br>📧 ${escapeHTML(c.email)}` : ''}
            </div>
            
            <div class="customer-stats">
                <div class="stat-item">
                    <div class="value">${c.total_orders || 0}</div>
                    <div class="label">Orders</div>
                </div>
                <div class="stat-item">
                    <div class="value">${formatCurrency(c.total_spent)}</div>
                    <div class="label">Total Spent</div>
                </div>
                <div class="stat-item">
                    <div class="value">${c.active_orders || 0}</div>
                    <div class="label">Active</div>
                </div>
                <div class="stat-item">
                    <div class="value" style="color: ${c.open_issues > 0 ? '#ef4444' : 'inherit'}">${c.open_issues || 0}</div>
                    <div class="label">Issues</div>
                </div>
            </div>
            
            ${c.loyalty_tier ? `<span class="loyalty-badge loyalty-${loyaltyClass}">🏆 ${c.loyalty_tier}</span>` : ''}
            
            <div class="contact-buttons">
                <button class="contact-btn whatsapp" onclick="openWhatsApp('${c.phone_number}')">
                    <i class="bi bi-whatsapp"></i> WhatsApp
                </button>
                <button class="contact-btn call" onclick="window.open('tel:${c.phone_number}')">
                    <i class="bi bi-telephone"></i> Call
                </button>
            </div>
        </div>
        
        <div style="padding: 12px; font-size: 11px; color: var(--text-muted);">
            Member since ${formatDate(c.member_since)}
        </div>
    `;
}

function renderOrders(orders) {
    if (!orders || orders.length === 0) {
        document.getElementById('ordersPanel').innerHTML = `
            <div class="empty-state-center">
                <i class="bi bi-inbox"></i>
                <p>No orders found for this customer</p>
            </div>
        `;
        return;
    }

    let html = '';
    orders.forEach(o => {
        const hasIssue = o.dispute_id;
        const isActive = ['pending', 'confirmed', 'in_transit', 'out_for_delivery'].includes(o.order_status);
        const cardClass = hasIssue ? 'has-issue' : (isActive ? 'in-transit' : 'completed');

        html += `
            <div class="order-card ${cardClass}" onclick="selectOrder('${o.order_id}')">
                <div class="order-header">
                    <span class="order-number">#${o.order_number}</span>
                    <span class="order-status" style="background: ${getStatusColor(o.order_status)}; color: white;">
                        ${o.order_status.replace(/_/g, ' ')}
                    </span>
                </div>
                <div class="order-part">${escapeHTML(o.part_description)}</div>
                <div class="order-meta">
                    ${o.car_make} ${o.car_model} ${o.car_year} • ${formatCurrency(o.total_amount)} • ${timeAgo(o.created_at)}
                </div>
                ${o.garage_name ? `<div class="order-meta">🏭 ${escapeHTML(o.garage_name)}</div>` : ''}
                ${o.driver_name ? `<div class="order-meta">🚗 ${escapeHTML(o.driver_name)}</div>` : ''}
                
                ${hasIssue ? `
                    <div class="order-issue">
                        <strong>⚠️ Issue:</strong> ${escapeHTML(o.dispute_reason || 'Dispute reported')}
                    </div>
                ` : ''}
                
                <div class="order-actions">
                    ${isActive ? `<button class="order-action-btn" onclick="event.stopPropagation(); trackOrder('${o.order_id}')">📍 Track</button>` : ''}
                    ${o.garage_phone ? `<button class="order-action-btn" onclick="event.stopPropagation(); openWhatsApp('${o.garage_phone}')">🏭 Garage</button>` : ''}
                    ${o.driver_phone ? `<button class="order-action-btn" onclick="event.stopPropagation(); openWhatsApp('${o.driver_phone}')">🚗 Driver</button>` : ''}
                    <button class="order-action-btn danger" onclick="event.stopPropagation(); quickAction('full_refund', '${o.order_id}')">💰 Refund</button>
                </div>
            </div>
        `;
    });

    document.getElementById('ordersPanel').innerHTML = html;
}

function selectOrder(orderId) {
    // Find the order and set as current
    currentOrder = orderId;
    document.querySelectorAll('.order-card').forEach(c => c.style.outline = 'none');
    event.currentTarget.style.outline = '2px solid var(--primary)';
}

function getStatusColor(status) {
    const colors = {
        'pending': '#f59e0b',
        'confirmed': '#3b82f6',
        'in_transit': '#8b5cf6',
        'out_for_delivery': '#06b6d4',
        'delivered': '#10b981',
        'completed': '#10b981',
        'cancelled': '#6b7280',
        'refunded': '#ef4444'
    };
    return colors[status] || '#6b7280';
}

function trackOrder(orderId) {
    // Could open tracking modal or redirect
    showToast('Opening tracking...', 'info');
}

// ==========================================
// QUICK ACTIONS
// Calls: POST /api/support/quick-action
// ==========================================

async function quickAction(actionType, orderId = null) {
    if (!currentCustomer) {
        showToast('Please search for a customer first', 'error');
        return;
    }

    orderId = orderId || currentOrder;

    // Actions that require an order
    const orderRequiredActions = ['full_refund', 'partial_refund', 'cancel_order', 'reassign_driver', 'rush_delivery', 'escalate_to_ops'];
    if (orderRequiredActions.includes(actionType) && !orderId) {
        showToast('Please select an order first', 'error');
        return;
    }

    // Confirmation
    const actionLabels = {
        'full_refund': 'Full Refund',
        'partial_refund': 'Partial Refund',
        'goodwill_credit': 'Goodwill Credit',
        'cancel_order': 'Cancel Order',
        'reassign_driver': 'Reassign Driver',
        'rush_delivery': 'Rush Delivery',
        'escalate_to_ops': 'Escalate to Operations'
    };

    const notes = prompt(`Confirm: ${actionLabels[actionType]}\n\nAdd notes (optional):`);
    if (notes === null) return; // Cancelled

    let actionDetails = {};
    if (actionType === 'partial_refund') {
        const amount = prompt('Enter refund amount (QAR):');
        if (!amount || isNaN(amount)) return;
        actionDetails.amount = parseFloat(amount);
    }
    if (actionType === 'goodwill_credit') {
        const amount = prompt('Enter credit amount (QAR):');
        if (!amount || isNaN(amount)) return;
        actionDetails.amount = parseFloat(amount);
    }

    try {
        const res = await fetch(`${API_URL}/support/quick-action`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_id: currentCustomer.user_id,
                order_id: orderId,
                action_type: actionType,
                action_details: actionDetails,
                notes: notes || undefined
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast(`${actionLabels[actionType]} completed!`, 'success');
            // Refresh customer data
            searchCustomer();
        } else {
            showToast(data.error || 'Action failed', 'error');
        }
    } catch (err) {
        console.error('Quick action error:', err);
        showToast('Action failed', 'error');
    }
}

// ==========================================
// CUSTOMER NOTES
// Calls: POST /api/support/notes
// ==========================================

function renderNotes(notes) {
    if (!notes || notes.length === 0) {
        document.getElementById('notesList').innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">No notes yet</p>';
        return;
    }

    let html = '';
    notes.forEach(n => {
        html += `
            <div class="note-item">
                <div class="note-text">${escapeHTML(n.note_text)}</div>
                <div class="note-meta">${escapeHTML(n.agent_name)} • ${timeAgo(n.created_at)}</div>
            </div>
        `;
    });
    document.getElementById('notesList').innerHTML = html;
}

async function addNote() {
    if (!currentCustomer) {
        showToast('Please search for a customer first', 'error');
        return;
    }

    const noteText = document.getElementById('noteInput').value.trim();
    if (!noteText) return;

    try {
        const res = await fetch(`${API_URL}/support/notes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_id: currentCustomer.user_id,
                note_text: noteText
            })
        });

        if (res.ok) {
            document.getElementById('noteInput').value = '';
            showToast('Note added', 'success');
            // Refresh customer data
            searchCustomer();
        } else {
            showToast('Failed to add note', 'error');
        }
    } catch (err) {
        showToast('Failed to add note', 'error');
    }
}

// ==========================================
// RESOLUTION LOG
// Calls: GET /api/support/resolution-logs
// ==========================================

function renderResolutionLog(logs) {
    if (!logs || logs.length === 0) {
        document.getElementById('resolutionLog').innerHTML = '<p style="color: var(--text-muted); font-size: 11px;">No resolution history</p>';
        return;
    }

    const actionLabels = {
        'full_refund': '💰 Full Refund',
        'partial_refund': '💰 Partial Refund',
        'goodwill_credit': '🎁 Goodwill Credit',
        'cancel_order': '❌ Cancel Order',
        'reassign_driver': '🔄 Reassign Driver',
        'rush_delivery': '⚡ Rush Delivery',
        'escalate_to_ops': '⚠️ Escalated'
    };

    let html = '';
    logs.forEach(l => {
        html += `
            <div class="resolution-item">
                <div class="resolution-action">${actionLabels[l.action_type] || l.action_type}</div>
                ${l.order_number ? `<div class="resolution-meta">Order: #${l.order_number}</div>` : ''}
                ${l.notes ? `<div class="resolution-meta">"${escapeHTML(l.notes)}"</div>` : ''}
                <div class="resolution-meta">${escapeHTML(l.agent_name)} • ${timeAgo(l.created_at)}</div>
            </div>
        `;
    });
    document.getElementById('resolutionLog').innerHTML = html;
}

// ==========================================
// WHATSAPP INTEGRATION
// ==========================================

function openWhatsApp(phone) {
    if (!phone) {
        showToast('No phone number available', 'error');
        return;
    }
    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+974' + cleanPhone;
    }
    cleanPhone = cleanPhone.replace('+', '');

    // Pre-fill message
    let message = 'Hello from QScrap Support.';
    if (currentCustomer) {
        message = `Hello ${currentCustomer.full_name}, this is QScrap Support.`;
    }

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function contactWhatsApp(type) {
    // This would use the current order's contact info
    if (!currentOrder && type !== 'customer') {
        showToast('Please select an order first', 'error');
        return;
    }

    if (type === 'customer' && currentCustomer) {
        openWhatsApp(currentCustomer.phone_number);
    } else {
        showToast('Contact info not available', 'error');
    }
}

// ==========================================
// REVIEWS (kept from original)
// ==========================================

let reviewStatus = 'pending';

async function loadReviews() {
    try {
        const res = await fetch(`${API_URL}/reviews?status=${reviewStatus}&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        renderReviews(data.reviews || data || []);
    } catch (err) {
        document.getElementById('reviewsTable').innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load reviews</td></tr>';
    }
}

function renderReviews(reviews) {
    if (!reviews.length) {
        document.getElementById('reviewsTable').innerHTML = `<tr><td colspan="6" class="empty-state">No ${reviewStatus} reviews</td></tr>`;
        return;
    }

    document.getElementById('reviewsTable').innerHTML = reviews.map(r => `
        <tr>
            <td>${escapeHTML(r.customer_name || '-')}</td>
            <td>${escapeHTML(r.garage_name || '-')}</td>
            <td>${'⭐'.repeat(r.rating || 0)}</td>
            <td style="max-width: 300px;">${escapeHTML(r.review_text || '-')}</td>
            <td>${timeAgo(r.created_at)}</td>
            <td>
                ${reviewStatus === 'pending' ? `
                    <button class="btn btn-sm btn-primary" onclick="moderateReview('${r.review_id}', 'approved')">✓</button>
                    <button class="btn btn-sm btn-danger" onclick="moderateReview('${r.review_id}', 'rejected')">✗</button>
                ` : `<span class="status-badge status-${r.moderation_status}">${r.moderation_status}</span>`}
            </td>
        </tr>
    `).join('');
}

async function moderateReview(reviewId, decision) {
    try {
        await fetch(`${API_URL}/reviews/${reviewId}/moderate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision })
        });
        showToast(`Review ${decision}`, 'success');
        loadReviews();
    } catch (err) {
        showToast('Failed to moderate review', 'error');
    }
}

// Review tabs
document.addEventListener('DOMContentLoaded', () => {
    // Already handled via section switching
});

console.log('Customer Resolution Center loaded - v2.0');
