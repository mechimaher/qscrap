const API_URL = '/api';
let token = localStorage.getItem('opsToken');
let socket = null;

// ===== SECURITY UTILITIES =====
/**
 * Escape HTML to prevent XSS attacks
 * Use this for ALL user-generated content
 */
// escapeHTML: provided by shared/utils.js

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
        socket = io({
            auth: { token }
        });

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
            showToast(`Order #${data.order_number} delivered by driver!`, 'success');
        }
        loadStats();
        loadOrders();
    });
    socket.on('dispute_created', () => { loadStats(); });
    socket.on('dispute_resolved', () => { loadStats(); });
    socket.on('new_order', () => { loadStats(); loadOrders(); });

    // Order cancelled by customer/garage - CRITICAL for ops awareness
    socket.on('order_cancelled', (data) => {
        const by = data.cancelled_by === 'customer' ? 'Customer' : data.cancelled_by === 'garage' ? 'Garage' : 'System';
        showToast(`Order #${data.order_number || ''} cancelled by ${by}`, 'warning');
        loadStats();
        loadOrders();
    });

    // New return request - needs ops review
    socket.on('new_return_request', (data) => {
        showToast(`Return request for Order #${data.order_number || ''}`, 'warning');
        loadStats();
        loadReturns();
    });

    // Order collected - ready for driver assignment
    socket.on('order_collected', (data) => {
        showToast(`Order #${data.order_number || ''} collected - ready for delivery!`, 'info');
        loadOrders();
        loadDeliveryData();
    });
    // qc_completed event removed - QC module no longer exists

    // Order ready for pickup notification (from garage)
    socket.on('order_ready_for_pickup', (data) => {
        showToast(data.notification || 'Order ready for collection!', 'warning');
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
        showToast(data.notification || 'Garage confirmed payment receipt!', 'success');
    });

    socket.on('payment_disputed', (data) => {
        showToast(data.notification || 'A payment has been disputed!', 'warning');
    });

    socket.on('payout_completed', (data) => {
        showToast(data.notification || 'Payout completed!', 'success');
        loadStats();
    });

    // NEW: Payout pending notification - shows finance badge
    socket.on('payout_pending', (data) => {
        showToast(data.notification || 'New payout pending for garage', 'warning');
        loadStats();
    });

    // NEW: Review moderation notification
    socket.on('new_review_pending', (data) => {
        showToast(data.notification || 'New review submitted - pending moderation', 'info');
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
        showToast(data.notification || `Return pending: Order #${data.order_number} needs driver`, 'warning');
        // Update delivery badge
        const badge = document.getElementById('deliveryBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.style.display = 'inline-flex';
            updateBadge('deliveryTabBadge', currentCount + 1);
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
    // Whitelist of available sections
    const availableSections = new Set(['overview', 'orders', 'delivery', 'escalations', 'reports', 'fraud']);
    const resolvedSection = availableSections.has(section) ? section : 'overview';

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navItem = document.querySelector(`[data-section="${resolvedSection}"]`);
    if (navItem) navItem.classList.add('active');

    // Update section visibility
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sectionEl = document.getElementById('section' + resolvedSection.charAt(0).toUpperCase() + resolvedSection.slice(1));
    if (sectionEl) sectionEl.classList.add('active');

    // Load section data
    switch (resolvedSection) {
        case 'overview':
            loadStats();
            loadRecentOrders();
            break;
        case 'orders':
            loadOrders();
            loadGarageFilter();
            break;
        case 'delivery':
            loadDeliveryData();
            loadDeliveryHistory();
            break;
        case 'escalations':
            loadEscalations();
            break;
        case 'reports':
            loadReports();
            break;
        case 'fraud':
            loadFraudSection();
            break;
        default:
            // Fallback to overview
            loadStats();
    }

    // Update header greeting based on time
    updateGreeting();
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
            updateBadge('deliveryTabBadge', s.in_transit || 0);

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
            // If driver already assigned, show driver name instead of assign button
            if (o.driver_id) {
                return `<span class="status-badge in-transit" style="font-size: 11px;"><i class="bi bi-person-check"></i> ${o.driver_name ? escapeHTML(o.driver_name) : 'Driver Assigned'}</span>`;
            }
            return `<button class="btn btn-primary btn-sm" onclick="openUnifiedAssignmentModal('${o.order_id}', '${o.order_number}', 'collection')" title="Assign driver for collection"><i class="bi bi-truck"></i></button>`;
        case 'collected':
            return `<span class="status-badge ready" style="font-size: 11px;">Part Collected</span>`;
        case 'qc_failed':
            // QC workflow cancelled (2026-02-01) - this status never occurs
            return `<span class="status-badge warning" style="font-size: 11px;">QC Failed</span>`;
        case 'in_transit':
            return `<span class="status-badge in_transit" style="font-size: 11px;">In Transit</span>`;
        case 'delivered':
            return `<span class="status-badge delivered" style="font-size: 11px;">Delivered</span>`;
        case 'completed':
            return `<span class="status-badge completed" style="font-size: 11px;">Completed</span>`;
        case 'refunded':
            return `<span class="status-badge refunded" style="font-size: 11px;">Refunded</span>`;
        case 'disputed':
            return `<button class="btn btn-warning btn-sm" onclick="viewOrder('${o.order_id}')" title="View dispute"><i class="bi bi-exclamation-circle"></i></button>`;
        default:
            if (status?.startsWith('cancelled')) {
                return `<span class="status-badge cancelled" style="font-size: 11px;">Cancelled</span>`;
            }
            return `<span class="text-muted">-</span>`;
    }
}

// Cancel stuck/orphan order (operations)
async function cancelStuckOrder(orderId, orderNumber) {
    QScrapModal.confirm({
        title: 'Cancel Order',
        message: `Cancel order #${orderNumber}? This will mark it as cancelled by operations.`,
        confirmText: 'Cancel Order',
        cancelText: 'Keep Order',
        variant: 'danger',
        onConfirm: async () => {
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
    });
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

// ===== BULK OPERATIONS (Phase 1.2) =====
let selectedOrderIds = new Set();

// Toggle select all orders on current page
function toggleSelectAllOrders(checked) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            selectedOrderIds.add(cb.dataset.orderId);
        } else {
            selectedOrderIds.delete(cb.dataset.orderId);
        }
    });
    updateBulkActionBar();
}

