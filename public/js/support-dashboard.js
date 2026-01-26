/**
 * Support Dashboard JavaScript
 * Customer Service team: Tickets, Disputes, Review Moderation
 */

const API_URL = '/api';
let token = localStorage.getItem('supportToken') || localStorage.getItem('opsToken');
let socket = null;
let currentSection = 'overview';
let currentTicketId = null;

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
    return new Date(dateStr).toLocaleDateString('en-QA', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

// ==========================================
// AUTHENTICATION
// ==========================================

function isAuthorizedUser(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Admin always has access
        if (payload.userType === 'admin') return true;

        // Staff users need customer_service role for support dashboard
        if (payload.userType === 'staff') {
            return payload.staffRole === 'customer_service';
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
                showToast('Access denied. Support access required.', 'error');
                return;
            }
            localStorage.setItem('supportToken', data.token);
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('userType', data.userType);
            localStorage.setItem('userName', data.fullName || 'Support Agent');
            localStorage.setItem('userPhone', data.phoneNumber || '');
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
    const userName = localStorage.getItem('userName') || 'Support Agent';
    const userPhone = localStorage.getItem('userPhone') || '';
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl) userNameEl.textContent = userName;
    if (userAvatarEl) userAvatarEl.textContent = userName.charAt(0).toUpperCase();

    // Also update greeting
    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = `Welcome, ${userName.split(' ')[0]}`;

    updateDateTime();
    setInterval(updateDateTime, 60000);

    loadOverview();
    loadBadges();
    setupNavigation();
    setupSocket();
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('headerDateTime').textContent = now.toLocaleDateString('en-QA', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
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
        item.addEventListener('click', () => {
            switchSection(item.dataset.section);
        });
    });
}

