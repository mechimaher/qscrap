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
        // JWT uses userType not role - allow staff too
        return ['admin', 'superadmin', 'operations', 'cs_admin', 'support', 'staff'].includes(payload.userType);
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
        socket.on('connect', () => {
            console.log('[Socket] Connected - refreshing data');
            loadStats();
        });
        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
        });
        socket.emit('join_room', 'operations');
        socket.emit('join_room', 'support');

        // Real-time event listeners
        socket.on('new_ticket', (data) => {
            showToast(`New ticket: ${data.ticket?.subject || 'Support request'}`, 'info');
            // Refresh if viewing the same customer
            if (currentCustomer && data.ticket?.customer_id === currentCustomer.user_id) {
                searchCustomer();
            }
        });

        socket.on('new_message', (data) => {
            // Refresh chat if viewing this ticket
            if (currentTicket && data.ticket_id === currentTicket) {
                openTicketChat(currentTicket);
            }
        });

        socket.on('ticket_updated', (data) => {
            // Refresh customer view if relevant
            if (currentCustomer) {
                searchCustomer();
            }
        });

        socket.on('resolution_action', (data) => {
            showToast(`Action: ${data.action_type} completed`, 'info');
            if (currentCustomer && data.customer_id === currentCustomer.user_id) {
                searchCustomer();
            }
        });

        socket.on('ticket_reopened', (data) => {
            showToast(`Ticket reopened: ${data.ticket?.subject || 'Support request'}`, 'warning');
        });

    } catch (e) {
        console.log('Socket not available');
    }

    // Load canned responses for chat templates
    loadCannedResponses();
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
        renderTickets(data.tickets || []);
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
        const hasPayout = o.payout_status && o.payout_status !== 'pending';
        const hasWarranty = o.warranty_days_remaining !== null && o.warranty_days_remaining > 0;
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
                <div class="order-part">${escapeHTML(o.part_description || 'Part request')}</div>
                <div class="order-meta">
                    ${o.car_make || ''} ${o.car_model || ''} ${o.car_year || ''} • ${formatCurrency(o.total_amount)} • ${timeAgo(o.created_at)}
                </div>
                ${o.garage_name ? `<div class="order-meta">🏭 ${escapeHTML(o.garage_name)}</div>` : ''}
                ${o.driver_name ? `<div class="order-meta">🚗 ${escapeHTML(o.driver_name)}</div>` : ''}
                
                ${hasWarranty ? `
                    <div class="order-meta" style="color: #10b981; font-weight: 600;">
                        🛡️ Warranty: ${o.warranty_days_remaining} days left
                    </div>
                ` : ''}
                
                ${hasPayout ? `
                    <div class="order-meta" style="color: ${o.payout_status === 'confirmed' ? '#10b981' : '#f59e0b'};">
                        💰 Payout: ${o.payout_status}
                    </div>
                ` : ''}
                
                ${hasIssue ? `
                    <div class="order-issue">
                        <strong>⚠️ Issue:</strong> ${escapeHTML(o.dispute_reason || 'Dispute reported')}
                    </div>
                ` : ''}
                
                <div class="order-actions">
                    ${isActive ? `<button class="order-action-btn" onclick="event.stopPropagation(); trackOrder('${o.order_id}')">📍 Track</button>` : ''}
                    ${isActive ? `<button class="order-action-btn danger" onclick="event.stopPropagation(); quickAction('cancel_order', '${o.order_id}')">❌ Cancel</button>` : ''}
                    ${o.garage_phone ? `<button class="order-action-btn" onclick="event.stopPropagation(); openWhatsApp('${o.garage_phone}')">🏭 Garage</button>` : ''}
                    ${o.driver_phone ? `<button class="order-action-btn" onclick="event.stopPropagation(); openWhatsApp('${o.driver_phone}')">🚗 Driver</button>` : ''}
                    ${hasWarranty || o.order_status === 'completed' ? `<button class="order-action-btn danger" onclick="event.stopPropagation(); quickAction('full_refund', '${o.order_id}')">💰 Refund</button>` : ''}
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

