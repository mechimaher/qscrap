const API_URL = '/api';
let token = localStorage.getItem('opsToken');
let socket = null;

// ===== SECURITY UTILITIES =====
/**
 * Escape HTML to prevent XSS attacks
 * Use this for ALL user-generated content
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Decode JWT token to extract payload (without verification - for frontend display only)
 * Security Note: Actual authorization is enforced by backend middleware
 */
function decodeJWT(token) {
    try {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch (e) {
        console.error('Failed to decode token:', e);
        return null;
    }
}

/**
 * Check if current token belongs to an authorized operations user
 * Allowed: admin, or staff with operations role
 */
function isAuthorizedUser(token) {
    const payload = decodeJWT(token);
    if (!payload) return false;

    // Admin always has access
    if (payload.userType === 'admin') return true;

    // Staff users need operations role for this dashboard
    if (payload.userType === 'staff') {
        return payload.staffRole === 'operations';
    }

    return false;
}

/**
 * Get user type from token for display purposes
 */
function getUserTypeFromToken(token) {
    const payload = decodeJWT(token);
    return payload?.userType || 'unknown';
}

/**
 * Show access denied screen with clear message
 */
function showAccessDenied(userType) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'none';

    // Create access denied overlay if it doesn't exist
    let accessDenied = document.getElementById('accessDeniedScreen');
    if (!accessDenied) {
        accessDenied = document.createElement('div');
        accessDenied.id = 'accessDeniedScreen';
        accessDenied.innerHTML = `
            <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%); padding: 20px;">
                <div style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; text-align: center; max-width: 450px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                        <i class="bi bi-shield-lock" style="font-size: 36px; color: white;"></i>
                    </div>
                    <h1 style="color: white; font-size: 24px; margin-bottom: 12px;">Access Denied</h1>
                    <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                        The Operations Dashboard is restricted to <strong style="color: #f59e0b;">Admin</strong>, 
                        <strong style="color: #f59e0b;">Operations</strong>, and <strong style="color: #f59e0b;">Staff</strong> accounts only.
                    </p>
                    <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                        <p style="color: #fca5a5; font-size: 13px; margin: 0;">
                            <i class="bi bi-info-circle"></i> You are logged in as: <strong id="deniedUserType" style="text-transform: capitalize;">${userType}</strong>
                        </p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="logoutAndRetry()" style="background: linear-gradient(135deg, #8D1B3D 0%, #6B1530 100%); border: none; color: white; padding: 14px 24px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;">
                            <i class="bi bi-box-arrow-in-right"></i> Login with Different Account
                        </button>
                        <a href="/garage-dashboard.html" style="color: rgba(255,255,255,0.6); font-size: 13px; text-decoration: none;">
                            ← Go to Garage Dashboard
                        </a>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(accessDenied);
    } else {
        accessDenied.style.display = 'block';
        // Update user type display
        const userTypeEl = accessDenied.querySelector('#deniedUserType');
        if (userTypeEl) userTypeEl.textContent = userType;
    }
}

/**
 * Logout and show login screen for retry
 */
function logoutAndRetry() {
    localStorage.removeItem('opsToken');
    token = null;

    // Hide access denied screen
    const accessDenied = document.getElementById('accessDeniedScreen');
    if (accessDenied) accessDenied.style.display = 'none';

    // Show login screen
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';

    showToast('Please login with an authorized operations account', 'info');
}

let currentOrderStatus = 'all';
let currentDisputeStatus = 'pending';
let currentUserType = 'customer';

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: email, password })
        });
        const data = await res.json();

        if (res.ok && data.token) {
            // Validate user type before granting access
            if (!isAuthorizedUser(data.token)) {
                const userType = getUserTypeFromToken(data.token);
                showToast(`Access denied: "${userType}" accounts cannot access Operations Dashboard`, 'error');
                showAccessDenied(userType);
                return;
            }

            token = data.token;
            localStorage.setItem('opsToken', token);
            localStorage.setItem('opsUserName', data.fullName || 'Operator');
            localStorage.setItem('opsUserPhone', data.phoneNumber || '');
            showDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

// Check auth on load - with user type validation
if (token) {
    if (isAuthorizedUser(token)) {
        showDashboard();
    } else {
        const userType = getUserTypeFromToken(token);
        showAccessDenied(userType);
    }
}



async function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    // Display logged-in user info
    const userName = localStorage.getItem('opsUserName') || 'Operator';
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const greetingEl = document.getElementById('greetingText');

    if (userNameEl) userNameEl.textContent = userName;
    if (userAvatarEl) userAvatarEl.textContent = userName.charAt(0).toUpperCase();
    if (greetingEl) greetingEl.textContent = `Welcome, ${userName.split(' ')[0]}`;

    // Connect socket - only if not already connected
    if (!socket || !socket.connected) {
        socket = io();
        socket.emit('join_operations_room');

        // Setup socket listeners (only once)
        setupSocketListeners();
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    // Order tabs
    document.querySelectorAll('#orderTabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#orderTabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentOrderStatus = tab.dataset.status;
            loadOrders();
        });
    });

    // Dispute tabs
    document.querySelectorAll('#disputeTabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#disputeTabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentDisputeStatus = tab.dataset.status;
            loadDisputes();
        });
    });

    // User tabs
    document.querySelectorAll('#userTabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#userTabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentUserType = tab.dataset.type;
            loadUsers();
        });
    });

    // Load initial data
    await loadStats();
    await loadOrders();

    // Initialize premium VVIP features
    initializePremiumFeatures();
}

/**
 * Setup socket listeners - prevents duplicate bindings
 */
function setupSocketListeners() {
    if (!socket) return;

    // Remove any existing listeners to prevent duplicates
    socket.off('order_status_updated');
    socket.off('delivery_status_updated');
    socket.off('dispute_created');
    socket.off('new_order');
    socket.off('order_ready_for_pickup');
    socket.off('payment_confirmed');
    socket.off('payment_disputed');
    socket.off('payout_completed');
    socket.off('payout_pending');
    socket.off('new_review_pending');
    socket.off('order_collected');
    socket.off('qc_completed');
    socket.off('order_cancelled');
    socket.off('new_return_request');

    // Connection handlers for data freshness
    socket.on('connect', () => {
        console.log('[Socket] Connected - refreshing data');
        loadStats();
        loadOrders();
    });

    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
    });

    // Bind listeners
    socket.on('order_status_updated', () => { loadStats(); loadOrders(); });
    socket.on('delivery_status_updated', (data) => {
        if (data.new_status === 'delivered') {
            showToast(`📦 Order #${data.order_number} delivered by driver!`, 'success');
        }
        loadStats();
        loadOrders();
    });
    socket.on('dispute_created', () => { loadStats(); loadDisputes(); });
    socket.on('dispute_resolved', () => { loadStats(); loadDisputes(); });
    socket.on('new_order', () => { loadStats(); loadOrders(); });

    // Order cancelled by customer/garage - CRITICAL for ops awareness
    socket.on('order_cancelled', (data) => {
        const by = data.cancelled_by === 'customer' ? '👤 Customer' : data.cancelled_by === 'garage' ? '🔧 Garage' : '⚙️ System';
        showToast(`❌ Order #${data.order_number || ''} cancelled by ${by}`, 'warning');
        loadStats();
        loadOrders();
    });

    // New return request - needs ops review
    socket.on('new_return_request', (data) => {
        showToast(`🔄 Return request for Order #${data.order_number || ''}`, 'warning');
        loadStats();
        loadReturns();
    });

    // Order collected - ready for driver assignment
    socket.on('order_collected', (data) => {
        showToast(`📦 Order #${data.order_number || ''} collected - ready for delivery!`, 'info');
        loadOrders();
        loadDeliveryData();
    });
    // qc_completed event removed - QC module no longer exists

    // Order ready for pickup notification (from garage)
    socket.on('order_ready_for_pickup', (data) => {
        showToast(data.notification || '📦 Order ready for collection!', 'warning');
        loadStats();
        loadOrders();
        // Update orders badge
        const badge = document.getElementById('ordersBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.style.display = 'inline-flex';
        }
    });

    // Payment/Payout Real-time Events
    socket.on('payment_confirmed', (data) => {
        showToast(data.notification || '✅ Garage confirmed payment receipt!', 'success');
        // Refresh finance data if on finance section
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionFinance') {
            loadFinance();
        }
    });

    socket.on('payment_disputed', (data) => {
        showToast(data.notification || 'A payment has been disputed!', 'warning');
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionFinance') {
            loadFinance();
        }
    });

    socket.on('payout_completed', (data) => {
        showToast(data.notification || '✅ Payout completed!', 'success');
        loadStats();
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionFinance') {
            loadFinance();
        }
        // Decrease finance badge when payout is completed
        const badge = document.getElementById('financeBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            if (currentCount > 1) {
                badge.textContent = currentCount - 1;
            } else {
                badge.textContent = '0';
                badge.style.display = 'none';
            }
        }
    });

    // NEW: Payout pending notification - shows finance badge
    socket.on('payout_pending', (data) => {
        showToast(data.notification || '💰 New payout pending for garage', 'warning');
        // Update the finance badge
        const badge = document.getElementById('financeBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.style.display = 'inline-flex';
        }
        // Refresh finance data if on finance section
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionFinance') {
            loadFinance();
        }
    });

    // NEW: Review moderation notification
    socket.on('new_review_pending', (data) => {
        showToast(data.notification || '⭐ New review submitted - pending moderation', 'info');
        // Update the reviews badge
        const badge = document.getElementById('reviewModerationBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.style.display = 'inline-flex';
        }
        // Refresh review moderation if on that section
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionReviewModeration') {
            loadReviewModeration();
        }
    });

    // Driver status change notification (available/busy/offline)
    socket.on('driver_status_changed', (data) => {
        console.log('[SOCKET] Driver status changed:', data);
        showToast(data.notification || `Driver ${data.driver_name || ''} is now ${data.new_status}`, 'info');
        // Refresh delivery data if on delivery section
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionDelivery') {
            loadDeliveryData();
        }
    });

    // Ticket status update notification
    socket.on('ticket_updated', (data) => {
        console.log('[SOCKET] Ticket updated:', data);
        showToast(`Support ticket status: ${data.status}`, 'info');
    });

    // Return assignment created - when refund approved and part needs to go back to garage
    socket.on('return_assignment_created', (data) => {
        console.log('[SOCKET] Return assignment created:', data);
        showToast(data.notification || `📦 Return pending: Order #${data.order_number} needs driver`, 'warning');
        // Update delivery badge
        const badge = document.getElementById('deliveryBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.style.display = 'inline-flex';
        }
        // Refresh delivery data if on delivery section
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionDelivery') {
            loadDeliveryData();
        }
    });

    // Initialize support socket listeners
    if (typeof initSupportSocketListeners === 'function') {
        initSupportSocketListeners();
    }
    // Initialize support socket listeners
    if (typeof initSupportSocketListeners === 'function') {
        initSupportSocketListeners();
    }

    // Mobile Support View Back Button
    const chatPanel = document.querySelector('.ticket-chat-panel');
    if (chatPanel) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-ghost btn-sm hide-desktop';
        backBtn.innerHTML = '<i class="bi bi-arrow-left"></i> Back';
        backBtn.style.marginBottom = '10px';
        backBtn.onclick = () => {
            const supportLayout = document.querySelector('.support-layout');
            if (supportLayout) supportLayout.classList.remove('show-chat');
        };

        // Insert before chat header only if it exists AND is a child of chatPanel
        const chatHeader = chatPanel.querySelector('.chat-header');
        if (chatHeader && chatHeader.parentNode === chatPanel) {
            chatPanel.insertBefore(backBtn, chatHeader);
        } else {
            // Fallback: prepend to chat panel
            chatPanel.prepend(backBtn);
        }
    }
}

function showMobileChat() {
    if (window.innerWidth <= 768) {
        document.querySelector('.support-layout').classList.add('show-chat');
    }
}

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1)).classList.add('active');

    // Load section data
    if (section === 'orders') loadOrders();
    if (section === 'escalations') loadEscalations();
    if (section === 'users') loadUsers();
    if (section === 'finance') loadFinance();
    if (section === 'delivery') { loadDeliveryData(); loadDeliveryHistory(); }
    if (section === 'analytics') loadAnalytics();
    if (section === 'reports') loadReports();
    if (section === 'reviewModeration') loadReviewModeration();
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/operations/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.stats) {
            const s = data.stats;

            // Helper function to safely set element text
            const setStatText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };

            // Update stat cards (defensive - elements may not exist)
            setStatText('statActiveOrders', s.active_orders);
            setStatText('statPendingDisputes', s.pending_disputes);
            setStatText('statContestedDisputes', s.contested_disputes);
            setStatText('statInTransit', s.in_transit);
            setStatText('statRevenueToday', Math.round(s.revenue_today) + ' QAR');
            setStatText('statReadyPickup', s.ready_for_pickup);
            setStatText('statTotalCustomers', s.total_customers);
            setStatText('statTotalGarages', s.total_garages);

            // LOYALTY PROGRAM TRANSPARENCY
            const loyaltyToday = parseFloat(s.loyalty_discounts_today) || 0;
            const loyaltyCountToday = parseInt(s.loyalty_discounts_count_today) || 0;
            const loyaltyWeek = parseFloat(s.loyalty_discounts_week) || 0;
            const loyaltyMonth = parseFloat(s.loyalty_discounts_month) || 0;

            setStatText('statLoyaltyToday', Math.round(loyaltyToday) + ' QAR');
            setStatText('statLoyaltyCount', loyaltyCountToday + ' orders');
            setStatText('statLoyaltyWeek', Math.round(loyaltyWeek) + ' QAR');
            setStatText('statLoyaltyMonth', Math.round(loyaltyMonth) + ' QAR');

            // Update badges
            updateBadge('disputesBadge', parseInt(s.pending_disputes) + parseInt(s.contested_disputes));
            updateBadge('ordersBadge', s.active_orders);
            updateBadge('deliveryBadge', s.in_transit || 0);

            // Escalations stats and badge
            const pendingEscalations = parseInt(s.pending_escalations) || 0;
            setStatText('statPendingEscalations', pendingEscalations);
            updateBadge('escalationsBadge', pendingEscalations);
        }

        // Also load review badge and finance badge
        loadReviewBadge();
        loadFinanceBadge();
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadReviewBadge() {
    try {
        const res = await fetch(`${API_URL}/reviews/pending?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.pagination) {
            updateBadge('reviewModerationBadge', data.pagination.total);
        }
    } catch (err) {
        console.error('Failed to load review badge:', err);
    }
}

async function loadFinanceBadge() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts?status=pending&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.pagination) {
            updateBadge('financeBadge', data.pagination.total || 0);
        } else if (Array.isArray(data.payouts)) {
            updateBadge('financeBadge', data.payouts.length || 0);
        } else if (Array.isArray(data)) {
            updateBadge('financeBadge', data.length || 0);
        }
    } catch (err) {
        console.log('Finance badge: unable to load pending payouts');
    }
}

function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

// Get context-sensitive action buttons based on order status
function getOrderActions(order) {
    const o = order;
    const status = o.order_status;

    // Define action buttons based on status
    switch (status) {
        case 'pending_payment':
            // Stuck orders - show cancel button
            return `<button class="btn btn-danger btn-sm" onclick="cancelStuckOrder('${o.order_id}', '${o.order_number}')" title="Cancel stuck order"><i class="bi bi-x-circle"></i></button>`;
        case 'confirmed':
        case 'preparing':
            return `<span class="text-muted" style="font-size: 12px;">Awaiting garage</span>`;
        case 'ready_for_pickup':
            return `<button class="btn btn-primary btn-sm" onclick="openUnifiedAssignmentModal('${o.order_id}', '${o.order_number}', 'collection')" title="Assign driver for collection"><i class="bi bi-truck"></i></button>`;
        case 'collected':
            return `<span class="status-badge ready" style="font-size: 11px;">Part Collected</span>`;
        case 'qc_failed':
            return `<button class="btn btn-warning btn-sm" onclick="handleQCFailed('${o.order_id}')" title="Handle QC failure"><i class="bi bi-exclamation-triangle"></i></button>`;
        case 'in_transit':
            return `<span class="status-badge in_transit" style="font-size: 11px;">In Transit</span>`;
        case 'delivered':
            return `<span class="status-badge delivered" style="font-size: 11px;">Delivered</span>`;
        case 'completed':
            return `<span class="status-badge completed" style="font-size: 11px;">Completed</span>`;
        case 'disputed':
            return `<button class="btn btn-warning btn-sm" onclick="switchSection('disputes')" title="View dispute"><i class="bi bi-exclamation-circle"></i></button>`;
        default:
            if (status?.startsWith('cancelled')) {
                return `<span class="status-badge cancelled" style="font-size: 11px;">Cancelled</span>`;
            }
            return `<span class="text-muted">-</span>`;
    }
}

// Cancel stuck/orphan order (operations)
async function cancelStuckOrder(orderId, orderNumber) {
    if (!confirm(`Cancel order #${orderNumber}? This will mark it as cancelled by operations.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/operations/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Cancelled by operations - stuck payment' })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Order #${orderNumber} cancelled successfully`, 'success');
            loadStats();
            loadOrders();
        } else {
            showToast(data.error || 'Failed to cancel order', 'error');
        }
    } catch (err) {
        console.error('Cancel order error:', err);
        showToast('Connection error', 'error');
    }
}



// Pagination state
let currentOrdersPage = 1;
const ORDERS_PER_PAGE = 20;

// Order filter state
let orderFilters = {
    search: '',
    dateFrom: '',
    dateTo: '',
    garageId: ''
};

// Debounce timer for search
let searchDebounceTimer = null;

// Debounced search function
function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        orderFilters.search = document.getElementById('orderSearch').value.trim();
        loadOrders(1);
    }, 300);
}

// Apply all order filters
function applyOrderFilters() {
    orderFilters.dateFrom = document.getElementById('orderDateFrom')?.value || '';
    orderFilters.dateTo = document.getElementById('orderDateTo')?.value || '';
    orderFilters.garageId = document.getElementById('orderGarageFilter')?.value || '';
    loadOrders(1);
}

// Clear all filters
function clearOrderFilters() {
    document.getElementById('orderSearch').value = '';
    document.getElementById('orderDateFrom').value = '';
    document.getElementById('orderDateTo').value = '';
    document.getElementById('orderGarageFilter').value = '';
    orderFilters = { search: '', dateFrom: '', dateTo: '', garageId: '' };
    loadOrders(1);
}

// Refresh orders (alias)
function refreshOrders() {
    loadOrdersStats();
    loadOrders(currentOrdersPage);
    loadGarageFilter();
    showToast('Orders refreshed', 'success');
}

// Load order stats for stats cards
async function loadOrdersStats() {
    try {
        const res = await fetch(`${API_URL}/operations/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Update stats cards if elements exist
        const today = new Date().toISOString().split('T')[0];

        // Today's orders (from overview stats)
        document.getElementById('ordersTotalToday').textContent = data.orders_today || data.todayOrders || 0;
        document.getElementById('ordersPendingConfirm').textContent = data.pending_confirmation || data.pending || 0;
        document.getElementById('ordersReadyPickup').textContent = data.ready_for_pickup || 0;
        document.getElementById('ordersCompletedToday').textContent = data.completed_today || 0;
    } catch (err) {
        console.error('Failed to load order stats:', err);
    }
}

// Load garage dropdown filter
async function loadGarageFilter() {
    try {
        const select = document.getElementById('orderGarageFilter');
        if (!select || select.options.length > 1) return; // Already loaded

        const res = await fetch(`${API_URL}/admin/garages?status=approved&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const garages = data.garages || [];

        garages.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.business_name || g.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load garages for filter:', err);
    }
}

// Export orders to CSV
async function exportOrdersCSV() {
    showToast('Generating CSV export...', 'info');

    try {
        // Build query with current filters
        let url = `${API_URL}/operations/orders?status=${currentOrderStatus}&limit=1000`;
        if (orderFilters.search) url += `&search=${encodeURIComponent(orderFilters.search)}`;
        if (orderFilters.dateFrom) url += `&from=${orderFilters.dateFrom}`;
        if (orderFilters.dateTo) url += `&to=${orderFilters.dateTo}`;
        if (orderFilters.garageId) url += `&garage_id=${orderFilters.garageId}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
            showToast('No orders to export', 'error');
            return;
        }

        // Generate CSV
        const headers = ['Order #', 'Customer', 'Garage', 'Part', 'Status', 'Amount', 'Date'];
        const rows = orders.map(o => [
            o.order_number,
            o.customer_name || 'N/A',
            o.garage_name || 'N/A',
            o.part_name || o.part_description || 'N/A',
            o.status,
            o.total_amount,
            new Date(o.created_at).toLocaleDateString()
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `qscrap_orders_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url2);

        showToast(`Exported ${orders.length} orders`, 'success');
    } catch (err) {
        console.error('Export failed:', err);
        showToast('Export failed', 'error');
    }
}