// Update bulk action bar visibility and count
function updateBulkActionBar() {
    const actionBar = document.getElementById('bulkActionBar');
    const countLabel = document.getElementById('selectedCount');

    if (!actionBar || !countLabel) return;

    if (selectedOrderIds.size > 0) {
        actionBar.style.display = 'flex';
        countLabel.textContent = selectedOrderIds.size;
    } else {
        actionBar.style.display = 'none';
    }
}

// Clear bulk selection
function clearBulkSelection() {
    selectedOrderIds.clear();
    document.querySelectorAll('.order-checkbox, #selectAllOrders').forEach(cb => {
        cb.checked = false;
    });
    updateBulkActionBar();
}

// Execute bulk action
async function executeBulkAction() {
    const action = document.getElementById('bulkActionSelect').value;

    if (!action || selectedOrderIds.size === 0) {
        showToast('Please select an action and orders', 'error');
        return;
    }

    const btn = document.getElementById('bulkExecuteBtn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';

    try {
        const res = await fetch(`${API_URL}/operations/orders/bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_ids: Array.from(selectedOrderIds),
                action: action
            })
        });

        const data = await res.json();

        if (res.ok) {
            const { success_count, failed_count, errors } = data;

            if (success_count > 0) {
                showToast(`Bulk action completed: ${success_count} successful, ${failed_count} failed`, 'success');

                // Show errors if any
                if (errors && errors.length > 0) {
                    const errorMessages = errors.slice(0, 3).map(e =>
                        `Order #${e.order_number || e.order_id}: ${e.error}`
                    ).join('; ');
                    if (errors.length > 3) {
                        errorMessages.push(`... and ${errors.length - 3} more`);
                    }
                    showToast(errorMessages, 'warning');
                }

                // Refresh orders
                clearBulkSelection();
                loadOrders(currentOrdersPage);
                loadStats();
            } else {
                showToast('No orders were updated. Check order status requirements.', 'warning');
            }
        } else {
            showToast(data.error || 'Bulk action failed', 'error');
        }
    } catch (err) {
        console.error('Bulk action error:', err);
        showToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}