function switchSection(section, skipLoad = false) {
    currentSection = section;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    document.querySelectorAll('.section').forEach(sec => {
        // Handle camelCase section names
        const sectionId = `section${section.charAt(0).toUpperCase() + section.slice(1)}`;
        sec.classList.toggle('active', sec.id === sectionId);
    });

    if (!skipLoad) {
        switch (section) {
            case 'overview': loadOverview(); break;
            case 'open': loadOpenTickets(); break;
            case 'inProgress': loadInProgressTickets(); break;
            case 'resolved': loadResolvedTickets(); break;
            case 'orderDisputes': loadOrderDisputes(); break;
            case 'paymentDisputes': loadPaymentDisputes(); break;
            case 'reviews': loadReviews(); break;
        }
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

    socket.on('new_ticket', (data) => {
        showToast(`New ticket: ${data.subject}`, 'info');
        loadBadges();
        if (currentSection === 'overview') loadOverview();
        if (currentSection === 'open') loadOpenTickets();
    });

    socket.on('ticket_message', (data) => {
        if (currentTicketId === data.ticket_id) {
            appendMessage(data.message);
        }
    });

    socket.on('new_dispute', (data) => {
        showToast(`New dispute on order #${data.order_number}`, 'error');
        loadBadges();
    });

    socket.on('review_submitted', (data) => {
        showToast('New review pending moderation!', 'info');
        loadBadges();
        if (currentSection === 'overview') loadOverview();
        if (currentSection === 'reviews') loadReviews();
    });
}

// ==========================================
// BADGES
// ==========================================

async function loadBadges() {
    try {
        const res = await fetch(`${API_URL}/support/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        updateBadge('openBadge', data.open_tickets || 0);
        updateBadge('progressBadge', data.in_progress_tickets || 0);
        updateBadge('orderDisputeBadge', data.order_disputes || 0);
        updateBadge('paymentDisputeBadge', data.payment_disputes || 0);
        updateBadge('reviewBadge', data.pending_reviews || 0);
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
        const res = await fetch(`${API_URL}/support/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        document.getElementById('statOpenTickets').textContent = data.open_tickets || 0;
        document.getElementById('statPendingDisputes').textContent = (data.order_disputes || 0) + (data.payment_disputes || 0);
        document.getElementById('statPendingReviews').textContent = data.pending_reviews || 0;
        document.getElementById('statResolvedToday').textContent = data.resolved_today || 0;

        // Load urgent items
        loadUrgentItems();
        loadRecentActivity();
    } catch (err) {
        console.error('Failed to load overview:', err);
    }
}

async function loadUrgentItems() {
    try {
        const res = await fetch(`${API_URL}/support/urgent`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('urgentItems');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = '<p class="empty-state" style="color: var(--success);"><i class="bi bi-check-circle"></i> No urgent items</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 8px; margin-bottom: 8px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid var(--danger);">
                <div>
                    <strong>${escapeHTML(item.title)}</strong>
                    <span style="color: var(--text-secondary); font-size: 12px; margin-left: 10px;">${timeAgo(item.created_at)}</span>
                </div>
                <button class="btn btn-primary btn-sm" onclick="handleUrgentItem('${item.id}', '${item.type}')">Handle</button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load urgent items:', err);
    }
}

async function loadRecentActivity() {
    try {
        const res = await fetch(`${API_URL}/support/activity`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('recentActivityTable');
        const activities = data.activities || [];

        if (activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent activity</td></tr>';
            return;
        }

        tbody.innerHTML = activities.map(a => `
            <tr>
                <td><span class="status-badge ${a.type}">${a.type}</span></td>
                <td>${escapeHTML(a.subject)}</td>
                <td>#${a.order_number || 'N/A'}</td>
                <td>${escapeHTML(a.customer_name)}</td>
                <td><span class="status-badge ${a.status}">${a.status}</span></td>
                <td>${timeAgo(a.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load recent activity:', err);
    }
}

// ==========================================
// TICKETS
// ==========================================

async function loadOpenTickets() {
    await loadTickets('open');
}

async function loadInProgressTickets() {
    await loadTickets('in_progress');
}

async function loadResolvedTickets() {
    await loadTickets('resolved');
}

async function loadTickets(status) {
    try {
        const res = await fetch(`${API_URL}/support/tickets?status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Target the correct container based on status
        const containerMap = {
            'open': 'openTicketList',
            'in_progress': 'inProgressTicketList',
            'resolved': 'resolvedTicketList'
        };
        const containerId = containerMap[status] || 'openTicketList';
        const container = document.getElementById(containerId);
        const tickets = data.tickets || [];

        if (tickets.length === 0) {
            // For table-based views (in_progress, resolved)
            if (status === 'in_progress' || status === 'resolved') {
                container.innerHTML = '<tr><td colspan="5" class="empty-state">No tickets</td></tr>';
            } else {
                container.innerHTML = '<div class="empty-state" style="padding: 40px;">No tickets</div>';
            }
            return;
        }

        // Render as table rows for in_progress and resolved
        if (status === 'in_progress' || status === 'resolved') {
            container.innerHTML = tickets.map(t => `
                <tr style="cursor: pointer;" onclick="selectTicket('${t.ticket_id}')" onmouseover="this.style.backgroundColor='var(--bg-secondary)'" onmouseout="this.style.backgroundColor='transparent'">
                    <td><strong>${escapeHTML(t.subject)}</strong></td>
                    <td>${escapeHTML(t.customer_name)}</td>
                    <td>#${t.order_number || 'N/A'}</td>
                    <td>${timeAgo(t.updated_at || t.created_at)}</td>
                    <td><button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectTicket('${t.ticket_id}')">View</button></td>
                </tr>
            `).join('');
        } else {
            // Render as cards for open tickets with SLA indicator
            container.innerHTML = tickets.map(t => {
                const isSlaBreached = t.sla_deadline && new Date(t.sla_deadline) < new Date();
                const isUrgent = t.priority === 'urgent';
                return `
                <div class="ticket-item" data-id="${t.ticket_id}" onclick="selectTicket('${t.ticket_id}')" 
                     style="padding: 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; ${isSlaBreached ? 'border-left: 3px solid var(--danger);' : ''}"
                     onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${isSlaBreached ? '<span style="background: var(--danger); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">SLA BREACH</span>' : ''}
                            ${isUrgent ? '<span style="background: #f59e0b; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">URGENT</span>' : ''}
                            <strong style="font-size: 14px;">${escapeHTML(t.subject)}</strong>
                        </div>
                        <span style="font-size: 11px; color: var(--text-muted);">${timeAgo(t.created_at)}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${escapeHTML(t.customer_name)} • Order #${t.order_number || 'N/A'}
                    </div>
                </div>
            `}).join('');
        }
    } catch (err) {
        console.error('Failed to load tickets:', err);
    }
}

async function selectTicket(ticketId) {
    currentTicketId = ticketId;

    // Switch to Open section to show the chat panel (skip loading tickets to prevent race condition)
    if (currentSection !== 'open') {
        switchSection('open', true);
        // Wait for DOM update
        await new Promise(r => setTimeout(r, 100));
    }

    try {
        const res = await fetch(`${API_URL}/support/tickets/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        document.getElementById('emptyChatState').style.display = 'none';
        document.getElementById('activeTicketView').style.display = 'flex';

        document.getElementById('ticketSubject').textContent = data.ticket.subject;
        document.getElementById('ticketOrder').textContent = `#${data.ticket.order_number || 'N/A'}`;
        document.getElementById('ticketCustomer').textContent = data.ticket.customer_name;
        document.getElementById('ticketStatus').value = data.ticket.status;

        // Show SLA and priority badges
        const isSlaBreached = data.ticket.sla_deadline && new Date(data.ticket.sla_deadline) < new Date();
        const isUrgent = data.ticket.priority === 'urgent';
        document.getElementById('ticketSlaBadge').style.display = isSlaBreached ? 'inline' : 'none';
        document.getElementById('ticketPriorityBadge').style.display = isUrgent ? 'inline' : 'none';

        // Load agents and set current assignment
        await loadSupportAgents();
        document.getElementById('ticketAssign').value = data.ticket.assigned_to || '';

        // Show customer contact info (clickable)
        const contactParts = [];
        if (data.ticket.customer_phone) {
            contactParts.push(`<a href="tel:${data.ticket.customer_phone}" style="color: var(--primary); text-decoration: none;">📞 ${data.ticket.customer_phone}</a>`);
        }
        if (data.ticket.customer_email) {
            contactParts.push(`<a href="mailto:${data.ticket.customer_email}" style="color: var(--primary); text-decoration: none;">✉️ ${data.ticket.customer_email}</a>`);
        }
        document.getElementById('ticketContactInfo').innerHTML = contactParts.join(' | ');

        // Load messages
        const chatContainer = document.getElementById('chatMessages');
        const messages = data.messages || [];

        chatContainer.innerHTML = messages.map(m => `
            <div class="chat-message ${m.sender_type}" style="margin-bottom: 15px; ${m.sender_type !== 'customer' ? 'text-align: right;' : ''}">
                <div style="display: inline-block; max-width: 70%; padding: 12px 16px; border-radius: 12px; 
                     background: ${m.sender_type !== 'customer' ? 'var(--primary)' : 'var(--bg-secondary)'}; 
                     color: ${m.sender_type !== 'customer' ? 'white' : 'var(--text-primary)'};">
                    ${escapeHTML(m.message_text || m.message)}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    ${m.sender_name} • ${timeAgo(m.created_at)}
                </div>
            </div>
        `).join('');

        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (err) {
        console.error('Failed to load ticket:', err);
        showToast('Failed to load ticket', 'error');
    }
}

function appendMessage(message) {
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML += `
        <div class="chat-message ${message.sender_type}" style="margin-bottom: 15px; ${message.sender_type !== 'customer' ? 'text-align: right;' : ''}">
            <div style="display: inline-block; max-width: 70%; padding: 12px 16px; border-radius: 12px; 
                 background: ${message.sender_type !== 'customer' ? 'var(--primary)' : 'var(--bg-secondary)'}; 
                 color: ${message.sender_type !== 'customer' ? 'white' : 'var(--text-primary)'};">
                ${escapeHTML(message.message)}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                ${message.sender_name} • Just now
            </div>
        </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendReply() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || !currentTicketId) return;

    try {
        const res = await fetch(`${API_URL}/support/tickets/${currentTicketId}/reply`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_text: message })
        });

        if (res.ok) {
            input.value = '';
            appendMessage({ message, sender_type: 'support', sender_name: 'You' });
        } else {
            showToast('Failed to send reply', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function updateTicketStatus(status) {
    if (!currentTicketId) return;

    try {
        const res = await fetch(`${API_URL}/support/tickets/${currentTicketId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            showToast(`Ticket marked as ${status}`, 'success');
            loadBadges();
        } else {
            showToast('Failed to update status', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function assignTicket(agentId) {
    if (!currentTicketId) return;

    try {
        const res = await fetch(`${API_URL}/support/tickets/${currentTicketId}/assign`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignee_id: agentId || null })
        });

        if (res.ok) {
            showToast(agentId ? 'Ticket assigned' : 'Ticket unassigned', 'success');
        } else {
            showToast('Failed to assign ticket', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Load support agents for assignment dropdown
async function loadSupportAgents() {
    try {
        const res = await fetch(`${API_URL}/staff?role=customer_service`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const select = document.getElementById('ticketAssign');
        if (!select) return;

        // Keep unassigned option
        select.innerHTML = '<option value="">Unassigned</option>';
        (data.staff || []).forEach(agent => {
            select.innerHTML += `<option value="${agent.user_id}">${escapeHTML(agent.full_name)}</option>`;
        });
    } catch (err) {
        console.error('Failed to load agents:', err);
    }
}

// ==========================================
// DISPUTES
// ==========================================

async function loadOrderDisputes() {
    try {
        const res = await fetch(`${API_URL}/operations/disputes?status=pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('orderDisputesTable');
        const disputes = data.disputes || [];

        if (disputes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i> No pending disputes</td></tr>';
            return;
        }

        // Support team views disputes for context - resolution is handled by Operations
        tbody.innerHTML = disputes.map(d => `
            <tr>
                <td><strong>#${d.order_number || 'N/A'}</strong></td>
                <td>${escapeHTML(d.customer_name || '-')}</td>
                <td title="${escapeHTML(d.part_description || '')}">${escapeHTML((d.part_description || '').substring(0, 25))}${(d.part_description || '').length > 25 ? '...' : ''}</td>
                <td><span class="status-badge ${d.status || 'pending'}">${escapeHTML(d.reason || d.status || 'pending')}</span></td>
                <td>${formatDate(d.created_at)}</td>
                <td>
                    <a href="/operations-dashboard.html#disputes" class="btn btn-outline btn-sm" title="Disputes resolved by Operations">
                        <i class="bi bi-box-arrow-up-right"></i> Ops
                    </a>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load order disputes:', err);
        document.getElementById('orderDisputesTable').innerHTML = '<tr><td colspan="6" class="empty-state text-danger">Failed to load disputes</td></tr>';
    }
}

async function loadPaymentDisputes() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts?status=disputed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('paymentDisputesTable');
        const disputes = data.payouts || [];

        if (disputes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i> No payment disputes</td></tr>';
            return;
        }

        // Support team views payment disputes for context - resolution by Finance team
        tbody.innerHTML = disputes.map(d => `
            <tr>
                <td><strong>${escapeHTML(d.garage_name || '-')}</strong></td>
                <td>#${d.order_number || 'N/A'}</td>
                <td>${parseFloat(d.net_amount || 0).toLocaleString()} QAR</td>
                <td><span class="status-badge cancelled">${escapeHTML(d.dispute_reason || 'Not received')}</span></td>
                <td>${formatDate(d.disputed_at)}</td>
                <td>
                    <a href="/finance-dashboard.html" class="btn btn-outline btn-sm" title="Payment disputes resolved by Finance">
                        <i class="bi bi-currency-dollar"></i> Finance
                    </a>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load payment disputes:', err);
        document.getElementById('paymentDisputesTable').innerHTML = '<tr><td colspan="6" class="empty-state text-danger">Failed to load</td></tr>';
    }
}

// Note: Dispute resolution is handled by Operations (order) and Finance (payment) teams
// Support team views disputes for context only

// ==========================================
// REVIEWS
// ==========================================

let reviewStatus = 'pending';

document.getElementById('reviewTabs')?.addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
        document.querySelectorAll('#reviewTabs .tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        reviewStatus = e.target.dataset.status;
        loadReviews();
    }
});

async function loadReviews() {
    try {
        const res = await fetch(`${API_URL}/reviews/moderation?status=${reviewStatus}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('reviewsTable');
        const reviews = data.reviews || [];

        if (reviews.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No ${reviewStatus} reviews</td></tr>`;
            return;
        }

        tbody.innerHTML = reviews.map(r => `
            <tr>
                <td>${escapeHTML(r.customer_name)}</td>
                <td>${escapeHTML(r.garage_name)}</td>
                <td style="color: #f59e0b;">${renderStars(r.overall_rating || 0)}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(r.review_text || 'No comment')}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                    ${reviewStatus === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="moderateReview('${r.review_id}', 'approved')"><i class="bi bi-check"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="moderateReview('${r.review_id}', 'rejected')"><i class="bi bi-x"></i></button>
                    ` : `<span class="status-badge ${reviewStatus}">${reviewStatus}</span>`}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

async function moderateReview(reviewId, decision) {
    try {
        // Backend expects 'action' not 'status', and 'approve'/'reject' not 'approved'/'rejected'
        const action = decision === 'approved' ? 'approve' : 'reject';

        let rejection_reason = null;
        if (action === 'reject') {
            rejection_reason = prompt('Enter rejection reason:');
            if (!rejection_reason) return; // User cancelled
        }

        const res = await fetch(`${API_URL}/reviews/${reviewId}/moderate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, rejection_reason })
        });

        if (res.ok) {
            showToast(`Review ${action}d successfully`, 'success');
            loadReviews();
            loadBadges();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to moderate review', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function handleUrgentItem(id, type) {
    if (type === 'ticket') {
        switchSection('open');
        setTimeout(() => selectTicket(id), 300);
    } else if (type === 'dispute') {
        switchSection('orderDisputes');
    }
}

// ==========================================
// CANNED RESPONSES
// ==========================================

function insertCannedResponse(value) {
    if (!value) return;
    const select = document.getElementById('cannedResponses');
    const textarea = document.getElementById('chatInput');
    const selectedOption = select.options[select.selectedIndex];
    textarea.value = selectedOption.text;
    textarea.focus();
    select.value = ''; // Reset dropdown
}

// ==========================================
// EXPORT
// ==========================================

async function exportTickets() {
    showToast('Generating export...', 'info');

    try {
        // Fetch all resolved tickets
        const res = await fetch(`${API_URL}/support/tickets?status=resolved&limit=500`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const tickets = data.tickets || [];

        if (tickets.length === 0) {
            showToast('No tickets to export', 'error');
            return;
        }

        // Create CSV content
        const headers = ['Ticket ID', 'Subject', 'Customer', 'Order #', 'Status', 'Priority', 'Created', 'Resolved'];
        const rows = tickets.map(t => [
            t.ticket_id,
            `"${(t.subject || '').replace(/"/g, '""')}"`,
            `"${(t.customer_name || '').replace(/"/g, '""')}"`,
            t.order_number || 'N/A',
            t.status,
            t.priority || 'normal',
            new Date(t.created_at).toISOString().split('T')[0],
            new Date(t.updated_at).toISOString().split('T')[0]
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        // Download file
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qscrap_tickets_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showToast(`Exported ${tickets.length} tickets`, 'success');
    } catch (err) {
        console.error('Export failed:', err);
        showToast('Export failed', 'error');
    }
}