async function loadOrders(page = 1) {
    try {
        currentOrdersPage = page;

        // Build query with filters
        let url = `${API_URL}/operations/orders?status=${currentOrderStatus}&page=${page}&limit=${ORDERS_PER_PAGE}`;
        if (orderFilters.search) url += `&search=${encodeURIComponent(orderFilters.search)}`;
        if (orderFilters.dateFrom) url += `&from=${orderFilters.dateFrom}`;
        if (orderFilters.dateTo) url += `&to=${orderFilters.dateTo}`;
        if (orderFilters.garageId) url += `&garage_id=${orderFilters.garageId}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const statusLabels = {
            pending_payment: 'Pending Payment',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            ready_for_pickup: 'Ready for Pickup',
            collected: 'Collected',
            qc_in_progress: 'QC In Progress',
            qc_passed: 'QC Passed',
            qc_failed: 'QC Failed',
            in_transit: 'In Transit',
            delivered: 'Delivered',
            completed: 'Completed',
            disputed: 'Disputed',
            refunded: 'Refunded',
            cancelled_by_customer: 'Cancelled (Customer)',
            cancelled_by_garage: 'Cancelled (Garage)',
            cancelled_by_operations: 'Cancelled (Ops)'
        };

        const statusClass = {
            pending_payment: 'pending',
            confirmed: 'confirmed',
            preparing: 'preparing',
            ready_for_pickup: 'ready',
            collected: 'collected',
            qc_in_progress: 'pending',
            qc_passed: 'completed',
            qc_failed: 'cancelled',
            in_transit: 'in-transit',
            delivered: 'delivered',
            completed: 'completed',
            disputed: 'pending',
            refunded: 'refunded',
            cancelled_by_customer: 'cancelled',
            cancelled_by_garage: 'cancelled',
            cancelled_by_operations: 'cancelled'
        };

        if (data.orders && data.orders.length) {
            // Helper function to determine row highlighting class
            const getRowClass = (status) => {
                switch (status) {
                    case 'pending_payment': return 'needs-attention-red';  // Stuck order, needs cancellation
                    case 'confirmed': return 'needs-attention-amber';  // Awaiting garage action
                    case 'disputed': return 'needs-attention-red';     // Urgent: dispute needs resolution
                    case 'ready_for_pickup': return 'needs-attention-green';  // Ready for driver assignment
                    case 'qc_failed': return 'needs-attention-red';    // QC failed, needs attention
                    default: return '';
                }
            };

            // Orders table - with loyalty discount transparency
            document.getElementById('ordersTable').innerHTML = data.orders.map(o => {
                const hasDiscount = parseFloat(o.loyalty_discount) > 0;
                const discountBadge = hasDiscount
                    ? `<span style="display:inline-block; background:#10B981; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:4px;" title="Loyalty Discount: -${o.loyalty_discount} QAR">🎁 -${o.loyalty_discount}</span>`
                    : '';
                return `
                        <tr class="${getRowClass(o.order_status)}">
                            <td><a href="#" onclick="viewOrder('${o.order_id}'); return false;" style="color: var(--accent); text-decoration: none; font-weight: 600;">#${o.order_number || o.order_id.slice(0, 8)}</a></td>
                            <td>${escapeHTML(o.customer_name)}<br><small style="color: var(--text-muted);">${escapeHTML(o.customer_phone)}</small></td>
                            <td>${escapeHTML(o.garage_name)}</td>
                            <td>${escapeHTML(o.car_make)} ${escapeHTML(o.car_model)}<br><small style="color: var(--text-muted);">${escapeHTML(o.part_description?.slice(0, 30))}...</small></td>
                            <td><span class="status-badge ${statusClass[o.order_status] || ''}">${statusLabels[o.order_status] || o.order_status}</span></td>
                            <td><strong>${o.total_amount} QAR</strong>${discountBadge}</td>
                            <td>${getOrderActions(o)}</td>
                        </tr>
                    `;
            }).join('');

            // Render pagination controls
            if (data.pagination) {
                renderPagination('ordersPagination', data.pagination, 'loadOrders');
            }

            // Recent orders on overview (first 5 from current page)
            document.getElementById('recentOrdersTable').innerHTML = data.orders.slice(0, 5).map(o => `
                        <tr class="${getRowClass(o.order_status)}">
                            <td><a href="#" onclick="viewOrder('${o.order_id}'); return false;" style="color: var(--accent); text-decoration: none; font-weight: 600;">#${o.order_number || o.order_id.slice(0, 8)}</a></td>
                            <td>${escapeHTML(o.customer_name)}</td>
                            <td>${escapeHTML(o.part_description?.slice(0, 25))}...</td>
                            <td><span class="status-badge ${statusClass[o.order_status] || ''}">${statusLabels[o.order_status] || o.order_status}</span></td>
                            <td>${o.total_amount} QAR</td>
                            <td>${getOrderActions(o)}</td>
                        </tr>
                    `).join('');
        } else {
            document.getElementById('ordersTable').innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-inbox"></i><h4>No orders found</h4></td></tr>';
            document.getElementById('ordersPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load orders:', err);
    }
}

// Pagination state for disputes
let currentDisputesPage = 1;
const DISPUTES_PER_PAGE = 20;

async function loadDisputes(page = 1) {
    try {
        currentDisputesPage = page;
        const res = await fetch(`${API_URL}/operations/disputes?status=${currentDisputeStatus}&page=${page}&limit=${DISPUTES_PER_PAGE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const reasonLabels = {
            wrong_part: 'Wrong Part',
            doesnt_fit: "Doesn't Fit",
            damaged: 'Damaged',
            not_as_described: 'Not as Described',
            changed_mind: 'Changed Mind'
        };

        if (data.disputes && data.disputes.length) {
            document.getElementById('orderDisputesTable').innerHTML = data.disputes.map(d => {
                // Determine row highlighting
                let rowClass = '';
                if (d.status === 'pending' || d.status === 'contested') {
                    rowClass = 'needs-attention-red';
                }

                // Determine action column based on status
                let actionCol = '';
                if (d.status === 'pending' || d.status === 'contested') {
                    actionCol = `
                                <button class="btn btn-success btn-sm" id="approveBtn-${d.dispute_id}" onclick="resolveDispute('${d.dispute_id}', 'refund_approved')">
                                    <i class="bi bi-check-lg"></i> Approve
                                </button>
                                <button class="btn btn-danger btn-sm" id="denyBtn-${d.dispute_id}" onclick="resolveDispute('${d.dispute_id}', 'refund_denied')" style="margin-left: 5px;">
                                    <i class="bi bi-x-lg"></i> Deny
                                </button>
                            `;
                } else if (d.status === 'resolved') {
                    const resolutionBadge = d.resolution === 'refund_approved'
                        ? '<span class="status-badge completed"><i class="bi bi-check-circle"></i> Refund Approved</span>'
                        : '<span class="status-badge cancelled"><i class="bi bi-x-circle"></i> Refund Denied</span>';
                    actionCol = resolutionBadge;
                } else {
                    actionCol = `<span class="status-badge ${d.status}">${d.status}</span>`;
                }

                return `
                            <tr id="dispute-row-${d.dispute_id}" class="${rowClass}">
                                <td><strong>#${d.order_number}</strong></td>
                                <td>${escapeHTML(d.customer_name)}<br><small style="color: var(--text-muted);">${escapeHTML(d.customer_phone)}</small></td>
                                <td>${escapeHTML(reasonLabels[d.reason] || d.reason)}</td>
                                <td><span class="status-badge ${d.status}">${d.status}</span></td>
                                <td><strong>${d.refund_amount} QAR</strong></td>
                                <td>${actionCol}</td>
                            </tr>
                        `;
            }).join('');

            // Render pagination controls
            if (data.pagination) {
                renderPagination('disputesPagination', data.pagination, 'loadDisputes');
            }
        } else {
            document.getElementById('orderDisputesTable').innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle"></i><h4>No disputes</h4></td></tr>';
            document.getElementById('disputesPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load disputes:', err);
    }
}

// ============================================
// ESCALATIONS (from Support Dashboard)
// ============================================

async function loadEscalations() {
    try {
        const res = await fetch(`${API_URL}/operations/escalations?status=pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Update stats
        const pendingEl = document.getElementById('escalationsPending');
        const urgentEl = document.getElementById('escalationsUrgent');

        if (data.escalations) {
            const pending = data.escalations.filter(e => e.status === 'pending').length;
            const urgent = data.escalations.filter(e => e.priority === 'urgent').length;
            if (pendingEl) pendingEl.textContent = pending;
            if (urgentEl) urgentEl.textContent = urgent;
        }

        const priorityColors = {
            'urgent': 'danger',
            'high': 'warning',
            'normal': 'info'
        };

        if (data.escalations && data.escalations.length) {
            document.getElementById('escalationsTable').innerHTML = data.escalations.map(e => {
                const priorityClass = priorityColors[e.priority] || 'info';
                const timeAgo = formatTimeAgo(e.created_at);

                return `
                    <tr>
                        <td>
                            <span class="status-badge ${priorityClass}">${e.priority?.toUpperCase() || 'NORMAL'}</span>
                        </td>
                        <td><strong>#${e.order_number || 'N/A'}</strong></td>
                        <td>
                            ${escapeHTML(e.customer_name || 'Unknown')}
                            <br><small style="color: var(--text-muted);">${e.customer_phone || ''}</small>
                        </td>
                        <td style="max-width: 200px;">
                            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(e.reason || '')}">
                                ${escapeHTML(e.reason || 'No reason provided')}
                            </div>
                            ${e.ticket_subject ? `<small style="color: var(--text-muted);">Ticket: ${escapeHTML(e.ticket_subject)}</small>` : ''}
                        </td>
                        <td>${escapeHTML(e.escalated_by_name || 'Support')}</td>
                        <td><small>${timeAgo}</small></td>
                        <td>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn btn-success btn-sm" onclick="resolveEscalation('${e.escalation_id}')" title="Resolve">
                                    <i class="bi bi-check-circle"></i>
                                </button>
                                ${e.ticket_id ? `
                                    <button class="btn btn-ghost btn-sm" onclick="viewTicket('${e.ticket_id}')" title="View Ticket">
                                        <i class="bi bi-chat-dots"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            document.getElementById('escalationsTable').innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="bi bi-inbox"></i>
                        <h4>No pending escalations</h4>
                        <p>All escalations have been resolved</p>
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Failed to load escalations:', err);
        showToast('Failed to load escalations', 'error');
    }
}

async function resolveEscalation(escalationId) {
    const notes = prompt('Resolution notes (optional):');

    try {
        const res = await fetch(`${API_URL}/operations/escalations/${escalationId}/resolve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution_notes: notes || 'Resolved by operations' })
        });

        if (res.ok) {
            showToast('Escalation resolved', 'success');
            loadEscalations();
            loadStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to resolve', 'error');
        }
    } catch (err) {
        console.error('Resolve escalation error:', err);
        showToast('Connection error', 'error');
    }
}