// ========================================

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

        const res = await fetch(`${API_URL}/operations/garages?status=approved&limit=100`, {
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
            cancelled_by_ops: 'Cancelled (Ops)'
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
            cancelled_by_ops: 'cancelled'
        };

        if (data.orders && data.orders.length) {
            // Orders table - with loyalty discount transparency
            document.getElementById('ordersTable').innerHTML = data.orders.map(o => {
                const hasDiscount = parseFloat(o.loyalty_discount) > 0;
                const discountBadge = hasDiscount
                    ? `<span style="display:inline-block; background:#10B981; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:4px;" title="Loyalty Discount: -${o.loyalty_discount} QAR"><i class="bi bi-gift"></i> -${o.loyalty_discount}</span>`
                    : '';

                // Add stuck order indicator
                const stuckIndicator = isOrderStuck(o)
                    ? `<i class="bi bi-exclamation-circle" style="color: #ef4444; margin-left: 8px;" title="${getStuckReason(o)}"></i>`
                    : '';

                return `
                        <tr class="${getRowClass(o)}">
                            <td>
                                <input type="checkbox" 
                                       class="order-checkbox" 
                                       data-order-id="${o.order_id}"
                                       onchange="updateBulkActionBar()"
                                       title="Select for bulk action">
                            </td>
                            <td><a href="#" onclick="viewOrder('${o.order_id}'); return false;" style="color: var(--accent); text-decoration: none; font-weight: 600;">#${o.order_number || o.order_id.slice(0, 8)}</a>${stuckIndicator}</td>
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
                        <tr class="${getRowClass(o)}">
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
    // Build action-based resolution modal (enterprise SaaS pattern)
    const modalContent = `
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary, #e2e8f0);">
                <i class="bi bi-gear me-1"></i>Resolution Action
            </label>
            <select id="escalationAction" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color, #334155); background: var(--bg-secondary, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px;">
                <option value="approve_refund">Approve Refund (sends to Finance for processing)</option>
                <option value="approve_cancellation">Approve Cancellation (cancels order + refund)</option>
                <option value="reject">Reject Escalation (no action taken)</option>
                <option value="acknowledge" selected>Acknowledge Only (close without order action)</option>
            </select>
            <div id="actionWarning" style="margin-top: 8px; padding: 8px 12px; border-radius: 6px; font-size: 12px; display: none;"></div>
        </div>
        <div>
            <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary, #e2e8f0);">
                <i class="bi bi-chat-text me-1"></i>Resolution Notes
            </label>
            <textarea id="escalationNotes" rows="3" placeholder="Explain the resolution decision..."
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color, #334155); background: var(--bg-secondary, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; resize: vertical;"></textarea>
        </div>
    `;

    QScrapModal.confirm({
        title: 'Resolve Escalation',
        message: modalContent,
        confirmText: 'Execute Resolution',
        cancelText: 'Cancel',
        variant: 'primary',
        onConfirm: async () => {
            const action = document.getElementById('escalationAction')?.value || 'acknowledge';
            const notes = document.getElementById('escalationNotes')?.value || '';

            // Require notes for reject
            if (action === 'reject' && !notes.trim()) {
                showToast('Rejection reason is required', 'error');
                return;
            }

            try {
                const res = await fetch(`${API_URL}/operations/escalations/${escalationId}/resolve`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        resolution_action: action,
                        resolution_notes: notes || `Resolved by operations (${action})`
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    const actionLabels = {
                        'approve_refund': 'Refund approved — sent to Finance',
                        'approve_cancellation': 'Order cancelled — refund processed',
                        'reject': 'Escalation rejected',
                        'acknowledge': 'Escalation acknowledged'
                    };
                    showToast(actionLabels[action] || 'Escalation resolved', 'success');
                    loadEscalations();
                    loadStats();
                } else {
                    showToast(data.error || 'Failed to resolve', 'error');
                }
            } catch (err) {
                console.error('Resolve escalation error:', err);
                showToast('Connection error', 'error');
            }
        }
    });

    // Add action change handler after modal renders
    setTimeout(() => {
        const actionSelect = document.getElementById('escalationAction');
        const warningDiv = document.getElementById('actionWarning');
        if (actionSelect && warningDiv) {
            actionSelect.addEventListener('change', () => {
                const val = actionSelect.value;
                if (val === 'approve_refund') {
                    warningDiv.style.display = 'block';
                    warningDiv.style.background = 'rgba(59, 130, 246, 0.1)';
                    warningDiv.style.border = '1px solid rgba(59, 130, 246, 0.3)';
                    warningDiv.style.color = '#93c5fd';
                    warningDiv.innerHTML = '<i class="bi bi-info-circle me-1"></i>Creates a pending refund request. Finance team must approve before Stripe refund executes.';
                } else if (val === 'approve_cancellation') {
                    warningDiv.style.display = 'block';
                    warningDiv.style.background = 'rgba(239, 68, 68, 0.1)';
                    warningDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    warningDiv.style.color = '#fca5a5';
                    warningDiv.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>This will immediately cancel the order, revert payouts, and process customer refund.';
                } else if (val === 'reject') {
                    warningDiv.style.display = 'block';
                    warningDiv.style.background = 'rgba(245, 158, 11, 0.1)';
                    warningDiv.style.border = '1px solid rgba(245, 158, 11, 0.3)';
                    warningDiv.style.color = '#fcd34d';
                    warningDiv.innerHTML = '<i class="bi bi-x-circle me-1"></i>No action will be taken. Rejection reason is required. Ticket stays open for support follow-up.';
                } else {
                    warningDiv.style.display = 'none';
                }
            });
        }
    }, 200);
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


// viewUser, suspendUser, activateUser — removed (2026-02-25) — Admin Dashboard owns user management
// ANALYTICS — removed (2026-02-25) — Replaced by Reports section
// Delivery Management Functions
let availableDrivers = [];

// Delivery Section - Pagination State
let currentDriversPage = 1;
let currentDeliveryOrdersPage = 1;
const DELIVERY_PAGE_SIZE = 20;


// loadDrivers, loadDeliveryOrders — removed (2026-02-25) — Superseded by loadDriversList, loadCollectionOrders
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

// Add Driver functions removed - driver management is Admin Dashboard only
// See admin-dashboard.js for openAddDriverModal() and submitAddDriver()


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
        await loadDriversList();
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
            loadDriversList();
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
    assignmentContext = { orderId, type };

    const title = type === 'collection' ? 'Assign Collection Driver' : 'Assign Delivery Driver';
    const icon = type === 'collection' ? 'bi-box-seam' : 'bi-truck';
    const description = type === 'collection'
        ? `Assign a driver to collect Order <strong>#${orderNumber}</strong> from the garage.`
        : `Assign a driver to deliver Order <strong>#${orderNumber}</strong> to the customer.`;

    // Remove existing modal if any
    document.getElementById('unifiedAssignModal')?.remove();

    // Create modal with loading state
    const modal = document.createElement('div');
    modal.id = 'unifiedAssignModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 500px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
                <h2><i class="bi ${icon}"></i> ${title}</h2>
                <button class="modal-close" onclick="document.getElementById('unifiedAssignModal').remove()" style="color: white;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin-bottom: 20px; color: var(--text-secondary); line-height: 1.5;">${description}</p>
                <div id="driverSelectContainer" style="text-align: center; padding: 20px;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 10px; color: var(--text-muted);">Finding nearby drivers...</p>
                </div>
                ${type === 'collection' ? `
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; margin-bottom: 8px; display: block;">Notes (Optional)</label>
                    <input type="text" id="unifiedAssignNotes" class="form-control" placeholder="Instructions for driver..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                </div>` : ''}
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-ghost" onclick="document.getElementById('unifiedAssignModal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="submitUnifiedAssignment()" id="unifiedSubmitBtn" style="background: linear-gradient(135deg, #f59e0b, #d97706); min-width: 120px;" disabled>
                    <i class="bi bi-check-lg"></i> Confirm
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Fetch ranked drivers by distance to order's garage
    try {
        const response = await fetch(`${API_URL}/delivery/drivers/ranked/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch drivers');
        }

        const data = await response.json();
        const drivers = data.drivers || [];
        const garage = data.garage;

        if (drivers.length === 0) {
            document.getElementById('driverSelectContainer').innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="bi bi-exclamation-circle" style="font-size: 2rem; color: #ef4444;"></i>
                    <p style="margin-top: 10px;">No available drivers. Please add or free up a driver.</p>
                </div>
            `;
            return;
        }

        // Generate driver options with distance badges
        const getDistanceBadge = (km) => {
            if (km === null) return '<span class="badge" style="background: #6b7280; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;"><i class="bi bi-geo-alt"></i> No GPS</span>';
            if (km < 3) return `<span class="badge" style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;"><i class="bi bi-circle-fill" style="font-size:6px;vertical-align:middle"></i> ${km} km</span>`;
            if (km < 8) return `<span class="badge" style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;"><i class="bi bi-circle-fill" style="font-size:6px;vertical-align:middle"></i> ${km} km</span>`;
            return `<span class="badge" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;"><i class="bi bi-circle-fill" style="font-size:6px;vertical-align:middle"></i> ${km} km</span>`;
        };

        const driverOptions = drivers.map((d, idx) => {
            const isRecommended = idx === 0 && d.distance_km !== null;
            const recommendedLabel = isRecommended ? ' <i class="bi bi-star-fill"></i> Recommended' : '';
            const statusIcon = d.status === 'available' ? '<i class="bi bi-circle-fill" style="color:#22c55e;font-size:8px"></i>' : '<i class="bi bi-circle-fill" style="color:#f59e0b;font-size:8px"></i>';
            return `<option value="${d.driver_id}" ${isRecommended ? 'selected' : ''}>
                ${statusIcon} ${d.full_name} (${d.vehicle_type || 'Car'}) - ${d.distance_km !== null ? d.distance_km + ' km' : 'No GPS'}${recommendedLabel}
            </option>`;
        }).join('');

        // Driver cards for visual selection
        const driverCards = drivers.slice(0, 5).map((d, idx) => {
            const isFirst = idx === 0;
            const borderColor = isFirst ? '#22c55e' : 'var(--border-color)';

            // Fix for numeric string or null rating_average
            let ratingDisplay = 'N/A';
            if (d.rating_average != null) {
                const parsedRating = parseFloat(d.rating_average);
                if (!isNaN(parsedRating)) {
                    ratingDisplay = parsedRating.toFixed(1);
                }
            }

            return `
                <div class="driver-card" onclick="document.getElementById('unifiedDriverSelect').value='${d.driver_id}'" 
                     style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 2px solid ${borderColor}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; ${isFirst ? 'background: rgba(34, 197, 94, 0.1);' : ''}"
                     onmouseover="this.style.borderColor='#f59e0b'" onmouseout="this.style.borderColor='${borderColor}'">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        ${d.full_name.charAt(0)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary);">${escapeHTML(d.full_name)} ${isFirst ? '<i class="bi bi-star-fill" style="color:#f59e0b"></i>' : ''}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${d.vehicle_type || 'Car'} • ${d.total_deliveries || 0} deliveries • <i class="bi bi-star-fill" style="color:#f59e0b;font-size:10px"></i> ${ratingDisplay}</div>
                    </div>
                    <div>
                        ${getDistanceBadge(d.distance_km)}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('driverSelectContainer').innerHTML = `
            <div style="margin-bottom: 15px; padding: 10px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 4px solid #22c55e;">
                <small style="color: var(--text-muted);"><i class="bi bi-geo-alt-fill"></i> Pickup from: <strong>${escapeHTML(garage.garage_name)}</strong></small>
            </div>
            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
                ${driverCards}
            </div>
            <div class="form-group">
                <label style="font-weight: 600; margin-bottom: 8px; display: block;">Or select from all drivers:</label>
                <select id="unifiedDriverSelect" class="form-control" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <option value="">-- Choose a Driver --</option>
                    ${driverOptions}
                </select>
            </div>
        `;

        // Enable submit button
        document.getElementById('unifiedSubmitBtn').disabled = false;

    } catch (err) {
        console.error('Error loading ranked drivers:', err);
        // Fallback to standard drivers list
        if (availableDrivers.length === 0) {
            await loadDriversList();
        }

        if (availableDrivers.length === 0) {
            document.getElementById('driverSelectContainer').innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="bi bi-exclamation-circle" style="font-size: 2rem; color: #ef4444;"></i>
                    <p style="margin-top: 10px;">No available drivers.</p>
                </div>
            `;
            return;
        }

        const driverOptions = availableDrivers.map(d =>
            `<option value="${d.driver_id}">${d.full_name} (${d.vehicle_type || 'Car'}) - ${d.status}</option>`
        ).join('');

        document.getElementById('driverSelectContainer').innerHTML = `
            <div class="form-group">
                <label style="font-weight: 600; margin-bottom: 8px; display: block;">Select Driver</label>
                <select id="unifiedDriverSelect" class="form-control" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <option value="">-- Choose a Driver --</option>
                    ${driverOptions}
                </select>
            </div>
        `;
        document.getElementById('unifiedSubmitBtn').disabled = false;
    }
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
            showToast(`Driver assigned successfully for ${type}`, 'success');
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



// Confirm delivery completed
async function confirmDelivery(orderId) {
    QScrapModal.confirm({
        title: 'Confirm Delivery',
        message: 'Confirm this order has been delivered to the customer?',
        confirmText: 'Confirm Delivery',
        variant: 'success',
        onConfirm: async () => {
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
    });
}




// openInspection function removed - QC workflow cancelled



// toggleCriteriaStatus removed - QC workflow cancelled


// showFailureSection, closeInspectionModal removed - QC workflow cancelled


// submitInspection removed - QC workflow cancelled



// QC-related driver assignment & return functions removed (2026-02-01)
// openDriverAssignmentModal, confirmDriverAssignment, createReturnForFailedQC





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
                // Backend expects: 'refund_approved' or 'dispute_rejected' (NOT refund_denied/declined)
                document.getElementById('btnApproveRefund').onclick = () => resolveDisputeFromModal('refund_approved');
                document.getElementById('btnDenyRefund').onclick = () => resolveDisputeFromModal('dispute_rejected');
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

    // Backend expects: 'refund_approved' or 'dispute_rejected'
    const confirmMsg = resolution === 'refund_approved'
        ? 'Are you sure you want to approve this refund?'
        : 'Are you sure you want to reject this dispute? (Customer will not receive a refund)';

    QScrapModal.confirm({
        title: resolution === 'refund_approved' ? 'Approve Refund' : 'Reject Dispute',
        message: confirmMsg,
        confirmText: resolution === 'refund_approved' ? 'Approve' : 'Reject',
        variant: resolution === 'refund_approved' ? 'success' : 'danger',
        onConfirm: async () => {
            await resolveDispute(currentModalDisputeId, resolution, true);
            closeOrderModal();
        }
    });
}


let isResolvingDispute = false;

async function resolveDispute(disputeId, resolution, skipConfirm = false) {
    if (isResolvingDispute) return; // Prevent double-clicks

    if (!skipConfirm) {
        const confirmMsg = resolution === 'refund_approved'
            ? 'Are you sure you want to approve this refund?'
            : 'Are you sure you want to deny this refund?';
        return new Promise(resolve => {
            QScrapModal.confirm({
                title: resolution === 'refund_approved' ? 'Approve Refund' : 'Deny Refund',
                message: confirmMsg,
                confirmText: resolution === 'refund_approved' ? 'Approve' : 'Deny',
                variant: resolution === 'refund_approved' ? 'success' : 'danger',
                onConfirm: async () => {
                    await resolveDispute(disputeId, resolution, true);
                    resolve();
                }
            });
        });
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

// ===== STUCK ORDER DETECTION (Phase 1.3) =====
// Time thresholds for detecting stuck orders (also used by attention widget)
const STUCK_THRESHOLDS = {
    pending_payment: 30 * 60 * 1000,      // 30 minutes
    confirmed: 2 * 60 * 60 * 1000,        // 2 hours
    preparing: 4 * 60 * 60 * 1000,        // 4 hours
    ready_for_pickup: 2 * 60 * 60 * 1000, // 2 hours without driver
    in_transit: 4 * 60 * 60 * 1000        // 4 hours
};

// Check if order is stuck
function isOrderStuck(order) {
    const status = order.order_status;
    const threshold = STUCK_THRESHOLDS[status];
    if (!threshold) return false;

    const now = new Date().getTime();
    const updatedAt = new Date(order.updated_at).getTime();
    const timeInStatus = now - updatedAt;

    return timeInStatus > threshold;
}

// Get stuck reason with time
function getStuckReason(order) {
    const status = order.order_status;
    const now = new Date().getTime();
    const updatedAt = new Date(order.updated_at).getTime();
    const hoursInStatus = Math.floor((now - updatedAt) / (60 * 60 * 1000));

    switch (status) {
        case 'pending_payment':
            return `Stuck in pending payment for ${hoursInStatus}h`;
        case 'confirmed':
            return `Awaiting garage action for ${hoursInStatus}h`;
        case 'preparing':
            return `Preparing for ${hoursInStatus}h`;
        case 'ready_for_pickup':
            return order.driver_id
                ? `Driver assigned ${hoursInStatus}h ago`
                : `No driver assigned for ${hoursInStatus}h`;
        case 'in_transit':
            return `In transit for ${hoursInStatus}h`;
        default:
            return 'Requires review';
    }
}

// Helper function to determine row highlighting class
// Highlights rows that need operator attention (e.g., no driver assigned)
function getRowClass(order) {
    const status = order.order_status;

    // Check if stuck (HIGH PRIORITY)
    if (isOrderStuck(order)) {
        if (status === 'pending_payment') return 'needs-attention-red';
        if (status === 'ready_for_pickup' && !order.driver_id) return 'needs-attention-red';
        if (status === 'disputed') return 'needs-attention-red';
        return 'needs-attention-amber';
    }

    // Original logic for non-stuck orders
    switch (status) {
        case 'pending_payment': return 'needs-attention-red';
        case 'confirmed': return 'needs-attention-amber';
        case 'disputed': return 'needs-attention-red';
        case 'ready_for_pickup':
            return !order.driver_id ? 'needs-attention-green' : '';
        default: return '';
    }
}
// ============================================
function logout() {
    // Clear all intervals
    if (window.dashboardRefreshInterval) clearInterval(window.dashboardRefreshInterval);
    if (window.attentionWidgetInterval) clearInterval(window.attentionWidgetInterval);
    if (window.dateTimeInterval) clearInterval(window.dateTimeInterval);
    if (window.autoCompleteInterval) clearInterval(window.autoCompleteInterval);

    // Clear all timeouts
    if (window.searchDebounceTimer) clearTimeout(window.searchDebounceTimer);
    if (window.globalSearchTimeout) clearTimeout(window.globalSearchTimeout);

    // Disconnect socket
    if (socket) {
        // Remove all listeners before disconnecting
        socket.removeAllListeners('connect');
        socket.removeAllListeners('disconnect');
        socket.removeAllListeners('order_status_updated');
        socket.removeAllListeners('delivery_status_updated');
        socket.removeAllListeners('dispute_created');
        socket.removeAllListeners('dispute_resolved');
        socket.removeAllListeners('new_order');
        socket.removeAllListeners('order_cancelled');
        socket.removeAllListeners('new_return_request');
        socket.removeAllListeners('order_collected');
        socket.removeAllListeners('order_ready_for_pickup');
        socket.removeAllListeners('payment_confirmed');
        socket.removeAllListeners('payment_disputed');
        socket.removeAllListeners('payout_completed');
        socket.removeAllListeners('payout_pending');
        socket.removeAllListeners('new_review_pending');
        socket.removeAllListeners('driver_status_changed');
        socket.removeAllListeners('ticket_updated');
        socket.removeAllListeners('return_assignment_created');
        socket.disconnect();
        socket = null;
    }

    // Clear auth state
    localStorage.removeItem('opsToken');
    localStorage.removeItem('opsUserName');
    localStorage.removeItem('opsUserPhone');
    token = null;

    // Hide app, show login
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';

    // Clear any open modals
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());

    // Reset to overview section
    currentOrderStatus = 'all';
    currentDisputeStatus = 'pending';
    currentUserType = 'customer';

    showToast('Logged out successfully', 'success');
}

// ===== ORDERS NEEDING ATTENTION WIDGET (Phase 1.6) =====
async function loadAttentionWidget() {
    const container = document.getElementById('attentionWidgetContent');
    const countBadge = document.getElementById('attentionCount');

    if (!container) return; // Widget not on page

    try {
        // Get recent orders and filter for attention-needed
        const res = await fetch(`${API_URL}/operations/orders?status=all&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const orders = data.orders || [];
        const attentionItems = [];

        // Filter orders needing attention
        for (const order of orders) {
            const status = order.order_status;
            const now = new Date().getTime();
            const updatedAt = new Date(order.updated_at).getTime();
            const hoursInStatus = Math.floor((now - updatedAt) / (60 * 60 * 1000));

            let priority = null;
            let reason = '';

            // Check for stuck orders
            if (isOrderStuck(order)) {
                if (status === 'pending_payment') {
                    priority = 'urgent';
                    reason = `Stuck in pending payment for ${hoursInStatus}h`;
                } else if (status === 'ready_for_pickup' && !order.driver_id) {
                    priority = 'urgent';
                    reason = `No driver assigned for ${hoursInStatus}h`;
                } else if (status === 'disputed') {
                    priority = 'urgent';
                    reason = `Dispute pending for ${hoursInStatus}h`;
                } else if (['confirmed', 'preparing', 'in_transit'].includes(status)) {
                    priority = 'high';
                    reason = getStuckReason(order);
                }
            }

            // Check for other attention-needed states
            if (!priority && status === 'ready_for_pickup' && !order.driver_id) {
                priority = 'high';
                reason = 'Ready for pickup - needs driver assignment';
            }

            if (priority) {
                attentionItems.push({
                    order_id: order.order_id,
                    order_number: order.order_number,
                    priority,
                    reason,
                    updated_at: order.updated_at,
                    status
                });
            }
        }

        // Sort by priority (urgent first, then high)
        attentionItems.sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, normal: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Update count badge
        if (countBadge) {
            countBadge.textContent = attentionItems.length;
            countBadge.style.display = attentionItems.length > 0 ? 'inline-block' : 'none';
        }

        // Render widget
        if (attentionItems.length === 0) {
            container.innerHTML = `
                <div style="padding: 30px; text-align: center; color: var(--success);">
                    <i class="bi bi-check-circle" style="font-size: 40px; margin-bottom: 12px;"></i>
                    <p style="font-size: 15px; font-weight: 600;">All caught up!</p>
                    <p style="color: var(--text-muted); font-size: 13px;">No orders need immediate attention</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="max-height: 350px; overflow-y: auto;">
                    ${attentionItems.slice(0, 10).map(item => `
                        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; ${item.priority === 'urgent' ? 'background: rgba(239, 68, 68, 0.05);' : ''}">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; margin-bottom: 4px;">
                                    <a href="#" onclick="viewOrder('${item.order_id}'); return false;" style="color: var(--accent);">
                                        #${item.order_number}
                                    </a>
                                    ${item.priority === 'urgent' ? '<span class="status-badge urgent" style="margin-left: 8px; font-size: 10px;">URGENT</span>' : ''}
                                    ${item.priority === 'high' ? '<span class="status-badge" style="margin-left: 8px; font-size: 10px; background: #f59e0b; color: white;">HIGH</span>' : ''}
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted);">
                                    <i class="bi bi-info-circle"></i> ${item.reason}
                                    <br>
                                    <i class="bi bi-clock"></i> Updated ${timeAgo(item.updated_at)}
                                </div>
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="viewOrder('${item.order_id}')" style="padding: 6px 12px; margin-left: 12px;">
                                Review
                            </button>
                        </div>
                    `).join('')}
                </div>
                ${attentionItems.length > 10 ? `<div style="padding: 12px; text-align: center; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 13px;">+ ${attentionItems.length - 10} more orders</div>` : ''}
                <div style="padding: 12px; border-top: 1px solid var(--border); text-align: center;">
                    <button class="btn btn-ghost btn-sm" onclick="switchSection('orders')">
                        View All Orders <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            `;
        }
    } catch (err) {
        console.error('Failed to load attention widget:', err);
        if (container) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--danger);">Failed to load attention widget</div>`;
        }
    }
}
// ============================================

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
    tbody.innerHTML = deliveries.map(d => {
        // ===== GPS PING STATUS (NEW FEATURE) =====
        const lastPing = d.last_location_update ? new Date(d.last_location_update) : null;
        const now = new Date();
        const minutesAgo = lastPing ? Math.floor((now - lastPing) / 60000) : null;

        // Determine ping status with color coding
        let pingStatus = 'unknown';
        let pingLabel = 'No signal';
        let pingColor = '#6b7280'; // gray
        let pingTitle = 'No GPS data available';

        if (minutesAgo !== null) {
            pingTitle = lastPing.toLocaleString();
            if (minutesAgo < 5) {
                pingStatus = 'live';
                pingLabel = `${minutesAgo}m`;
                pingColor = '#10b981'; // green - live tracking
            } else if (minutesAgo < 30) {
                pingStatus = 'recent';
                pingLabel = `${minutesAgo}m`;
                pingColor = '#f59e0b'; // amber - recent but not live
            } else {
                pingStatus = 'stale';
                pingLabel = `${minutesAgo}m`;
                pingColor = '#ef4444'; // red - stale, may need attention
            }
        }
        // =========================================

        const statusClass = {
            'assigned': 'pending',
            'picked_up': 'in-transit',
            'in_transit': 'in-transit'
        }[d.status] || 'pending';

        return `
            <tr>
                <td><strong>#${d.order_number || '-'}</strong></td>
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
                    ${d.customer_name || '-'}<br>
                    <a href="tel:${d.customer_phone}" style="color: var(--accent); font-size: 12px;">${d.customer_phone || ''}</a>
                </td>
                <td><span class="status-badge ${statusClass}">${(d.order_status || d.assignment_status || 'in_transit').replace(/_/g, ' ')}</span></td>
                <td>
                    ${d.driver_lat && d.driver_lng ? `
                        <a href="https://www.google.com/maps?q=${d.driver_lat},${d.driver_lng}" target="_blank" rel="noopener"
                           style="display: flex; align-items: center; gap: 6px; text-decoration: none; cursor: pointer;" title="${pingTitle} — Click to view on map">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${pingColor}; display: inline-block; ${pingStatus === 'live' ? 'animation: pulse 2s infinite;' : ''}"></span>
                            <span style="color: ${pingColor}; font-weight: 600; font-size: 13px;">${pingLabel}</span>
                            <i class="bi bi-box-arrow-up-right" style="font-size: 10px; color: var(--text-muted);"></i>
                        </a>
                    ` : `
                        <div style="display: flex; align-items: center; gap: 6px;" title="${pingTitle}">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${pingColor}; display: inline-block;"></span>
                            <span style="color: ${pingColor}; font-weight: 600; font-size: 13px;">${pingLabel}</span>
                        </div>
                    `}
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
                        </div>
                    ` : `
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            <button class="btn btn-sm" onclick="markOrderDelivered('${d.order_id}', '${d.order_number}')"
                                    style="padding: 4px 8px; font-size: 11px; background: var(--success);">
                                <i class="bi bi-check-circle"></i> Delivered
                            </button>
                            <button class="btn btn-sm" onclick="openUnifiedAssignmentModal('${d.order_id}', '${d.order_number}', 'delivery')"
                                    style="padding: 4px 8px; font-size: 11px; background: var(--accent);">
                                <i class="bi bi-person-plus"></i> Assign
                            </button>
                        </div>
                    `}
                </td>
            </tr>
        `;
    }).join('');
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
                            <span style="font-size: 18px;"><i class="bi bi-truck" style="color:white"></i></span>
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
    QScrapModal.confirm({
        title: 'Mark as Delivered',
        message: `Mark order ${orderNumber} as delivered?`,
        confirmText: 'Mark Delivered',
        variant: 'success',
        onConfirm: async () => {
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
                    showToast(`Order ${orderNumber} marked as delivered!`, 'success');
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
    });
}

// Mark order as delivered via operations order status update (for orders without assignment)
async function markOrderDelivered(orderId, orderNumber) {
    QScrapModal.confirm({
        title: 'Mark as Delivered',
        message: `Mark order ${orderNumber} as delivered?`,
        confirmText: 'Mark Delivered',
        variant: 'success',
        onConfirm: async () => {
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
                    showToast(`Order ${orderNumber} marked as delivered!`, 'success');
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
    });
}

// NOTE: openLocationModal() and updateDriverLocation() functions removed (2026-02-01)
// Manual GPS coordinate entry via browser prompts was impractical.
// Driver app handles GPS tracking automatically via TrackingService.

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
            updateBadge('deliveryBadge', totalPending);
            updateBadge('deliveryTabBadge', totalPending);
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
        // Collection panel removed (2026-02-01) - duplicates Orders functionality
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

        // Populate availableDrivers array (legacy fallback used by modals)
        availableDrivers = data.drivers || [];

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
        // Use new assign-collection endpoint (collect endpoint is deprecated - returns 410)
        const res = await fetch(`${API_URL}/delivery/assign-collection/${orderId}`, {
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
            showToast(`Order ${data.order_number || ''} collection assigned!`, 'success');
            document.getElementById('collectOrderModal').remove();
            loadDeliveryData();
            loadStats();
            loadOrders();
        } else {
            showToast(data.error || 'Failed to assign collection', 'error');
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

// USER MANAGEMENT + GARAGES — removed (2026-02-25) — Admin Dashboard owns these
// FINANCE MANAGEMENT — removed (2026-02-25) — Finance is in /finance-dashboard.html
// UNIFIED DISPUTES MODULE — removed (2026-02-25) — Disputes handled via order modal
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
            showToast('Payment marked as sent! Awaiting garage confirmation.', 'success');
            closeSendPaymentModal();
            // Finance refresh removed — Finance lives in /finance-dashboard.html
        } else {
            showToast(data.error || 'Failed to send payment', 'error');
        }
    } catch (err) {
        console.error('Send payment error:', err);
        showToast('Failed to send payment', 'error');
    }
}


// loadTransactions, processPayout, holdPayout, releasePayout — removed (2026-02-25) — Finance is in /finance-dashboard.html
// SUPPORT TICKET LOGIC — removed (2026-02-25) — Support is in /support-dashboard.html
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
                    <div style="font-weight: 600; color: var(--accent);">#${escapeHTML(o.order_number || '')}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${escapeHTML((o.car_make || '') + ' ' + (o.car_model || ''))} - ${escapeHTML((o.part_description || '').slice(0, 30))}</div>
                </div>
                <span class="order-status ${escapeHTML(o.order_status?.replace('_', '-') || '')}" style="font-size: 10px;">${escapeHTML(o.order_status || '')}</span>
            </div>
        `).join('');
    }

    // Users
    if (results.users && results.users.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 8px;">Users</div>`;
        html += results.users.slice(0, 5).map(u => `
            <div class="search-result-item" onclick="searchOrdersByText('${encodeURIComponent(u.full_name || '')}'); searchResultsDiv.style.display='none';"
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600;">${escapeHTML(u.full_name || '')}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${escapeHTML(u.email || '')} | ${escapeHTML(u.phone_number || '')}</div>
                </div>
                <span style="font-size: 11px; color: var(--text-muted);">${escapeHTML(u.user_type || '')}</span>
            </div>
        `).join('');
    }

    // Disputes
    if (results.disputes && results.disputes.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 8px;">Disputes</div>`;
        html += results.disputes.slice(0, 5).map(d => `
            <div class="search-result-item" onclick="viewOrder('${d.order_id}'); searchResultsDiv.style.display='none';"
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600;">#${escapeHTML(d.order_number || '')}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${escapeHTML(d.reason || '')} - ${escapeHTML(d.customer_name || '')}</div>
                </div>
                <span class="status-badge ${escapeHTML(d.status || '')}" style="font-size: 10px;">${escapeHTML(d.status || '')}</span>
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
                    <div style="font-weight: 600;">${escapeHTML((r.car_make || '') + ' ' + (r.car_model || ''))}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${escapeHTML((r.part_description || '').slice(0, 40))}</div>
                </div>
                <span style="font-size: 11px; color: var(--text-muted);">${escapeHTML(r.status || '')}</span>
            </div>
        `).join('');
    }

    searchResultsDiv.innerHTML = html;
    searchResultsDiv.style.display = 'block';
}

function searchOrdersByText(encodedQuery) {
    const query = decodeURIComponent(encodedQuery || '');
    switchSection('orders');
    const input = document.getElementById('orderSearch');
    if (input) input.value = query;
    orderFilters.search = query;
    loadOrders();
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
                        <td>${parseFloat(g.rating_average || 0).toFixed(1)} <i class="bi bi-star-fill" style="color:#f59e0b;font-size:11px"></i> (${g.rating_count || 0})</td>
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


// processAllPayouts — removed (2026-02-25) — Finance is in /finance-dashboard.html
// REVIEW MODERATION — removed (2026-02-25)
// No HTML section exists. Review moderation is not an operations function.

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
            showToast(`${data.message}`, 'success');
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
        showToast(`Driver reassigned: ${data.old_driver} → ${data.new_driver} for Order #${data.order_number}`, 'info');
        loadActiveDeliveries();
        loadDeliveryStats();
    });

    socket.on('driver_changed', (data) => {
        if (data.new_driver) {
            showToast(`Driver changed for Order #${data.order_number}: ${data.new_driver.name}`, 'info');
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
            updateBadge('deliveryTabBadge', s.ready_for_pickup || 0);
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
            // Refresh attention widget if on overview
            const activeSection = document.querySelector('.section.active');
            if (activeSection && activeSection.id === 'sectionOverview') {
                loadAttentionWidget();
            }
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

        // Section navigation (1-6)
        const sections = ['overview', 'orders', 'delivery', 'escalations', 'reports', 'fraud'];
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
            cancelled_by_ops: 'Cancelled (Ops)'
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
            cancelled_by_ops: 'cancelled'
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
            loadDeliveryHistory();
            loadReturns();
            break;
        case 'escalations':
            loadEscalations();
            break;
        case 'reports':
            loadReports();
            break;
        case 'fraud':
            loadFraudSection();
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
        showToast('Session will expire in 5 minutes due to inactivity', 'warning');
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
const returnRequestPhotoMap = new Map();

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
        returnRequestPhotoMap.clear();
        requests.forEach(r => {
            returnRequestPhotoMap.set(r.return_id, Array.isArray(r.photo_urls) ? r.photo_urls : []);
        });

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

function viewReturnPhotos(returnId) {
    const urls = (returnRequestPhotoMap.get(returnId) || [])
        .map(url => String(url || '').trim())
        .filter(url => /^https?:\/\//i.test(url) || url.startsWith('/'));

    if (urls.length === 0) {
        showToast('No photos available for this return', 'warning');
        return;
    }

    const existing = document.getElementById('returnPhotosModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'returnPhotosModal';
    modal.className = 'modal-overlay active';

    const container = document.createElement('div');
    container.className = 'modal-container';
    container.style.maxWidth = '900px';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
        <h2><i class="bi bi-images"></i> Return Photos</h2>
        <button class="modal-close" onclick="document.getElementById('returnPhotosModal').remove()">&times;</button>
    `;

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.padding = '16px';

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    grid.style.gap = '12px';

    urls.forEach((url, idx) => {
        const card = document.createElement('a');
        card.href = url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.style.display = 'block';
        card.style.border = '1px solid var(--border)';
        card.style.borderRadius = '8px';
        card.style.overflow = 'hidden';

        const img = document.createElement('img');
        img.src = url;
        img.alt = `Return photo ${idx + 1}`;
        img.style.width = '100%';
        img.style.height = '180px';
        img.style.objectFit = 'cover';

        card.appendChild(img);
        grid.appendChild(card);
    });

    body.appendChild(grid);
    container.appendChild(header);
    container.appendChild(body);
    modal.appendChild(container);
    document.body.appendChild(modal);
}

/**
 * Approve a return request
 */
async function approveReturn(returnId) {
    QScrapModal.confirm({
        title: 'Approve Return',
        message: 'Approve this return request? Customer will receive refund minus 20% fee + delivery.',
        confirmText: 'Approve Return',
        variant: 'success',
        onConfirm: async () => {
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
    });
}

/**
 * Reject a return request
 */
async function rejectReturn(returnId) {
    QScrapModal.prompt({
        title: 'Reject Return',
        message: 'Enter rejection reason (required, min 5 characters):',
        inputType: 'textarea',
        placeholder: 'Rejection reason...',
        required: true,
        confirmText: 'Reject Return',
        variant: 'danger',
        onConfirm: async (reason) => {
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
    });
}

/**
 * View return photos in modal
 */


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
    const flagLabels = { none: 'None (Clear)', watchlist: 'Watchlist', high_risk: 'High Risk', blocked: 'Blocked' };

    QScrapModal.prompt({
        title: 'Change Fraud Flag',
        message: `Current flag: <strong>${currentFlag || 'none'}</strong>. Select a new flag:`,
        inputType: 'select',
        selectOptions: flags.map(f => ({ value: f, label: flagLabels[f] || f })),
        defaultValue: currentFlag || 'none',
        confirmText: 'Update Flag',
        variant: 'warning',
        onConfirm: async (newFlag) => {
            if (!newFlag || !flags.includes(newFlag.toLowerCase())) {
                showToast('Invalid flag selection', 'error');
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
    });
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

console.log('Operations Dashboard - v4.0 BRAIN Compliant (Fraud Prevention)');