function quickAction(actionType, orderId = null) {
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

    // Action configurations
    const actionConfig = {
        'full_refund': {
            title: 'Full Refund',
            icon: 'bi-arrow-counterclockwise',
            color: 'linear-gradient(135deg, #ef4444, #dc2626)',
            confirmText: 'Process Refund',
            needsAmount: false,
            message: 'This will refund the entire order amount to the customer.'
        },
        'partial_refund': {
            title: 'Partial Refund',
            icon: 'bi-percent',
            color: 'linear-gradient(135deg, #f59e0b, #d97706)',
            confirmText: 'Process Refund',
            needsAmount: true,
            amountLabel: 'Refund Amount (QAR)',
            message: 'Enter the amount to refund to the customer.'
        },
        'goodwill_credit': {
            title: 'Goodwill Credit',
            icon: 'bi-gift',
            color: 'linear-gradient(135deg, #10b981, #059669)',
            confirmText: 'Grant Credit',
            needsAmount: true,
            amountLabel: 'Credit Amount (QAR)',
            message: 'This credit will be applied to the customer\'s next order.'
        },
        'cancel_order': {
            title: 'Cancel Order',
            icon: 'bi-x-circle',
            color: 'linear-gradient(135deg, #ef4444, #dc2626)',
            confirmText: 'Cancel Order',
            needsAmount: false,
            message: 'This will cancel the order and initiate any applicable refunds.'
        },
        'reassign_driver': {
            title: 'Reassign Driver',
            icon: 'bi-arrow-repeat',
            color: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            confirmText: 'Reassign',
            needsAmount: false,
            message: 'The order will be returned to the driver pool for reassignment.'
        },
        'rush_delivery': {
            title: 'Rush Delivery',
            icon: 'bi-lightning',
            color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            confirmText: 'Mark as Rush',
            needsAmount: false,
            message: 'This order will be prioritized for immediate delivery.'
        },
        'escalate_to_ops': {
            title: 'Escalate to Operations',
            icon: 'bi-exclamation-triangle',
            color: 'linear-gradient(135deg, #ef4444, #dc2626)',
            confirmText: 'Escalate',
            needsAmount: false,
            message: 'This will create an urgent escalation for the operations team.'
        }
    };

    const config = actionConfig[actionType];
    if (!config) {
        showToast('Unknown action', 'error');
        return;
    }

    // Build modal content
    let formContent = `
        <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
            <p style="margin: 0; color: var(--text-secondary);">${config.message}</p>
        </div>
    `;

    if (config.needsAmount) {
        formContent += `
            <div class="form-group" style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">${config.amountLabel}</label>
                <input type="number" id="actionAmount" class="form-control" 
                    min="1" step="0.01" placeholder="0.00" required
                    style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
            </div>
        `;
    }

    formContent += `
        <div class="form-group">
            <label style="display: block; margin-bottom: 6px; font-weight: 600;">Notes (optional)</label>
            <textarea id="actionNotes" class="form-control" rows="3" 
                placeholder="Add any relevant notes..."
                style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; resize: vertical;"></textarea>
        </div>
    `;

    // Create modal
    QScrapModal.create({
        id: 'quick-action-modal',
        title: config.title,
        headerIcon: config.icon,
        headerClass: config.color,
        content: formContent,
        size: 'sm',
        actions: [
            {
                id: 'action-cancel-btn',
                text: 'Cancel',
                class: 'btn btn-ghost',
                onclick: () => QScrapModal.close('quick-action-modal')
            },
            {
                id: 'action-confirm-btn',
                text: config.confirmText,
                class: 'btn btn-primary',
                onclick: async () => {
                    // Validate amount if needed
                    let actionDetails = {};
                    if (config.needsAmount) {
                        const amountInput = document.getElementById('actionAmount');
                        const amount = parseFloat(amountInput.value);
                        if (!amount || amount <= 0) {
                            showToast('Please enter a valid amount', 'error');
                            amountInput.focus();
                            return;
                        }
                        actionDetails.amount = amount;
                    }

                    const notes = document.getElementById('actionNotes').value.trim();

                    // Close modal and show loading
                    QScrapModal.close('quick-action-modal');
                    showToast('Processing...', 'info');

                    // Execute action
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
                            showToast(`${config.title} completed!`, 'success');
                            searchCustomer(); // Refresh
                        } else {
                            showToast(data.error || data.message || 'Action failed', 'error');
                        }
                    } catch (err) {
                        console.error('Quick action error:', err);
                        showToast('Action failed - please try again', 'error');
                    }
                }
            }
        ]
    });

    // Focus amount input if present
    if (config.needsAmount) {
        setTimeout(() => document.getElementById('actionAmount')?.focus(), 100);
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
// TICKETS & CHAT (Phase 2 - Unified Workspace)
// ==========================================

let currentTicket = null;

function renderTickets(tickets) {
    const container = document.getElementById('ticketsPanel');
    if (!container) return; // Panel not yet in HTML

    if (!tickets || tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state-mini">
                <i class="bi bi-chat-dots"></i>
                <p>No support tickets</p>
                <button class="btn btn-sm" onclick="createNewTicket()">+ New Ticket</button>
            </div>
        `;
        return;
    }

    let html = `<button class="btn btn-sm" style="margin-bottom: 10px; width: 100%;" onclick="createNewTicket()">
        <i class="bi bi-plus-circle"></i> New Ticket
    </button>`;

    tickets.forEach(t => {
        const statusColor = t.status === 'open' ? '#f59e0b' : (t.status === 'in_progress' ? '#3b82f6' : '#10b981');
        const slaBadge = t.sla_breached ? '<span class="sla-breach">⏰ SLA!</span>' : '';
        const priorityColors = { urgent: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#6b7280' };
        const priorityColor = priorityColors[t.priority] || '#6b7280';
        const priorityBadge = t.priority ? `<span style="background:${priorityColor};color:white;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;">${(t.priority || 'normal').toUpperCase()}</span>` : '';

        html += `
            <div class="ticket-card ${t.status} ${t.sla_breached ? 'has-issue' : ''}" onclick="openTicketChat('${t.ticket_id}')">
                <div class="ticket-header">
                    <span class="ticket-subject">${escapeHTML(t.subject)}</span>
                    <div style="display:flex;gap:4px;align-items:center;">
                        ${slaBadge}
                        ${priorityBadge}
                    </div>
                </div>
                <div class="ticket-meta">
                    <span class="ticket-status" style="background: ${statusColor};">${t.status.replace('_', ' ')}</span>
                    ${t.order_number ? `<span class="ticket-order">#${t.order_number}</span>` : ''}
                    <span class="ticket-msgs">${t.message_count || 0} msgs</span>
                </div>
                <div class="ticket-preview">${escapeHTML(t.last_message || 'No messages')}</div>
                <div class="ticket-time">${timeAgo(t.last_message_at || t.created_at)}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function openTicketChat(ticketId) {
    currentTicket = ticketId;
    const chatContainer = document.getElementById('chatPanel');
    if (!chatContainer) return;

    // Join socket room for real-time updates
    if (socket && socket.connected) {
        socket.emit('join_room', `ticket_${ticketId}`);
    }

    try {
        const res = await fetch(`${API_URL}/support/tickets/${ticketId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load messages');

        const messages = await res.json();
        renderChatMessages(messages);

        // Show chat panel
        chatContainer.classList.add('active');

    } catch (err) {
        console.error('Failed to load chat:', err);
        showToast('Failed to load messages', 'error');
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="empty-state-mini"><p>No messages yet</p></div>';
        return;
    }

    let html = '';
    messages.forEach(m => {
        const isAgent = m.sender_type === 'admin';
        const isInternal = m.is_internal === true;

        // Internal notes get special styling
        const internalStyle = isInternal
            ? 'background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px dashed #f59e0b;'
            : '';
        const internalBadge = isInternal
            ? '<span style="font-size:9px;background:#f59e0b;color:white;padding:1px 5px;border-radius:3px;margin-left:4px;">🔒 Internal</span>'
            : '';

        html += `
            <div class="chat-message ${isAgent ? 'agent' : 'customer'}" style="${internalStyle}">
                <div class="chat-bubble">
                    ${escapeHTML(m.message_text)}
                </div>
                <div class="chat-meta">${m.sender_name} • ${timeAgo(m.created_at)}${internalBadge}</div>
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function sendTicketMessage() {
    if (!currentTicket) {
        showToast('No ticket selected', 'error');
        return;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    // Check internal note toggle
    const isInternal = document.getElementById('internalNoteToggle')?.checked || false;

    try {
        const res = await fetch(`${API_URL}/support/tickets/${currentTicket}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message_text: message,
                is_internal: isInternal
            })
        });

        if (res.ok) {
            input.value = '';
            if (document.getElementById('internalNoteToggle')) {
                document.getElementById('internalNoteToggle').checked = false;
            }
            await openTicketChat(currentTicket); // Refresh messages
            showToast(isInternal ? 'Internal note added' : 'Message sent', 'success');
        } else {
            showToast('Failed to send message', 'error');
        }
    } catch (err) {
        showToast('Failed to send message', 'error');
    }
}

// Canned responses cache
let cannedResponses = [];

async function loadCannedResponses() {
    try {
        const res = await fetch(`${API_URL}/support/canned-responses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            cannedResponses = await res.json();
        }
    } catch (err) {
        console.error('Failed to load canned responses:', err);
    }
}

function showCannedResponsesDropdown() {
    if (cannedResponses.length === 0) {
        showToast('No templates available', 'info');
        return;
    }

    let html = '<div style="max-height: 300px; overflow-y: auto;">';
    cannedResponses.forEach((r, i) => {
        html += `
            <div class="canned-item" onclick="insertCannedResponse(${i})" 
                style="padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;"
                onmouseover="this.style.background='var(--bg-secondary)'" 
                onmouseout="this.style.background='transparent'">
                <div style="font-weight: 600; font-size: 12px;">${escapeHTML(r.title)}</div>
                <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHTML(r.message_text.substring(0, 80))}...
                </div>
            </div>
        `;
    });
    html += '</div>';

    QScrapModal.create({
        id: 'canned-responses-modal',
        title: 'Quick Responses',
        headerIcon: 'bi-lightning',
        content: html,
        size: 'sm',
        actions: [{
            id: 'canned-cancel',
            text: 'Cancel',
            class: 'btn btn-ghost',
            onclick: () => QScrapModal.close('canned-responses-modal')
        }]
    });
}

function insertCannedResponse(index) {
    const response = cannedResponses[index];
    if (response) {
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = response.message_text;
            input.focus();
        }
    }
    QScrapModal.close('canned-responses-modal');
}

function createNewTicket() {
    if (!currentCustomer) {
        showToast('Please select a customer first', 'error');
        return;
    }

    const categoryOptions = `
        <option value="general">General</option>
        <option value="delivery">Delivery Issue</option>
        <option value="part_quality">Part Quality</option>
        <option value="billing">Billing</option>
        <option value="bid_dispute">Bid Dispute</option>
        <option value="payout">Payout Issue</option>
        <option value="account">Account</option>
        <option value="other">Other</option>
    `;

    const priorityOptions = `
        <option value="normal">Normal</option>
        <option value="low">Low</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
    `;

    const formContent = `
        <div class="form-group" style="margin-bottom: 14px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600;">Subject</label>
            <input type="text" id="ticketSubject" class="form-control" placeholder="Brief description of issue"
                style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 14px;">
            <div class="form-group" style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">Category</label>
                <select id="ticketCategory" class="form-control" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">Priority</label>
                <select id="ticketPriority" class="form-control" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
                    ${priorityOptions}
                </select>
            </div>
        </div>
        <div class="form-group">
            <label style="display: block; margin-bottom: 6px; font-weight: 600;">Initial Message</label>
            <textarea id="ticketMessage" class="form-control" rows="4" placeholder="Describe the customer's issue..."
                style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; resize: vertical;"></textarea>
        </div>
        ${currentOrder ? `<p style="margin-top: 12px; font-size: 11px; color: var(--text-muted);">📦 Linked to selected order</p>` : ''}
    `;

    QScrapModal.create({
        id: 'new-ticket-modal',
        title: 'Create Support Ticket',
        headerIcon: 'bi-plus-circle',
        headerClass: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        content: formContent,
        size: 'md',
        actions: [
            {
                id: 'ticket-cancel-btn',
                text: 'Cancel',
                class: 'btn btn-ghost',
                onclick: () => QScrapModal.close('new-ticket-modal')
            },
            {
                id: 'ticket-create-btn',
                text: 'Create Ticket',
                class: 'btn btn-primary',
                onclick: async () => {
                    const subject = document.getElementById('ticketSubject').value.trim();
                    const message = document.getElementById('ticketMessage').value.trim();
                    const category = document.getElementById('ticketCategory').value;
                    const priority = document.getElementById('ticketPriority').value;

                    if (!subject) {
                        showToast('Subject is required', 'error');
                        document.getElementById('ticketSubject').focus();
                        return;
                    }
                    if (!message) {
                        showToast('Message is required', 'error');
                        document.getElementById('ticketMessage').focus();
                        return;
                    }

                    QScrapModal.close('new-ticket-modal');
                    showToast('Creating ticket...', 'info');

                    try {
                        const res = await fetch(`${API_URL}/support/tickets/create-for-customer`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                customer_id: currentCustomer.user_id,
                                subject,
                                message,
                                category,
                                priority,
                                order_id: currentOrder || null
                            })
                        });

                        if (res.ok) {
                            showToast('Ticket created!', 'success');
                            searchCustomer(); // Refresh
                        } else {
                            const data = await res.json();
                            showToast(data.error || 'Failed to create ticket', 'error');
                        }
                    } catch (err) {
                        showToast('Failed to create ticket', 'error');
                    }
                }
            }
        ]
    });

    setTimeout(() => document.getElementById('ticketSubject')?.focus(), 100);
}

function closeChat() {
    const chatContainer = document.getElementById('chatPanel');
    if (chatContainer) chatContainer.classList.remove('active');
    currentTicket = null;
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
        // Use /moderation endpoint which supports status filter
        const res = await fetch(`${API_URL}/reviews/moderation?status=${reviewStatus}&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        renderReviews(data.reviews || []);
    } catch (err) {
        console.error('Failed to load reviews:', err);
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
        // Backend expects 'action' with values 'approve' or 'reject'
        const action = decision === 'approved' ? 'approve' : 'reject';
        const res = await fetch(`${API_URL}/reviews/${reviewId}/moderate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || `Review ${action}d!`, 'success');
            loadReviews();
        } else {
            showToast(data.error || 'Failed to moderate review', 'error');
        }
    } catch (err) {
        console.error('Moderate review error:', err);
        showToast('Failed to moderate review', 'error');
    }
}

// Review tabs
document.addEventListener('DOMContentLoaded', () => {
    // Already handled via section switching
});

// ==========================================
// BRAIN v3.0 CANCELLATION & RETURN HANDLING
// ==========================================

/**
 * Show BRAIN v3.0 compliant cancellation preview with fee breakdown
 * Calls: GET /api/cancellation/orders/:orderId/cancel-preview
 */
async function showCancellationPreview(orderId) {
    if (!orderId) {
        showToast('Please select an order', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cancellation/orders/${orderId}/cancel-preview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Cannot cancel this order', 'error');
            return;
        }

        const preview = await res.json();

        // Stage descriptions per BRAIN v3.0
        const stageDescriptions = {
            'before_payment': 'No fee - Order not yet paid',
            'after_payment': '5% fee - Order confirmed but not started',
            'during_preparation': '10% fee - Garage started preparation',
            'in_transit': '10% + Delivery fee retained - Part dispatched',
            'after_delivery': '20% + Delivery fee retained - Use return instead'
        };

        const stageDesc = stageDescriptions[preview.cancellation_stage] || preview.cancellation_stage;

        let content = `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; color: var(--text-primary);">📊 Fee Breakdown (BRAIN v3.0)</h4>
                
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                        <span>Part Price</span>
                        <strong>${formatCurrency(preview.part_price || preview.total_amount)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                        <span>Delivery Fee</span>
                        <strong>${formatCurrency(preview.delivery_fee || 0)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); color: #ef4444;">
                        <span>❌ Cancellation Fee (${(preview.fee_percentage || 0)}%)</span>
                        <strong>-${formatCurrency(preview.cancellation_fee)}</strong>
                    </div>
                    ${preview.delivery_fee_retained ? `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); color: #f59e0b;">
                        <span>⚠️ Delivery Fee (Non-refundable)</span>
                        <strong>-${formatCurrency(preview.delivery_fee_retained)}</strong>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; color: #10b981;">
                        <span>💰 Customer Refund</span>
                        <strong>${formatCurrency(preview.refund_amount)}</strong>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding: 10px; background: var(--bg-primary); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
                    <strong>Stage:</strong> ${stageDesc}
                </div>
            </div>
            
            <div class="form-group">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">Reason for Cancellation</label>
                <select id="cancelReason" class="form-control" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
                    <option value="customer_request">Customer Request</option>
                    <option value="found_elsewhere">Found Elsewhere</option>
                    <option value="price_issue">Price Issue</option>
                    <option value="taking_too_long">Taking Too Long</option>
                    <option value="changed_mind">Changed Mind</option>
                    <option value="other">Other</option>
                </select>
            </div>
            
            <div class="form-group" style="margin-top: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">Notes (optional)</label>
                <textarea id="cancelNotes" class="form-control" rows="2" 
                    placeholder="Add cancellation notes..."
                    style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;"></textarea>
            </div>
        `;

        QScrapModal.create({
            id: 'cancel-preview-modal',
            title: 'Cancel Order - BRAIN v3.0',
            headerIcon: 'bi-x-circle',
            headerClass: 'linear-gradient(135deg, #ef4444, #dc2626)',
            content: content,
            size: 'md',
            actions: [
                {
                    id: 'cancel-modal-btn',
                    text: 'Cancel',
                    class: 'btn btn-ghost',
                    onclick: () => QScrapModal.close('cancel-preview-modal')
                },
                {
                    id: 'confirm-cancel-btn',
                    text: `Confirm Cancellation (Refund ${formatCurrency(preview.refund_amount)})`,
                    class: 'btn btn-danger',
                    onclick: async () => {
                        const reason = document.getElementById('cancelReason').value;
                        const notes = document.getElementById('cancelNotes').value.trim();

                        QScrapModal.close('cancel-preview-modal');
                        await processCancellation(orderId, reason, notes);
                    }
                }
            ]
        });

    } catch (err) {
        console.error('Cancellation preview error:', err);
        showToast('Failed to load cancellation preview', 'error');
    }
}

/**
 * Process cancellation via support quick-action endpoint
 */
async function processCancellation(orderId, reason, notes) {
    showToast('Processing cancellation...', 'info');

    try {
        const res = await fetch(`${API_URL}/support/quick-action`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_id: currentCustomer?.user_id,
                order_id: orderId,
                action_type: 'cancel_order',
                action_details: { reason },
                notes: notes || undefined
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('Order cancelled - Refund processing', 'success');
            searchCustomer(); // Refresh
        } else {
            showToast(data.error || 'Cancellation failed', 'error');
        }
    } catch (err) {
        console.error('Cancellation error:', err);
        showToast('Cancellation failed', 'error');
    }
}

/**
 * Show return request form for 7-day warranty returns
 * Calls: GET /api/cancellation/orders/:orderId/return-preview
 */
async function showReturnRequest(orderId) {
    if (!orderId) {
        showToast('Please select an order', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cancellation/orders/${orderId}/return-preview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Cannot return this order', 'error');
            return;
        }

        const preview = await res.json();

        if (!preview.can_return) {
            showToast(preview.reason || 'Return window expired', 'error');
            return;
        }

        let content = `
            <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 16px; border-radius: 12px; margin-bottom: 16px; text-align: center;">
                <i class="bi bi-clock" style="font-size: 24px;"></i>
                <div style="font-size: 18px; font-weight: 700; margin-top: 8px;">${preview.days_remaining} Days Remaining</div>
                <div style="font-size: 12px; opacity: 0.9;">7-Day Return Window (Qatar Law)</div>
            </div>
            
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0;">💰 Return Fee Breakdown</h4>
                
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); color: #ef4444;">
                        <span>Return Fee (20%)</span>
                        <strong>-${formatCurrency(preview.return_fee)}</strong>
                    </div>
                    ${preview.delivery_fee_retained ? `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); color: #f59e0b;">
                        <span>Delivery Fee (Non-refundable)</span>
                        <strong>-${formatCurrency(preview.delivery_fee_retained)}</strong>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; color: #10b981;">
                        <span>Customer Refund</span>
                        <strong>${formatCurrency(preview.refund_amount)}</strong>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">Return Reason *</label>
                <select id="returnReason" class="form-control" required style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
                    <option value="">Select reason...</option>
                    <option value="unused">Unused / Changed Mind</option>
                    <option value="defective">Defective Part</option>
                    <option value="wrong_part">Wrong Part Received</option>
                </select>
            </div>
            
            <div class="form-group" style="margin-top: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600;">Condition Notes</label>
                <textarea id="returnNotes" class="form-control" rows="2" 
                    placeholder="Describe the part condition..."
                    style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;"></textarea>
            </div>
            
            <div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-radius: 8px; font-size: 11px; color: #92400e;">
                <strong>⚠️ Note:</strong> Customer must provide 3+ photos of the part. This request will be reviewed by Operations.
            </div>
        `;

        QScrapModal.create({
            id: 'return-request-modal',
            title: '7-Day Return Request',
            headerIcon: 'bi-arrow-return-left',
            headerClass: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            content: content,
            size: 'md',
            actions: [
                {
                    id: 'return-cancel-btn',
                    text: 'Cancel',
                    class: 'btn btn-ghost',
                    onclick: () => QScrapModal.close('return-request-modal')
                },
                {
                    id: 'return-submit-btn',
                    text: 'Submit Return Request',
                    class: 'btn btn-primary',
                    onclick: async () => {
                        const reason = document.getElementById('returnReason').value;
                        const notes = document.getElementById('returnNotes').value.trim();

                        if (!reason) {
                            showToast('Please select a return reason', 'error');
                            return;
                        }

                        QScrapModal.close('return-request-modal');
                        await processReturnRequest(orderId, reason, notes);
                    }
                }
            ]
        });

    } catch (err) {
        console.error('Return preview error:', err);
        showToast('Failed to load return options', 'error');
    }
}