// View ticket details from escalation
async function viewTicket(ticketId) {
    try {
        const res = await fetch(`${API_URL}/support/tickets/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Failed to load ticket', 'error');
            return;
        }

        const t = data.ticket;
        const statusColors = {
            'open': 'warning',
            'in_progress': 'info',
            'pending_customer': 'pending',
            'resolved': 'completed',
            'closed': 'cancelled'
        };

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'ticketDetailModal';
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 700px;">
                <div class="modal-header">
                    <h2><i class="bi bi-ticket-detailed"></i> Ticket #${t.ticket_number || ticketId.slice(0, 8)}</h2>
                    <button class="modal-close" onclick="document.getElementById('ticketDetailModal').remove()"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="modal-body">
                    <div class="info-card" style="margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0;">${escapeHTML(t.subject)}</h3>
                            <span class="status-badge ${statusColors[t.status] || 'info'}">${t.status?.replace(/_/g, ' ').toUpperCase()}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p style="color: var(--text-muted); margin-bottom: 5px;">Customer</p>
                                <p style="font-weight: 500;">${escapeHTML(t.customer_name || 'Unknown')}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-muted); margin-bottom: 5px;">Category</p>
                                <p style="font-weight: 500;">${escapeHTML(t.category || 'General')}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-muted); margin-bottom: 5px;">Order</p>
                                <p style="font-weight: 500;">${t.order_number ? '#' + t.order_number : 'N/A'}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-muted); margin-bottom: 5px;">Created</p>
                                <p style="font-weight: 500;">${new Date(t.created_at).toLocaleString()}</p>
                            </div>
                        </div>
                        ${t.description ? `
                            <div style="margin-top: 15px; padding: 15px; background: var(--bg-tertiary); border-radius: 8px;">
                                <p style="color: var(--text-muted); margin-bottom: 5px;">Description</p>
                                <p style="white-space: pre-wrap;">${escapeHTML(t.description)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-ghost" onclick="document.getElementById('ticketDetailModal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (err) {
        console.error('View ticket error:', err);
        showToast('Failed to load ticket', 'error');
    }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// Pagination state for users
let currentUsersPage = 1;
const USERS_PER_PAGE = 20;

async function loadUsers(page = 1) {
    currentUsersPage = page;
    try {
        const res = await fetch(`${API_URL}/operations/users?type=${currentUserType}&page=${page}&limit=${USERS_PER_PAGE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.users && data.users.length) {
            document.getElementById('usersTable').innerHTML = data.users.map(u => {
                const userId = currentUserType === 'garage' ? u.garage_id : u.user_id;
                const name = currentUserType === 'garage' ? u.garage_name : u.full_name;
                const contact = u.phone || u.phone_number || u.email || 'N/A';
                return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${contact}</td>
                                <td>${u.total_orders || 0} orders</td>
                                <td>${new Date(u.created_at || u.user_created).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-ghost btn-sm" onclick="viewUser('${userId}', '${currentUserType}')">
                                        <i class="bi bi-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
            }).join('');

            // Render pagination controls
            if (data.pagination) {
                renderPagination('usersPagination', data.pagination, 'loadUsers');
            }
        } else {
            document.getElementById('usersTable').innerHTML = '<tr><td colspan="5" class="empty-state"><i class="bi bi-people"></i><h4>No users found</h4></td></tr>';
            document.getElementById('usersPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

// View User Detail Modal
async function viewUser(userId, userType) {
    try {
        const res = await fetch(`${API_URL}/operations/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Failed to load user', 'error');
            return;
        }

        const u = data.user;
        const isGarage = u.user_type === 'garage' || u.garage_name;
        const name = isGarage ? u.garage_name : u.full_name;
        const contact = u.phone || u.phone_number || 'N/A';
        const email = u.email || 'N/A';
        const suspended = u.is_suspended ? '<span class="status-badge cancelled">Suspended</span>' : '<span class="status-badge completed">Active</span>';

        // Build orders table
        let ordersHtml = '<p style="color: var(--text-muted);">No orders</p>';
        if (data.orders && data.orders.length) {
            ordersHtml = data.orders.map(o => `
                        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                            <strong>#${o.order_number}</strong> - ${o.part_description?.slice(0, 30)}...
                            <span class="status-badge ${o.order_status}" style="margin-left: 10px;">${o.order_status}</span>
                        </div>
                    `).join('');
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'userDetailModal';
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
                    <div class="modal-container" style="max-width: 600px;">
                        <div class="modal-header">
                            <h2><i class="bi bi-person"></i> ${name}</h2>
                            <button class="modal-close" onclick="document.getElementById('userDetailModal').remove()"><i class="bi bi-x-lg"></i></button>
                        </div>
                        <div class="modal-body">
                            <div class="info-card" style="margin-bottom: 20px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div>
                                        <p style="color: var(--text-muted); margin-bottom: 5px;">Type</p>
                                        <p style="font-weight: 500;">? 'Garage' : 'Customer'}</p>
                                    </div>
                                    <div>
                                        <p style="color: var(--text-muted); margin-bottom: 5px;">Status</p>
                                        <p>${suspended}</p>
                                    </div>
                                    <div>
                                        <p style="color: var(--text-muted); margin-bottom: 5px;">Phone</p>
                                        <p style="font-weight: 500;">${contact}</p>
                                    </div>
                                    <div>
                                        <p style="color: var(--text-muted); margin-bottom: 5px;">Email</p>
                                        <p style="font-weight: 500;">${email}</p>
                                    </div>
                                    ${isGarage ? `
                                        <div>
                                            <p style="color: var(--text-muted); margin-bottom: 5px;">Address</p>
                                            <p style="font-weight: 500;">${u.address || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p style="color: var(--text-muted); margin-bottom: 5px;">Rating</p>
                                            <p style="font-weight: 500;">${u.rating_average || 0} (${u.rating_count || 0})</p>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            
                            <h4 style="margin-bottom: 10px;"><i class="bi bi-box-seam"></i> Recent Orders</h4>
                            <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                                ${ordersHtml}
                            </div>
                        </div>
                        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid var(--border-color);">
                            ${u.is_suspended
                ? `<button class="btn btn-success" onclick="activateUser('${userId}')"><i class="bi bi-check-circle"></i> Activate</button>`
                : `<button class="btn btn-danger" onclick="suspendUser('${userId}')"><i class="bi bi-slash-circle"></i> Suspend</button>`
            }
                            <button class="btn btn-ghost" onclick="document.getElementById('userDetailModal').remove()">Close</button>
                        </div>
                    </div>
                `;
        document.body.appendChild(modal);
    } catch (err) {
        console.error('viewUser Error:', err);
        showToast('Connection error', 'error');
    }
}

async function suspendUser(userId) {
    const reason = prompt('Suspension reason (optional):');
    try {
        const res = await fetch(`${API_URL}/operations/users/${userId}/suspend`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || 'Suspended by operations team' })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'User suspended', 'success');
            document.getElementById('userDetailModal')?.remove();
            loadUsers();
        } else {
            showToast(data.error || 'Failed to suspend user', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function activateUser(userId) {
    try {
        const res = await fetch(`${API_URL}/operations/users/${userId}/activate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'User activated', 'success');
            document.getElementById('userDetailModal')?.remove();
            loadUsers();
        } else {
            showToast(data.error || 'Failed to activate user', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}


let currentAnalyticsPeriod = '7d';

async function loadAnalytics() {
    try {
        const res = await fetch(`${API_URL}/operations/analytics?period=${currentAnalyticsPeriod}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Update stats
        document.getElementById('analyticsTotalRevenue').textContent = parseFloat(data.orders.total_revenue || 0).toLocaleString() + ' QAR';
        document.getElementById('analyticsNetRevenue').textContent = parseFloat(data.orders.net_revenue || 0).toLocaleString() + ' QAR';
        document.getElementById('analyticsTotalOrders').textContent = data.orders.total_orders || 0;
        document.getElementById('analyticsCompleted').textContent = data.orders.completed || 0;

        // Update disputes
        document.getElementById('analyticsDisputesTotal').textContent = data.disputes.total_disputes || 0;
        document.getElementById('analyticsDisputesPending').textContent = data.disputes.pending || 0;
        document.getElementById('analyticsDisputesResolved').textContent = data.disputes.resolved || 0;
        document.getElementById('analyticsRefundsApproved').textContent = data.disputes.refunds_approved || 0;
        document.getElementById('analyticsRefundsDenied').textContent = data.disputes.refunds_denied || 0;

        // Top garages table
        if (data.top_garages && data.top_garages.length) {
            document.getElementById('topGaragesTable').innerHTML = data.top_garages.map(g => `
                        <tr>
                            <td><strong>${g.garage_name}</strong></td>
                            <td>${g.order_count}</td>
                            <td>${parseFloat(g.total_revenue || 0).toLocaleString()} QAR</td>
                        </tr>
                    `).join('');
        } else {
            document.getElementById('topGaragesTable').innerHTML = '<tr><td colspan="3" class="empty-state">No data</td></tr>';
        }

        // Top parts table
        if (data.top_parts && data.top_parts.length) {
            document.getElementById('topPartsTable').innerHTML = data.top_parts.map(p => `
                        <tr>
                            <td>${p.part_description}</td>
                            <td>${p.request_count}</td>
                        </tr>
                    `).join('');
        } else {
            document.getElementById('topPartsTable').innerHTML = '<tr><td colspan="2" class="empty-state">No data</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load analytics:', err);
    }
}

// Period tabs for Finance section
document.getElementById('periodTabs')?.addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
        document.querySelectorAll('#periodTabs .tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentAnalyticsPeriod = e.target.dataset.period;
        loadAnalytics();
    }
});

// Delivery Management Functions
let availableDrivers = [];

// Delivery Section - Pagination State
let currentDriversPage = 1;
let currentDeliveryOrdersPage = 1;
const DELIVERY_PAGE_SIZE = 20;


// Load Drivers with pagination
async function loadDrivers(page = 1) {
    currentDriversPage = page;
    try {
        const res = await fetch(`${API_URL}/delivery/drivers?page=${page}&limit=${DELIVERY_PAGE_SIZE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Store available drivers for assignment modals
        availableDrivers = (data.drivers || []).filter(d => d.status === 'available');

        if (data.drivers && data.drivers.length) {
            document.getElementById('driversTable').innerHTML = data.drivers.map(d => {
                const toggleBtn = d.status === 'available'
                    ? `<button class="btn btn-sm" style="background: var(--warning); color: white; padding: 4px 10px;" onclick="toggleDriverStatus('${d.driver_id}', 'busy')" title="Mark as Busy"><i class="bi bi-pause-circle"></i></button>`
                    : `<button class="btn btn-sm" style="background: var(--success); color: white; padding: 4px 10px;" onclick="toggleDriverStatus('${d.driver_id}', 'available')" title="Mark as Available"><i class="bi bi-play-circle"></i></button>`;
                return `
                    <tr>
                        <td><strong>${escapeHTML(d.full_name)}</strong><br><small style="color: var(--text-muted);">${d.vehicle_type || 'car'} - ${d.vehicle_plate || 'N/A'}</small></td>
                        <td><span class="status-badge ${d.status}">${d.status}</span></td>
                        <td>${toggleBtn}</td>
                    </tr>
                `;
            }).join('');
        } else {
            document.getElementById('driversTable').innerHTML = '<tr><td colspan="3" class="empty-state">No drivers. Click "Add Driver" to create one.</td></tr>';
        }

        // Render pagination
        if (data.pagination && data.pagination.pages > 1) {
            renderPagination('driversPagination', data.pagination, 'loadDrivers');
        } else {
            const paginationEl = document.getElementById('driversPagination');
            if (paginationEl) paginationEl.innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load drivers:', err);
    }
}

// Load Delivery Orders with pagination  
async function loadDeliveryOrders(page = 1) {
    currentDeliveryOrdersPage = page;
    try {
        const res = await fetch(`${API_URL}/delivery/orders?page=${page}&limit=${DELIVERY_PAGE_SIZE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.orders && data.orders.length) {
            document.getElementById('deliveryOrdersTable').innerHTML = data.orders.map(o => {
                const rowClass = !o.driver_name ? 'needs-attention-green' : '';
                const statusLabel = o.driver_name ? `Assigned to ${escapeHTML(o.driver_name)}` : o.order_status;
                const actionBtn = o.driver_name
                    ? `<span class="status-badge in_transit">Assigned</span>`
                    : `<button class="btn btn-primary btn-sm" onclick="openUnifiedAssignmentModal('${o.order_id}', '${o.order_number}', 'delivery')"><i class="bi bi-person-plus"></i> Assign</button>`;
                return `
                    <tr class="${rowClass}">
                        <td><strong>#${o.order_number}</strong></td>
                        <td>${escapeHTML(o.part_description)}</td>
                        <td><span class="status-badge ${o.order_status}">${statusLabel}</span></td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            }).join('');
        } else {
            document.getElementById('deliveryOrdersTable').innerHTML = '<tr><td colspan="4" class="empty-state">No orders ready for pickup</td></tr>';
        }

        // Render pagination
        if (data.pagination && data.pagination.pages > 1) {
            renderPagination('deliveryOrdersPagination', data.pagination, 'loadDeliveryOrders');
        } else {
            const paginationEl = document.getElementById('deliveryOrdersPagination');
            if (paginationEl) paginationEl.innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load delivery orders:', err);
    }
}

// Toggle driver status (Operations manual control)

// Delivery History
let deliveryHistoryPage = 1;

async function loadDeliveryHistory(page = 1) {
    deliveryHistoryPage = page;
    const dateFilter = document.getElementById('deliveryHistoryDate')?.value || '';

    try {
        // Include both 'delivered' and 'completed' since completed orders were previously delivered
        let url = `${API_URL}/operations/orders?status=delivered,completed&limit=20&offset=${(page - 1) * 20}`;
        if (dateFilter) {
            url += `&date=${dateFilter}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const orders = data.orders || [];
        const total = data.pagination?.total || data.total || orders.length;

        const tbody = document.getElementById('deliveryHistoryTable');

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No delivery history found</td></tr>';
        } else {
            tbody.innerHTML = orders.map(o => {
                const deliveryDate = o.delivered_at ? new Date(o.delivered_at).toLocaleDateString() : '-';
                const deliveryTime = o.delivered_at ? new Date(o.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                const createdDate = new Date(o.created_at).toLocaleDateString();

                return `
                    <tr>
                        <td>${createdDate}</td>
                        <td><strong>#${o.order_number}</strong></td>
                        <td>${escapeHTML(o.driver_name) || '<span class="text-muted">No driver</span>'}</td>
                        <td>${escapeHTML(o.customer_name) || '-'}</td>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(o.delivery_address || '')}">${escapeHTML(o.delivery_address || '-')}</td>
                        <td>${deliveryTime}</td>
                        <td><span class="status-badge delivered">Delivered</span></td>
                    </tr>
                `;
            }).join('');
        }

        // Update count and pagination
        document.getElementById('deliveryHistoryCount').textContent = `${total} deliveries`;
        document.getElementById('deliveryHistoryPrev').disabled = page <= 1;
        document.getElementById('deliveryHistoryNext').disabled = orders.length < 20 || (page * 20) >= total;

    } catch (err) {
        console.error('Failed to load delivery history:', err);
        document.getElementById('deliveryHistoryTable').innerHTML = '<tr><td colspan="7" class="empty-state">Failed to load delivery history</td></tr>';
    }
}

function openAddDriverModal() {
    const modal = document.createElement('div');
    modal.id = 'addDriverModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
                <div class="modal-container" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2><i class="bi bi-person-plus"></i> Add Driver</h2>
                        <button class="modal-close" onclick="document.getElementById('addDriverModal').remove()"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Full Name *</label>
                            <input type="text" id="driverName" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);" required>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Phone *</label>
                            <input type="text" id="driverPhone" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);" required>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Vehicle Type</label>
                            <select id="driverVehicle" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                                <option value="motorcycle">Motorcycle</option>
                                <option value="car">Car</option>
                                <option value="van">Van</option>
                                <option value="truck">Truck</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Vehicle Plate</label>
                            <input type="text" id="driverPlate" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-ghost" onclick="document.getElementById('addDriverModal').remove()">Cancel</button>
                        <button class="btn btn-primary" onclick="submitAddDriver()"><i class="bi bi-check-lg"></i> Add Driver</button>
                    </div>
                </div>
            `;
    document.body.appendChild(modal);
}

async function submitAddDriver() {
    const name = document.getElementById('driverName').value.trim();
    const phone = document.getElementById('driverPhone').value.trim();
    const vehicle = document.getElementById('driverVehicle').value;
    const plate = document.getElementById('driverPlate').value.trim();

    if (!name || !phone) {
        showToast('Name and phone are required', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/delivery/drivers`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: name, phone, vehicle_type: vehicle, vehicle_plate: plate })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Driver added!', 'success');
            document.getElementById('addDriverModal').remove();
            loadDeliveryData();
        } else {
            showToast(data.error || 'Failed to add driver', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ==========================================
// RETURN ASSIGNMENTS MANAGEMENT
// ==========================================

async function loadReturns() {
    try {
        const res = await fetch(`${API_URL}/operations/returns`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const returns = data.returns || data || [];
        const tbody = document.getElementById('returnsTable');
        const badgeCount = document.getElementById('returnsBadgeCount');

        if (badgeCount) {
            badgeCount.textContent = returns.length;
            badgeCount.style.display = returns.length > 0 ? 'inline' : 'none';
        }

        if (returns.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="bi bi-check-circle" style="font-size: 24px; color: var(--success);"></i>
                        <p>No pending returns</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = returns.map(r => {
            const statusBadge = r.status === 'assigned'
                ? `<span class="status-badge in_transit">Driver Assigned</span>`
                : `<span class="status-badge pending">Awaiting Driver</span>`;

            const actionBtn = r.driver_id
                ? `<span class="status-badge completed">In Progress</span>`
                : `<button class="btn btn-warning btn-sm" onclick="assignReturnDriver('${r.assignment_id}', '${r.order_number}')">
                    <i class="bi bi-person-plus"></i> Assign
                   </button>`;

            return `
                <tr>
                    <td><strong>#${escapeHTML(r.order_number || 'N/A')}</strong></td>
                    <td>${escapeHTML(r.garage_name || 'Unknown')}</td>
                    <td>${escapeHTML(r.part_description || 'N/A').substring(0, 30)}...</td>
                    <td>${escapeHTML(r.return_reason || 'QC Failed')}</td>
                    <td>${statusBadge}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load returns:', err);
        document.getElementById('returnsTable').innerHTML = `
            <tr><td colspan="6" class="empty-state">Failed to load returns</td></tr>
        `;
    }
}

async function assignReturnDriver(assignmentId, orderNumber) {
    if (availableDrivers.length === 0) {
        await loadDrivers();
        if (availableDrivers.length === 0) {
            showToast('No available drivers', 'error');
            return;
        }
    }

    const driverOptions = availableDrivers.map(d =>
        `<option value="${d.driver_id}">${escapeHTML(d.full_name)} (${d.vehicle_type || 'Car'})</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'returnAssignModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 400px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
                <h2><i class="bi bi-arrow-return-left"></i> Assign Return Driver</h2>
                <button class="modal-close" onclick="document.getElementById('returnAssignModal').remove()" style="color: white;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin-bottom: 15px;">Assign driver to return Order <strong>#${orderNumber}</strong> to garage.</p>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 8px; display: block;">Select Driver</label>
                    <select id="returnDriverSelect" class="form-control" style="width: 100%;">
                        <option value="">-- Choose Driver --</option>
                        ${driverOptions}
                    </select>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-ghost" onclick="document.getElementById('returnAssignModal').remove()">Cancel</button>
                <button class="btn btn-warning" onclick="submitReturnAssignment('${assignmentId}')">
                    <i class="bi bi-check-lg"></i> Confirm
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitReturnAssignment(assignmentId) {
    const driverId = document.getElementById('returnDriverSelect').value;
    if (!driverId) {
        showToast('Please select a driver', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/operations/returns/${assignmentId}/assign-driver`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ driver_id: driverId })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Return driver assigned!', 'success');
            document.getElementById('returnAssignModal').remove();
            loadReturns();
            loadDrivers();
        } else {
            showToast(data.error || 'Failed to assign driver', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ==========================================
// UNIFIED DRIVER ASSIGNMENT LOGIC
// ==========================================

let assignmentContext = {
    orderId: null,
    type: 'collection' // 'collection' or 'delivery'
};

async function openUnifiedAssignmentModal(orderId, orderNumber, type = 'collection') {
    // 1. Check/Load drivers if needed
    if (availableDrivers.length === 0) {
        // Try loading drivers if none cached
        await loadDrivers();
        if (availableDrivers.length === 0) {
            showToast('No available drivers. Please add or free up a driver.', 'error');
            return;
        }
    }

    assignmentContext = { orderId, type };

    const title = type === 'collection' ? 'Assign Collection Driver' : 'Assign Delivery Driver';
    const icon = type === 'collection' ? 'bi-box-seam' : 'bi-truck';
    const description = type === 'collection'
        ? `Assign a driver to collect Order <strong>#${orderNumber}</strong> from the garage.`
        : `Assign a driver to deliver Order <strong>#${orderNumber}</strong> to the customer.`;

    // Generate driver options
    const driverOptions = availableDrivers.map(d =>
        `<option value="${d.driver_id}">${d.full_name} (${d.vehicle_type || 'Car'}) - ${d.status}</option>`
    ).join('');

    // Remove existing modal if any
    document.getElementById('unifiedAssignModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'unifiedAssignModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
                <h2><i class="bi ${icon}"></i> ${title}</h2>
                <button class="modal-close" onclick="document.getElementById('unifiedAssignModal').remove()" style="color: white;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin-bottom: 20px; color: var(--text-secondary); line-height: 1.5;">${description}</p>
                
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 8px; display: block;">Select Driver</label>
                    <select id="unifiedDriverSelect" class="form-control" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <option value="">-- Choose a Driver --</option>
                        ${driverOptions}
                    </select>
                </div>

                ${type === 'collection' ? `
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; margin-bottom: 8px; display: block;">Notes (Optional)</label>
                    <input type="text" id="unifiedAssignNotes" class="form-control" placeholder="Instructions for driver..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                </div>` : ''}

            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-ghost" onclick="document.getElementById('unifiedAssignModal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="submitUnifiedAssignment()" id="unifiedSubmitBtn" style="background: linear-gradient(135deg, #f59e0b, #d97706); min-width: 120px;">
                    <i class="bi bi-check-lg"></i> Confirm
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitUnifiedAssignment() {
    const driverId = document.getElementById('unifiedDriverSelect').value;
    const notes = document.getElementById('unifiedAssignNotes')?.value || '';

    if (!driverId) {
        showToast('Please select a driver', 'error');
        return;
    }

    const btn = document.getElementById('unifiedSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';

    const { orderId, type } = assignmentContext;
    let url = '';
    let body = { driver_id: driverId };

    if (type === 'collection') {
        url = `${API_URL}/delivery/assign-collection/${orderId}`;
        body.notes = notes;
    } else {
        url = `${API_URL}/delivery/assign/${orderId}`;
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`✅ Driver assigned successfully for ${type}`, 'success');
            document.getElementById('unifiedAssignModal').remove();

            // Refresh all relevant sections
            loadOrders();
            loadStats();
            if (typeof loadDeliveryData === 'function') loadDeliveryData();
        } else {
            showToast(data.error || 'Assignment failed', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Confirm';
        }
    } catch (err) {
        console.error(err);
        showToast('Connection error', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Confirm';
    }
}

// Order Action Functions - Reusing existing patterns



// Handle QC Failed - Show options modal
function handleQCFailed(orderId) {
    const modal = document.createElement('div');
    modal.id = 'qcFailedModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                <h2><i class="bi bi-exclamation-triangle"></i> QC Failed - Resolution</h2>
                <button class="modal-close" onclick="document.getElementById('qcFailedModal').remove()"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 20px; color: var(--text-secondary);">This order failed quality control. Select an action:</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="btn btn-primary" onclick="requestReplacement('${orderId}')" style="justify-content: flex-start; padding: 15px;">
                        <i class="bi bi-arrow-repeat"></i> Request Replacement from Garage
                    </button>
                    <button class="btn btn-warning" onclick="issueRefund('${orderId}')" style="justify-content: flex-start; padding: 15px;">
                        <i class="bi bi-cash"></i> Issue Refund to Customer
                    </button>
                    <button class="btn btn-success" onclick="retryQCInspection('${orderId}')" style="justify-content: flex-start; padding: 15px;">
                        <i class="bi bi-clipboard-check"></i> Re-inspect (Override)
                    </button>
                </div>
            </div>
            <div class="modal-footer" style="padding: 15px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-ghost" onclick="document.getElementById('qcFailedModal').remove()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Request replacement from garage
async function requestReplacement(orderId) {
    if (!confirm('Request a replacement part from the garage?')) return;
    try {
        const res = await fetch(`${API_URL}/operations/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_status: 'preparing', notes: 'Replacement requested due to QC failure' })
        });
        if (res.ok) {
            showToast('Replacement requested from garage', 'success');
            document.getElementById('qcFailedModal')?.remove();
            loadOrders();
            loadStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to request replacement', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Issue refund for failed QC
async function issueRefund(orderId) {
    if (!confirm('Issue a full refund to the customer?')) return;
    try {
        const res = await fetch(`${API_URL}/operations/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_status: 'refunded', notes: 'Refund issued due to QC failure' })
        });
        if (res.ok) {
            showToast('Refund initiated', 'success');
            document.getElementById('qcFailedModal')?.remove();
            loadOrders();
            loadStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to issue refund', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Retry QC inspection (override failure)
function retryQCInspection(orderId) {
    document.getElementById('qcFailedModal')?.remove();
    // Reuse existing QC inspection modal
    openInspection(orderId, '', '', '');
}

// Confirm delivery completed
async function confirmDelivery(orderId) {
    if (!confirm('Confirm this order has been delivered to the customer?')) return;
    try {
        const res = await fetch(`${API_URL}/operations/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_status: 'delivered', notes: 'Delivery confirmed by operations' })
        });
        if (res.ok) {
            showToast('Delivery confirmed!', 'success');
            loadOrders();
            loadDeliveryData();
            loadStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to confirm delivery', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ==========================================
// QC SECTION CODE - REMOVED
// QC module has been removed. Order goes from 'collected' directly to 'in_transit'
// ==========================================

// Quality Inspection Modal Functions - Enhanced Professional Version
let inspectionCriteria = [];
let currentInspectionOrder = null;
let currentInspectionData = null;

// Failure categories for professional QC
const FAILURE_CATEGORIES = {
    'damaged': 'Physical Damage (cracks, dents, scratches)',
    'wrong_part': 'Wrong Part (incorrect model/number)',
    'missing_components': 'Missing Components or Hardware',
    'quality_mismatch': 'Quality Does Not Match Description',
    'counterfeit': 'Suspected Counterfeit or Non-OEM',
    'rust_corrosion': 'Rust, Corrosion, or Oxidation',
    'non_functional': 'Non-Functional or Defective',
    'packaging_issue': 'Packaging Damage or Inadequate',
    'other': 'Other Issue'
};

async function openInspection(orderId, orderNumber, partDesc, garageName) {
    currentInspectionOrder = orderId;
    currentInspectionData = { orderNumber, partDesc, garageName };

    // Load criteria if not cached
    if (inspectionCriteria.length === 0) {
        const res = await fetch(`${API_URL}/quality/criteria`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        inspectionCriteria = data.criteria || [];
    }

    // Build professional checklist HTML with pass/fail toggles and per-item notes
    const checklistHtml = inspectionCriteria.map(c => `
                <div class="qc-checklist-item" style="padding: 15px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 15px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 14px;">
                                ${c.name} ${c.is_required ? '<span style="color: var(--danger);">*</span>' : ''}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">${c.description || ''}</div>
                        </div>
                        <div class="qc-toggle-group" style="display: flex; gap: 5px;">
                            <button type="button" class="qc-toggle-btn qc-pass-btn" data-criteria="${c.criteria_id}" data-status="pass"
                                style="padding: 8px 16px; border-radius: 6px; border: 2px solid var(--success); background: transparent; color: var(--success); cursor: pointer; font-weight: 600; transition: all 0.2s;"
                                onclick="toggleCriteriaStatus('${c.criteria_id}', 'pass')">
                                <i class="bi bi-check-lg"></i> Pass
                            </button>
                            <button type="button" class="qc-toggle-btn qc-fail-btn" data-criteria="${c.criteria_id}" data-status="fail"
                                style="padding: 8px 16px; border-radius: 6px; border: 2px solid var(--danger); background: transparent; color: var(--danger); cursor: pointer; font-weight: 600; transition: all 0.2s;"
                                onclick="toggleCriteriaStatus('${c.criteria_id}', 'fail')">
                                <i class="bi bi-x-lg"></i> Fail
                            </button>
                        </div>
                    </div>
                    <div class="qc-item-notes" id="notes-container-${c.criteria_id}" style="margin-top: 10px; display: none;">
                        <input type="text" id="item-notes-${c.criteria_id}" placeholder="Add notes for this check..."
                            style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px;">
                    </div>
                </div>
            `).join('');

    // Failure category options
    const failureCategoryOptions = Object.entries(FAILURE_CATEGORIES).map(([value, label]) =>
        `<option value="${value}">${label}</option>`
    ).join('');

    // Create professional inspection modal
    const modal = document.createElement('div');
    modal.id = 'inspectionModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
                <div class="modal-container" style="max-width: 800px; max-height: 90vh; display: flex; flex-direction: column;">
                    <div class="modal-header" style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px;">
                        <div>
                            <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                                <i class="bi bi-clipboard-check"></i> Quality Control Inspection
                            </h2>
                            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Order #${orderNumber}</p>
                        </div>
                        <button class="modal-close" onclick="closeInspectionModal()" style="color: white;"><i class="bi bi-x-lg"></i></button>
                    </div>
                    
                    <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                        <!-- Order Details Card -->
                        <div class="qc-order-details" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--border-color);">
                            <div>
                                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Part</div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-top: 3px;">${partDesc}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Supplier Garage</div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-top: 3px;">${garageName}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Status</div>
                                <div style="margin-top: 3px;"><span class="status-badge preparing">Awaiting Inspection</span></div>
                            </div>
                        </div>
                        
                        <!-- Inspection Checklist -->
                        <div style="margin-bottom: 20px;">
                            <h4 style="margin-bottom: 12px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <i class="bi bi-check2-square"></i> Inspection Checklist
                                <span style="font-size: 12px; font-weight: 400; color: var(--text-muted);">(Click Pass/Fail for each item)</span>
                            </h4>
                            <div style="border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; max-height: 280px; overflow-y: auto;">
                                ${checklistHtml}
                            </div>
                        </div>
                        
                        <!-- Assessment Row -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div>
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--text-primary);">
                                    <i class="bi bi-star"></i> Condition Assessment
                                </label>
                                <select id="conditionAssessment" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
                                    <option value="">-- Select Condition --</option>
                                    <option value="excellent">Excellent - Like New</option>
                                    <option value="good">Good - Minor Wear</option>
                                    <option value="fair">Fair - Visible Wear</option>
                                    <option value="poor">Poor - Significant Wear</option>
                                    <option value="defective">Defective - Not Usable</option>
                                </select>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--text-primary);">
                                    <i class="bi bi-award"></i> Part Grade
                                </label>
                                <select id="partGrade" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
                                    <option value="">-- Assign Grade --</option>
                                    <option value="A">Grade A - Premium Quality</option>
                                    <option value="B">Grade B - Standard Quality</option>
                                    <option value="C">Grade C - Economy Quality</option>
                                    <option value="reject">Reject - Does Not Pass</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Inspector Notes -->
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--text-primary);">
                                <i class="bi bi-pencil-square"></i> Inspector Remarks
                            </label>
                            <textarea id="inspectionNotes" rows="3" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px; resize: vertical;" placeholder="Add detailed inspection notes, observations, and recommendations..."></textarea>
                        </div>
                        
                        <!-- Failure Section (Hidden by default) -->
                        <div id="failureSection" style="display: none; padding: 15px; background: rgba(220, 53, 69, 0.1); border: 1px solid var(--danger); border-radius: 10px; margin-bottom: 20px;">
                            <h4 style="color: var(--danger); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="bi bi-exclamation-triangle-fill"></i> QC Failure Details
                            </h4>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--text-primary);">
                                    Failure Category *
                                </label>
                                <select id="failureCategory" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--danger); background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
                                    <option value="">-- Select Failure Category --</option>
                                    ${failureCategoryOptions}
                                </select>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--text-primary);">
                                    Detailed Failure Reason * (min 10 characters)
                                </label>
                                <textarea id="failureReason" rows="3" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--danger); background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;" placeholder="Describe the specific defects, issues, or reasons for rejection in detail..."></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer Actions -->
                    <div class="modal-footer" style="display: flex; gap: 12px; justify-content: space-between; padding: 20px; border-top: 1px solid var(--border-color); background: var(--bg-secondary);">
                        <button class="btn btn-ghost" onclick="closeInspectionModal()" style="padding: 12px 20px;">
                            <i class="bi bi-x-lg"></i> Cancel
                        </button>
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn-danger" id="failBtn" onclick="showFailureSection()" style="padding: 12px 24px; font-weight: 600;">
                                <i class="bi bi-x-circle"></i> Fail QC
                            </button>
                            <button class="btn btn-success" id="passBtn" onclick="submitInspection('passed')" style="padding: 12px 24px; font-weight: 600;">
                                <i class="bi bi-check-circle"></i> Pass QC & Assign Driver
                            </button>
                        </div>
                    </div>
                </div>
            `;
    document.body.appendChild(modal);
}

// Toggle criteria status (pass/fail)
function toggleCriteriaStatus(criteriaId, status) {
    const passBtn = document.querySelector(`.qc-pass-btn[data-criteria="${criteriaId}"]`);
    const failBtn = document.querySelector(`.qc-fail-btn[data-criteria="${criteriaId}"]`);
    const notesContainer = document.getElementById(`notes-container-${criteriaId}`);

    // Reset both buttons
    passBtn.style.background = 'transparent';
    failBtn.style.background = 'transparent';

    if (status === 'pass') {
        passBtn.style.background = 'var(--success)';
        passBtn.style.color = 'white';
        passBtn.dataset.selected = 'true';
        failBtn.dataset.selected = 'false';
        failBtn.style.color = 'var(--danger)';
        notesContainer.style.display = 'none';
    } else {
        failBtn.style.background = 'var(--danger)';
        failBtn.style.color = 'white';
        failBtn.dataset.selected = 'true';
        passBtn.dataset.selected = 'false';
        passBtn.style.color = 'var(--success)';
        notesContainer.style.display = 'block'; // Show notes for failed items
    }
}

// Show failure section
function showFailureSection() {
    document.getElementById('failureSection').style.display = 'block';
    document.getElementById('failBtn').textContent = ' Confirm Failure';
    document.getElementById('failBtn').innerHTML = '<i class="bi bi-x-circle"></i> Confirm Failure';
    document.getElementById('failBtn').onclick = function () { submitInspection('failed'); };
    document.getElementById('failureCategory').focus();
}

function closeInspectionModal() {
    document.getElementById('inspectionModal')?.remove();
    currentInspectionOrder = null;
    currentInspectionData = null;
}

async function submitInspection(result) {
    if (!currentInspectionOrder) return;

    // Collect checklist results with per-item notes
    const checklistResults = inspectionCriteria.map(c => {
        const passBtn = document.querySelector(`.qc-pass-btn[data-criteria="${c.criteria_id}"]`);
        const itemNotes = document.getElementById(`item-notes-${c.criteria_id}`)?.value || '';
        return {
            criteria_id: c.criteria_id,
            name: c.name,
            passed: passBtn?.dataset?.selected === 'true',
            notes: itemNotes
        };
    });

    // Collect per-item notes as object
    const itemNotes = {};
    inspectionCriteria.forEach(c => {
        const notes = document.getElementById(`item-notes-${c.criteria_id}`)?.value;
        if (notes) itemNotes[c.criteria_id] = notes;
    });

    const notes = document.getElementById('inspectionNotes')?.value || '';
    const conditionAssessment = document.getElementById('conditionAssessment')?.value || '';
    const partGrade = document.getElementById('partGrade')?.value || '';
    const failureReason = document.getElementById('failureReason')?.value || '';
    const failureCategory = document.getElementById('failureCategory')?.value || '';

    // Validate for failure
    if (result === 'failed') {
        if (!failureCategory) {
            showToast('Please select a failure category', 'error');
            return;
        }
        if (!failureReason.trim() || failureReason.trim().length < 10) {
            showToast('Failure reason must be at least 10 characters', 'error');
            return;
        }
    }

    // Disable buttons
    document.getElementById('passBtn').disabled = true;
    document.getElementById('failBtn').disabled = true;
    document.getElementById('passBtn').innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';

    try {
        const res = await fetch(`${API_URL}/quality/inspect/${currentInspectionOrder}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                result,
                checklist_results: checklistResults,
                notes,
                condition_assessment: conditionAssessment,
                part_grade: partGrade,
                item_notes: itemNotes,
                failure_reason: failureReason,
                failure_category: failureCategory
            })
        });

        const data = await res.json();

        if (res.ok) {
            if (result === 'passed') {
                // Save order data BEFORE closing modal (which resets these to null)
                const passedOrderId = currentInspectionOrder;
                const passedOrderData = currentInspectionData;
                // Close inspection modal and open driver assignment
                closeInspectionModal();
                showToast('Part passed QC! Now assign a driver for delivery.', 'success');
                openDriverAssignmentModal(passedOrderId, passedOrderData);
            } else {
                // Save order ID before closing
                const failedOrderId = currentInspectionOrder;
                // Part failed - create return assignment
                closeInspectionModal();
                showToast('Part failed QC. Return assignment will be created.', 'warning');
                await createReturnForFailedQC(failedOrderId);
            }
            loadStats();
        } else {
            showToast(data.error || 'Failed to submit inspection', 'error');
            document.getElementById('passBtn').disabled = false;
            document.getElementById('failBtn').disabled = false;
            document.getElementById('passBtn').innerHTML = '<i class="bi bi-check-circle"></i> Pass QC & Assign Driver';
        }
    } catch (err) {
        console.error('Submit inspection error:', err);
        showToast('Connection error', 'error');
        document.getElementById('passBtn').disabled = false;
        document.getElementById('failBtn').disabled = false;
        document.getElementById('passBtn').innerHTML = '<i class="bi bi-check-circle"></i> Pass QC & Assign Driver';
    }
}

// Open driver assignment modal after QC pass
async function openDriverAssignmentModal(orderId, orderData) {
    // Load available drivers
    let driversHtml = '<option value="">-- No drivers available --</option>';
    try {
        const res = await fetch(`${API_URL}/delivery/drivers?status=available`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const drivers = (data.drivers || []).filter(d => d.status === 'available');
        if (drivers.length > 0) {
            driversHtml = drivers.map(d => `
                        <option value="${d.driver_id}">
                            ${d.full_name} - ${d.vehicle_type} (${d.vehicle_plate || 'N/A'}) - ${d.total_deliveries} deliveries
                        </option>
                    `).join('');
        }
    } catch (err) {
        console.error('Failed to load drivers:', err);
    }

    const modal = document.createElement('div');
    modal.id = 'driverAssignModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
                <div class="modal-container" style="max-width: 500px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, var(--success), #218838); color: white;">
                        <div>
                            <h2 style="margin: 0;"><i class="bi bi-truck"></i> Assign Delivery Driver</h2>
                            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Order passed QC - Ready for delivery</p>
                        </div>
                        <button class="modal-close" onclick="document.getElementById('driverAssignModal').remove()" style="color: white;"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">Part Details</div>
                            <div style="font-weight: 600; color: var(--text-primary);">${orderData?.partDesc || 'Auto Part'}</div>
                            <div style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">From: ${orderData?.garageName || 'Garage'}</div>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Select Driver *</label>
                            <select id="assignDriverSelect" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                                ${driversHtml}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-ghost" onclick="document.getElementById('driverAssignModal').remove()">
                            <i class="bi bi-x-lg"></i> Skip for Now
                        </button>
                        <button class="btn btn-primary" id="confirmDriverBtn" onclick="confirmDriverAssignment('${orderId}')" style="background: var(--success);">
                            <i class="bi bi-check-lg"></i> Assign & Start Delivery
                        </button>
                    </div>
                </div>
            `;
    document.body.appendChild(modal);
}

// Confirm driver assignment
async function confirmDriverAssignment(orderId) {
    const driverId = document.getElementById('assignDriverSelect').value;
    if (!driverId) {
        showToast('Please select a driver', 'error');
        return;
    }

    document.getElementById('confirmDriverBtn').disabled = true;
    document.getElementById('confirmDriverBtn').innerHTML = '<i class="bi bi-hourglass-split"></i> Assigning...';

    try {
        const res = await fetch(`${API_URL}/delivery/assign/${orderId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ driver_id: driverId })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Driver assigned! Delivery started.', 'success');
            document.getElementById('driverAssignModal').remove();
            loadDeliveryData();
            loadStats();
        } else {
            showToast(data.error || 'Failed to assign driver', 'error');
            document.getElementById('confirmDriverBtn').disabled = false;
            document.getElementById('confirmDriverBtn').innerHTML = '<i class="bi bi-check-lg"></i> Assign & Start Delivery';
        }
    } catch (err) {
        showToast('Connection error', 'error');
        document.getElementById('confirmDriverBtn').disabled = false;
        document.getElementById('confirmDriverBtn').innerHTML = '<i class="bi bi-check-lg"></i> Assign & Start Delivery';
    }
}

// Create return assignment for failed QC
async function createReturnForFailedQC(orderId) {
    try {
        const res = await fetch(`${API_URL}/quality/return/${orderId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await res.json();
        if (res.ok) {
            showToast('📦 Return assignment created. Part will be returned to garage.', 'success');
        } else {
            showToast(data.error || 'Return assignment may need manual creation', 'warning');
        }
    } catch (err) {
        console.error('Return assignment error:', err);
    }
}



let currentModalOrderId = null;
let currentModalDisputeId = null;

async function viewOrder(orderId) {
    currentModalOrderId = orderId;

    try {
        const res = await fetch(`${API_URL}/operations/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to load order');
        }

        const data = await res.json();
        const order = data.order;
        const history = data.status_history || [];
        const dispute = data.dispute;

        // Populate modal header
        document.getElementById('modalOrderNumber').textContent = '#' + (order.order_number || orderId.slice(0, 8));

        // Customer info
        document.getElementById('modalCustomerName').textContent = order.customer_name || '---';
        document.getElementById('modalCustomerPhone').textContent = order.customer_phone || '---';
        document.getElementById('modalCustomerEmail').textContent = order.customer_email || '---';

        // Garage info
        document.getElementById('modalGarageName').textContent = order.garage_name || '---';
        document.getElementById('modalGaragePhone').textContent = order.garage_phone || '---';
        document.getElementById('modalGarageAddress').textContent = order.garage_address || '---';

        // Part details
        const vehicle = `${order.car_make || ''} ${order.car_model || ''} ${order.car_year || ''}`.trim();
        document.getElementById('modalVehicle').textContent = vehicle || '---';
        document.getElementById('modalPrice').textContent = (order.total_amount || 0) + ' QAR';
        document.getElementById('modalPartDesc').textContent = order.part_description || '---';
        document.getElementById('modalCondition').textContent = formatCondition(order.part_condition);
        document.getElementById('modalWarranty').textContent = order.warranty_days || 0;
        document.getElementById('modalVin').textContent = order.vin_number || 'N/A';

        // Status badge
        const statusLabels = {
            confirmed: 'Confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready',
            in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
            disputed: 'Disputed', refunded: 'Refunded', cancelled: 'Cancelled'
        };
        const statusClasses = {
            confirmed: 'confirmed', preparing: 'preparing', ready_for_pickup: 'ready',
            in_transit: 'in-transit', delivered: 'delivered', completed: 'completed',
            disputed: 'pending', refunded: 'refunded', cancelled: 'refunded'
        };
        const statusBadge = document.getElementById('modalStatusBadge');
        statusBadge.textContent = statusLabels[order.order_status] || order.order_status;
        statusBadge.className = 'status-badge ' + (statusClasses[order.order_status] || '');

        // Images
        const imagesContainer = document.getElementById('modalImages');
        const allImages = [...(order.bid_photos || []), ...(order.request_images || [])];
        if (allImages.length > 0) {
            imagesContainer.innerHTML = allImages.map(url =>
                `<img src="${url}" class="gallery-img" onclick="window.open('${url}', '_blank')" alt="Part image">`
            ).join('');
        } else {
            imagesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">No images available</div>';
        }

        // Timeline
        renderTimeline(order.order_status, history);

        // Bid notes
        if (order.bid_notes) {
            document.getElementById('modalNotesSection').style.display = 'block';
            document.getElementById('modalBidNotes').textContent = order.bid_notes;
        } else {
            document.getElementById('modalNotesSection').style.display = 'none';
        }

        // Dispute section
        if (dispute) {
            currentModalDisputeId = dispute.dispute_id;
            document.getElementById('modalDisputeSection').style.display = 'block';

            const reasonLabels = {
                wrong_part: 'Wrong Part', doesnt_fit: "Doesn't Fit", damaged: 'Damaged',
                not_as_described: 'Not as Described', changed_mind: 'Changed Mind'
            };
            document.getElementById('modalDisputeReason').textContent = reasonLabels[dispute.reason] || dispute.reason;
            document.getElementById('modalDisputeDesc').textContent = dispute.description || 'No description provided';
            document.getElementById('modalRefundAmount').textContent = (dispute.refund_amount || 0) + ' QAR';

            const disputeStatusBadge = document.getElementById('modalDisputeStatus');
            disputeStatusBadge.textContent = dispute.status;
            disputeStatusBadge.className = 'status-badge ' + dispute.status;

            // Show/hide action buttons based on dispute status
            const actionsDiv = document.getElementById('modalDisputeActions');
            if (dispute.status === 'pending' || dispute.status === 'contested') {
                actionsDiv.style.display = 'flex';
                document.getElementById('btnApproveRefund').onclick = () => resolveDisputeFromModal('refund_approved');
                document.getElementById('btnDenyRefund').onclick = () => resolveDisputeFromModal('refund_denied');
            } else {
                actionsDiv.style.display = 'none';
            }
        } else {
            document.getElementById('modalDisputeSection').style.display = 'none';
            currentModalDisputeId = null;
        }

        // Show modal
        document.getElementById('orderModal').classList.add('active');

    } catch (err) {
        console.error('viewOrder error:', err);
        showToast(err.message || 'Failed to load order details', 'error');
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    currentModalOrderId = null;
    currentModalDisputeId = null;
}

function formatCondition(condition) {
    const labels = { new: 'New', used_good: 'Used - Good', used_fair: 'Used - Fair', refurbished: 'Refurbished' };
    return labels[condition] || condition || '---';
}

function renderTimeline(currentStatus, history) {
    const timelineContainer = document.getElementById('modalTimeline');
    const statusOrder = ['confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered', 'completed'];
    const statusLabels = {
        confirmed: 'Order Confirmed', preparing: 'Preparing Part', ready_for_pickup: 'Ready for Pickup',
        in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
        disputed: 'Disputed', refunded: 'Refunded', cancelled: 'Cancelled'
    };

    // Build history map
    const historyMap = {};
    history.forEach(h => { historyMap[h.status] = h.changed_at; });

    let html = '';
    let reachedCurrent = false;

    for (const status of statusOrder) {
        const isActive = historyMap[status];
        const isCurrent = status === currentStatus;
        if (isCurrent) reachedCurrent = true;

        const itemClass = isCurrent ? 'current' : (isActive ? 'active' : '');
        const time = historyMap[status] ? new Date(historyMap[status]).toLocaleString() : (reachedCurrent ? '' : 'Pending');

        html += `
                    <div class="timeline-item ${itemClass}">
                        <div class="timeline-dot"></div>
                        <div class="timeline-status">${statusLabels[status]}</div>
                        <div class="timeline-time">${time}</div>
                    </div>
                `;

        if (isCurrent) break; // Don't show future statuses
    }

    // Add special statuses if current
    if (['disputed', 'refunded', 'cancelled'].includes(currentStatus)) {
        const time = historyMap[currentStatus] ? new Date(historyMap[currentStatus]).toLocaleString() : '';
        html += `
                    <div class="timeline-item current">
                        <div class="timeline-dot"></div>
                        <div class="timeline-status">${statusLabels[currentStatus]}</div>
                        <div class="timeline-time">${time}</div>
                    </div>
                `;
    }

    timelineContainer.innerHTML = html;
}

async function resolveDisputeFromModal(resolution) {
    if (!currentModalDisputeId) {
        showToast('No dispute selected', 'error');
        return;
    }

    const confirmMsg = resolution === 'refund_approved'
        ? 'Are you sure you want to approve this refund?'
        : 'Are you sure you want to deny this refund?';

    if (!confirm(confirmMsg)) return;

    await resolveDispute(currentModalDisputeId, resolution, true); // skipConfirm since we already confirmed
    closeOrderModal();
}


let isResolvingDispute = false;

async function resolveDispute(disputeId, resolution, skipConfirm = false) {
    if (isResolvingDispute) return; // Prevent double-clicks

    if (!skipConfirm) {
        const confirmMsg = resolution === 'refund_approved'
            ? 'Are you sure you want to approve this refund?'
            : 'Are you sure you want to deny this refund?';
        if (!confirm(confirmMsg)) return;
    }

    isResolvingDispute = true;

    // Disable buttons and show loading state
    const approveBtn = document.getElementById(`approveBtn-${disputeId}`);
    const denyBtn = document.getElementById(`denyBtn-${disputeId}`);
    const originalApproveHtml = approveBtn?.innerHTML;
    const originalDenyHtml = denyBtn?.innerHTML;

    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
    }
    if (denyBtn) {
        denyBtn.disabled = true;
    }

    try {
        const res = await fetch(`${API_URL}/operations/disputes/${disputeId}/resolve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution })
        });

        const data = await res.json();

        if (res.ok) {
            let msg = resolution === 'refund_approved'
                ? 'Refund approved successfully'
                : 'Refund denied successfully';

            // Add payout action feedback if available
            if (data.payout_action) {
                const actionMsg = {
                    cancelled: '• Garage payout cancelled',
                    released: '• Garage payout released for processing',
                    reversal_created: `• Reversal of ${data.payout_action.reversal_amount} QAR created`
                };
                if (actionMsg[data.payout_action.action]) {
                    msg += '\n' + actionMsg[data.payout_action.action];
                }
            }

            showToast(msg, 'success');
            loadDisputes(); // Reload to show updated status
            loadStats();
        } else {
            console.error('Resolve dispute error:', data);
            showToast(data.error || 'Failed to resolve dispute', 'error');
            // Re-enable buttons on error
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.innerHTML = originalApproveHtml;
            }
            if (denyBtn) {
                denyBtn.disabled = false;
                denyBtn.innerHTML = originalDenyHtml;
            }
        }
    } catch (err) {
        console.error('Resolve dispute network error:', err);
        showToast('Connection error. Please try again.', 'error');
        // Re-enable buttons on network error
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = originalApproveHtml;
        }
        if (denyBtn) {
            denyBtn.disabled = false;
        }
    } finally {
        isResolvingDispute = false;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('opsToken');
    token = null;
    if (socket) socket.disconnect();
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    showToast('Logged out successfully', 'success');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'exclamation-triangle'}"></i> ${message}`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== DELIVERY MANAGEMENT =====
let deliveryMap = null;
let deliveryMarkers = {};

async function loadActiveDeliveries() {
    try {
        const res = await fetch(`${API_URL}/delivery/active`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.deliveries && data.deliveries.length > 0) {
            renderActiveDeliveries(data.deliveries);
            initDeliveryMap(data.deliveries);
        } else {
            document.getElementById('activeDeliveriesTable').innerHTML = `
                        <tr>
                            <td colspan="6" class="empty-state">
                                <i class="bi bi-truck"></i>
                                <p>No active deliveries</p>
                            </td>
                        </tr>
                    `;
        }
    } catch (err) {
        console.error('Failed to load active deliveries:', err);
    }
}

function renderActiveDeliveries(deliveries) {
    const tbody = document.getElementById('activeDeliveriesTable');
    tbody.innerHTML = deliveries.map(d => `
                <tr>
                    <td>${d.order_number}</td>
                    <td>
                        ${d.driver_name ? `
                            <strong>${d.driver_name}</strong><br>
                            <span style="color: var(--text-muted); font-size: 12px;">${d.vehicle_type || ''} - ${d.vehicle_plate || ''}</span>
                        ` : `
                            <em style="color: var(--warning);">No driver assigned</em><br>
                            <span style="font-size: 11px; color: var(--danger);">Needs assignment!</span>
                        `}
                    </td>
                    <td>
                        ${d.customer_name}<br>
                        <a href="tel:${d.customer_phone}" style="color: var(--accent); font-size: 12px;">${d.customer_phone}</a>
                    </td>
                    <td><span class="status-badge ${d.order_status || d.assignment_status}">${d.order_status || d.assignment_status || 'in_transit'}</span></td>
                    <td>
                        ${d.current_lat && d.current_lng ?
            `<span style="color: var(--success);"><i class="bi bi-geo-alt-fill"></i> ${parseFloat(d.current_lat).toFixed(4)}, ${parseFloat(d.current_lng).toFixed(4)}</span>`
            : '<span style="color: var(--text-muted);">No GPS</span>'}
                    </td>
                    <td>
                        ${d.assignment_id ? `
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button class="btn btn-sm" onclick="markAsDelivered('${d.assignment_id}', '${d.order_number}')" 
                                        style="padding: 4px 8px; font-size: 11px; background: var(--success);">
                                    <i class="bi bi-check-circle"></i> Delivered
                                </button>
                                <button class="btn btn-sm" onclick="openReassignModal('${d.assignment_id}', '${d.order_number}', '${d.driver_name || ''}')" 
                                        style="padding: 4px 8px; font-size: 11px; background: var(--warning); color: #000;"
                                        title="Emergency driver reassignment">
                                    <i class="bi bi-arrow-left-right"></i> Reassign
                                </button>
                                <button class="btn btn-sm" onclick="openLocationModal('${d.assignment_id}', '${d.order_number}')" 
                                        style="padding: 4px 8px; font-size: 11px; background: var(--accent);">
                                    <i class="bi bi-geo-alt"></i> GPS
                                </button>
                            </div>
                        ` : `
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button class="btn btn-sm" onclick="markOrderDelivered('${d.order_id}', '${d.order_number}')" 
                                        style="padding: 4px 8px; font-size: 11px; background: var(--success);">
                                    <i class="bi bi-check-circle"></i> Delivered
                                </button>
                                <button class="btn btn-sm" onclick="openDriverAssignModal('${d.order_id}', ${JSON.stringify(d).replace(/"/g, '&quot;')})" 
                                        style="padding: 4px 8px; font-size: 11px; background: var(--accent);">
                                    <i class="bi bi-person-plus"></i> Assign
                                </button>
                            </div>
                        `}
                    </td>
                </tr>
            `).join('');
}

function initDeliveryMap(deliveries) {
    const container = document.getElementById('deliveryMapContainer');
    if (!container || !window.L) return;

    // Initialize map if not exists
    if (!deliveryMap) {
        deliveryMap = L.map('deliveryMapContainer').setView([25.2854, 51.5310], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18
        }).addTo(deliveryMap);
    }

    // Clear existing markers
    Object.values(deliveryMarkers).forEach(m => m.remove());
    deliveryMarkers = {};

    // Add markers for each delivery
    deliveries.forEach(d => {
        if (d.current_lat && d.current_lng) {
            const icon = L.divIcon({
                className: 'driver-marker',
                html: `<div style="width: 36px; height: 36px; background: #8D1B3D; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); border: 3px solid white;">
                            <span style="font-size: 18px;">🚚</span>
                        </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            const marker = L.marker([parseFloat(d.current_lat), parseFloat(d.current_lng)], { icon })
                .bindPopup(`
                            <strong>${d.order_number}</strong><br>
                            Driver: ${d.driver_name}<br>
                            Part: ${d.part_description}
                        `)
                .addTo(deliveryMap);

            deliveryMarkers[d.assignment_id] = marker;
        }
    });

    // Fit bounds if markers exist
    const bounds = Object.values(deliveryMarkers).map(m => m.getLatLng());
    if (bounds.length > 0) {
        deliveryMap.fitBounds(bounds.map(b => [b.lat, b.lng]), { padding: [50, 50] });
    }
}

// Mark order as delivered - THE CRITICAL MISSING FUNCTION
async function markAsDelivered(assignmentId, orderNumber) {
    if (!confirm(`Mark order ${orderNumber} as delivered?`)) return;

    try {
        const res = await fetch(`${API_URL}/delivery/assignment/${assignmentId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'delivered',
                driver_notes: 'Marked as delivered by operations'
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`✅ Order ${orderNumber} marked as delivered!`, 'success');
            // Refresh all delivery data
            await loadDeliveryData();
            await loadStats();
        } else {
            showToast(data.error || 'Failed to mark as delivered', 'error');
        }
    } catch (err) {
        console.error('markAsDelivered error:', err);
        showToast('Connection error', 'error');
    }
}

// Mark order as delivered via operations order status update (for orders without assignment)
async function markOrderDelivered(orderId, orderNumber) {
    if (!confirm(`Mark order ${orderNumber} as delivered?`)) return;

    try {
        const res = await fetch(`${API_URL}/operations/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                new_status: 'delivered',
                notes: 'Marked as delivered by operations (no driver assignment)'
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`✅ Order ${orderNumber} marked as delivered!`, 'success');
            // Refresh all delivery data
            await loadDeliveryData();
            await loadStats();
        } else {
            showToast(data.error || 'Failed to mark as delivered', 'error');
        }
    } catch (err) {
        console.error('markOrderDelivered error:', err);
        showToast('Connection error', 'error');
    }
}

function openLocationModal(assignmentId, orderNumber) {
    const lat = prompt(`Enter Latitude for ${orderNumber}:`, '25.2854');
    if (!lat) return;
    const lng = prompt(`Enter Longitude for ${orderNumber}:`, '51.5310');
    if (!lng) return;
    updateDriverLocation(assignmentId, parseFloat(lat), parseFloat(lng));
}

async function updateDriverLocation(assignmentId, lat, lng) {
    try {
        const res = await fetch(`${API_URL}/delivery/assignment/${assignmentId}/location`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lng })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Driver location updated', 'success');
            loadActiveDeliveries(); // Refresh
        } else {
            showToast(data.error || 'Failed to update location', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Safe element setter helper
function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

async function loadDeliveryStats() {
    try {
        const res = await fetch(`${API_URL}/delivery/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.stats) {
            setElementText('collectionPending', data.stats.pending_pickup || 0);
            setElementText('deliveryReady', data.stats.qc_passed || 0);
            setElementText('deliveryInTransit', data.stats.in_transit || 0);
            setElementText('deliveryAvailable', data.stats.available_drivers || 0);

            // Update delivery nav badge with total pending items
            const totalPending = (data.stats.pending_pickup || 0) + (data.stats.qc_passed || 0);
            const deliveryBadge = document.getElementById('deliveryBadge');
            if (deliveryBadge) {
                deliveryBadge.textContent = totalPending;
                deliveryBadge.style.display = totalPending > 0 ? 'flex' : 'none';
            }
        }
    } catch (e) {
        console.error('Failed to load delivery stats:', e);
    }
}

// Main function to load all delivery section data
async function loadDeliveryData() {
    await Promise.all([
        loadDeliveryStats(),
        loadCollectionOrders(),
        loadDeliveryPending(),
        loadActiveDeliveries(),
        loadDriversList(),
        loadReturns()
    ]);
}

// ============================================
// DELIVERY TAB SWITCHER
// ============================================
document.getElementById('deliveryTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    const panel = tab.dataset.panel;
    if (!panel) return;

    // Update active tab styling
    document.querySelectorAll('#deliveryTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Get all delivery content cards
    const allCards = document.querySelectorAll('#sectionDelivery .content-card');
    const statsGrid = document.querySelector('#sectionDelivery .stats-grid');

    // Panel mapping to content sections
    const panelVisibility = {
        'deliveryPanelAll': { show: 'all', hideStats: false },
        'deliveryPanelCollection': { show: [0], hideStats: true },    // Collection table
        'deliveryPanelDelivery': { show: [1], hideStats: true },      // Delivery table
        'deliveryPanelActive': { show: [2], hideStats: true },        // Active deliveries
        'deliveryPanelDrivers': { show: [3], hideStats: true },       // Drivers list
        'deliveryPanelHistory': { show: [4], hideStats: false },      // Delivery history
        'deliveryPanelReturns': { show: [5], hideStats: false }       // Returns
    };

    const config = panelVisibility[panel];
    if (!config) return;

    // Show/hide stats
    if (statsGrid) {
        statsGrid.style.display = config.hideStats ? 'none' : '';
    }

    // Show/hide content cards based on panel
    allCards.forEach((card, idx) => {
        if (config.show === 'all') {
            card.style.display = '';
        } else if (Array.isArray(config.show)) {
            card.style.display = config.show.includes(idx) ? '' : 'none';
        }
    });
});


// Load orders ready for collection from garages
async function loadCollectionOrders() {
    try {
        const res = await fetch(`${API_URL}/delivery/collection/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const table = document.getElementById('collectionTable');
        if (data.orders && data.orders.length > 0) {
            table.innerHTML = data.orders.map(o => `
                <tr>
                    <td><strong>${o.order_number}</strong></td>
                    <td>
                        ${o.garage_name}<br>
                        <span style="font-size: 11px; color: var(--text-muted);">${o.pickup_address || 'N/A'}</span>
                    </td>
                    <td>${o.part_description}</td>
                    <td>
                        <button class="btn btn-sm" onclick="collectOrder('${o.order_id}')" 
                                style="background: var(--warning); color: white; padding: 4px 10px;">
                            <i class="bi bi-box-arrow-in-down"></i> Collect
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            table.innerHTML = '<tr><td colspan="4" class="empty-state">No orders waiting for collection</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load collection orders:', err);
    }
}

// Load orders ready for delivery (QC passed)
async function loadDeliveryPending() {
    try {
        const res = await fetch(`${API_URL}/delivery/delivery/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const table = document.getElementById('deliveryPendingTable');
        if (data.orders && data.orders.length > 0) {
            table.innerHTML = data.orders.map(o => `
                <tr>
                    <td><strong>${o.order_number}</strong></td>
                    <td>
                        ${o.customer_name}<br>
                        <span style="font-size: 11px; color: var(--text-muted);">${o.customer_phone || ''}</span>
                    </td>
                    <td>
                        <span class="status-badge" style="background: ${o.part_grade === 'A' ? 'var(--success)' : o.part_grade === 'B' ? 'var(--warning)' : 'var(--danger)'};">
                            ${o.part_grade || '?'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm" onclick="openDeliveryAssignModal('${o.order_id}', '${o.order_number}')" 
                                style="background: var(--success); color: white; padding: 4px 10px;">
                            <i class="bi bi-truck"></i> Assign Driver
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            table.innerHTML = '<tr><td colspan="4" class="empty-state">No orders ready for delivery</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load delivery pending:', err);
    }
}

// Load drivers list with status toggle
async function loadDriversList() {
    try {
        const res = await fetch(`${API_URL}/delivery/drivers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const table = document.getElementById('driversTable');
        if (data.drivers && data.drivers.length > 0) {
            table.innerHTML = data.drivers.map(d => {
                const statusColor = d.status === 'available' ? 'var(--success)' : d.status === 'busy' ? 'var(--warning)' : 'var(--text-muted)';
                const statusIcon = d.status === 'available' ? 'bi-check-circle-fill' : d.status === 'busy' ? 'bi-hourglass-split' : 'bi-pause-circle';
                return `
                    <tr>
                        <td>
                            <strong>${d.full_name}</strong><br>
                            <span style="font-size: 11px; color: var(--text-muted);">${d.vehicle_type || 'Car'} - ${d.vehicle_plate || 'N/A'}</span>
                        </td>
                        <td>
                            <span style="color: ${statusColor};">
                                <i class="bi ${statusIcon}"></i> ${d.status}
                            </span>
                        </td>
                        <td>
                            ${d.status === 'available' ? `
                                <button class="btn btn-sm" onclick="toggleDriverStatus('${d.driver_id}', 'busy')" 
                                        style="padding: 2px 8px; font-size: 11px; background: var(--warning); color: white;" title="Mark as Busy">
                                    <i class="bi bi-pause-circle"></i>
                                </button>
                            ` : d.status === 'busy' ? `
                                <button class="btn btn-sm" onclick="toggleDriverStatus('${d.driver_id}', 'available')" 
                                        style="padding: 2px 8px; font-size: 11px; background: var(--success); color: white;" title="Mark as Available">
                                    <i class="bi bi-play-fill"></i>
                                </button>
                            ` : d.status === 'offline' ? `
                                <button class="btn btn-sm" onclick="toggleDriverStatus('${d.driver_id}', 'available')" 
                                        style="padding: 2px 8px; font-size: 11px; background: var(--success); color: white;" title="Mark as Available">
                                    <i class="bi bi-play-fill"></i>
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            table.innerHTML = '<tr><td colspan="3" class="empty-state">No drivers added</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load drivers:', err);
    }
}

// Collect order from garage - show driver assignment modal
async function collectOrder(orderId) {
    // Load available drivers
    let driversHtml = '<option value="">-- No drivers available --</option>';
    let hasDrivers = false;
    try {
        const res = await fetch(`${API_URL}/delivery/drivers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Filter for available drivers
        const drivers = (data.drivers || []).filter(d => d.status === 'available');
        if (drivers.length > 0) {
            hasDrivers = true;
            driversHtml = '<option value="">-- Select a driver --</option>' + drivers.map(d => `
                <option value="${d.driver_id}">${d.full_name} (${d.vehicle_type || 'Car'} - ${d.vehicle_plate || 'N/A'})</option>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load drivers:', err);
    }

    // Show modal
    const modal = document.createElement('div');
    modal.id = 'collectOrderModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
                <h3><i class="bi bi-box-arrow-in-down"></i> Collect Order from Garage</h3>
                <button class="modal-close" onclick="document.getElementById('collectOrderModal').remove()" style="color: white;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin-bottom: 15px; color: var(--text-secondary);">Assign a driver to collect this order from the garage.</p>
                <label style="font-weight: 600; margin-bottom: 8px; display: block;">Select Driver:</label>
                <select id="collectOrderDriverSelect" class="form-control" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    ${driversHtml}
                </select>
                ${!hasDrivers ? '<p style="color: var(--danger); font-size: 12px; margin-top: 8px;"><i class="bi bi-exclamation-triangle"></i> No drivers available. Please add drivers first.</p>' : ''}
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-ghost" onclick="document.getElementById('collectOrderModal').remove()">Cancel</button>
                <button class="btn btn-primary" id="confirmCollectOrderBtn" onclick="submitCollectOrder('${orderId}')" style="background: linear-gradient(135deg, #f59e0b, #d97706);" ${!hasDrivers ? 'disabled' : ''}>
                    <i class="bi bi-check-lg"></i> Collect Order
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Submit collect order with driver
async function submitCollectOrder(orderId) {
    const driverId = document.getElementById('collectOrderDriverSelect').value;
    if (!driverId) {
        showToast('Please select a driver', 'error');
        return;
    }

    const btn = document.getElementById('confirmCollectOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Collecting...';

    try {
        const res = await fetch(`${API_URL}/delivery/collect/${orderId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                driver_id: driverId,
                notes: 'Collected by assigned driver'
            })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`📦 Order ${data.order_number || ''} collected!`, 'success');
            document.getElementById('collectOrderModal').remove();
            loadDeliveryData();
            loadStats();
            loadOrders();
        } else {
            showToast(data.error || 'Failed to collect order', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Collect Order';
        }
    } catch (err) {
        showToast('Connection error', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Collect Order';
    }
}

// Toggle driver status
async function toggleDriverStatus(driverId, newStatus) {
    try {
        const res = await fetch(`${API_URL}/delivery/drivers/${driverId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Driver set to ${newStatus}`, 'success');
            loadDriversList();
            loadDeliveryStats();
        } else {
            showToast(data.error || 'Failed to update driver', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Open modal to assign driver for delivery
async function openDeliveryAssignModal(orderId, orderNumber) {
    // Load available drivers
    let driversHtml = '<option value="">-- No drivers available --</option>';
    try {
        const res = await fetch(`${API_URL}/delivery/drivers?status=available`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const drivers = (data.drivers || []).filter(d => d.status === 'available');
        if (drivers.length > 0) {
            driversHtml = drivers.map(d => `
                <option value="${d.driver_id}">${d.full_name} (${d.vehicle_type || 'Car'} - ${d.vehicle_plate || 'N/A'})</option>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load drivers:', err);
    }

    const modal = document.createElement('div');
    modal.id = 'deliveryAssignModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h3><i class="bi bi-truck"></i> Assign Delivery Driver</h3>
                <button class="modal-close" onclick="document.getElementById('deliveryAssignModal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin-bottom: 15px;">Order: <strong>${orderNumber}</strong></p>
                <label style="font-weight: 600; margin-bottom: 8px; display: block;">Select Driver:</label>
                <select id="deliveryDriverSelect" class="form-control" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    ${driversHtml}
                </select>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-ghost" onclick="document.getElementById('deliveryAssignModal').remove()">Cancel</button>
                <button class="btn btn-primary" id="confirmDeliveryBtn" onclick="submitDeliveryAssignment('${orderId}')" style="background: var(--success);">
                    <i class="bi bi-check-lg"></i> Assign & Start Delivery
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Submit delivery assignment
async function submitDeliveryAssignment(orderId) {
    const driverId = document.getElementById('deliveryDriverSelect').value;
    if (!driverId) {
        showToast('Please select a driver', 'error');
        return;
    }

    const btn = document.getElementById('confirmDeliveryBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Assigning...';

    try {
        const res = await fetch(`${API_URL}/delivery/assign/${orderId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ driver_id: driverId })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Driver assigned! Delivery started.', 'success');
            document.getElementById('deliveryAssignModal').remove();
            loadDeliveryData();
            loadStats();
        } else {
            showToast(data.error || 'Failed to assign driver', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Assign & Start Delivery';
        }
    } catch (err) {
        showToast('Connection error', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Assign & Start Delivery';
    }
}

// ===== USER MANAGEMENT =====
let allUsers = [];

async function loadUsers() {
    try {
        // Load user stats
        const statsRes = await fetch(`${API_URL}/operations/users/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await statsRes.json();

        if (statsData.stats) {
            document.getElementById('totalUsers').textContent = statsData.stats.total_customers || 0;
            document.getElementById('totalGarages').textContent = statsData.stats.total_garages || 0;
            document.getElementById('newUsersThisMonth').textContent = statsData.stats.new_this_month || 0;
            document.getElementById('suspendedUsers').textContent = statsData.stats.suspended || 0;
        }

        // Load users list
        const usersRes = await fetch(`${API_URL}/operations/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usersData = await usersRes.json();

        if (usersData.users) {
            allUsers = usersData.users;
            renderUsersTable(allUsers);
        }

        // Load garages
        loadGarages();
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.full_name || '-'}</td>
            <td>${u.phone_number}</td>
            <td><span class="badge ${u.user_type}">${u.user_type}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
                <span class="status-badge ${u.is_active ? 'active' : 'suspended'}">
                    ${u.is_active ? 'Active' : 'Suspended'}
                </span>
            </td>
            <td>
                ${u.is_active ?
            `<button class="btn btn-sm btn-danger" onclick="suspendUser('${u.user_id}')">
                        <i class="bi bi-ban"></i> Suspend
                    </button>` :
            `<button class="btn btn-sm btn-success" onclick="activateUser('${u.user_id}')">
                        <i class="bi bi-check"></i> Activate
                    </button>`
        }
            </td>
        </tr>
    `).join('');
}

function searchUsers() {
    const query = document.getElementById('userSearchInput').value.toLowerCase();
    const filtered = allUsers.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(query)) ||
        (u.phone_number && u.phone_number.includes(query))
    );
    renderUsersTable(filtered);
}

async function loadGarages() {
    try {
        const res = await fetch(`${API_URL}/operations/garages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('garagesTable');

        if (!data.garages || data.garages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No garages found</td></tr>';
            return;
        }

        tbody.innerHTML = data.garages.map(g => `
            <tr>
                <td><strong>${g.garage_name}</strong></td>
                <td>${g.owner_name || '-'}</td>
                <td>
                    ${g.average_rating ?
                `<span class="rating"><i class="bi bi-star-fill"></i> ${parseFloat(g.average_rating).toFixed(1)}</span>` :
                '<span class="text-muted">No ratings</span>'
            }
                </td>
                <td>${g.total_orders || 0}</td>
                <td>
                    <span class="badge ${g.subscription_status || 'none'}">
                        ${g.plan_name || 'No Plan'}
                    </span>
                </td>
                <td>
                    ${g.is_verified ?
                `<span class="status-badge verified"><i class="bi bi-patch-check"></i> Verified</span>` :
                `<button class="btn btn-sm btn-primary" onclick="verifyGarage('${g.garage_id}')">
                            <i class="bi bi-patch-check"></i> Verify
                        </button>`
            }
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load garages:', err);
    }
}


async function verifyGarage(garageId) {
    try {
        const res = await fetch(`${API_URL}/operations/garages/${garageId}/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Garage verified!', 'success');
            loadGarages();
        }
    } catch (err) {
        showToast('Failed to verify garage', 'error');
    }
}

// ===== FINANCE MANAGEMENT =====
async function loadFinance() {
    try {
        // Load finance stats
        const statsRes = await fetch(`${API_URL}/finance/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await statsRes.json();

        if (statsData.stats) {
            const s = statsData.stats;
            document.getElementById('financeTotalRevenue').textContent = `${s.total_revenue || 0} QAR`;
            document.getElementById('financePendingPayouts').textContent = `${s.pending_payouts || 0} QAR`;
            document.getElementById('financeProcessingPayouts').textContent = `${s.processing_payouts || 0} QAR`;
            document.getElementById('financeCompletedPayouts').textContent = `${s.completed_payouts || 0} QAR`;
        }

        // Load pending payouts
        loadPendingPayouts();
        loadTransactions();
    } catch (err) {
        console.error('Failed to load finance data:', err);
    }
}

// Pagination state for finance
let currentPendingPayoutsPage = 1;
const PENDING_PAYOUTS_PER_PAGE = 20;

async function loadPendingPayouts(page = 1) {
    currentPendingPayoutsPage = page;
    try {
        const res = await fetch(`${API_URL}/finance/payouts?status=pending,on_hold&page=${page}&limit=${PENDING_PAYOUTS_PER_PAGE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('pendingPayoutsTable');

        if (!data.payouts || data.payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No pending payouts</td></tr>';
            document.getElementById('pendingPayoutsPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = data.payouts.map(p => {
            const isHeld = p.payout_status === 'on_hold' || p.payout_status === 'hold';
            const reason = (p.failure_reason || 'No reason').replace(/"/g, '&quot;');
            const statusBadge = isHeld
                ? `<span class="badge badge-warning" title="${reason}" style="background-color: #f59e0b; color: white;">On Hold</span>`
                : '<span class="badge badge-info">Pending</span>';

            const rowStyle = isHeld ? 'background-color: #fff7ed !important; border-left: 4px solid #f59e0b;' : '';

            return `
            <tr style="${rowStyle}">
                <td>
                    <strong>${p.garage_name || '-'}</strong>
                    ${isHeld ? `<div style="font-size: 11px; color: #d97706; margin-top: 4px; font-weight: 600;"><i class="bi bi-exclamation-triangle-fill"></i> ${reason}</div>` : ''}
                </td>
                <td>${p.order_number || '-'}</td>
                <td>${parseFloat(p.gross_amount).toLocaleString()} QAR</td>
                <td>${parseFloat(p.commission_amount).toLocaleString()} QAR</td>
                <td><strong>${parseFloat(p.net_amount).toLocaleString()} QAR</strong></td>
                <td>
                    ${statusBadge}
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        ${p.scheduled_for ? new Date(p.scheduled_for).toLocaleDateString() : '-'}
                    </div>
                </td>
                <td>
                    ${isHeld ? `
                        <button class="btn btn-sm" onclick="releasePayout('${p.payout_id}')" title="Release Hold" style="background-color: #059669; color: white; border: none; padding: 6px 12px; font-weight: 600;">
                            <i class="bi bi-play-fill"></i> Release
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-success" onclick="openSendPaymentModal('${p.payout_id}', '${p.garage_name || ''}', '${p.order_number || ''}', ${p.net_amount})">
                            <i class="bi bi-send-check"></i> Send
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="holdPayout('${p.payout_id}')" title="Put on hold">
                            <i class="bi bi-pause"></i>
                        </button>
                    `}
                </td>
            </tr>
            `;
        }).join('');

        // Render pagination controls
        // Note: data returned from getPayouts includes page, limit, total. 
        // We construct pagination object manually if needed or use data directly if it matches the format.
        // The backend returns: { payouts: [], total: number, page: number, limit: number }
        // Our utility expects { page, pages, total, limit } or similar.
        // Actually utility expects { page, pages, total }
        const pages = Math.ceil(data.total / PENDING_PAYOUTS_PER_PAGE);
        if (pages > 1) {
            renderPagination('pendingPayoutsPagination', {
                page: Number(data.page),
                pages: pages,
                total: data.total
            }, 'loadPendingPayouts');
        } else {
            document.getElementById('pendingPayoutsPagination').innerHTML = '';
        }

    } catch (err) {
        console.error('Failed to load pending payouts:', err);
    }
}

// ==========================================
// UNIFIED DISPUTES MODULE
// Handles both Order Disputes (customer) and Payment Disputes (garage)
// ==========================================

let currentDisputeTab = 'order'; // 'order' or 'payment'

async function loadDisputes() {
    // Load stats
    await loadDisputeStats();

    // Load current tab data
    if (currentDisputeTab === 'order') {
        await loadOrderDisputes();
    } else {
        await loadPaymentDisputesData();
    }
}

async function loadDisputeStats() {
    try {
        // Get order disputes count
        const orderRes = await fetch(`${API_URL}/operations/disputes?status=pending&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orderData = await orderRes.json();

        // Get payment disputes count
        const paymentRes = await fetch(`${API_URL}/finance/payouts?status=disputed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const paymentData = await paymentRes.json();

        const orderCount = orderData.pagination?.total || 0;
        const paymentCount = paymentData.payouts?.length || 0;
        const totalOpen = orderCount + paymentCount;

        // Update stats
        document.getElementById('disputesTotalOpen').textContent = totalOpen;
        document.getElementById('disputesOrderCount').textContent = orderCount;
        document.getElementById('disputesPaymentCount').textContent = paymentCount;

        // Update nav badge
        const badge = document.getElementById('disputesBadge');
        if (badge) {
            badge.textContent = totalOpen;
            badge.style.display = totalOpen > 0 ? 'inline-block' : 'none';
        }

        // Update tab badges
        document.getElementById('orderDisputesTabBadge').textContent = orderCount;
        document.getElementById('paymentDisputesTabBadge').textContent = paymentCount;
    } catch (err) {
        console.error('Failed to load dispute stats:', err);
    }
}

async function loadOrderDisputes() {
    const tbody = document.getElementById('orderDisputesTable');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading...</td></tr>';

        const res = await fetch(`${API_URL}/operations/disputes?status=pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        const disputes = data.disputes || [];

        if (disputes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-check-circle" style="font-size: 32px; color: var(--success);"></i><p>No pending order disputes</p></td></tr>';
            return;
        }

        tbody.innerHTML = disputes.map(d => `
            <tr>
                <td><strong>${d.order_number || '-'}</strong></td>
                <td>${d.customer_name || 'Customer'}</td>
                <td>${d.part_description?.substring(0, 30) || '-'}${d.part_description?.length > 30 ? '...' : ''}</td>
                <td><span class="badge badge-warning">${(d.reason || '').replace(/_/g, ' ')}</span></td>
                <td><strong style="color: var(--accent);">${parseFloat(d.refund_amount || 0).toLocaleString()} QAR</strong></td>
                <td>${d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-sm btn-success" onclick="resolveOrderDisputeAction('${d.dispute_id}', 'refund_approved', ${d.refund_amount || 0})" title="Approve Refund">
                            <i class="bi bi-check-lg"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="resolveOrderDisputeAction('${d.dispute_id}', 'refund_declined', 0)" title="Reject Dispute">
                            <i class="bi bi-x-lg"></i> Reject
                        </button>
                    </div>
                </td>
            </tr>
            `).join('');
    } catch (err) {
        console.error('Failed to load order disputes:', err);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color: var(--danger);">Error: ${err.message}</td></tr>`;
    }
}

async function loadPaymentDisputesData() {
    const tbody = document.getElementById('paymentDisputesTable');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Loading...</td></tr>';

        const res = await fetch(`${API_URL}/finance/payouts?status=disputed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        const payouts = data.payouts || [];

        if (payouts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle" style="font-size: 32px; color: var(--success);"></i><p>No payment disputes</p></td></tr>';
            return;
        }

        tbody.innerHTML = payouts.map(p => `
            <tr style="background: rgba(239, 68, 68, 0.03);">
                <td><strong>${p.garage_name || '-'}</strong></td>
                <td>${p.order_number || '-'}</td>
                <td><strong style="color: var(--danger);">${parseFloat(p.net_amount).toLocaleString()} QAR</strong></td>
                <td style="max-width: 200px;">
                    <span title="${(p.failure_reason || '').replace(/"/g, '&quot;')}" style="color: var(--text-secondary); font-size: 13px;">
                        ${(p.failure_reason || 'No reason').substring(0, 40)}${(p.failure_reason || '').length > 40 ? '...' : ''}
                    </span>
                </td>
                <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-sm btn-success" onclick="resolvePaymentDisputeAction('${p.payout_id}', 'resent_payment', '${p.net_amount}')" title="Resend Payment">
                            <i class="bi bi-arrow-repeat"></i> Resend
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="resolvePaymentDisputeAction('${p.payout_id}', 'confirmed_received', '${p.net_amount}')" title="Mark as Received">
                            <i class="bi bi-check-lg"></i> Confirmed
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="resolvePaymentDisputeAction('${p.payout_id}', 'cancelled', '${p.net_amount}')" title="Cancel">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `).join('');
    } catch (err) {
        console.error('Failed to load payment disputes:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color: var(--danger);">Error: ${err.message}</td></tr>`;
    }
}

function switchDisputeTab(tab) {
    currentDisputeTab = tab;

    // Update tab styles
    document.querySelectorAll('.dispute-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-dispute-tab="${tab}"]`).classList.add('active');

    // Show/hide tables
    document.getElementById('orderDisputesPanel').style.display = tab === 'order' ? 'block' : 'none';
    document.getElementById('paymentDisputesPanel').style.display = tab === 'payment' ? 'block' : 'none';

    // Load data
    if (tab === 'order') {
        loadOrderDisputes();
    } else {
        loadPaymentDisputesData();
    }
}

async function resolveOrderDisputeAction(disputeId, resolution, refundAmount) {
    const resolutionLabels = {
        refund_approved: `Approve refund of ${refundAmount} QAR to customer ? `,
        refund_declined: 'Reject this dispute? Customer will not receive a refund.'
    };

    if (!confirm(resolutionLabels[resolution] || 'Proceed?')) return;

    const notes = prompt('Add resolution notes (optional):') || '';

    try {
        const res = await fetch(`${API_URL}/operations/disputes/${disputeId}/resolve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resolution: resolution,
                refund_amount: refundAmount,
                notes: notes
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Dispute resolved successfully', 'success');
            loadDisputes();
        } else {
            showToast(data.error || 'Failed to resolve dispute', 'error');
        }
    } catch (err) {
        console.error('Resolve order dispute error:', err);
        showToast('Failed to resolve dispute', 'error');
    }
}

async function resolvePaymentDisputeAction(payoutId, resolution, amount) {
    const resolutionLabels = {
        resent_payment: `Resend payment of ${amount} QAR ? (Garage will need to confirm again)`,
        confirmed_received: 'Mark as received? (Garage already confirmed they got it)',
        cancelled: 'Cancel this payout permanently?'
    };

    if (!confirm(resolutionLabels[resolution] || 'Proceed?')) return;

    const notes = prompt('Add resolution notes (optional):') || '';

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/resolve-dispute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resolution: resolution,
                notes: notes,
                resend_payment: resolution === 'resent_payment'
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Payment dispute resolved: ${resolution.replace(/_/g, ' ')}`, 'success');
            loadDisputes();
        } else {
            showToast(data.error || 'Failed to resolve dispute', 'error');
        }
    } catch (err) {
        console.error('Resolve payment dispute error:', err);
        showToast('Failed to resolve dispute', 'error');
    }
}

// ==========================================
// SEND PAYMENT MODAL FUNCTIONS
// ==========================================

function openSendPaymentModal(payoutId, garageName, orderNumber, amount) {
    document.getElementById('spPayoutId').value = payoutId;
    document.getElementById('spGarageName').textContent = garageName || 'Unknown';
    document.getElementById('spOrderNumber').textContent = orderNumber || '-';
    document.getElementById('spAmount').textContent = parseFloat(amount).toLocaleString() + ' QAR';

    // Reset form
    document.getElementById('spPaymentMethod').value = '';
    document.getElementById('spReference').value = '';
    document.getElementById('spNotes').value = '';

    document.getElementById('sendPaymentModal').classList.add('active');
}

function closeSendPaymentModal() {
    document.getElementById('sendPaymentModal').classList.remove('active');
}

async function submitSendPayment() {
    const payoutId = document.getElementById('spPayoutId').value;
    const method = document.getElementById('spPaymentMethod').value;
    const reference = document.getElementById('spReference').value;
    const notes = document.getElementById('spNotes').value;

    if (!method) {
        showToast('Please select a payment method', 'error');
        return;
    }

    if (!reference) {
        showToast('Please enter a reference number', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                payout_method: method,
                payout_reference: reference,
                notes: notes
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('✅ Payment marked as sent! Awaiting garage confirmation.', 'success');
            closeSendPaymentModal();
            loadPendingPayouts();
            loadFinance();
        } else {
            showToast(data.error || 'Failed to send payment', 'error');
        }
    } catch (err) {
        console.error('Send payment error:', err);
        showToast('Failed to send payment', 'error');
    }
}


// Pagination state for transactions
let currentTransactionsPage = 1;
const TRANSACTIONS_PER_PAGE = 20;

async function loadTransactions(page = 1) {
    currentTransactionsPage = page;
    try {
        const res = await fetch(`${API_URL}/finance/transactions?page=${page}&limit=${TRANSACTIONS_PER_PAGE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('transactionsTable');

        if (!data.transactions || data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions yet</td></tr>';
            document.getElementById('transactionsPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = data.transactions.map(t => {
            // Robust check for held status - normalize to lowercase and remove spaces/underscores
            const statusNorm = (t.status || '').toLowerCase().replace(/[\s_-]/g, '');
            const isHeld = statusNorm === 'onhold' || statusNorm === 'hold';
            const rowStyle = isHeld ? 'background-color: #fff7ed !important; border-left: 4px solid #f59e0b;' : '';
            const statusBadge = isHeld
                ? `<span class="badge badge-warning" style="background-color: #f59e0b; color: white;">On Hold</span>`
                : `<span class="status-badge ${t.status}">${t.status}</span>`;

            return `
            <tr style="${rowStyle}">
                <td>${new Date(t.created_at).toLocaleDateString()}
                    <div style="font-size: 11px; color: var(--text-muted);">${new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td><span class="badge ${t.transaction_type}">${t.transaction_type}</span></td>
                <td>${t.order_number || '-'}</td>
                <td>${t.garage_name || '-'}</td>
                <td><strong>${t.amount} QAR</strong></td>
                <td>
                    ${statusBadge}
                    ${isHeld ? `
                        <div style="margin-top: 5px;">
                            <button class="btn btn-sm" onclick="releasePayout('${t.id}')" title="Release Hold" style="background-color: #059669; color: white; border: none; padding: 4px 10px; font-weight: 600; font-size: 11px;">
                                <i class="bi bi-play-fill"></i> Release
                            </button>
                        </div>
                    ` : ''}
                </td>
            </tr>
        `;
        }).join('');

        // Render pagination controls
        if (data.pagination) {
            renderPagination('transactionsPagination', data.pagination, 'loadTransactions');
        } else {
            document.getElementById('transactionsPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load transactions:', err);
    }
}

async function processPayout(payoutId) {
    if (!confirm('Process this payout?')) return;
    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/process`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Payout processed!', 'success');
            loadFinance();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to process payout', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function holdPayout(payoutId) {
    const reason = prompt('Reason for holding payout:');
    if (!reason) return;

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/hold`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        if (res.ok) {
            showToast('Payout held', 'success');
            loadFinance();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to hold payout', 'error');
        }
    } catch (err) {
        showToast('Failed to hold payout', 'error');
    }
}

async function releasePayout(payoutId) {
    if (!confirm('Release this payout back to pending status?')) return;

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/release`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (res.ok) {
            showToast('Payout released', 'success');
            loadFinance();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to release payout', 'error');
        }
    } catch (err) {
        showToast('Failed to release payout', 'error');
    }
}

// ============================================
// SUPPORT TICKET LOGIC (OPERATIONS)
// ============================================

let activeOpsTicketId = null;

async function loadOpsTickets() {
    try {
        const res = await fetch(`${API_URL}/support/tickets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Handle paginated response format {tickets: [...]} or legacy array format
        const tickets = Array.isArray(data) ? data : (data.tickets || []);
        const container = document.getElementById('supportTicketList');

        if (tickets.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No active tickets</div>';
            return;
        }

        container.innerHTML = tickets.map(t => {
            const lastMsg = t.last_message ? t.last_message.message_text || t.last_message : 'No messages';
            const activeClass = activeOpsTicketId === t.ticket_id ? 'active' : '';
            return `
            <div class="ticket-item ${activeClass}" onclick="viewOpsTicket('${t.ticket_id}', '${escapeHTML(t.subject || '')}', '${escapeHTML(t.customer_name || '')}', '${t.status}', '${t.order_id || ''}')">
                <div class="ticket-header">
                    <span class="ticket-subject">${escapeHTML(t.subject || 'No Subject')}</span>
                    <span class="ticket-status status-${t.status}">${t.status}</span>
                </div>
                <div class="ticket-meta">
                    <span>${escapeHTML(t.customer_name || 'Unknown')}</span>
                    <span>${new Date(t.created_at).toLocaleDateString()}</span>
                </div>
                <div class="ticket-preview">${escapeHTML(String(lastMsg).slice(0, 50))}</div>
                ${t.order_id ? `<div class="ticket-meta" style="margin-top: 4px; color: var(--accent);"><i class="bi bi-box-seam"></i> Order #${t.order_id.substring(0, 8)}</div>` : ''}
            </div>
            `;
        }).join('');

        // Update support badge
        updateBadge('supportBadge', tickets.filter(t => t.status === 'open').length);

    } catch (err) {
        console.error('Failed to load tickets:', err);
        showToast('Failed to load tickets', 'error');
    }
}

async function viewOpsTicket(ticketId, subject, customerName, status, orderId) {
    activeOpsTicketId = ticketId;
    document.getElementById('emptyChatState').style.display = 'none';
    document.getElementById('activeTicketView').style.display = 'flex';

    document.getElementById('opsTicketSubject').textContent = subject;
    document.getElementById('opsTicketCustomer').textContent = customerName;
    document.getElementById('opsTicketOrder').textContent = orderId && orderId !== 'null' ? `#${orderId.substring(0, 8)}` : 'No Order';
    document.getElementById('opsTicketStatus').value = status;

    loadOpsTicketMessages(ticketId);
    socket.emit('join_ticket', ticketId);

    // Refresh list to update active selection style
    loadOpsTickets();
}

async function loadOpsTicketMessages(ticketId) {
    const container = document.getElementById('opsChatMessages');
    container.innerHTML = '<div style="display: flex; justify-content: center; padding: 20px;"><div class="spinner"></div></div>';

    try {
        const res = await fetch(`${API_URL}/support/tickets/${ticketId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await res.json();

        container.innerHTML = messages.map(m => {
            const isAdmin = m.sender_type === 'admin';
            return `
                <div class="message ${isAdmin ? 'admin' : 'customer'}">
                    ${m.message_text}
                    <div class="message-time">
                        ${m.sender_name || (isAdmin ? 'Me' : 'Customer')} • ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        container.innerHTML = 'Failed to load messages';
    }
}

async function sendOpsMessage() {
    if (!activeOpsTicketId) return;
    const input = document.getElementById('opsChatInput');
    const message = input.value.trim();
    if (!message) return;

    try {
        const res = await fetch(`${API_URL}/support/tickets/${activeOpsTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message_text: message })
        });

        if (res.ok) {
            input.value = '';
            // New message will come via socket
        }
    } catch (err) {
        showToast('Failed to send message', 'error');
    }
}

async function updateTicketStatus(status) {
    if (!activeOpsTicketId) return;
    try {
        const res = await fetch(`${API_URL}/support/tickets/${activeOpsTicketId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            showToast('Ticket status updated', 'success');
            loadOpsTickets();
        }
    } catch (err) {
        showToast('Failed to update status', 'error');
    }
}

// Socket Listeners (Operations) - Initialize after socket is ready
function initSupportSocketListeners() {
    if (!socket) return;

    socket.on('new_ticket', (data) => {
        showToast(`New Ticket: ${data.ticket.subject}`, 'info');
        loadOpsTickets();
        if (typeof loadStats === 'function') loadStats();
    });

    socket.on('support_reply', (data) => {
        if (activeOpsTicketId === data.ticket_id) {
            showToast('New customer reply', 'info');
            loadOpsTicketMessages(data.ticket_id); // Reload messages to see update
        } else {
            showToast('New customer reply', 'info');
            loadOpsTickets();
        }
    });

    socket.on('new_message', (message) => {
        if (activeOpsTicketId === message.ticket_id) {
            const container = document.getElementById('opsChatMessages');
            const isAdmin = message.sender_type === 'admin';

            container.insertAdjacentHTML('beforeend', `
                <div class="message ${isAdmin ? 'admin' : 'customer'}">
                    ${message.message_text}
                    <div class="message-time">
                        ${isAdmin ? 'Me' : 'Customer'} • ${new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            `);
            container.scrollTop = container.scrollHeight;

            loadOpsTickets(); // Update list preview
        }
    });
}

// Monkey patch switchSection
const originalSwitchSection = window.switchSection || switchSection;
window.switchSection = function (section) {
    if (originalSwitchSection) originalSwitchSection(section);
    if (section === 'support') loadOpsTickets();
};

// ============================================
// GLOBAL SEARCH
// ============================================
let globalSearchTimeout = null;
const searchInput = document.getElementById('globalSearchInput');
const searchResultsDiv = document.getElementById('searchResults');

// Initialize search on DOM ready
if (searchInput) {
    // Debounced search
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(globalSearchTimeout);

        if (query.length < 2) {
            searchResultsDiv.style.display = 'none';
            return;
        }

        globalSearchTimeout = setTimeout(() => performGlobalSearch(query), 300);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResultsDiv.style.display = 'none';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
        // Escape to close
        if (e.key === 'Escape') {
            searchResultsDiv.style.display = 'none';
            searchInput.blur();
        }
    });

    // '/' to focus when not in input
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

async function performGlobalSearch(query) {
    try {
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.results && Object.keys(data.results).length > 0) {
            renderSearchResults(data.results);
        } else {
            searchResultsDiv.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">No results found</div>';
            searchResultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Search error:', err);
    }
}

function renderSearchResults(results) {
    let html = '';

    // Orders
    if (results.orders && results.orders.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Orders</div>`;
        html += results.orders.slice(0, 5).map(o => `
            <div class="search-result-item" onclick="viewOrder('${o.order_id}'); searchResultsDiv.style.display='none';" 
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600; color: var(--accent);">#${o.order_number}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${o.car_make} ${o.car_model} - ${o.part_description?.slice(0, 30) || ''}</div>
                </div>
                <span class="order-status ${o.order_status?.replace('_', '-') || ''}" style="font-size: 10px;">${o.order_status || ''}</span>
            </div>
        `).join('');
    }

    // Users
    if (results.users && results.users.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 8px;">Users</div>`;
        html += results.users.slice(0, 5).map(u => `
            <div class="search-result-item" onclick="switchSection('users'); searchResultsDiv.style.display='none';"
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600;">${u.full_name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${u.email} | ${u.phone_number}</div>
                </div>
                <span style="font-size: 11px; color: var(--text-muted);">${u.user_type}</span>
            </div>
        `).join('');
    }

    // Disputes
    if (results.disputes && results.disputes.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 8px;">Disputes</div>`;
        html += results.disputes.slice(0, 5).map(d => `
            <div class="search-result-item" onclick="switchSection('disputes'); searchResultsDiv.style.display='none';"
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600;">#${d.order_number}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${d.reason} - ${d.customer_name}</div>
                </div>
                <span class="status-badge ${d.status}" style="font-size: 10px;">${d.status}</span>
            </div>
        `).join('');
    }

    // Requests
    if (results.requests && results.requests.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 8px;">Requests</div>`;
        html += results.requests.slice(0, 5).map(r => `
            <div class="search-result-item"
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600;">${r.car_make} ${r.car_model}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${r.part_description?.slice(0, 40) || ''}</div>
                </div>
                <span style="font-size: 11px; color: var(--text-muted);">${r.status}</span>
            </div>
        `).join('');
    }

    searchResultsDiv.innerHTML = html;
    searchResultsDiv.style.display = 'block';
}

// ==========================================
// REPORTS MODULE
// ==========================================

let currentReportData = null;

// Initialize report dates on section load
function initReportDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('reportFromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('reportToDate').value = now.toISOString().split('T')[0];
    updateReportPreview();
}

// Update report preview based on selected options
function updateReportPreview() {
    const type = document.getElementById('reportType')?.value || 'orders';
    const from = document.getElementById('reportFromDate')?.value || '';
    const to = document.getElementById('reportToDate')?.value || '';

    const previewInfo = document.getElementById('reportPreviewInfo');
    if (previewInfo) {
        const typeLabels = {
            orders: 'Orders Report',
            revenue: 'Revenue Report',
            disputes: 'Disputes Report',
            deliveries: 'Deliveries Report',
            garages: 'Garages Performance Report'
        };
        previewInfo.innerHTML = `
            <div style="display: flex; gap: 20px; align-items: center; color: var(--text-secondary); font-size: 13px;">
                <span><i class="bi bi-file-earmark-text"></i> ${typeLabels[type] || type}</span>
                <span><i class="bi bi-calendar"></i> ${from || 'Start'} to ${to || 'End'}</span>
            </div>
        `;
    }
}

// Generate report
async function generateReport() {
    const type = document.getElementById('reportType').value;
    const from = document.getElementById('reportFromDate').value;
    const to = document.getElementById('reportToDate').value;

    if (!from || !to) {
        showToast('Please select date range', 'error');
        return;
    }

    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = '<div style="text-align: center; padding: 60px;"><div class="spinner"></div><p>Generating report...</p></div>';

    try {
        const res = await fetch(`${API_URL}/reports/${type}?from=${from}&to=${to}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            currentReportData = data;
            renderReport(type, data);
        } else {
            reportContent.innerHTML = `<div style="text-align: center; padding: 60px; color: #ef4444;"><i class="bi bi-exclamation-circle" style="font-size: 48px;"></i><p>${data.error || 'Failed to generate report'}</p></div>`;
        }
    } catch (err) {
        reportContent.innerHTML = `<div style="text-align: center; padding: 60px; color: #ef4444;"><i class="bi bi-wifi-off" style="font-size: 48px;"></i><p>Connection error</p></div>`;
    }
}

// Render report HTML
function renderReport(type, data) {
    const reportTitles = {
        orders: 'ORDERS REPORT',
        revenue: 'REVENUE REPORT',
        disputes: 'DISPUTES REPORT',
        deliveries: 'DELIVERY PERFORMANCE REPORT',
        garages: 'GARAGE PERFORMANCE REPORT'
    };

    const fromDate = new Date(data.period.from).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const toDate = new Date(data.period.to).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const generatedAt = new Date(data.generated_at).toLocaleString();

    let html = `
        <style>
            @media print {
                body * { visibility: hidden; }
                #reportContent, #reportContent * { visibility: visible; }
                #reportContent { position: absolute; left: 0; top: 0; width: 100%; }
                .no-print { display: none !important; }
                .print-page-break { page-break-before: always; }
            }
            .report-header { border-bottom: 3px solid #8D1B3D; padding-bottom: 20px; margin-bottom: 30px; }
            .report-logo { display: flex; align-items: center; gap: 12px; }
            .report-logo-icon { width: 50px; height: 50px; background: linear-gradient(135deg, #8D1B3D, #A82050); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
            .report-title { text-align: center; margin: 30px 0; }
            .report-title h1 { font-size: 28px; font-weight: 700; color: #1f2937; margin: 0; letter-spacing: 1px; }
            .report-title p { color: #6b7280; margin-top: 8px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 30px; }
            .summary-card { background: #f9fafb; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e5e7eb; }
            .summary-card .value { font-size: 28px; font-weight: 700; color: #1f2937; }
            .summary-card .label { font-size: 13px; color: #6b7280; margin-top: 4px; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            .data-table th { background: #f3f4f6; padding: 12px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
            .data-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; color: #4b5563; }
            .data-table tr:nth-child(even) { background: #f9fafb; }
            .data-table tr:hover { background: #f3f4f6; }
            .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
            .status-completed { background: #d1fae5; color: #065f46; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-cancelled { background: #fee2e2; color: #b91c1c; }
            .report-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; }
        </style>
        
        <div class="report-header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="report-logo">
                    <div class="report-logo-icon"><i class="bi bi-gear-wide-connected"></i></div>
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: #1f2937;">QScrap</div>
                        <div style="font-size: 12px; color: #6b7280;">Auto Parts Marketplace</div>
                    </div>
                </div>
                <div style="text-align: right; font-size: 12px; color: #6b7280;">
                    <div>Page 1 of 1</div>
                    <div>${generatedAt}</div>
                </div>
            </div>
        </div>
        
        <div class="report-title">
            <h1>${reportTitles[type]}</h1>
            <p>${fromDate} — ${toDate}</p>
        </div>
    `;

    // Add type-specific content
    if (type === 'orders') {
        html += renderOrdersReport(data);
    } else if (type === 'revenue') {
        html += renderRevenueReport(data);
    } else if (type === 'disputes') {
        html += renderDisputesReport(data);
    } else if (type === 'deliveries') {
        html += renderDeliveriesReport(data);
    } else if (type === 'garages') {
        html += renderGaragesReport(data);
    }

    html += `
        <div class="report-footer">
            <div>Generated by QScrap Operations Center</div>
            <div>Confidential - Internal Use Only</div>
        </div>
    `;

    document.getElementById('reportContent').innerHTML = html;
}

function renderOrdersReport(data) {
    const s = data.summary;
    return `
        <div class="summary-grid">
            <div class="summary-card">
                <div class="value">${s.total_orders || 0}</div>
                <div class="label">Total Orders</div>
            </div>
            <div class="summary-card">
                <div class="value">${s.completed_orders || 0}</div>
                <div class="label">Completed</div>
            </div>
            <div class="summary-card">
                <div class="value">${s.cancelled_orders || 0}</div>
                <div class="label">Cancelled</div>
            </div>
            <div class="summary-card">
                <div class="value">${parseFloat(s.total_revenue || 0).toLocaleString()} QAR</div>
                <div class="label">Total Revenue</div>
            </div>
        </div>
        
        <h3 style="margin: 30px 0 15px; color: #374151;"><i class="bi bi-table"></i> Order Details</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Garage</th>
                    <th>Part</th>
                    <th>Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.data.map((o, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><strong>${o.order_number || '—'}</strong></td>
                        <td>${new Date(o.created_at).toLocaleDateString()}</td>
                        <td>${o.customer_name || '—'}</td>
                        <td>${o.garage_name || '—'}</td>
                        <td>${o.part_description?.slice(0, 25) || '—'}${o.part_description?.length > 25 ? '...' : ''}</td>
                        <td><strong>${parseFloat(o.total_amount || 0).toFixed(2)} QAR</strong></td>
                        <td><span class="status-badge status-${o.order_status?.includes('cancelled') ? 'cancelled' : o.order_status === 'completed' ? 'completed' : 'pending'}">${o.order_status?.replace(/_/g, ' ') || '—'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderRevenueReport(data) {
    const s = data.summary;
    return `
        <div class="summary-grid">
            <div class="summary-card" style="background: linear-gradient(135deg, #8D1B3D, #A82050); color: white;">
                <div class="value" style="color: white;">${parseFloat(s.gross_revenue || 0).toLocaleString()} QAR</div>
                <div class="label" style="color: rgba(255,255,255,0.8);">Gross Revenue</div>
            </div>
            <div class="summary-card">
                <div class="value">${parseFloat(s.platform_revenue || 0).toLocaleString()} QAR</div>
                <div class="label">Platform Fees</div>
            </div>
            <div class="summary-card">
                <div class="value">${parseFloat(s.garage_payouts || 0).toLocaleString()} QAR</div>
                <div class="label">Garage Payouts</div>
            </div>
            <div class="summary-card">
                <div class="value">${s.total_transactions || 0}</div>
                <div class="label">Transactions</div>
            </div>
        </div>
        
        <h3 style="margin: 30px 0 15px; color: #374151;"><i class="bi bi-graph-up"></i> Daily Breakdown</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th>Platform Fees</th>
                    <th>Garage Payouts</th>
                </tr>
            </thead>
            <tbody>
                ${data.daily_breakdown.map(d => `
                    <tr>
                        <td>${new Date(d.date).toLocaleDateString()}</td>
                        <td>${d.order_count}</td>
                        <td>${parseFloat(d.revenue || 0).toFixed(2)} QAR</td>
                        <td>${parseFloat(d.platform_fees || 0).toFixed(2)} QAR</td>
                        <td>${parseFloat(d.garage_payouts || 0).toFixed(2)} QAR</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h3 style="margin: 30px 0 15px; color: #374151;"><i class="bi bi-trophy"></i> Top Performing Garages</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Garage</th>
                    <th>Orders</th>
                    <th>Earnings</th>
                </tr>
            </thead>
            <tbody>
                ${data.top_garages.map((g, i) => `
                    <tr>
                        <td><strong>#${i + 1}</strong></td>
                        <td>${g.garage_name}</td>
                        <td>${g.order_count}</td>
                        <td><strong>${parseFloat(g.total_earnings || 0).toLocaleString()} QAR</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderDisputesReport(data) {
    const s = data.summary;
    return `
        <div class="summary-grid">
            <div class="summary-card">
                <div class="value">${s.total_disputes || 0}</div>
                <div class="label">Total Disputes</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #10b981;">${s.resolved || 0}</div>
                <div class="label">Resolved</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #f59e0b;">${s.pending || 0}</div>
                <div class="label">Pending</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #ef4444;">${parseFloat(s.total_refunded || 0).toLocaleString()} QAR</div>
                <div class="label">Total Refunded</div>
            </div>
        </div>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Garage</th>
                    <th>Reason</th>
                    <th>Resolution</th>
                    <th>Refund</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.data.length > 0 ? data.data.map((d, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${d.order_number || '—'}</td>
                        <td>${d.customer_name || '—'}</td>
                        <td>${d.garage_name || '—'}</td>
                        <td>${d.dispute_reason || '—'}</td>
                        <td>${d.resolution_type || '—'}</td>
                        <td>${parseFloat(d.refund_amount || 0).toFixed(2)} QAR</td>
                        <td><span class="status-badge status-${d.status === 'resolved' ? 'completed' : 'pending'}">${d.status}</span></td>
                    </tr>
                `).join('') : '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #9ca3af;">No disputes in this period</td></tr>'}
            </tbody>
        </table>
    `;
}

function renderDeliveriesReport(data) {
    const s = data.summary;
    return `
        <div class="summary-grid">
            <div class="summary-card">
                <div class="value">${s.total_deliveries || 0}</div>
                <div class="label">Total Deliveries</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #10b981;">${s.successful_deliveries || 0}</div>
                <div class="label">Successful</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #3b82f6;">${s.in_transit || 0}</div>
                <div class="label">In Transit</div>
            </div>
            <div class="summary-card">
                <div class="value">${parseFloat(s.avg_delivery_hours || 0).toFixed(1)} hrs</div>
                <div class="label">Avg Delivery Time</div>
            </div>
        </div>
        
        <h3 style="margin: 30px 0 15px; color: #374151;"><i class="bi bi-people"></i> Driver Performance</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Driver</th>
                    <th>Total Deliveries</th>
                    <th>Completed</th>
                    <th>Avg Time (hrs)</th>
                </tr>
            </thead>
            <tbody>
                ${data.drivers.length > 0 ? data.drivers.map((d, i) => `
                    <tr>
                        <td><strong>#${i + 1}</strong></td>
                        <td>${d.driver_name}</td>
                        <td>${d.total_deliveries}</td>
                        <td>${d.completed}</td>
                        <td>${parseFloat(d.avg_hours_to_deliver || 0).toFixed(1)}</td>
                    </tr>
                `).join('') : '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #9ca3af;">No delivery data in this period</td></tr>'}
            </tbody>
        </table>
    `;
}

function renderGaragesReport(data) {
    return `
        <h3 style="margin: 0 0 20px; color: #374151;"><i class="bi bi-building"></i> All Garages Performance</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Garage</th>
                    <th>Rating</th>
                    <th>Period Orders</th>
                    <th>Period Earnings</th>
                    <th>Completion Rate</th>
                    <th>All-Time Orders</th>
                </tr>
            </thead>
            <tbody>
                ${data.data.map((g, i) => `
                    <tr>
                        <td><strong>#${i + 1}</strong></td>
                        <td><strong>${g.garage_name}</strong></td>
                        <td>${parseFloat(g.rating_average || 0).toFixed(1)} ⭐ (${g.rating_count || 0})</td>
                        <td>${g.period_orders || 0}</td>
                        <td><strong>${parseFloat(g.period_earnings || 0).toLocaleString()} QAR</strong></td>
                        <td>${g.completion_rate || 0}%</td>
                        <td>${g.total_transactions || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Print report
function printReport() {
    if (!currentReportData) {
        showToast('Please generate a report first', 'error');
        return;
    }
    window.print();
}

// Export to PDF (using browser print to PDF)
function exportPDF() {
    if (!currentReportData) {
        showToast('Please generate a report first', 'error');
        return;
    }
    showToast('Use Print dialog → Save as PDF', 'info');
    window.print();
}

// Initialize reports section on load
function loadReports() {
    initReportDates();
}


async function processAllPayouts() {
    if (!confirm('Process all pending payouts now? This will send payments to all garages with pending payouts.')) {
        return;
    }

    showToast('Processing all payouts...', 'info');

    try {
        // Get all pending payouts
        const res = await fetch(`${API_URL}/finance/payouts?status=pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.payouts || data.payouts.length === 0) {
            showToast('No pending payouts to process', 'info');
            return;
        }

        let successCount = 0;
        let failCount = 0;
        const batchId = `BATCH-${Date.now()}`;

        for (let i = 0; i < data.payouts.length; i++) {
            const payout = data.payouts[i];
            try {
                const sendRes = await fetch(`${API_URL}/finance/payouts/${payout.payout_id}/send`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        payout_method: 'bank_transfer',
                        payout_reference: `${batchId}-${i + 1}`,
                        notes: 'Bulk processed by operations'
                    })
                });

                if (sendRes.ok) {
                    successCount++;
                } else {
                    const errData = await sendRes.json();
                    console.error(`Payout ${payout.payout_id} failed:`, errData.error);
                    failCount++;
                }
            } catch (err) {
                console.error(`Payout ${payout.payout_id} error:`, err);
                failCount++;
            }
        }

        if (successCount > 0) {
            showToast(`✅ ${successCount} payment(s) sent successfully!${failCount > 0 ? ` (${failCount} failed)` : ''}`, 'success');
        } else {
            showToast('Failed to process payouts', 'error');
        }

        loadFinance(); // Refresh
    } catch (err) {
        console.error('Process all payouts error:', err);
        showToast('Failed to process payouts', 'error');
    }
}

// ========================================
// REVIEW MODERATION
// ========================================

// Pagination state
let currentReviewsPage = 1;
const REVIEWS_PER_PAGE = 20;
let currentReviewStatus = 'pending';

async function loadReviewModeration(arg1, arg2) {
    let status = currentReviewStatus;
    let page = 1;

    // Handle "page only" call from pagination (e.g. loadReviewModeration(2))
    if (typeof arg1 === 'number') {
        page = arg1;
        // status remains currentReviewStatus
    } else if (typeof arg1 === 'string') {
        // Handle "status only" or "status + page" call (e.g. loadReviewModeration('approved'))
        status = arg1;
        page = typeof arg2 === 'number' ? arg2 : 1;
    }

    currentReviewStatus = status;
    currentReviewsPage = page;
    const tbody = document.getElementById('reviewModerationTable');
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-hourglass-split"></i> Loading...</td></tr>';

    try {
        const endpoint = status === 'pending'
            ? `${API_URL}/reviews/pending?page=${page}&limit=${REVIEWS_PER_PAGE}`
            : `${API_URL}/reviews/all?status=${status}&page=${page}&limit=${REVIEWS_PER_PAGE}`;

        const res = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const reviews = data.pending_reviews || data.reviews || [];

        // Update badge
        if (status === 'pending') {
            const badge = document.getElementById('reviewModerationBadge');
            if (badge) {
                // Total count might be in pagination data if available, otherwise array length
                const count = data.pagination ? data.pagination.total : reviews.length;
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        }

        if (reviews.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No ${status} reviews</td></tr>`;
            document.getElementById('reviewsPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = reviews.map(r => `
            <tr>
                <td>${r.customer_name || 'Customer'}</td>
                <td>${r.garage_name || 'Garage'}</td>
                <td>
                    <div style="display: flex; gap: 2px;">
                        ${[1, 2, 3, 4, 5].map(i => `<i class="bi bi-star${i <= r.overall_rating ? '-fill' : ''}" style="color: #f59e0b; font-size: 12px;"></i>`).join('')}
                    </div>
                </td>
                <td style="max-width: 300px;">
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${(r.review_text || '').replace(/"/g, '&quot;')}">
                        ${r.review_text ? `"${r.review_text.substring(0, 100)}${r.review_text.length > 100 ? '...' : ''}"` : '<span style="color: var(--text-muted);">No text</span>'}
                    </div>
                </td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                    ${status === 'pending' ? `
                        <div style="display: flex; gap: 8px;">
                            <button onclick="approveReview('${r.review_id}')" class="btn-sm btn-success" title="Approve">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <button onclick="openRejectReviewModal('${r.review_id}')" class="btn-sm btn-danger" title="Reject">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    ` : `
                        <span class="badge badge-${r.moderation_status === 'approved' ? 'success' : 'danger'}">
                            ${r.moderation_status}
                        </span>
                    `}
                </td>
            </tr>
        `).join('');

        // Render pagination controls
        if (data.pagination) {
            renderPagination('reviewsPagination', data.pagination, 'loadReviewModeration');
        }
    } catch (err) {
        console.error('Load review moderation error:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color: var(--danger);">Failed to load reviews</td></tr>';
    }
}

async function approveReview(reviewId) {
    try {
        const res = await fetch(`${API_URL}/reviews/${reviewId}/moderate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'approve' })
        });

        if (res.ok) {
            showToast('Review approved and now visible', 'success');
            loadReviewModeration();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to approve', 'error');
        }
    } catch (err) {
        console.error('Approve review error:', err);
        showToast('Failed to approve review', 'error');
    }
}

function openRejectReviewModal(reviewId) {
    const reason = prompt('Enter rejection reason (required for transparency):');
    if (reason && reason.trim()) {
        rejectReview(reviewId, reason.trim());
    }
}

async function rejectReview(reviewId, reason) {
    try {
        const res = await fetch(`${API_URL}/reviews/${reviewId}/moderate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'reject', rejection_reason: reason })
        });

        if (res.ok) {
            showToast('Review rejected', 'success');
            loadReviewModeration();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to reject', 'error');
        }
    } catch (err) {
        console.error('Reject review error:', err);
        showToast('Failed to reject review', 'error');
    }
}

// Review Tabs
document.addEventListener('DOMContentLoaded', () => {
    const reviewTabs = document.getElementById('reviewTabs');
    if (reviewTabs) {
        reviewTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                reviewTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                loadReviewModeration(e.target.dataset.status);
            }
        });
    }
});

// ===== DRIVER REASSIGNMENT (Emergency) =====

// Open modal for driver reassignment
async function openReassignModal(assignmentId, orderNumber, currentDriverName) {
    // Load available drivers
    let driversHtml = '<option value="">-- No drivers available --</option>';
    try {
        const res = await fetch(`${API_URL}/delivery/drivers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const drivers = (data.drivers || []).filter(d => d.status === 'available');
        if (drivers.length > 0) {
            driversHtml = '<option value="">-- Select new driver --</option>' +
                drivers.map(d => `<option value="${d.driver_id}">${d.full_name} (${d.vehicle_type} - ${d.vehicle_plate})</option>`).join('');
        }
    } catch (err) {
        console.error('Failed to load drivers:', err);
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'reassignDriverModal';
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-primary); border-radius: 16px; padding: 24px; max-width: 450px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-arrow-left-right" style="color: var(--warning);"></i>
                    Emergency Reassignment
                </h3>
                <button onclick="document.getElementById('reassignDriverModal').remove()" 
                        style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary);">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>

            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Order</div>
                <div style="font-size: 16px; font-weight: 600;">${orderNumber}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                    Current driver: <strong>${currentDriverName || 'None'}</strong>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500;">New Driver</label>
                <select id="reassignDriverSelect" style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                    ${driversHtml}
                </select>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500;">
                    Reason <span style="color: var(--danger);">*</span>
                </label>
                <select id="reassignReasonPreset" onchange="updateReassignReason()" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); margin-bottom: 8px;">
                    <option value="">-- Select reason --</option>
                    <option value="Vehicle breakdown">Vehicle breakdown</option>
                    <option value="Driver emergency/illness">Driver emergency/illness</option>
                    <option value="Driver unreachable">Driver unreachable</option>
                    <option value="Traffic/route issue">Traffic/route issue</option>
                    <option value="Customer request">Customer request</option>
                    <option value="Other">Other (specify below)</option>
                </select>
                <textarea id="reassignReasonText" placeholder="Additional details..." rows="2"
                          style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); resize: none;"></textarea>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-ghost" onclick="document.getElementById('reassignDriverModal').remove()">Cancel</button>
                <button class="btn" id="confirmReassignBtn" onclick="submitReassignment('${assignmentId}')" 
                        style="background: linear-gradient(135deg, var(--warning), #d97706); color: #000; font-weight: 600;">
                    <i class="bi bi-arrow-left-right"></i> Reassign Driver
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Update reason text from preset selection
function updateReassignReason() {
    const preset = document.getElementById('reassignReasonPreset').value;
    const textArea = document.getElementById('reassignReasonText');
    if (preset && preset !== 'Other') {
        textArea.value = preset;
    } else if (preset === 'Other') {
        textArea.value = '';
        textArea.focus();
    }
}

// Submit driver reassignment
async function submitReassignment(assignmentId) {
    const newDriverId = document.getElementById('reassignDriverSelect').value;
    const presetReason = document.getElementById('reassignReasonPreset').value;
    const textReason = document.getElementById('reassignReasonText').value.trim();

    // Get final reason (preset takes priority if not 'Other')
    let reason = textReason;
    if (presetReason && presetReason !== 'Other') {
        reason = presetReason + (textReason ? `: ${textReason}` : '');
    }

    if (!newDriverId) {
        showToast('Please select a new driver', 'error');
        return;
    }

    if (!reason || reason.length < 5) {
        showToast('Please provide a reason (min 5 characters)', 'error');
        return;
    }

    const btn = document.getElementById('confirmReassignBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Reassigning...';

    try {
        const res = await fetch(`${API_URL}/delivery/reassign/${assignmentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                new_driver_id: newDriverId,
                reason: reason
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showToast(`✅ ${data.message}`, 'success');
            document.getElementById('reassignDriverModal').remove();
            // Refresh delivery data
            await loadActiveDeliveries();
            await loadDeliveryStats();
            await loadDriversList();
        } else {
            showToast(data.error || 'Failed to reassign driver', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-left-right"></i> Reassign Driver';
        }
    } catch (err) {
        console.error('Reassignment error:', err);
        showToast('Connection error', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-left-right"></i> Reassign Driver';
    }
}

// Listen for driver reassignment socket events
if (typeof socket !== 'undefined' && socket) {
    socket.on('driver_reassigned', (data) => {
        showToast(`🔄 Driver reassigned: ${data.old_driver} → ${data.new_driver} for Order #${data.order_number}`, 'info');
        loadActiveDeliveries();
        loadDeliveryStats();
    });

    socket.on('driver_changed', (data) => {
        if (data.new_driver) {
            showToast(`🔄 Driver changed for Order #${data.order_number}: ${data.new_driver.name}`, 'info');
        }
    });
}

/**
 * Update all nav badges based on current stats
 */
async function updateAllBadges() {
    try {
        const res = await fetch(`${API_URL}/operations/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.stats) {
            const s = data.stats;
            updateBadge('ordersBadge', s.active_orders || 0);
            updateBadge('disputesBadge', (parseInt(s.pending_disputes) || 0) + (parseInt(s.contested_disputes) || 0));
            updateBadge('deliveryBadge', s.ready_for_pickup || 0);
        }

        // Update finance badge (pending payouts) - use shared function
        loadFinanceBadge();

    } catch (err) {
        console.error('Failed to update badges:', err);
    }
}

/**
 * Helper: Get time ago string
 */
function getTimeAgo(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// ==========================================
// QC SOCKET EVENT LISTENERS - REMOVED
// QC module has been removed. Order goes from 'collected' directly to 'in_transit'
// ==========================================

// Support ticket created
if (typeof socket !== 'undefined' && socket) {
    socket.on('ticket_created', (data) => {
        showToast(data.notification || 'New support ticket received', 'info');
        updateBadge('supportBadge', (parseInt(document.getElementById('supportBadge')?.textContent) || 0) + 1);
    });
}

// Initial badge update on page load (already connected socket)
setTimeout(() => {
    if (token) {
        updateAllBadges();
    }
}, 2000);

// ==========================================
// PREMIUM VVIP FEATURES
// ==========================================

let autoRefreshInterval = null;
let lastActivityTime = Date.now();
let currentSection = 'overview';

/**
 * Initialize all premium features after login
 */
function initializePremiumFeatures() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    updateGreeting();
    startAutoRefresh();
    setupKeyboardShortcuts();
    setupActivityTracking();
    loadHeaderNotifications();

    // Update operator name from stored user info
    const userName = localStorage.getItem('opsUserName') || 'Operator';
    const nameEl = document.getElementById('operatorName');
    if (nameEl) nameEl.textContent = userName;
}

/**
 * Update live date and time in header
 */
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const dateTimeEl = document.getElementById('headerDateTime');
    if (dateTimeEl) {
        dateTimeEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

/**
 * Update greeting based on time of day
 */
function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17) greeting = 'Good evening';

    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = greeting;
}

/**
 * Start auto-refresh of dashboard data every 30 seconds
 */
function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        // Only refresh if page is visible and no modals open
        if (document.visibilityState === 'visible' && !document.querySelector('.modal:not([style*="display: none"])')) {
            refreshCurrentSection();
            loadHeaderNotifications();
        }
    }, 30000);
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input/textarea or modal is open
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        // Section navigation (1-8) - quality section removed
        const sections = ['overview', 'orders', 'delivery', 'disputes', 'reviewModeration', 'support', 'users', 'finance'];
        if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const index = parseInt(e.key) - 1;
            if (sections[index]) {
                e.preventDefault();
                switchSection(sections[index]);
            }
        }

        // R - Refresh
        if (e.key === 'r' || e.key === 'R') {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                refreshCurrentSection();
            }
        }

        // ? - Show shortcuts
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            showKeyboardShortcuts();
        }

        // Esc - Close modals
        if (e.key === 'Escape') {
            closeAllModals();
        }

        // Ctrl+K - Focus global search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) searchInput.focus();
        }
    });
}

/**
 * Show keyboard shortcuts modal
 */
function showKeyboardShortcuts() {
    const modal = document.getElementById('keyboardShortcutsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

/**
 * Close all modals
 */
function closeAllModals() {
    const shortcutsModal = document.getElementById('keyboardShortcutsModal');
    if (shortcutsModal) {
        shortcutsModal.style.display = 'none';
        shortcutsModal.classList.remove('active');
    }

    const notificationsDropdown = document.getElementById('notificationsDropdown');
    if (notificationsDropdown) {
        notificationsDropdown.classList.remove('show');
    }

    // Close other modals
    document.querySelectorAll('.modal-overlay.active, .modal[style*="display: flex"]').forEach(modal => {
        if (!modal.id?.includes('keyboardShortcuts')) {
            modal.remove();
        }
    });
}
/**
 * Load recent orders for overview
 */
async function loadRecentOrders() {
    try {
        const res = await fetch(`${API_URL}/operations/orders?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const statusLabels = {
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            ready_for_pickup: 'Ready for Pickup',
            collected: 'Collected',
            qc_in_progress: 'QC In Progress',
            qc_passed: 'QC Passed',
            qc_failed: 'QC Failed',
            in_transit: 'In Transit',
            delivered: 'Delivered',
            completed: 'Completed',
            disputed: 'Disputed',
            refunded: 'Refunded',
            cancelled_by_customer: 'Cancelled (Customer)',
            cancelled_by_garage: 'Cancelled (Garage)',
            cancelled_by_operations: 'Cancelled (Ops)'
        };

        const statusClass = {
            confirmed: 'confirmed',
            preparing: 'preparing',
            ready_for_pickup: 'ready',
            collected: 'collected',
            qc_in_progress: 'pending',
            qc_passed: 'completed',
            qc_failed: 'cancelled',
            in_transit: 'in-transit',
            delivered: 'delivered',
            completed: 'completed',
            disputed: 'pending',
            refunded: 'refunded',
            cancelled_by_customer: 'cancelled',
            cancelled_by_garage: 'cancelled',
            cancelled_by_operations: 'cancelled'
        };

        const table = document.getElementById('recentOrdersTable');
        if (table && data.orders && data.orders.length) {
            table.innerHTML = data.orders.map(o => `
                <tr>
                    <td><a href="#" onclick="viewOrder('${o.order_id}'); return false;" style="color: var(--accent); text-decoration: none; font-weight: 600;">#${o.order_number || o.order_id.slice(0, 8)}</a></td>
                    <td>${o.customer_name}</td>
                    <td>${o.part_description?.slice(0, 25)}...</td>
                    <td><span class="status-badge ${statusClass[o.order_status] || ''}">${statusLabels[o.order_status] || o.order_status}</span></td>
                    <td>${o.total_amount} QAR</td>
                    <td>${getOrderActions(o)}</td>
                </tr>
            `).join('');
        } else if (table) {
            table.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-inbox"></i><h4>No recent orders</h4></td></tr>';
        }
    } catch (err) {
        console.error('Failed to load recent orders:', err);
    }
}

/**
 * Refresh current section data with animation
 */
function refreshCurrentSection() {
    const refreshIcon = document.getElementById('refreshIcon');
    if (refreshIcon) {
        refreshIcon.parentElement.classList.add('spinning');
        setTimeout(() => refreshIcon.parentElement.classList.remove('spinning'), 1000);
    }

    // Find active section
    const activeNav = document.querySelector('.nav-item.active');
    const section = activeNav?.dataset?.section || 'overview';

    switch (section) {
        case 'overview':
            loadStats();
            loadRecentOrders();
            break;
        case 'orders':
            loadOrders();
            loadOrdersStats();
            loadGarageFilter();
            break;
        case 'delivery':
            loadDeliveryData();
            break;
        case 'disputes':
            loadDisputes();
            break;
        case 'reviewModeration':
            loadReviewModeration();
            break;
        case 'support':
            loadSupportTickets();
            break;
        case 'users':
            loadUsers();
            break;
        case 'finance':
            loadFinance();
            break;
        default:
            loadStats();
    }

    showToast('Data refreshed', 'info');
}

/**
 * Toggle notifications dropdown
 */
function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

/**
 * Mark all notifications as read
 */
function markAllRead() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
    }

    const list = document.getElementById('notificationsList');
    if (list) {
        list.innerHTML = '<div class="notification-empty">No new notifications</div>';
    }

    toggleNotifications();
}

/**
 * Load notifications for header dropdown
 */
async function loadHeaderNotifications() {
    const notifications = [];

    try {
        // Get stats for notifications
        const res = await fetch(`${API_URL}/operations/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.stats) {
            const s = data.stats;

            if (s.ready_for_pickup > 0) {
                notifications.push({
                    icon: 'warning',
                    title: `${s.ready_for_pickup} order(s) ready for pickup`,
                    section: 'delivery',
                    time: 'Now'
                });
            }

            if (s.pending_disputes > 0) {
                notifications.push({
                    icon: 'danger',
                    title: `${s.pending_disputes} pending dispute(s)`,
                    section: 'disputes',
                    time: 'Active'
                });
            }

            if (s.contested_disputes > 0) {
                notifications.push({
                    icon: 'danger',
                    title: `${s.contested_disputes} contested dispute(s)`,
                    section: 'disputes',
                    time: 'Urgent'
                });
            }
        }

        // Check support tickets
        const supportBadge = document.getElementById('supportBadge');
        if (supportBadge && supportBadge.textContent && parseInt(supportBadge.textContent) > 0) {
            notifications.push({
                icon: 'info',
                title: `${supportBadge.textContent} open support ticket(s)`,
                section: 'support',
                time: 'Active'
            });
        }

    } catch (err) {
        console.log('Failed to load notifications:', err);
    }

    renderNotifications(notifications);
}

/**
 * Render notifications in dropdown
 */
function renderNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('notificationBadge');

    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">No new notifications</div>';
        if (badge) badge.style.display = 'none';
        return;
    }

    if (badge) {
        badge.textContent = notifications.length;
        badge.style.display = 'flex';
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item" onclick="handleNotificationClick('${n.section}')" style="display: flex; align-items: center;">
            <div class="icon ${n.icon}">
                <i class="bi bi-${n.icon === 'warning' ? 'exclamation-triangle' : n.icon === 'danger' ? 'x-circle' : 'info-circle'}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${n.title}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${n.time}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Handle notification click - navigate to section
 */
function handleNotificationClick(section) {
    toggleNotifications();
    if (section) {
        switchSection(section);
    }
}

/**
 * Setup activity tracking for session timeout
 */
function setupActivityTracking() {
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
        document.addEventListener(event, () => {
            lastActivityTime = Date.now();
        }, { passive: true });
    });

    // Check for inactivity every minute
    setInterval(checkInactivity, 60000);
}

/**
 * Check for user inactivity and warn/logout
 */
function checkInactivity() {
    const inactiveTime = Date.now() - lastActivityTime;
    const warningTime = 25 * 60 * 1000; // 25 minutes
    const logoutTime = 30 * 60 * 1000; // 30 minutes

    if (inactiveTime >= logoutTime) {
        showToast('Session expired due to inactivity', 'error');
        logout();
    } else if (inactiveTime >= warningTime) {
        showToast('⚠️ Session will expire in 5 minutes due to inactivity', 'warning');
    }
}

// Click outside to close notifications dropdown
document.addEventListener('click', (e) => {
    const notificationsContainer = document.querySelector('.header-notifications');
    const dropdown = document.getElementById('notificationsDropdown');

    if (notificationsContainer && dropdown && !notificationsContainer.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// Click outside to close shortcuts modal
document.addEventListener('click', (e) => {
    const modal = document.getElementById('keyboardShortcutsModal');
    if (modal && e.target === modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
});

// ==========================================
// FRAUD PREVENTION CENTER (BRAIN v3.0)
// ==========================================

/**
 * Load fraud section stats and data
 */
async function loadFraudSection() {
    loadFraudStats();
    loadReturnRequests();
    loadAbuseTracking();
    loadGaragePenalties();
}

/**
 * Load fraud prevention statistics
 */
async function loadFraudStats() {
    try {
        const res = await fetch(`${API_URL}/cancellation/fraud-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('fraudWatchlistCount').textContent = data.watchlist_count || 0;
            document.getElementById('fraudPendingReturns').textContent = data.pending_returns || 0;
            document.getElementById('fraudPenaltiesMonth').textContent = formatCurrency(data.penalties_this_month || 0);
            document.getElementById('fraudPreventedAmount').textContent = formatCurrency(data.prevented_amount || 0);

            // Update badge
            const badge = document.getElementById('fraudBadge');
            if (badge) {
                const pendingCount = (data.pending_returns || 0) + (data.watchlist_count || 0);
                badge.textContent = pendingCount;
                badge.style.display = pendingCount > 0 ? 'flex' : 'none';
            }
        }
    } catch (err) {
        console.error('Failed to load fraud stats:', err);
    }
}

/**
 * Load return requests pending review
 */
async function loadReturnRequests() {
    const tbody = document.getElementById('returnRequestsTable');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/cancellation/return-requests?status=pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color: var(--danger);"><i class="bi bi-exclamation-triangle"></i> Failed to load</td></tr>';
            return;
        }

        const data = await res.json();
        const requests = data.return_requests || [];

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-check-circle" style="font-size: 24px; color: var(--success);"></i><p>No pending return requests</p></td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(r => `
            <tr>
                <td>
                    <strong>${escapeHTML(r.customer_name || 'Customer')}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(r.customer_phone || '')}</div>
                </td>
                <td><a href="#" onclick="viewOrder('${r.order_id}'); return false;" style="color: var(--accent);">#${escapeHTML(r.order_number || r.order_id?.slice(0, 8))}</a></td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(r.part_description || 'Part')}</td>
                <td>
                    <span class="badge badge-${r.reason === 'defective' ? 'warning' : 'secondary'}">${escapeHTML(r.reason || 'N/A')}</span>
                </td>
                <td>
                    ${r.photo_urls?.length > 0 ?
                `<button class="btn-sm btn-ghost" onclick="viewReturnPhotos('${r.return_id}')" title="View ${r.photo_urls.length} photos">
                            <i class="bi bi-images"></i> ${r.photo_urls.length}
                        </button>` :
                '<span style="color: #ef4444;"><i class="bi bi-x-circle"></i> None</span>'
            }
                </td>
                <td>${getTimeAgo(r.created_at)}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-sm btn-success" onclick="approveReturn('${r.return_id}')" title="Approve Return">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn-sm btn-danger" onclick="rejectReturn('${r.return_id}')" title="Reject Return">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load return requests:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color: var(--danger);">Connection error</td></tr>';
    }
}

/**
 * Approve a return request
 */
async function approveReturn(returnId) {
    if (!confirm('Approve this return request? Customer will receive refund minus 20% fee + delivery.')) return;

    try {
        const res = await fetch(`${API_URL}/cancellation/return-requests/${returnId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            showToast('Return approved - Refund processing', 'success');
            loadReturnRequests();
            loadFraudStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to approve return', 'error');
        }
    } catch (err) {
        console.error('Approve return error:', err);
        showToast('Connection error', 'error');
    }
}

/**
 * Reject a return request
 */
async function rejectReturn(returnId) {
    const reason = prompt('Enter rejection reason (required):');
    if (!reason || reason.trim().length < 5) {
        showToast('Please provide a reason (min 5 characters)', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cancellation/return-requests/${returnId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rejection_reason: reason.trim() })
        });

        if (res.ok) {
            showToast('Return rejected', 'success');
            loadReturnRequests();
            loadFraudStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to reject return', 'error');
        }
    } catch (err) {
        console.error('Reject return error:', err);
        showToast('Connection error', 'error');
    }
}

/**
 * View return photos in modal
 */
function viewReturnPhotos(returnId) {
    // Open modal with photos - simple implementation
    showToast('Photo viewer not implemented yet', 'info');
}

/**
 * Load customer abuse tracking data
 */
async function loadAbuseTracking() {
    const tbody = document.getElementById('abuseTrackingTable');
    if (!tbody) return;

    const flagFilter = document.getElementById('fraudFlagFilter')?.value || '';

    try {
        let url = `${API_URL}/cancellation/abuse-tracking`;
        if (flagFilter) url += `?flag=${flagFilter}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color: var(--danger);">Failed to load</td></tr>';
            return;
        }

        const data = await res.json();
        const customers = data.customers || [];

        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-check-circle" style="color: var(--success);"></i> No flagged customers</td></tr>';
            return;
        }

        const flagColors = {
            'none': '#10b981',
            'watchlist': '#f59e0b',
            'high_risk': '#ef4444',
            'blocked': '#991b1b'
        };

        tbody.innerHTML = customers.map(c => {
            const flagColor = flagColors[c.fraud_flag] || '#6b7280';
            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(c.full_name || 'Customer')}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(c.phone_number || '')}</div>
                    </td>
                    <td>
                        <span style="background: ${flagColor}20; color: ${flagColor}; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                            ${c.fraud_flag || 'none'}
                        </span>
                    </td>
                    <td style="text-align: center; font-weight: 600; ${c.returns_this_month >= 3 ? 'color: #ef4444;' : ''}">${c.returns_this_month || 0}/3</td>
                    <td style="text-align: center; font-weight: 600; ${c.defective_claims_this_month >= 3 ? 'color: #ef4444;' : ''}">${c.defective_claims_this_month || 0}/3</td>
                    <td style="text-align: center;">${c.cancellations_this_month || 0}</td>
                    <td>${getTimeAgo(c.updated_at || c.created_at)}</td>
                    <td>
                        <button class="btn-sm btn-ghost" onclick="editCustomerFlag('${c.customer_id}', '${c.fraud_flag}')" title="Change Flag">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load abuse tracking:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color: var(--danger);">Connection error</td></tr>';
    }
}

/**
 * Edit customer fraud flag
 */
async function editCustomerFlag(customerId, currentFlag) {
    const flags = ['none', 'watchlist', 'high_risk', 'blocked'];
    const newFlag = prompt(`Change fraud flag from "${currentFlag}" to:\n\nOptions: ${flags.join(', ')}`);

    if (!newFlag || !flags.includes(newFlag.toLowerCase())) {
        if (newFlag !== null) showToast('Invalid flag. Use: ' + flags.join(', '), 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cancellation/abuse-flag`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_id: customerId,
                fraud_flag: newFlag.toLowerCase()
            })
        });

        if (res.ok) {
            showToast(`Customer flag updated to ${newFlag}`, 'success');
            loadAbuseTracking();
            loadFraudStats();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to update flag', 'error');
        }
    } catch (err) {
        console.error('Edit flag error:', err);
        showToast('Connection error', 'error');
    }
}

/**
 * Load garage penalties
 */
async function loadGaragePenalties() {
    const tbody = document.getElementById('garagePenaltiesTable');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/cancellation/garage-penalties`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color: var(--danger);">Failed to load</td></tr>';
            return;
        }

        const data = await res.json();
        const penalties = data.penalties || [];

        if (penalties.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="bi bi-check-circle" style="font-size: 24px; color: var(--success);"></i><p>No penalties issued</p></td></tr>';
            return;
        }

        tbody.innerHTML = penalties.map(p => `
            <tr>
                <td><strong>${escapeHTML(p.garage_name || 'Garage')}</strong></td>
                <td><a href="#" onclick="viewOrder('${p.order_id}'); return false;" style="color: var(--accent);">#${escapeHTML(p.order_number || p.order_id?.slice(0, 8))}</a></td>
                <td>${escapeHTML(p.reason || 'N/A')}</td>
                <td style="color: #ef4444; font-weight: 600;">${formatCurrency(p.penalty_amount)}</td>
                <td>
                    <span class="status-badge status-${p.status === 'paid' ? 'completed' : p.status === 'deducted' ? 'confirmed' : 'pending'}">
                        ${p.status || 'pending'}
                    </span>
                </td>
                <td>${formatDate(p.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load garage penalties:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color: var(--danger);">Connection error</td></tr>';
    }
}

// Add fraud section to section switching
const originalSwitchSection = typeof switchSection === 'function' ? switchSection : null;
window.switchSection = function (section) {
    // Call original if exists
    if (originalSwitchSection && section !== 'fraud') {
        originalSwitchSection(section);
    }

    // Handle fraud section
    if (section === 'fraud') {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const fraudSection = document.getElementById('sectionFraud');
        if (fraudSection) fraudSection.classList.add('active');

        const fraudNav = document.querySelector('[data-section="fraud"]');
        if (fraudNav) fraudNav.classList.add('active');

        loadFraudSection();
    }
};

console.log('Operations Dashboard - v4.0 BRAIN Compliant (Fraud Prevention)');