/**
 * Process return request via API
 */
async function processReturnRequest(orderId, reason, notes) {
    showToast('Submitting return request...', 'info');

    try {
        const res = await fetch(`${API_URL}/cancellation/orders/${orderId}/return`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason,
                condition_description: notes,
                photo_urls: [] // Support agent can mark as pending photos
            })
        });

        const data = await res.json();
        if (data.success || data.return_request) {
            showToast('Return request submitted - Pending review', 'success');
            searchCustomer(); // Refresh
        } else {
            showToast(data.error || 'Return request failed', 'error');
        }
    } catch (err) {
        console.error('Return request error:', err);
        showToast('Return request failed', 'error');
    }
}

/**
 * Show customer abuse status (fraud prevention)
 * Calls: GET /api/cancellation/abuse-status
 */
async function showCustomerAbuseStatus() {
    if (!currentCustomer) {
        showToast('Please search for a customer first', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cancellation/abuse-status?customer_id=${currentCustomer.user_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            showToast('Failed to load abuse status', 'error');
            return;
        }

        const status = await res.json();

        const flagColors = {
            'none': '#10b981',
            'watchlist': '#f59e0b',
            'high_risk': '#ef4444',
            'blocked': '#991b1b'
        };

        const flagColor = flagColors[status.fraud_flag] || '#6b7280';

        let content = `
            <div style="background: ${flagColor}20; border: 2px solid ${flagColor}; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 16px;">
                <div style="font-size: 40px; margin-bottom: 8px;">${status.fraud_flag === 'none' ? '✅' : status.fraud_flag === 'blocked' ? '🚫' : '⚠️'}</div>
                <div style="font-size: 20px; font-weight: 700; color: ${flagColor}; text-transform: uppercase;">${status.fraud_flag || 'Unknown'}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${status.returns_this_month || 0}/3</div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Returns This Month</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${status.defective_claims_this_month || 0}/3</div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Defective Claims</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${status.cancellations_this_month || 0}</div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Cancellations</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: ${status.can_make_return ? '#10b981' : '#ef4444'};">${status.can_make_return ? '✓' : '✗'}</div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Can Return</div>
                </div>
            </div>
            
            ${status.fraud_flag !== 'none' ? `
            <div style="padding: 12px; background: #fef2f2; border-radius: 8px; color: #991b1b; font-size: 12px;">
                <strong>⚠️ Warning:</strong> This customer has elevated fraud flags. Exercise caution with refunds and returns.
            </div>
            ` : ''}
        `;

        QScrapModal.create({
            id: 'abuse-status-modal',
            title: 'Customer Abuse Status',
            headerIcon: 'bi-shield-exclamation',
            headerClass: `background: ${flagColor}`,
            content: content,
            size: 'sm',
            actions: [{
                id: 'abuse-close-btn',
                text: 'Close',
                class: 'btn btn-primary',
                onclick: () => QScrapModal.close('abuse-status-modal')
            }]
        });

    } catch (err) {
        console.error('Abuse status error:', err);
        showToast('Failed to load abuse status', 'error');
    }
}

console.log('Customer Resolution Center loaded - v3.0 BRAIN Compliant');

