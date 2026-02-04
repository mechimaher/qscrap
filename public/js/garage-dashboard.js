const API_URL = '/api';
let token = localStorage.getItem('token');
let userId = localStorage.getItem('userId');
let userType = localStorage.getItem('userType');

// STRICT ROLE CHECK: If logged in as customer, force logout on garage dashboard
if (token && userType && userType !== 'garage') {
    console.warn('Wrong user role for Garage Dashboard. Clearing session.');
    localStorage.clear();
    token = null;
    userId = null;
    userType = null;
}

let socket = null;
let requests = [];

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
 * Escape string for use in inline JavaScript onclick handlers
 * Handles quotes, newlines, backslashes, and other problematic characters
 */
function escapeJSString(text) {
    if (!text) return '';
    return String(text)
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

let ignoredRequests = JSON.parse(localStorage.getItem('ignoredRequests') || '[]');
let biddedRequests = []; // Track requests we've already bid on (pending)
let rejectedRequests = []; // Track requests where our bid was rejected
let bidStatusMap = {}; // Full status map: request_id -> {status, bid_id}
let dismissedRequests = JSON.parse(localStorage.getItem('dismissedRequests') || '[]');
let bidPhotos = [];
let pendingCounterOffers = []; // Track counter-offers from customers
let pendingDisputes = []; // Track disputes from customers
let flaggedBids = []; // Track bids flagged by customers for correction
let activeOrdersCount = 0; // Global tracker for badge
let garageSupplierType = 'both'; // Cache garage supplier type (used/new/both)

// ===== VVIP G-04: Human Status Labels =====
const ORDER_STATUS_LABELS = {
    pending_payment: { label: 'Awaiting Payment', color: '#F59E0B' },
    confirmed: { label: 'Confirmed', color: '#22C55E' },
    preparing: { label: 'Being Prepared', color: '#F59E0B' },
    ready_for_pickup: { label: 'Ready for Pickup', color: '#8B5CF6' },
    ready_for_collection: { label: 'Ready for Pickup', color: '#8B5CF6' },
    collected: { label: 'Picked Up', color: '#3B82F6' },
    in_transit: { label: 'On the Way', color: '#3B82F6' },
    delivered: { label: 'Delivered', color: '#22C55E' },
    completed: { label: 'Complete', color: '#22C55E' },
    cancelled_by_customer: { label: 'Cancelled', color: '#EF4444' },
    cancelled_by_garage: { label: 'Cancelled', color: '#EF4444' },
    cancelled_by_ops: { label: 'Cancelled', color: '#EF4444' },
    cancelled_by_undo: { label: 'Undone', color: '#6B7280' },
    disputed: { label: 'Under Review', color: '#F59E0B' },
    refunded: { label: 'Refunded', color: '#6B7280' }
};

function getOrderStatusLabel(status) {
    return ORDER_STATUS_LABELS[status]?.label || status;
}

function getOrderStatusColor(status) {
    return ORDER_STATUS_LABELS[status]?.color || '#6B7280';
}

// ===== VVIP G-01: Undo Order Function =====
async function undoOrder(orderId, reason = 'User initiated undo') {
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/undo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();

        if (!res.ok) {
            showNotification(data.error || 'Undo failed', 'error');
            return false;
        }

        showNotification('Order undone successfully', 'success');
        loadOrders(); // Refresh orders list
        loadStats();  // Refresh stats
        return true;
    } catch (err) {
        console.error('Undo order failed:', err);
        showNotification('Failed to undo order', 'error');
        return false;
    }
}

// Premium Feature Variables (must be declared before showDashboard call)
let autoRefreshInterval = null;
let lastActivityTime = Date.now();
let notifications = [];

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Use saved theme, or system preference, or default to dark
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update label text
    const label = document.getElementById('themeLabel');
    if (label) {
        label.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Initialize theme immediately (before DOM fully loads)
initTheme();

// Initialize app
if (token) {
    showDashboard();
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, password })
        });
        const data = await res.json();

        if (data.token) {
            if (data.userType !== 'garage') {
                showToast('This portal is for garage partners only', 'error');
                return;
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('userType', 'garage');
            token = data.token;
            userId = data.userId;
            userType = 'garage';
            showDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

// Auth Tab Switching
function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    tabs[0].style.background = tab === 'login' ? 'linear-gradient(135deg, var(--accent) 0%, #A82050 100%)' : 'rgba(255,255,255,0.05)';
    tabs[0].style.color = tab === 'login' ? 'white' : 'var(--text-secondary)';
    tabs[1].style.background = tab === 'register' ? 'linear-gradient(135deg, var(--accent) 0%, #A82050 100%)' : 'rgba(255,255,255,0.05)';
    tabs[1].style.color = tab === 'register' ? 'white' : 'var(--text-secondary)';

    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

// Register
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const garageName = document.getElementById('regGarageName').value;
    const ownerName = document.getElementById('regOwnerName').value;
    const phone = document.getElementById('regPhone').value;
    const address = document.getElementById('regAddress').value;
    const password = document.getElementById('regPassword').value;

    // Get specialization fields
    const supplierType = document.getElementById('regSupplierType').value;
    const allBrands = document.getElementById('regAllBrands').checked;
    const brandCheckboxes = document.querySelectorAll('.brand-checkbox:checked');
    const specializedBrands = allBrands ? [] : Array.from(brandCheckboxes).map(cb => cb.value);

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: phone,
                password,
                full_name: ownerName,
                user_type: 'garage',
                garage_name: garageName,
                address: address,
                // Specialization fields
                supplier_type: supplierType,
                specialized_brands: specializedBrands,
                all_brands: allBrands
            })
        });
        const data = await res.json();

        if (data.userId) {
            showToast('Account created! Please sign in.', 'success');
            switchAuthTab('login');
            document.getElementById('registerForm').reset();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

// Toggle brand selection visibility (for registration form)
function toggleBrandSelection() {
    const allBrandsChecked = document.getElementById('regAllBrands').checked;
    const container = document.getElementById('regBrandSelectionContainer');
    if (container) {
        container.style.display = allBrandsChecked ? 'none' : 'block';
    }
}

function logout() {
    localStorage.clear();
    location.reload();
}



// ===== NOTIFICATION SYSTEM =====
var notificationSound = null;

function initNotificationSound() {
    // AudioContext must be resumed/created after user gesture
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    // Resume context if suspended (browser policy)
    if (ctx.state === 'suspended') {
        const resumeAudio = () => {
            ctx.resume();
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('touchstart', resumeAudio);
    }

    notificationSound = (freq = 800, duration = 0.3) => {
        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('Audio play failed', e);
        }
    };
}

function playNotificationSound(type = 'default') {
    if (!notificationSound) return;
    try {
        if (type === 'newRequest') {
            // Double beep for new requests
            notificationSound(880, 0.15);
            setTimeout(() => notificationSound(1100, 0.2), 200);
        } else if (type === 'success') {
            notificationSound(1000, 0.3);
        } else if (type === 'warning') {
            notificationSound(400, 0.4);
        } else {
            notificationSound(800, 0.3);
        }
    } catch (e) { console.error('Sound error:', e); }
}

async function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');

    // Initialize notification sound
    initNotificationSound();

    // Connect Socket
    socket = io();
    socket.emit('join_garage_room', userId);

    // Initialize premium features (live datetime, shortcuts, notifications)
    if (typeof initializePremiumFeatures === 'function') {
        initializePremiumFeatures();
    }

    // Initial Load of Notifications
    loadNotifications();

    // Sync ignored requests from backend (merge with localStorage)
    try {
        const res = await fetch(`${API_URL}/requests/ignored/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.ignored && Array.isArray(data.ignored)) {
                // Merge server ignored with local (server takes precedence)
                const serverIgnored = data.ignored.map(id => String(id));
                const merged = [...new Set([...ignoredRequests, ...serverIgnored])];
                ignoredRequests = merged;
                localStorage.setItem('ignoredRequests', JSON.stringify(merged));
            }
        }
    } catch (err) {
        console.log('Could not sync ignored requests from server:', err);
    }

    // Connection handlers for data freshness
    socket.on('connect', () => {
        console.log('[Socket] Connected - refreshing data');
        loadStats();
        loadRequests();
        loadBids();
        loadOrders();
    });

    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
    });

    socket.on('new_request', (data) => {
        playNotificationSound('newRequest');
        prependRequest(data);
        showToast('New part request!', 'success');
        updateBadge();
        loadBadgeCounts(); // Real-time badge update
    });

    // GENERIC NOTIFICATION LISTENER (Persistent)
    socket.on('new_notification', (data) => {
        // Play sound based on type
        if (data.type === 'bid_accepted') playNotificationSound('success');
        else if (data.type === 'new_request') playNotificationSound('newRequest');
        else playNotificationSound('default');

        // Add to list and update badge
        prependNotification(data);
        updateNotificationBadge(true); // Increment unread count

        // Show toast
        showToast(data.message, data.type === 'error' ? 'error' : 'info');
    });

    socket.on('bid_accepted', (data) => {
        playNotificationSound('success');
        showToast(data.notification, 'success');

        // Refresh Data
        loadBids();
        loadOrders();
        loadStats(); // This updates the Active Orders badge
        loadRequests(); // VVIP FIX: Refresh requests to remove the one that was accepted

        // Instant UI Update: Remove request from local list immediately
        if (data.request_id) {
            requests = requests.filter(r => r.request_id !== data.request_id);
            renderRequests();
            updateBadge(); // Updates the Requests badge immediately
            loadBadgeCounts(); // Update enterprise badges
        }
    });

    socket.on('bid_rejected', (data) => {
        playNotificationSound('warning');
        showToast(data.message || 'Your bid was not selected', 'warning');
        loadBids();
        loadBadgeCounts(); // Update badges
    });

    socket.on('request_cancelled', (data) => {
        playNotificationSound('warning');
        showToast('Customer cancelled a request', 'warning');
        // Remove the cancelled request from local list
        requests = requests.filter(r => r.request_id !== data.request_id);
        renderRequests();
        loadBids();
        updateBadge();
    });

    // Handle customer deleting a request
    socket.on('request_removed', (data) => {
        console.log('[SOCKET] Request removed:', data.request_id);
        // Remove the deleted request from local list
        requests = requests.filter(r => r.request_id !== data.request_id);
        renderRequests();
        loadBids();
        updateBadge();
    });

    // NEW: Counter-offer listeners
    socket.on('counter_offer_received', (data) => {
        playNotificationSound('newRequest'); // Use distinct sound
        showToast(data.notification || 'New counter-offer received!', 'info');
        loadPendingCounterOffers(); // Auto-fetch and open modal
        loadBids(); // Update list
        loadBadgeCounts(); // Update pending actions badge
    });

    socket.on('counter_offer_accepted', (data) => {
        playNotificationSound('success');
        showToast(data.notification, 'success');
        loadBids();
        loadOrders(); // Refresh orders list - new order created
        loadStats();
        loadBadgeCounts(); // Update badges
    });

    socket.on('counter_offer_rejected', (data) => {
        playNotificationSound('warning');
        showToast(data.notification, 'warning');
        loadBids();
        loadBadgeCounts(); // Update badges
    });

    // Request expired notification
    socket.on('request_expired', (data) => {
        playNotificationSound('warning'); // Add warning sound
        showToast(data.notification, 'warning');
        // Remove expired request from local list
        requests = requests.filter(r => r.request_id !== data.request_id);
        renderRequests();
        loadBids();
        updateBadge();
    });

    // Counter offer expired notification
    socket.on('counter_offer_expired', (data) => {
        playNotificationSound('warning'); // Add warning sound
        showToast(data.notification, 'warning');
        loadBids();
        loadBadgeCounts(); // Update badges
    });

    socket.on('order_cancelled', (data) => {
        playNotificationSound('warning');
        showToast('Order has been cancelled', 'warning');
        loadOrders();
        loadStats();
        loadBadgeCounts(); // Update orders badge
    });

    // Payment received notification
    socket.on('payments_sent', (data) => {
        playNotificationSound('success');
        showToast(`💰 Payment received! Check your Payouts section.`, 'success');
        loadStats(); // Update earnings display
    });

    // Order completed - Customer confirmed delivery
    socket.on('order_completed', (data) => {
        playNotificationSound('success');
        showToast(data.notification, 'success');
        loadOrders();
        loadStats();
        loadBadgeCounts(); // Update orders badge
    });

    // Order status updates (from driver, operations, etc.)
    socket.on('order_status_updated', (data) => {
        if (data.new_status === 'delivered') {
            playNotificationSound('info'); // Add sound for important status
            showToast(`📦 Order #${data.order_number} has been delivered to customer!`, 'success');
        }
        loadOrders();
        loadStats();
        loadBadgeCounts(); // Update badges
    });

    // Dispute handlers - Professional queue approach (no modal spam)
    socket.on('dispute_created', (data) => {
        playNotificationSound('warning');
        showToast(data.notification, 'warning');
        // Store in pending disputes queue
        pendingDisputes.push(data);
        // Update badge counter
        updateOrdersBadge();
        // Reload orders to show disputed status
        loadOrders();
    });

    socket.on('dispute_resolved', (data) => {
        playNotificationSound('warning');
        showToast(data.notification, 'info');
        loadOrders();
        loadStats();
    });

    // Payment/Payout Real-time Events
    socket.on('payment_sent', (data) => {
        playNotificationSound('success');
        showToast(data.notification || `💰 Payment of ${data.amount} QAR received! Please confirm.`, 'success');
        // Update earnings badge count
        updateEarningsBadge();
        // If on earnings section, refresh the data
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionEarnings') {
            loadEarnings();
        }
    });

    socket.on('payment_confirmed', (data) => {
        playNotificationSound('success'); // Add success sound
        showToast(data.notification || 'Payment confirmed successfully!', 'success');
        updateEarningsBadge();
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'sectionEarnings') {
            loadEarnings();
        }
    });

    socket.on('payment_auto_confirmed', (data) => {
        showToast(data.notification || 'Payment was auto-confirmed after 7 days.', 'info');
        updateEarningsBadge();
    });

    socket.on('payout_completed', (data) => {
        playNotificationSound('success');
        showToast(data.notification || `Payout completed!`, 'success');
        loadEarnings();
    });

    socket.on('payout_released', (data) => {
        playNotificationSound('info'); // Add info sound
        showToast(data.notification || 'Payout released!', 'info');
    });

    // QC-failed return notification - part is being returned to garage
    socket.on('return_assignment_created', (data) => {
        playNotificationSound('warning');
        showToast(data.notification || '⚠️ QC Failed: Part is being returned to you.', 'warning');
        loadOrders(); // Refresh to show returning_to_garage status
    });

    // Dispute resolved notification - part may be returning
    socket.on('dispute_resolved', (data) => {
        playNotificationSound('info');
        showToast(data.notification || `Dispute for Order #${data.order_number} resolved.`, 'info');
        loadOrders(); // Refresh orders
    });

    // Return driver assigned - driver is on the way with the part
    socket.on('return_driver_assigned', (data) => {
        playNotificationSound('info');
        showToast(data.notification || `Driver ${data.driver_name} bringing back Order #${data.order_number}`, 'info');
    });

    // ===== Flag & Supersede: Customer flagged bid as incorrect =====
    socket.on('bid:flagged', (data) => {
        playNotificationSound('warning');
        showToast(`⚠️ Customer flagged a bid as incorrect: ${data.reason || 'Please review'}`, 'warning');
        // Reload flagged bids to show in Pending Actions
        loadFlaggedBids();
        loadBadgeCounts();
    });

    socket.on('flag:dismissed', (data) => {
        showToast(`Flag dismissed for bid #${data.bid_id}`, 'info');
        loadFlaggedBids();
        loadBadgeCounts();
    });

    // Load initial data
    await Promise.all([
        loadStats(),
        loadRequests(),
        loadBids(),
        loadOrders(),
        loadProfile(),
        loadSubscription(),  // Load subscription to update Analytics badge
        loadBadgeCounts()    // Enterprise badge counts
    ]);

    // Check for pending counter-offers (after bids are loaded)
    loadPendingCounterOffers();

    // Check for pending disputes
    loadPendingDisputes();

    // Check for flagged bids (Flag & Supersede feature)
    loadFlaggedBids();

    // Update earnings badge (awaiting confirmations)
    updateEarningsBadge();

    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/dashboard/garage/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Dashboard stats loaded

        if (data.stats) {
            // Use animated counters for smooth count-up effect
            animateCounter('statPendingBids', data.stats.pending_bids, 800);
            animateCounter('statAcceptedBids', data.stats.accepted_bids_month, 800);
            animateCounter('statActiveOrders', data.stats.active_orders, 800);
            animateCounter('statRevenue', data.stats.revenue_month, 1000);

            // Update Sidebar Badges
            activeOrdersCount = data.stats.active_orders || 0;
            updateOrdersBadge();
        }
        if (data.profile && data.profile.garage_name) {
            document.getElementById('userName').textContent = data.profile.garage_name;
            document.getElementById('userAvatar').textContent = data.profile.garage_name[0].toUpperCase();

            // Store garage name for premium features header greeting
            localStorage.setItem('garageName', data.profile.garage_name);

            // Update header greeting with garage name
            const greetingEl = document.getElementById('headerGreeting');
            if (greetingEl && typeof getTimeBasedGreeting === 'function') {
                greetingEl.textContent = getTimeBasedGreeting() + ', ' + data.profile.garage_name;
            }
        } else {
            console.warn('No profile or garage_name found:', data.profile);
        }
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

// Enterprise Badge Counts - Like Talabat/Keeta
async function loadBadgeCounts() {
    try {
        const res = await fetch(`${API_URL}/dashboard/garage/badge-counts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            // Update Request Badge
            const requestBadge = document.getElementById('requestBadge');
            if (requestBadge) {
                requestBadge.textContent = data.new_requests || 0;
                requestBadge.style.display = data.new_requests > 0 ? 'inline-block' : 'none';
            }

            // Update Bids Badge  
            const bidsBadge = document.getElementById('bidsBadge');
            if (bidsBadge) {
                bidsBadge.textContent = data.my_active_bids || 0;
                bidsBadge.style.display = data.my_active_bids > 0 ? 'inline-block' : 'none';
            }

            // Update Counter Offers Badge (Pending Actions)
            const pendingActionsBadge = document.getElementById('pendingActionsBadge');
            if (pendingActionsBadge) {
                pendingActionsBadge.textContent = data.counter_offers_pending || 0;
                pendingActionsBadge.style.display = data.counter_offers_pending > 0 ? 'inline-block' : 'none';
            }

            // Update Orders Badge
            const activeOrdersBadge = document.getElementById('activeOrdersBadge');
            if (activeOrdersBadge) {
                activeOrdersBadge.textContent = data.pending_orders || 0;
                activeOrdersBadge.style.display = data.pending_orders > 0 ? 'inline-block' : 'none';
            }

            console.log('[BadgeCounts] Updated:', data);
        }
    } catch (err) {
        console.error('[BadgeCounts] Failed to load:', err);
    }
}

// Requests Pagination State
let currentRequestsPage = 1;
const REQUESTS_PAGE_SIZE = 20;

async function loadRequests(page = 1) {
    currentRequestsPage = page;
    const urgency = document.getElementById('requestUrgencyFilter')?.value || 'all';
    const condition = document.getElementById('requestConditionFilter')?.value || 'all';
    const sort = document.getElementById('requestSortOption')?.value || 'newest';

    try {
        const res = await fetch(`${API_URL}/requests/pending?page=${page}&limit=${REQUESTS_PAGE_SIZE}&urgency=${urgency}&condition=${condition}&sort=${sort}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Handle both old array format and new wrapped format
        requests = Array.isArray(data) ? data : (data.requests || []);
        // Save original for filter reset
        originalRequests = [...requests];
        renderRequests();
        updateBadge();

        // Render pagination if available
        if (data.pagination && data.pagination.pages > 1) {
            renderPagination('requestsPagination', data.pagination, 'loadRequests');
        } else {
            const paginationEl = document.getElementById('requestsPagination');
            if (paginationEl) paginationEl.innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load requests:', err);
    }
}

function renderRequests() {
    const html = requests.length ? requests.map(r => createRequestCard(r)).join('') :
        '<div class="empty-state"><i class="bi bi-inbox"></i><h4>No requests yet</h4><p>New requests will appear here in real-time</p></div>';

    document.getElementById('requestsList').innerHTML = html;

    // Recent Orders section on dashboard is populated by loadDashboard/loadOrders
}

// Filter requests - now triggers server reload
function filterRequests() {
    loadRequests(1);
}

// Sort requests based on selected option
function sortRequests() {
    loadRequests(1);
}

// Deprecated client-side sort - kept for reference but unused
function applyRequestSort() {
    // Logic moved to backend
}

// Clear all request filters
function clearRequestFilters() {
    const urgencyEl = document.getElementById('requestUrgencyFilter');
    const conditionEl = document.getElementById('requestConditionFilter');
    const sortEl = document.getElementById('requestSortOption');

    if (urgencyEl) urgencyEl.value = 'all';
    if (conditionEl) conditionEl.value = 'all';
    if (sortEl) sortEl.value = 'newest';

    if (sortEl) sortEl.value = 'newest';

    loadRequests(1);
}


function createRequestCard(req, isNew = false) {
    const title = req.car_make ? `${req.car_make} ${req.car_model} ${req.car_year || ''}` :
        req.summary?.car || 'Vehicle';
    const desc = req.part_description || req.summary?.part || 'Part Request';
    const id = req.request_id;
    const age = req.created_at ? getTimeAgo(req.created_at) : 'Just now';
    const isIgnored = ignoredRequests.includes(id);
    const hasBid = biddedRequests.includes(id);

    // Calculate urgency based on request age (requests expire after 72 hours)
    const createdAt = req.created_at ? new Date(req.created_at) : new Date();
    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    let urgencyClass = 'urgency-low';
    let urgencyLabel = 'low';
    if (hoursOld < 12) {
        urgencyClass = 'urgency-high';
        urgencyLabel = 'high';
    } else if (hoursOld < 36) {
        urgencyClass = 'urgency-medium';
        urgencyLabel = 'medium';
    }

    // Time remaining calculation (72 hour expiry)
    const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000);
    const hoursRemaining = Math.max(0, (expiresAt - Date.now()) / (1000 * 60 * 60));
    const timeRemainingClass = hoursRemaining < 12 ? 'urgent' : '';
    const timeRemainingText = hoursRemaining > 24
        ? `${Math.floor(hoursRemaining / 24)}d ${Math.floor(hoursRemaining % 24)}h left`
        : hoursRemaining > 1
            ? `${Math.floor(hoursRemaining)}h left`
            : 'Expiring soon';

    // Bid count badge styling
    const bidCount = req.bid_count || 0;
    let bidCountClass = bidCount === 0 ? 'none' : bidCount >= 5 ? 'hot' : '';

    let actionHtml = '';
    const bidInfo = bidStatusMap[id];
    const isDismissed = dismissedRequests.includes(id);

    if (isDismissed) {
        // Don't show dismissed requests at all
        return '';
    } else if (bidInfo) {
        // We have a bid on this request - show status based on bid lifecycle
        const statusConfig = {
            pending: { class: 'pending', icon: 'hourglass-split', text: 'Bid Pending' },
            accepted: { class: 'accepted', icon: 'check-circle-fill', text: 'Bid Accepted' },
            rejected: { class: 'rejected', icon: 'x-circle-fill', text: 'Bid Rejected' },
            withdrawn: { class: 'withdrawn', icon: 'arrow-counterclockwise', text: 'Withdrawn' },
            expired: { class: 'expired', icon: 'clock-history', text: 'Expired' }
        };
        const config = statusConfig[bidInfo.status] || { class: 'pending', icon: 'question', text: bidInfo.status };

        let actionsBtn = '';
        if (bidInfo.status === 'pending') {
            // Pending: Show Update Bid button
            actionsBtn = `<button class="btn-update-bid" onclick="openUpdateBidModal('${bidInfo.bid_id}', '${title.replace(/'/g, "\\'")}')">
                        <i class="bi bi-pencil"></i> Update
                    </button>`;
        } else if (['rejected', 'expired', 'withdrawn'].includes(bidInfo.status)) {
            // Rejected/Expired: Show Dismiss button
            actionsBtn = `<button class="btn-dismiss" onclick="dismissRequest('${id}')">
                        <i class="bi bi-x-lg"></i> Dismiss
                    </button>`;
        }

        actionHtml = `<div class="bid-action-group">
                    <span class="bid-status ${config.class}"><i class="bi bi-${config.icon}"></i> ${config.text}</span>
                    ${actionsBtn}
                </div>`;
    } else if (isIgnored) {
        actionHtml = `<span class="ignored-badge"><i class="bi bi-eye-slash"></i> Ignored</span>`;
    } else {
        // Use safe escapeJSString to prevent syntax errors from special chars
        const safeTitle = escapeJSString(title);
        const safeDesc = escapeJSString(desc);
        actionHtml = `<div class="request-actions">
                    <button class="btn-ignore" onclick="ignoreRequest('${id}')" title="Skip this request">
                        <i class="bi bi-x-lg"></i> Skip
                    </button>
                    <button class="btn-bid" onclick="openBidModal('${id}', '${safeTitle} - ${safeDesc}')">
                        <i class="bi bi-tag-fill"></i> Bid Now
                    </button>
                </div>`;
    }

    // Safe image handling with URL normalization - include car images
    let imagesHtml = '';
    const allImages = [];

    // Add car front image first (if exists)
    if (req.car_front_image_url) {
        const url = req.car_front_image_url.startsWith('/') ? req.car_front_image_url : '/' + req.car_front_image_url;
        allImages.push({ url, type: 'car', label: 'Front' });
    }

    // Add car rear image (if exists)
    if (req.car_rear_image_url) {
        const url = req.car_rear_image_url.startsWith('/') ? req.car_rear_image_url : '/' + req.car_rear_image_url;
        allImages.push({ url, type: 'car', label: 'Rear' });
    }

    // Add part images
    if (req.image_urls && req.image_urls.length > 0) {
        req.image_urls.forEach(imgUrl => {
            const url = imgUrl.startsWith('/') ? imgUrl : '/' + imgUrl;
            allImages.push({ url, type: 'part', label: 'Part' });
        });
    }

    if (allImages.length > 0) {
        imagesHtml = `<div class="request-thumbnails">
                    ${allImages.map((img, idx) => `
                        <div class="thumb ${img.type === 'car' ? 'car-image' : ''}" onclick="openRequestLightbox('${id}', ${idx})" title="${img.label}">
                            <img src="${img.url}" onerror="this.src='https://placehold.co/100?text=No+Image'">
                            ${img.type === 'car' ? `<span class="car-badge"><i class="bi bi-car-front-fill"></i> ${img.label}</span>` : ''}
                        </div>
                    `).join('')}
                 </div>`;
    }

    return `
                <div class="request-card ${isNew ? 'new' : ''} ${isIgnored ? 'ignored' : ''} ${hasBid ? 'bidded' : ''} ${urgencyClass}" data-id="${id}">
                    <div class="request-info">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <h4>${escapeHTML(title)}</h4>
                            <span class="urgency-badge ${urgencyLabel}"><i class="bi bi-fire"></i> ${urgencyLabel.toUpperCase()}</span>
                        </div>
                        <p>${escapeHTML(desc)}</p>
                        
                        <!-- Technical Specs for Garage -->
                        <div class="tech-specs">
                            ${req.vin_number ? `<span class="spec-item vin"><i class="bi bi-upc-scan"></i> VIN: <strong>${escapeHTML(req.vin_number)}</strong></span>` : ''}
                            ${req.part_number ? `<span class="spec-item"><i class="bi bi-hash"></i> Part#: <strong>${escapeHTML(req.part_number)}</strong></span>` : ''}
                            ${req.part_category ? `<span class="spec-item"><i class="bi bi-folder"></i> ${escapeHTML(req.part_category)}${req.part_subcategory ? ' > ' + escapeHTML(req.part_subcategory) : ''}</span>` : ''}
                            <span class="spec-item condition ${req.condition_required === 'new' ? 'new' : req.condition_required === 'used' ? 'used' : 'any'}"><i class="bi bi-${req.condition_required === 'new' ? 'star-fill' : req.condition_required === 'used' ? 'recycle' : 'check-circle'}"></i> ${(req.condition_required || 'any').toUpperCase()}</span>
                        </div>
                        
                        ${imagesHtml}
                        <div class="request-meta">
                            <span class="time-remaining ${timeRemainingClass}"><i class="bi bi-hourglass-split"></i> ${timeRemainingText}</span>
                            <span class="bid-count-badge ${bidCountClass}"><i class="bi bi-people-fill"></i> ${bidCount} bids</span>
                        </div>
                    </div>
                    ${actionHtml}
                </div>
            `;
}


function openRequestLightbox(id, index) {
    // Find request in the global list
    const req = requests.find(r => r.request_id === id);
    if (!req) return;

    // Build combined image array (same order as thumbnails)
    const allImages = [];
    if (req.car_front_image_url) allImages.push(req.car_front_image_url.startsWith('/') ? req.car_front_image_url : '/' + req.car_front_image_url);
    if (req.car_rear_image_url) allImages.push(req.car_rear_image_url.startsWith('/') ? req.car_rear_image_url : '/' + req.car_rear_image_url);
    if (req.image_urls) allImages.push(...req.image_urls.map(u => u.startsWith('/') ? u : '/' + u));

    if (allImages.length > 0) {
        openLightbox(allImages, index);
    }
}

function prependRequest(data) {
    // Socket now sends complete request data
    const newReq = {
        request_id: data.request_id,
        car_make: data.car_make,
        car_model: data.car_model,
        car_year: data.car_year,
        vin_number: data.vin_number,
        part_description: data.part_description,
        part_number: data.part_number,
        part_category: data.part_category,
        part_subcategory: data.part_subcategory,
        condition_required: data.condition_required,
        image_urls: data.image_urls || [],
        car_front_image_url: data.car_front_image_url || null,
        car_rear_image_url: data.car_rear_image_url || null,
        delivery_address_text: data.delivery_address_text,
        status: data.status || 'active',
        created_at: data.created_at || new Date().toISOString(),
        bid_count: data.bid_count || 0
    };
    requests.unshift(newReq);
    renderRequests();
}

// Bids Pagination State
let currentBidsPage = 1;
const BIDS_PAGE_SIZE = 20;

async function loadBids(page = 1) {
    currentBidsPage = page;
    try {
        const res = await fetch(`${API_URL}/bids/my?page=${page}&limit=${BIDS_PAGE_SIZE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Handle both old array format and new paginated format
        const bids = Array.isArray(data) ? data : (data.bids || []);

        // Build comprehensive bid status map
        bidStatusMap = {};
        bids.forEach(b => {
            bidStatusMap[b.request_id] = { status: b.status, bid_id: b.bid_id };
        });

        // Legacy arrays for backward compatibility
        biddedRequests = bids.filter(b => b.status === 'pending').map(b => b.request_id);
        rejectedRequests = bids.filter(b => b.status === 'rejected').map(b => b.request_id);

        renderRequests(); // Re-render to show correct state
        updateBadge(); // Update badge after bidStatusMap is set

        const html = bids.length ? bids.map(b => {
            const statusLabels = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn', expired: 'Expired' };
            const images = b.image_urls || [];
            const thumbnail = images.length > 0 ? images[0] : null;

            // Use final accepted amount for accepted bids, otherwise use bid_amount
            const displayAmount = (b.status === 'accepted' && b.final_accepted_amount) ? b.final_accepted_amount : b.bid_amount;
            // original_bid_amount preserves the initial garage bid; bid_amount is overwritten on acceptance
            const originalBidAmount = b.original_bid_amount || b.bid_amount;
            const wasNegotiated = b.status === 'accepted' && b.final_accepted_amount && parseFloat(b.final_accepted_amount) !== parseFloat(originalBidAmount);

            return `
                <div class="bid-card-pro ${b.status}" data-bid-id="${b.bid_id}">
                    <div class="bid-card-left">
                        ${thumbnail ? `<img src="${thumbnail}" alt="Part" class="bid-thumb">` : '<div class="bid-thumb-placeholder"><i class="bi bi-image"></i></div>'}
                        <div class="bid-info">
                            <div class="bid-amount-row">
                                ${wasNegotiated ? `
                                    <span class="bid-amount-original">${originalBidAmount} QAR</span>
                                    <span class="bid-amount final">${displayAmount} QAR</span>
                                    <span class="negotiated-badge"><i class="bi bi-arrow-repeat"></i> Negotiated</span>
                                ` : `
                                    <span class="bid-amount">${displayAmount} QAR</span>
                                `}
                                <span class="bid-status-badge ${b.status}">${statusLabels[b.status] || b.status}</span>
                            </div>
                            ${b.order_number ? `<div class="order-number-badge"><i class="bi bi-hash"></i> ${b.order_number}</div>` : ''}
                            <div class="bid-car">${escapeHTML(b.car_summary || 'Vehicle')} - ${escapeHTML(b.part_category || 'Part')}${b.part_subcategory ? ' > ' + escapeHTML(b.part_subcategory) : ''}</div>
                            ${b.part_description && b.part_category ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(b.part_description.slice(0, 40))}</div>` : ''}
                            <div class="bid-meta">
                                <span><i class="bi bi-calendar3"></i> ${getTimeAgo(b.created_at)}</span>
                                <span><i class="bi bi-shield-check"></i> ${b.warranty_days}d warranty</span>
                                <span><i class="bi bi-box-seam"></i> ${b.part_condition || 'Used'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="bid-timeline-container" id="timeline-${b.bid_id}">
                        <div class="timeline-loading">
                            <div class="timeline-skeleton"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : '<div class="empty-state"><i class="bi bi-tag"></i><h4>No bids yet</h4><p>Submit bids on part requests to see them here</p></div>';

        // Store for filtering
        allBidsData = bids;

        document.getElementById('bidsList').innerHTML = html;

        // Fetch and render negotiation timelines for each bid asynchronously
        // Use original_bid_amount to show true initial bid (bid_amount is overwritten on acceptance)
        bids.forEach(b => fetchAndRenderTimeline(b.bid_id, b.original_bid_amount || b.bid_amount, b.created_at));


        // Render pagination
        if (data.pagination && data.pagination.pages > 1) {
            renderPagination('bidsPagination', data.pagination, 'loadBids');
        } else {
            const paginationEl = document.getElementById('bidsPagination');
            if (paginationEl) paginationEl.innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load bids:', err);
    }
}

// Fetch and render inline timeline for a bid
async function fetchAndRenderTimeline(bidId, initialAmount, bidCreatedAt) {
    const container = document.getElementById(`timeline-${bidId}`);
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/negotiations/bids/${bidId}/negotiations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const history = data.negotiations || [];

        // Build compact inline timeline
        let timelineHtml = `<div class="mini-timeline">`;

        // Initial bid step
        timelineHtml += `
            <div class="timeline-step garage" title="Your Initial Bid">
                <div class="step-marker"><i class="bi bi-tag-fill"></i></div>
                <div class="step-info">
                    <span class="step-amount">${initialAmount} QAR</span>
                    <span class="step-time">${getTimeAgo(bidCreatedAt)}</span>
                </div>
            </div>
        `;

        if (history.length > 0) {
            // Show up to 3 most recent negotiation steps
            const recentHistory = history.slice(-3);
            recentHistory.forEach((co, idx) => {
                const isGarage = co.offered_by_type === 'garage';
                const statusIcon = co.status === 'accepted' ? 'check-circle-fill' :
                    co.status === 'rejected' ? 'x-circle-fill' :
                        co.status === 'countered' ? 'arrow-repeat' : 'hourglass-split';
                const statusClass = co.status === 'accepted' ? 'accepted' :
                    co.status === 'rejected' ? 'rejected' :
                        co.status === 'countered' ? 'countered' : 'pending';

                timelineHtml += `
                    <div class="timeline-connector"></div>
                    <div class="timeline-step ${isGarage ? 'garage' : 'customer'} ${statusClass}" title="${isGarage ? 'Your Counter' : 'Customer Counter'} - ${co.status}">
                        <div class="step-marker"><i class="bi bi-${isGarage ? 'building' : 'person-fill'}"></i></div>
                        <div class="step-info">
                            <span class="step-amount">${co.proposed_amount} QAR</span>
                            <span class="step-status ${statusClass}"><i class="bi bi-${statusIcon}"></i></span>
                        </div>
                    </div>
                `;
            });

            // If there are more than 3 items, show a "more" indicator
            if (history.length > 3) {
                timelineHtml += `<div class="timeline-more">+${history.length - 3} more</div>`;
            }
        } else {
            // No negotiation yet
            timelineHtml += `
                <div class="timeline-connector dashed"></div>
                <div class="timeline-step waiting">
                    <div class="step-marker"><i class="bi bi-clock"></i></div>
                    <div class="step-info">
                        <span class="step-label">Awaiting response</span>
                    </div>
                </div>
            `;
        }

        timelineHtml += `</div>`;
        container.innerHTML = timelineHtml;

    } catch (err) {
        console.error('Failed to load timeline for bid', bidId, err);
        container.innerHTML = `<div class="timeline-error"><i class="bi bi-exclamation-triangle"></i></div>`;
    }
}

// Load pending counter-offers and render in Pending Actions section
async function loadPendingCounterOffers() {
    try {
        const res = await fetch(`${API_URL}/negotiations/pending-offers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.pending_offers && data.pending_offers.length > 0) {
            pendingCounterOffers = data.pending_offers.map(co => ({
                counter_offer_id: co.counter_offer_id,
                bid_id: co.bid_id,
                proposed_amount: co.proposed_amount,
                original_amount: co.original_bid_amount || co.original_amount, // Backend renamed to original_bid_amount
                garage_last_offer: co.garage_last_offer, // Garage's last counter-offer
                message: co.message,
                car_summary: co.car_summary,
                part_description: co.part_description,
                created_at: co.created_at,
                round_number: co.round_number || 1
            }));
        } else {
            pendingCounterOffers = [];
        }

        // Render to Pending Actions section
        renderPendingActions();
        updatePendingActionsBadge();

    } catch (err) {
        console.error('Failed to load pending counter-offers:', err);
    }
}

// Render pending actions (counter-offers + disputes) as premium cards
function renderPendingActions() {
    const container = document.getElementById('pendingActionsList');
    if (!container) return;

    const allActions = [
        ...flaggedBids.map(f => ({ type: 'flagged-bid', data: f })),  // Flagged bids first (highest priority)
        ...pendingCounterOffers.map(co => ({ type: 'counter-offer', data: co })),
        ...pendingDisputes.map(d => ({ type: 'dispute', data: d }))
    ];

    // Update summary counts
    const counterEl = document.getElementById('counterOfferCount');
    const disputeEl = document.getElementById('disputeCount');
    const flaggedEl = document.getElementById('flaggedBidCount');
    if (counterEl) counterEl.textContent = pendingCounterOffers.length;
    if (disputeEl) disputeEl.textContent = pendingDisputes.length;
    if (flaggedEl) flaggedEl.textContent = flaggedBids.length;

    if (allActions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border);">
                <i class="bi bi-check-circle" style="font-size: 48px; color: var(--success); margin-bottom: 16px;"></i>
                <h4 style="margin: 0 0 8px; font-size: 18px; color: var(--text-primary);">All Clear!</h4>
                <p style="margin: 0; color: var(--text-secondary);">No pending actions right now. Counter-offers, flagged bids, and disputes will appear here.</p>
            </div>
        `;
        return;
    }

    // Render cards
    container.innerHTML = allActions.map(action => {
        if (action.type === 'flagged-bid') {
            return createFlaggedBidCard(action.data);
        } else if (action.type === 'counter-offer') {
            return createCounterOfferCard(action.data);
        } else {
            return createDisputeActionCard(action.data);
        }
    }).join('');
}

// Create premium counter-offer card
function createCounterOfferCard(co) {
    const bidRef = `BID-${String(co.bid_id).padStart(4, '0')}`;

    // Calculate time remaining (24 hours from creation)
    const createdAt = new Date(co.created_at || Date.now());
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const hoursRemaining = Math.max(0, (expiresAt - Date.now()) / (1000 * 60 * 60));

    let urgencyClass = 'urgency-low';
    let urgencyColor = '#10b981';
    if (hoursRemaining < 2) {
        urgencyClass = 'urgency-critical';
        urgencyColor = '#ef4444';
    } else if (hoursRemaining < 6) {
        urgencyClass = 'urgency-high';
        urgencyColor = '#f59e0b';
    }

    const timeText = hoursRemaining > 1
        ? `${Math.floor(hoursRemaining)}h ${Math.floor((hoursRemaining % 1) * 60)}m`
        : `${Math.floor(hoursRemaining * 60)}m`;

    // Calculate price difference based on garage's LAST counter-offer (not original bid)
    const garageAmount = co.garage_last_offer || co.original_amount;
    const priceDiff = (((co.proposed_amount - garageAmount) / garageAmount) * 100).toFixed(0);
    const isLower = co.proposed_amount < garageAmount;

    return `
        <div class="pending-action-card counter-offer-card ${urgencyClass}" style="
            background: linear-gradient(135deg, var(--bg-card) 0%, rgba(249, 115, 22, 0.05) 100%);
            border: 1px solid rgba(249, 115, 22, 0.3);
            border-radius: 16px;
            padding: 20px;
            animation: slideIn 0.3s ease-out;
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                    <span style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">BID-${String(co.bid_id).padStart(4, '0')}</span>
                    <span style="background: rgba(249, 115, 22, 0.2); color: #f97316; padding: 4px 8px; border-radius: 6px; font-size: 11px; margin-left: 8px;">
                        <i class="bi bi-arrow-repeat"></i> Counter-Offer
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; color: ${urgencyColor}; font-size: 13px; font-weight: 600;">
                    <i class="bi bi-clock"></i>
                    <span>${timeText} left</span>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">${escapeHTML(co.car_summary || 'Vehicle')}</div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${escapeHTML(co.part_description || 'Part Request')}</div>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 16px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-muted);">${co.garage_last_offer ? 'Your Counter' : 'Your Bid'}</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">${parseFloat(garageAmount).toFixed(0)} QAR</div>
                </div>
                <i class="bi bi-arrow-right" style="font-size: 24px; color: var(--accent);"></i>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-muted);">Customer Offer</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${isLower ? '#ef4444' : '#10b981'};">${parseFloat(co.proposed_amount).toFixed(0)} QAR</div>
                    <div style="font-size: 11px; color: ${isLower ? '#ef4444' : '#10b981'};">${priceDiff > 0 ? '+' : ''}${priceDiff}%</div>
                </div>
            </div>
            
            ${co.message ? `
                <div style="padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); font-style: italic;">
                    <i class="bi bi-chat-dots"></i> "${escapeHTML(co.message)}"
                </div>
            ` : ''}
            
            ${co.round_number >= 3 ? `
                <div style="padding: 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; margin-bottom: 16px; text-align: center;">
                    <i class="bi bi-exclamation-triangle" style="color: #f59e0b;"></i>
                    <span style="color: #f59e0b; font-weight: 600;">Round 3/3 - Final Round</span>
                    <p style="margin: 8px 0 0; font-size: 12px; color: var(--text-secondary);">No more counter-offers allowed. Please Accept or Decline.</p>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 12px;">
                <button onclick="respondToCounterFromCard('${co.counter_offer_id}', 'accept')" style="
                    flex: 1; padding: 12px; border: none; border-radius: 10px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    transition: transform 0.2s, box-shadow 0.2s;
                " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="bi bi-check-circle"></i> Accept
                </button>
                ${co.round_number < 3 ? `
                <button onclick="openCounterInputForCard('${co.counter_offer_id}', ${co.proposed_amount})" style="
                    flex: 1; padding: 12px; border: 1px solid var(--accent); border-radius: 10px;
                    background: transparent; color: var(--accent); font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    transition: all 0.2s;
                " onmouseover="this.style.background='var(--accent)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='var(--accent)'">
                    <i class="bi bi-arrow-repeat"></i> Counter
                </button>
                ` : ''}
                <button onclick="respondToCounterFromCard('${co.counter_offer_id}', 'reject')" style="
                    padding: 12px 16px; border: 1px solid var(--danger); border-radius: 10px;
                    background: transparent; color: var(--danger); font-weight: 600; cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='var(--danger)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='var(--danger)'">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        </div>
    `;
}

// Create dispute action card
function createDisputeActionCard(dispute) {
    return `
        <div class="pending-action-card dispute-card" style="
            background: linear-gradient(135deg, var(--bg-card) 0%, rgba(245, 158, 11, 0.05) 100%);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 16px;
            padding: 20px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <span style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">
                    <i class="bi bi-exclamation-triangle"></i> Dispute
                </span>
                <span style="font-size: 13px; color: var(--text-secondary);">Order #${dispute.order_number || dispute.order_id}</span>
            </div>
            <div style="margin-bottom: 16px; color: var(--warning); font-weight: 600;">${escapeHTML(dispute.reason || 'Customer reported an issue')}</div>
            <div style="display: flex; gap: 12px;">
                <button onclick="openDisputeModalFromCard('${dispute.dispute_id}', '${dispute.order_id}')" style="
                    flex: 1; padding: 12px; border: none; border-radius: 10px;
                    background: var(--warning); color: white; font-weight: 600; cursor: pointer;
                ">
                    <i class="bi bi-eye"></i> View Details
                </button>
            </div>
        </div>
    `;
}

// Update pending actions badge
function updatePendingActionsBadge() {
    const total = pendingCounterOffers.length + pendingDisputes.length + flaggedBids.length;
    const badge = document.getElementById('pendingActionsBadge');
    if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'inline-flex' : 'none';
    }
}

// Respond to counter-offer from card (inline)
async function respondToCounterFromCard(counterOfferId, action) {
    try {
        const res = await fetch(`${API_URL}/negotiations/counter-offers/${counterOfferId}/garage-respond`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || `Counter-offer ${action}ed!`, 'success');
            // Reload pending actions
            await loadPendingCounterOffers();
            loadBids();
            if (action === 'accept') loadOrders();
        } else {
            showToast(data.error || 'Failed to respond', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Open counter input inline (simplified)
function openCounterInputForCard(counterOfferId, currentAmount) {
    const newAmount = prompt(`Enter your counter price (current offer: ${currentAmount} QAR):`);
    if (newAmount && !isNaN(parseFloat(newAmount))) {
        respondToCounterWithAmount(counterOfferId, parseFloat(newAmount));
    }
}

// Respond with counter amount
async function respondToCounterWithAmount(counterOfferId, amount) {
    try {
        const res = await fetch(`${API_URL}/negotiations/counter-offers/${counterOfferId}/garage-respond`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'counter', counter_amount: amount })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'Counter-offer sent!', 'success');
            await loadPendingCounterOffers();
            loadBids();
        } else {
            showToast(data.error || 'Failed to counter', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ===== Flag & Supersede: Edit & Resubmit Modal =====
let currentEditingBid = null;
let editBidPhotos = [];

function openEditBidModal(bidId) {
    // Look up flag data from global flaggedBids array
    const flagData = flaggedBids.find(f => f.bid_id === bidId);

    if (!flagData) {
        showToast('Bid data not found. Please refresh the page.', 'error');
        return;
    }

    currentEditingBid = flagData;
    editBidPhotos = [];

    // Prepare modal HTML
    const modalHtml = `
        <div id="editBidModal" class="modal-overlay" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.2s ease-out;
        ">
            <div class="modal-content" style="
                background: var(--bg-secondary); border-radius: 20px;
                width: 95%; max-width: 500px; max-height: 90vh; overflow-y: auto;
                animation: slideUp 0.3s ease-out;
            ">
                <div style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px; color: var(--text-primary);">
                            <i class="bi bi-pencil-square" style="color: #10b981;"></i> Edit & Resubmit Bid
                        </h2>
                        <p style="margin: 4px 0 0; font-size: 12px; color: var(--text-muted);">BID-${String(currentEditingBid.bid_id).padStart(4, '0')}</p>
                    </div>
                    <button onclick="closeEditBidModal()" style="background: none; border: none; font-size: 24px; color: var(--text-muted); cursor: pointer;">×</button>
                </div>
                
                <div style="padding: 20px;">
                    <!-- Flag Reason Alert -->
                    <div style="padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight: 600; margin-bottom: 4px;">
                            <i class="bi bi-flag-fill"></i> Customer Issue
                        </div>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                            ${escapeHTML(currentEditingBid.customer_note || getReasonLabel(currentEditingBid.reason))}
                        </p>
                    </div>
                    
                    <!-- Original Bid Info -->
                    <div style="padding: 12px; background: var(--bg-card); border-radius: 10px; margin-bottom: 20px; font-size: 13px;">
                        <div style="color: var(--text-muted); margin-bottom: 4px;">Original Bid</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${parseFloat(currentEditingBid.bid_amount || 0).toFixed(0)} QAR</div>
                    </div>
                    
                    <!-- Corrected Price -->
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                            Corrected Price (QAR) *
                        </label>
                        <input type="number" id="editBidPrice" value="${currentEditingBid.bid_amount || ''}" min="1" style="
                            width: 100%; padding: 14px; border: 1px solid var(--border); border-radius: 10px;
                            background: var(--input-bg); color: var(--text-primary); font-size: 16px;
                        ">
                    </div>
                    
                    <!-- Part Condition -->
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                            Part Condition
                        </label>
                        <select id="editBidCondition" style="
                            width: 100%; padding: 14px; border: 1px solid var(--border); border-radius: 10px;
                            background: var(--input-bg); color: var(--text-primary); font-size: 14px;
                        ">
                            <option value="used" ${currentEditingBid.part_condition === 'used' ? 'selected' : ''}>Used</option>
                            <option value="new" ${currentEditingBid.part_condition === 'new' ? 'selected' : ''}>New</option>
                            <option value="refurbished" ${currentEditingBid.part_condition === 'refurbished' ? 'selected' : ''}>Refurbished</option>
                        </select>
                    </div>
                    
                    <!-- Warranty -->
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                            Warranty (days)
                        </label>
                        <input type="number" id="editBidWarranty" value="${currentEditingBid.warranty_days || 30}" min="0" max="365" style="
                            width: 100%; padding: 14px; border: 1px solid var(--border); border-radius: 10px;
                            background: var(--input-bg); color: var(--text-primary); font-size: 14px;
                        ">
                    </div>
                    
                    <!-- Photo Upload -->
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                            <i class="bi bi-camera"></i> Replace Photos (optional)
                        </label>
                        <input type="file" id="editBidPhotos" accept="image/*" multiple onchange="handleEditBidPhotos(event)" style="
                            width: 100%; padding: 14px; border: 1px dashed var(--border); border-radius: 10px;
                            background: var(--input-bg); color: var(--text-primary); font-size: 13px;
                        ">
                        <div id="editBidPhotoPreview" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"></div>
                    </div>
                    
                    <!-- Note to Customer -->
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                            Note to Customer (optional)
                        </label>
                        <textarea id="editBidNote" rows="2" placeholder="Explain the correction..." style="
                            width: 100%; padding: 14px; border: 1px solid var(--border); border-radius: 10px;
                            background: var(--input-bg); color: var(--text-primary); font-size: 14px; resize: none;
                        "></textarea>
                    </div>
                    
                    <!-- Actions -->
                    <div style="display: flex; gap: 12px;">
                        <button onclick="closeEditBidModal()" style="
                            flex: 1; padding: 14px; border: 1px solid var(--border); border-radius: 10px;
                            background: transparent; color: var(--text-secondary); font-weight: 600; cursor: pointer;
                        ">Cancel</button>
                        <button onclick="submitCorrectedBid('${currentEditingBid.bid_id}')" style="
                            flex: 2; padding: 14px; border: none; border-radius: 10px;
                            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                            color: white; font-weight: 600; cursor: pointer;
                        ">
                            <i class="bi bi-check-circle"></i> Submit Correction
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Focus on price input
    setTimeout(() => {
        document.getElementById('editBidPrice')?.focus();
    }, 100);
}

function getReasonLabel(reason) {
    const labels = {
        wrong_price: 'The price was incorrect',
        wrong_part: 'Wrong part or condition described',
        wrong_photo: 'Photo does not match the actual part',
        other: 'Other issue reported'
    };
    return labels[reason] || reason || 'Issue reported';
}

function closeEditBidModal() {
    const modal = document.getElementById('editBidModal');
    if (modal) {
        modal.remove();
    }
    currentEditingBid = null;
    editBidPhotos = [];
}

function handleEditBidPhotos(event) {
    const files = event.target.files;
    const preview = document.getElementById('editBidPhotoPreview');
    preview.innerHTML = '';
    editBidPhotos = [];

    for (let i = 0; i < files.length && i < 5; i++) {
        const file = files[i];
        editBidPhotos.push(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML += `
                <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 2px solid var(--border);">
                    <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            `;
        };
        reader.readAsDataURL(file);
    }
}

async function submitCorrectedBid(bidId) {
    const price = document.getElementById('editBidPrice')?.value;
    const condition = document.getElementById('editBidCondition')?.value;
    const warranty = document.getElementById('editBidWarranty')?.value;
    const note = document.getElementById('editBidNote')?.value || '';

    if (!price || parseFloat(price) <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }

    try {
        // Prepare form data (for photos)
        const formData = new FormData();
        formData.append('bid_amount', price);
        formData.append('part_condition', condition);
        formData.append('warranty_days', warranty);
        formData.append('correction_note', note);

        editBidPhotos.forEach((file, idx) => {
            formData.append('images', file);
        });

        const res = await fetch(`${API_URL}/bids/${bidId}/supersede`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            showToast('✅ Corrected bid submitted successfully!', 'success');
            closeEditBidModal();
            loadFlaggedBids();
            loadBids();
            loadBadgeCounts();
        } else {
            showToast(data.error || 'Failed to submit correction', 'error');
        }
    } catch (err) {
        console.error('Submit correction error:', err);
        showToast('Connection error. Please try again.', 'error');
    }
}

async function acknowledgeFlaggedBid(flagId, bidId) {
    try {
        const res = await fetch(`${API_URL}/bids/flags/${flagId}/acknowledge`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Flag acknowledged. Customer has been notified.', 'info');
            loadFlaggedBids();
            loadBadgeCounts();
        } else {
            showToast(data.error || 'Failed to acknowledge flag', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Open dispute modal from card
function openDisputeModalFromCard(disputeId, orderId) {
    // Find dispute in pendingDisputes and open modal
    const dispute = pendingDisputes.find(d => d.dispute_id === disputeId || d.order_id === orderId);
    if (dispute) {
        openDisputeModal(dispute);
    }
}

// Generate visual timeline for order progression
function generateOrderTimeline(status) {
    const stages = [
        { key: 'confirmed', icon: 'check-circle', label: 'Confirmed' },
        { key: 'ready_for_pickup', icon: 'box-seam', label: 'Ready' },
        { key: 'collected', icon: 'building', label: 'Collected' },
        { key: 'in_transit', icon: 'truck', label: 'In Transit' },
        { key: 'delivered', icon: 'house-check', label: 'Delivered' }
    ];

    const statusOrder = ['confirmed', 'preparing', 'ready_for_pickup', 'collected', 'in_transit', 'delivered', 'completed'];
    const currentIndex = statusOrder.indexOf(status);

    // Map status to display stages
    const getStageState = (stageKey) => {
        const stageIndex = stages.findIndex(s => s.key === stageKey);
        const mappedIndex = {
            'confirmed': 0,
            'preparing': 0,
            'ready_for_pickup': 1,
            'collected': 2,
            'in_transit': 3,
            'delivered': 4,
            'completed': 4
        }[status] || 0;

        if (stageIndex < mappedIndex) return 'completed';
        if (stageIndex === mappedIndex) return 'active';
        return 'upcoming';
    };

    const progressPercent = Math.min(100, (currentIndex / (statusOrder.length - 1)) * 100);

    return `
        <div class="order-timeline">
            <div class="timeline-progress" style="width: ${progressPercent}%;"></div>
            ${stages.map(stage => `
                <div class="timeline-step ${getStageState(stage.key)}">
                    <div class="timeline-icon">
                        <i class="bi bi-${stage.icon}"></i>
                    </div>
                    <span class="timeline-label">${stage.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadOrders() {
    try {
        const res = await fetch(`${API_URL}/orders/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Handle both old array format and new wrapped format
        const orders = Array.isArray(data) ? data : (data.orders || []);

        const statusFlow = ['confirmed', 'preparing', 'ready_for_pickup', 'collected', 'in_transit', 'delivered'];
        const statusLabels = {
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            ready_for_pickup: 'Ready for Collection',
            collected: 'Picked Up by Driver',
            in_transit: 'In Transit',
            delivered: 'Delivered',
            completed: 'Completed',
            disputed: 'Disputed',
            refunded: 'Refunded',
            returning_to_garage: 'Returning to You'
        };

        const html = orders.length ? orders.map(o => {
            const isCancelled = o.order_status?.includes('cancelled');
            const isDisputed = o.order_status === 'disputed';
            const isRefunded = o.order_status === 'refunded';
            const statusLabel = isCancelled ? 'Cancelled' : (statusLabels[o.order_status] || o.order_status);
            const statusClass = isCancelled ? 'cancelled' : (isDisputed ? 'disputed' : (isRefunded ? 'refunded' : o.order_status?.replace('_', '-') || ''));

            // GARAGE can ONLY control orders in these states
            const garageAllowedTransitions = {
                'confirmed': { next: 'preparing', label: 'Start Preparing' },
                'preparing': { next: 'ready_for_pickup', label: 'Mark as Ready' }
            };

            // Determine action buttons based on status
            let actionsHtml = '';

            if (isDisputed) {
                // Disputed orders - show Review Dispute button
                actionsHtml = `
                            <div class="order-actions">
                                <button class="btn-status dispute" onclick="reviewDisputeForOrder('${o.order_id}')" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                                    <i class="bi bi-exclamation-triangle"></i> Review Dispute
                                </button>
                            </div>
                        `;
            } else if (o.order_status === 'returning_to_garage') {
                // Part is being returned after QC failure
                actionsHtml = `<div class="order-actions"><span style="color: var(--warning);"><i class="bi bi-arrow-return-left"></i> Part being returned - QC Failed</span></div>`;
            } else if (garageAllowedTransitions[o.order_status] && !isCancelled) {
                // Garage CAN update this order
                const transition = garageAllowedTransitions[o.order_status];
                actionsHtml = `
                            <div class="order-actions">
                                <button class="btn-cancel" onclick="openCancelOrderModal('${o.order_id}')" title="Cancel this order">
                                    <i class="bi bi-x-circle"></i> Cancel
                                </button>
                                <button class="btn-status next" onclick="updateOrderStatus('${o.order_id}', '${transition.next}')">
                                    <i class="bi bi-check-circle"></i> ${transition.label}
                                </button>
                            </div>
                        `;
            } else if (o.order_status === 'ready_for_pickup') {
                // Waiting for QScrap collection - no actions for garage
                actionsHtml = `<div class="order-actions"><span style="color: var(--primary);"><i class="bi bi-hourglass-split"></i> Waiting for QScrap collection</span></div>`;
            } else if (o.order_status === 'collected') {
                // Part picked up by driver - on the way to customer
                actionsHtml = `<div class="order-actions"><span style="color: var(--primary);"><i class="bi bi-truck"></i> Part is on its way to customer</span></div>`;
            } else if (o.order_status === 'in_transit') {
                // In delivery
                actionsHtml = `<div class="order-actions"><span style="color: var(--primary);"><i class="bi bi-truck"></i> Being delivered to customer</span></div>`;
            } else if (o.order_status === 'delivered' || o.order_status === 'completed') {
                // Completed - show payout download button
                const payoutAmount = o.garage_payout_amount || (parseFloat(o.part_price || 0) * 0.85);
                actionsHtml = `
                    <div class="order-actions" style="display: flex; flex-direction: column; gap: 8px;">
                        <span style="color: var(--success);"><i class="bi bi-check-circle-fill"></i> Completed • Net: ${parseFloat(payoutAmount).toFixed(2)} QAR</span>
                        <button class="btn-outline-sm" onclick="event.stopPropagation(); downloadPayoutStatement('${o.order_id}')" style="padding: 6px 12px; font-size: 12px; border: 1px solid var(--primary); color: var(--primary); background: transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--primary)'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='var(--primary)';">
                            <i class="bi bi-file-earmark-pdf"></i> Payout Statement / كشف حساب
                        </button>
                    </div>
                `;
            } else if (isCancelled) {
                // Cancelled orders - show clear status (no payout for cancelled orders per BRAIN v3.0)
                const canceller = o.order_status === 'cancelled_by_customer' ? 'Customer' : 'Garage';
                // Clear professional message about what happened
                actionsHtml = `
                    <div class="order-actions" style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="padding: 10px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.04)); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);">
                            ${o.order_status === 'cancelled_by_customer' ? `
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #dc2626; font-weight: 600; font-size: 12px;">
                                        <i class="bi bi-person-x"></i> ${canceller} Cancelled
                                    </span>
                                    <span style="color: var(--text-muted); font-weight: 600; font-size: 12px;">
                                        Order Lost
                                    </span>
                                </div>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                                    No payout for this order. Customer refund processed.
                                </div>
                            ` : `
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #dc2626; font-weight: 600; font-size: 12px;">
                                        <i class="bi bi-shop"></i> You Cancelled
                                    </span>
                                    <span style="color: var(--text-muted); font-weight: 600; font-size: 12px;">
                                        No payout
                                    </span>
                                </div>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                                    Customer received full refund. No charges to you.
                                </div>
                            `}
                        </div>
                    </div>
                `;
            } else if (isRefunded) {
                // Refunded orders
                actionsHtml = `<div class="order-actions"><span style="color: var(--danger);"><i class="bi bi-arrow-return-left"></i> Refunded to customer</span></div>`;
            }

            // Get thumbnail
            const images = o.bid_images || o.request_images || [];
            const thumbnail = images.length > 0 ? images[0] : null;

            return `
                        <div class="order-card ${isCancelled ? 'cancelled' : ''} ${isDisputed ? 'disputed' : ''}" onclick="viewOrder('${o.order_id}')" style="cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.15)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                            ${isCancelled ? '<div class="cancelled-overlay"></div>' : ''}
                            <div class="order-header">
                                <div class="order-number">Order #${o.order_number || o.order_id.slice(0, 8)}</div>
                                <span class="order-status ${statusClass}">${statusLabel}</span>
                            </div>
                            <div style="display: flex; gap: 12px; margin-top: 10px;">
                                ${thumbnail ? `<img src="${thumbnail}" alt="Part" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">` : '<div style="width: 60px; height: 60px; background: var(--bg-tertiary); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="bi bi-image" style="color: var(--text-muted);"></i></div>'}
                                <div style="flex: 1; min-width: 0;">
                                    <div style="color: var(--text-secondary); font-size: 14px; font-weight: 600;">
                                        ${o.car_make} ${o.car_model} - ${o.part_category || o.part_description?.slice(0, 30) || 'Part'}
                                    </div>
                                    ${o.part_description && o.part_category ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(o.part_description.slice(0, 35))}</div>` : ''}
                                    <div style="font-weight: 600; margin-top: 4px;">${o.part_price} QAR</div>
                                </div>
                            </div>
                            ${actionsHtml}
                        </div>
                    `;
        }).join('') : '<div class="empty-state"><i class="bi bi-box-seam"></i><h4>No orders yet</h4><p>When customers accept your bids, orders will appear here</p></div>';

        document.getElementById('ordersList').innerHTML = html;

        // Store all orders for filtering
        window.allOrders = orders;

        // Update order count badge
        const activeCount = orders.filter(o => !['completed', 'cancelled_by_customer', 'cancelled_by_garage', 'refunded'].includes(o.order_status)).length;
        setOrdersBadgeCount(activeCount);

        // Populate Dashboard Recent Orders (collapsible - 1 by default, 10 when expanded)
        window.recentOrdersData = orders.slice(0, 10); // Store for toggle
        window.recentOrdersExpanded = false;
        renderRecentOrders();
    } catch (err) {
        console.error('Failed to load orders:', err);
    }
}

// Update orders badge in nav - sets global activeOrdersCount and delegates to main function
// NOTE: Main updateOrdersBadge() is defined at line ~3508 and handles display logic
function setOrdersBadgeCount(count) {
    activeOrdersCount = count;
    updateOrdersBadge();
}

// Update earnings badge in nav (payouts awaiting confirmation)
async function updateEarningsBadge() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts?status=awaiting_confirmation`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const count = data.payouts?.length || 0;
        const badge = document.getElementById('earningsBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    } catch (err) {
        console.error('Failed to update earnings badge:', err);
    }
}

// Filter bids
let currentBidFilter = 'all';
let allBidsData = [];

function filterBids(filter) {
    currentBidFilter = filter;

    // Update button styles in Bids section
    document.querySelectorAll('#sectionBids .filter-tab').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-secondary)';
        }
    });

    // Filter bids
    let filtered = allBidsData;

    if (filter !== 'all') {
        filtered = allBidsData.filter(b => b.status === filter);
    }

    // Re-render with filtered data
    renderFilteredBids(filtered);
}

function renderFilteredBids(bids) {
    const statusLabels = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn', expired: 'Expired' };

    const html = bids.length ? bids.map(b => {
        const images = b.image_urls || [];
        const thumbnail = images.length > 0 ? images[0] : null;
        return `
            <div class="bid-card ${b.status === 'rejected' ? 'rejected' : ''}" style="display: flex; gap: 12px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.12)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                ${thumbnail ? `<img src="${thumbnail}" alt="Part" style="width: 70px; height: 70px; object-fit: cover; border-radius: 10px; flex-shrink: 0;">` : '<div style="width: 70px; height: 70px; background: var(--bg-tertiary); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="bi bi-image" style="color: var(--text-muted); font-size: 24px;"></i></div>'}
                <div style="flex: 1; min-width: 0;">
                    <div class="bid-header" style="margin-bottom: 8px;">
                        <div>
                            <div class="bid-amount" style="font-size: 18px; font-weight: 700; color: var(--success);">${b.bid_amount} QAR</div>
                            <div style="color: var(--text-secondary); font-size: 13px; margin-top: 2px;">${b.car_summary || 'Vehicle'} - ${b.part_description?.slice(0, 30) || 'Part'}</div>
                        </div>
                        <span class="bid-status ${b.status}" style="font-size: 11px; padding: 4px 10px;">${statusLabels[b.status] || b.status}</span>
                    </div>
                    <div class="request-meta" style="display: flex; gap: 16px; font-size: 12px; color: var(--text-muted);">
                        <span><i class="bi bi-calendar"></i> ${getTimeAgo(b.created_at)}</span>
                        <span><i class="bi bi-shield-check"></i> ${b.warranty_days} days</span>
                    </div>
                </div>
            </div>
        `;
    }).join('') : '<div class="empty-state"><i class="bi bi-tag"></i><h4>No bids match this filter</h4></div>';

    document.getElementById('bidsList').innerHTML = html;
}

// Filter orders
let currentOrderFilter = 'all';
function filterOrders(filter) {
    currentOrderFilter = filter;

    // Update button styles
    document.querySelectorAll('.filter-tab').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-secondary)';
        }
    });

    // Filter orders
    const allOrders = window.allOrders || [];
    let filtered = allOrders;

    if (filter === 'active') {
        filtered = allOrders.filter(o => !['completed', 'cancelled_by_customer', 'cancelled_by_garage', 'refunded', 'delivered'].includes(o.order_status));
    } else if (filter === 'completed') {
        filtered = allOrders.filter(o => ['completed', 'delivered'].includes(o.order_status));
    } else if (filter === 'cancelled') {
        filtered = allOrders.filter(o => o.order_status?.includes('cancelled') || o.order_status === 'refunded');
    }

    // Re-render with filtered data
    renderFilteredOrders(filtered);
}

function renderFilteredOrders(orders) {
    const statusLabels = {
        confirmed: 'Confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready',
        collected: 'Picked Up',
        in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
        disputed: 'Disputed', refunded: 'Refunded',
        cancelled_by_customer: 'Customer Cancelled', cancelled_by_garage: 'Cancelled'
    };

    const html = orders.length > 0 ? orders.map(o => {
        const isCancelled = o.order_status?.includes('cancelled');
        const isRefunded = o.order_status === 'refunded';
        const isDisputed = o.order_status === 'disputed';
        const statusLabel = isCancelled ? 'Cancelled' : (statusLabels[o.order_status] || o.order_status);
        const statusClass = isCancelled ? 'cancelled' : o.order_status?.replace('_', '-');
        const images = o.bid_images || o.request_images || [];
        const thumbnail = images.length > 0 ? images[0] : null;

        return `
            <div class="order-card ${isCancelled ? 'cancelled' : ''} ${isDisputed ? 'disputed' : ''}" onclick="viewOrder('${o.order_id}')" style="cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.15)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                <div class="order-header">
                    <div class="order-number">Order #${o.order_number || o.order_id.slice(0, 8)}</div>
                    <span class="order-status ${statusClass}">${statusLabel}</span>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    ${thumbnail ? `<img src="${thumbnail}" alt="Part" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` : '<div style="width: 60px; height: 60px; background: var(--bg-tertiary); border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i class="bi bi-image" style="color: var(--text-muted);"></i></div>'}
                    <div style="flex: 1;">
                        <div style="color: var(--text-secondary); font-size: 14px;">${o.car_make} ${o.car_model} - ${o.part_description?.slice(0, 30) || 'Part'}</div>
                        <div style="font-weight: 600; margin-top: 4px;">${o.part_price} QAR</div>
                    </div>
                </div>
            </div>
        `;
    }).join('') : '<div class="empty-state"><i class="bi bi-inbox"></i><h4>No orders match this filter</h4></div>';

    document.getElementById('ordersList').innerHTML = html;
}

// Render Recent Orders (1 or 10 based on expanded state)
function renderRecentOrders() {
    const orders = window.recentOrdersData || [];
    const count = window.recentOrdersExpanded ? 10 : 1;
    const statusLabels = {
        confirmed: 'Confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready',
        collected: 'Picked Up',
        in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
        disputed: 'Disputed', refunded: 'Refunded'
    };

    const recentOrdersHtml = orders.slice(0, count).map(o => {
        const isCancelled = o.order_status?.includes('cancelled');
        const statusLabel = isCancelled ? 'Cancelled' : (statusLabels[o.order_status] || o.order_status);
        const statusClass = isCancelled ? 'cancelled' : o.order_status?.replace('_', '-');
        // Get first image from bid_images or request_images
        const images = o.bid_images || o.request_images || [];
        const thumbnail = images.length > 0 ? images[0] : null;
        return `
            <div class="order-card" onclick="viewOrder('${o.order_id}')" style="display: flex; gap: 12px; padding: 15px; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                ${thumbnail ? `<img src="${thumbnail}" alt="Part" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">` : '<div style="width: 60px; height: 60px; background: var(--bg-tertiary); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="bi bi-image" style="color: var(--text-muted);"></i></div>'}
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 600; color: var(--accent);">#${o.order_number || o.order_id?.slice(0, 8)}</span>
                        <span class="order-status ${statusClass}" style="font-size: 11px;">${statusLabel}</span>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${o.car_make} ${o.car_model} - ${o.part_description?.slice(0, 25) || 'Part'}
                    </div>
                    <div style="margin-top: 6px; font-weight: 600; color: var(--text-primary);">${o.part_price} QAR</div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('dashboardRecentOrders').innerHTML = recentOrdersHtml ||
        '<div class="empty-state"><i class="bi bi-box-seam"></i><h4>No orders yet</h4></div>';

    // Update toggle button visibility
    const toggleBtn = document.getElementById('toggleRecentOrders');
    if (toggleBtn) {
        toggleBtn.style.display = orders.length > 1 ? 'flex' : 'none';
    }
}

// Toggle Recent Orders expand/collapse
function toggleRecentOrdersList() {
    window.recentOrdersExpanded = !window.recentOrdersExpanded;
    renderRecentOrders();

    const text = document.getElementById('toggleRecentOrdersText');
    const icon = document.getElementById('toggleRecentOrdersIcon');
    if (text) text.textContent = window.recentOrdersExpanded ? 'Show less' : 'Show more';
    if (icon) icon.className = window.recentOrdersExpanded ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
}

// Dismiss Request (hide rejected/expired from dashboard)
function dismissRequest(reqId) {
    if (!dismissedRequests.includes(reqId)) {
        dismissedRequests.push(reqId);
        localStorage.setItem('dismissedRequests', JSON.stringify(dismissedRequests));
        renderRequests();
        updateBadge();
        showToast('Request dismissed', 'success');
    }
}

// Update Bid Modal - fetch existing bid data and open modal
let currentEditBidId = null;
async function openUpdateBidModal(bidId, title) {
    currentEditBidId = bidId;

    // Find bid info from server (optimized fetch)
    try {
        const res = await fetch(`${API_URL}/bids/${bidId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const bid = await res.json();
            // Pre-fill modal with existing values
            document.getElementById('bidRequestId').value = bid.request_id;
            document.getElementById('bidRequestInfo').textContent = `Updating bid for: ${title} `;
            document.getElementById('bidAmount').value = bid.bid_amount;
            document.getElementById('bidCondition').value = bid.part_condition;
            document.getElementById('bidWarranty').value = bid.warranty_days;
            document.getElementById('bidNotes').value = bid.notes || '';

            // Update button text
            const submitBtn = document.querySelector('#bidForm button[type="submit"]');
            submitBtn.innerHTML = '<i class="bi bi-pencil"></i> Update Bid';

            document.getElementById('bidModal').classList.add('active');
        } else {
            showToast('Bid not found', 'error');
        }
    } catch (err) {
        showToast('Failed to load bid data', 'error');
    }
}

// Cancel Order Logic - Enhanced with Fee Breakdown
let cancelOrderId = '';

async function openCancelOrderModal(id) {
    cancelOrderId = id;

    // Find order info from allOrders
    const order = window.allOrders?.find(o => o.order_id === id);
    const orderNumber = order?.order_number || id.slice(0, 8);
    const partPrice = parseFloat(order?.part_price || 0);

    // Create dynamic modal with impact info
    const existingModal = document.getElementById('cancelModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'cancelModal';
    modal.className = 'modal-overlay active';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 9999;';

    modal.innerHTML = `
        <div class="modal" style="background: var(--bg-card, #fff); border-radius: 16px; padding: 24px; max-width: 420px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3); animation: fadeIn 0.2s ease;">
            <div class="modal-header" style="margin-bottom: 16px;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 10px; color: var(--danger, #dc2626);">
                    <i class="bi bi-exclamation-triangle-fill"></i> Cancel Order #${orderNumber}
                </h3>
            </div>
            
            <!-- Impact Warning Box -->
            <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 88, 12, 0.05)); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                <div style="font-weight: 600; color: #d97706; margin-bottom: 8px;">
                    <i class="bi bi-info-circle"></i> Impact Notice
                </div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary, #666); line-height: 1.6;">
                    <li>Customer receives <strong>100% refund</strong></li>
                    <li>No payout issued to you for this order</li>
                    <li>Affects your fulfillment rate score</li>
                </ul>
            </div>
            
            <!-- Reason Input -->
            <div class="form-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; color: var(--text-muted, #888); margin-bottom: 6px;">
                    Reason for cancellation *
                </label>
                <select id="cancelReason" class="form-control" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border, #ddd); font-size: 14px;">
                    <option value="">Select a reason...</option>
                    <option value="out_of_stock">Part out of stock</option>
                    <option value="wrong_part">Wrong part ordered</option>
                    <option value="part_damaged">Part is damaged</option>
                    <option value="price_error">Price was incorrect</option>
                    <option value="other">Other reason</option>
                </select>
                <textarea id="cancelReasonText" class="form-control" placeholder="Additional details (optional)..." 
                    style="width: 100%; margin-top: 8px; padding: 10px; border-radius: 8px; border: 1px solid var(--border, #ddd); font-size: 13px; resize: vertical; min-height: 60px;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-ghost" onclick="closeCancelModal()" style="padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; background: transparent; border: 1px solid var(--border, #ddd);">
                    Go Back
                </button>
                <button class="btn btn-danger" onclick="confirmCancelOrder()" style="padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; border: none;">
                    <i class="bi bi-x-circle"></i> Confirm Cancellation
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCancelModal();
    });
}

function closeCancelModal() {
    const modal = document.getElementById('cancelModal');
    if (modal) modal.remove();
    cancelOrderId = '';
}

async function confirmCancelOrder() {
    const reasonCode = document.getElementById('cancelReason').value;
    const reasonText = document.getElementById('cancelReasonText')?.value || '';

    if (!reasonCode) {
        showToast('Please select a cancellation reason', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cancellations/orders/${cancelOrderId}/cancel/garage`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason_code: reasonCode, reason_text: reasonText })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Order cancelled successfully', 'success');
            closeCancelModal();
            loadOrders();
            loadStats();
        } else {
            showToast(data.error || 'Failed to cancel order', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ===== LOAD MY REVIEWS (Garage sees reviews about them) =====
async function loadMyReviews(page = 1) {
    reviewsPage = page;
    const summaryEl = document.getElementById('reviewsSummary');
    const listEl = document.getElementById('reviewsList');

    summaryEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);"><i class="bi bi-hourglass-split"></i> Loading reviews...</div>';
    listEl.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/reviews/my?page=${page}&limit=${REVIEWS_PAGE_SIZE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Render summary
        if (data.stats) {
            const s = data.stats;
            summaryEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap;">
                    <div style="text-align: center; min-width: 120px;">
                        <div style="font-size: 48px; font-weight: 800; color: #f59e0b;">${parseFloat(s.avg_rating || 0).toFixed(1)}</div>
                        <div style="display: flex; gap: 4px; justify-content: center; margin: 8px 0;">
                            ${[1, 2, 3, 4, 5].map(i => `<i class="bi bi-star${i <= Math.round(s.avg_rating) ? '-fill' : ''}" style="color: #f59e0b; font-size: 20px;"></i>`).join('')}
                        </div>
                        <div style="color: var(--text-muted);">${s.total_reviews || 0} reviews</div>
                    </div>
                    <div style="flex: 1; color: var(--text-secondary); font-size: 14px;">
                        <p><i class="bi bi-info-circle"></i> Reviews are visible to customers when they view your bids.</p>
                        <p style="margin-top: 8px;">Improve your ratings by providing quality parts and excellent customer service.</p>
                    </div>
                </div>
            `;
        } else {
            summaryEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="bi bi-star" style="font-size: 48px; opacity: 0.3;"></i>
                    <p style="margin-top: 12px;">No reviews yet. Complete orders to start receiving ratings!</p>
                </div>
            `;
        }

        // Render reviews list
        if (data.reviews && data.reviews.length > 0) {
            listEl.innerHTML = data.reviews.map(r => `
                <div style="background: var(--bg-card); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-sm);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <span style="font-weight: 600; color: var(--text-primary);">${r.customer_initial}</span>
                            <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">
                                Order ${r.order_number || 'N/A'} • ${new Date(r.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <div style="display: flex; gap: 2px;">
                            ${[1, 2, 3, 4, 5].map(i => `<i class="bi bi-star${i <= r.overall_rating ? '-fill' : ''}" style="color: #f59e0b;"></i>`).join('')}
                        </div>
                    </div>
                    ${r.review_text ? `
                        <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.5; margin: 0;">
                            "${r.review_text}"
                        </p>
                    ` : '<p style="color: var(--text-muted); font-style: italic; font-size: 14px;">No written review</p>'}
                    
                    <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 12px; color: var(--text-muted);">
                        ${r.part_quality_rating ? `<span><i class="bi bi-gear"></i> Quality: ${r.part_quality_rating}/5</span>` : ''}
                        ${r.communication_rating ? `<span><i class="bi bi-chat"></i> Communication: ${r.communication_rating}/5</span>` : ''}
                        ${r.delivery_rating ? `<span><i class="bi bi-truck"></i> Delivery: ${r.delivery_rating}/5</span>` : ''}
                    </div>
                </div>
            `).join('');

            // Render pagination
            if (data.pagination) {
                renderPagination('reviewsPagination', data.pagination, 'loadMyReviews');
            }
        } else {
            listEl.innerHTML = '';
            document.getElementById('reviewsPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
        summaryEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);"><i class="bi bi-exclamation-triangle"></i> Failed to load reviews</div>';
    }
}

async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/dashboard/garage/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const profile = await res.json();

        // Cache supplier type for bid condition filtering
        garageSupplierType = profile.supplier_type || 'both';

        // Generate star rating
        const rating = parseFloat(profile.rating_average) || 0;
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        const starsHtml =
            '<i class="bi bi-star-fill" style="color: #f59e0b;"></i>'.repeat(fullStars) +
            (halfStar ? '<i class="bi bi-star-half" style="color: #f59e0b;"></i>' : '') +
            '<i class="bi bi-star" style="color: var(--border);"></i>'.repeat(emptyStars);

        document.getElementById('profileContent').innerHTML = `
            <!-- Garage Header -->
            <div style="background: linear-gradient(135deg, var(--accent) 0%, #A82050 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; color: white;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 36px;">
                        <i class="bi bi-building"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-size: 28px; font-weight: 700;">${profile.garage_name || 'Your Garage'}</h2>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; opacity: 0.9;">
                            ${starsHtml}
                            <span style="margin-left: 8px;">${rating.toFixed(1)} (${profile.rating_count || 0} reviews)</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Stats Grid -->
            <div class="stats-grid" style="margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="bi bi-receipt"></i></div>
                    <div class="stat-value">${profile.total_transactions || 0}</div>
                    <div class="stat-label">Total Orders</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="bi bi-currency-dollar"></i></div>
                    <div class="stat-value">${profile.total_revenue || 0}</div>
                    <div class="stat-label">Revenue (QAR)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="bi bi-tag"></i></div>
                    <div class="stat-value">${profile.plan_name || 'Free Trial'}</div>
                    <div class="stat-label">Current Plan</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon yellow"><i class="bi bi-percent"></i></div>
                    <div class="stat-value">${profile.approval_status === 'demo' ? '0% <small style="font-size:10px;opacity:0.7">(Demo)</small>' : (profile.commission_rate !== null && profile.commission_rate !== undefined ? (profile.commission_rate * 100).toFixed(0) + '%' : '15%')}</div>
                    <div class="stat-label">Commission Rate</div>
                </div>
            </div>
            
            <!-- Account Details Card -->
            <div class="stat-card">
                <h3 style="margin: 0 0 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-person-badge" style="color: var(--accent);"></i> Account Details
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Phone</div>
                        <div style="font-weight: 600;">${profile.phone_number || '---'}</div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Address</div>
                        <div style="font-weight: 600;">${profile.address || '---'}</div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Member Since</div>
                        <div style="font-weight: 600;">${profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '---'}</div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Status</div>
                        <div style="font-weight: 600; color: var(--success);"><i class="bi bi-check-circle-fill"></i> Active</div>
                    </div>
                </div>
            </div>
            
            <!-- Specialization (Supplier Type & Brands) -->
            <div class="stat-card" style="margin-top: 24px;">
                <h3 style="margin: 0 0 8px; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-car-front" style="color: var(--accent);"></i> Specialization
                </h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                    <i class="bi bi-info-circle"></i> Your parts specialization determines which requests you receive.
                </p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Parts Type</div>
                        <div style="font-weight: 600;">
                            ${profile.supplier_type === 'new' ? '<i class="bi bi-patch-check-fill" style="color: var(--success);"></i> New Parts' :
                profile.supplier_type === 'used' ? '<i class="bi bi-recycle" style="color: var(--warning);"></i> Used Parts' :
                    '<i class="bi bi-collection" style="color: var(--accent);"></i> New & Used Parts'}
                        </div>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Brands</div>
                        <div style="font-weight: 600;">
                            ${profile.all_brands === true ? '<i class="bi bi-globe2" style="color: var(--accent);"></i> All Brands' :
                (profile.specialized_brands && profile.specialized_brands.length > 0 ?
                    '<i class="bi bi-star-fill" style="color: #f59e0b;"></i> ' + profile.specialized_brands.join(', ') :
                    '<span style="color: var(--text-muted);">Not set</span>')}
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 16px;">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('supplierSettingsForm').scrollIntoView({behavior: 'smooth', block: 'start'});">
                        <i class="bi bi-gear"></i> Edit Specialization
                    </button>
                </div>
            </div>
            
            <!-- Business Registration (Qatar Legal Requirements) -->
            <div class="stat-card" style="margin-top: 24px;">
                <h3 style="margin: 0 0 8px; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-building-check" style="color: var(--accent);"></i> Business Registration
                </h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
                    <i class="bi bi-info-circle"></i> Required for legal invoices in Qatar. Your CR number will appear on all invoices.
                </p>
                
                ${!profile.cr_number ? `
                <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 88, 12, 0.1)); border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #f59e0b; font-weight: 600;">
                        <i class="bi bi-exclamation-triangle-fill"></i> CR Number Required
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                        Please add your Commercial Registration number for legal invoice generation.
                    </div>
                </div>
                ` : ''}
                
                <form id="businessDetailsForm" onsubmit="saveBusinessDetails(event)">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                        <div class="form-group">
                            <label style="font-size: 13px; color: var(--text-secondary);">
                                <i class="bi bi-file-text"></i> CR Number (Commercial Registration) *
                            </label>
                            <input type="text" class="form-control" id="crNumber" 
                                value="${profile.cr_number || ''}" 
                                placeholder="e.g. 12345" 
                                pattern="[0-9]{4,10}"
                                title="Qatar CR number (4-10 digits)"
                                style="font-size: 16px; font-weight: 600;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 13px; color: var(--text-secondary);">
                                <i class="bi bi-card-text"></i> Trade License Number
                            </label>
                            <input type="text" class="form-control" id="tradeLicense" 
                                value="${profile.trade_license_number || ''}" 
                                placeholder="Your trade license">
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-top: 16px;">
                        <div class="form-group">
                            <label style="font-size: 13px; color: var(--text-secondary);">
                                <i class="bi bi-bank"></i> Bank Name
                            </label>
                            <input type="text" class="form-control" id="bankName" 
                                value="${profile.bank_name || ''}" 
                                placeholder="e.g. Qatar National Bank">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 13px; color: var(--text-secondary);">
                                <i class="bi bi-credit-card"></i> IBAN
                            </label>
                            <input type="text" class="form-control" id="ibanNumber" 
                                value="${profile.iban || ''}" 
                                placeholder="QA..."
                                pattern="QA[0-9]{2}[A-Z]{4}[0-9A-Z]{21}"
                                title="Qatar IBAN format">
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="bi bi-check-lg"></i> Save Business Details
                    </button>
                </form>
            </div>
            <!-- GPS Location Picker - Chic Modern Card System (Jan 27, 2026) -->
            <div class="gmap-card" style="margin-top: 24px;">
                <div class="gmap-header">
                    <div class="gmap-header-left">
                        <div class="gmap-icon">
                            <i class="bi bi-geo-alt-fill"></i>
                        </div>
                        <div>
                            <div class="gmap-title">Garage Location</div>
                            <div class="gmap-subtitle">Set your location for driver navigation</div>
                        </div>
                    </div>
                    ${(profile.location_lat && profile.location_lng)
                ? '<span class="gmap-badge set"><i class="bi bi-check-circle-fill"></i> GPS Set</span>'
                : '<span class="gmap-badge required"><i class="bi bi-exclamation-circle-fill"></i> Required</span>'}
                </div>
                
                <div class="gmap-container" id="locationMapContainer"></div>
                
                <div class="gmap-controls">
                    <div class="gmap-search-wrapper">
                        <i class="bi bi-search gmap-search-icon"></i>
                        <input type="text" 
                            class="gmap-search-input" 
                            id="locationAddressInput"
                            value="${profile.address || ''}"
                            placeholder="Search for an address in Qatar...">
                    </div>
                    <button type="button" class="gmap-btn gmap-btn-locate" onclick="useMyLocation()">
                        <i class="bi bi-crosshairs"></i> Use My Location
                    </button>
                    <button type="button" class="gmap-btn gmap-btn-save" onclick="saveGarageLocation()">
                        <i class="bi bi-check-lg"></i> Save Location
                    </button>
                </div>
                
                <div class="gmap-coords">
                    <div class="gmap-coord-item">
                        <div class="gmap-coord-label">Latitude</div>
                        <div class="gmap-coord-value" id="locationLatDisplay">${profile.location_lat || '—'}</div>
                        <input type="hidden" id="locationLatInput" value="${profile.location_lat || ''}">
                    </div>
                    <div class="gmap-coord-item">
                        <div class="gmap-coord-label">Longitude</div>
                        <div class="gmap-coord-value" id="locationLngDisplay">${profile.location_lng || '—'}</div>
                        <input type="hidden" id="locationLngInput" value="${profile.location_lng || ''}">
                    </div>
                </div>
            </div>
        `;

        // Initialize Google Maps after DOM is updated
        setTimeout(() => initLocationMap(profile.location_lat, profile.location_lng), 100);
        // Initialize Supplier Settings (Brands)
        setTimeout(() => initSupplierSettings(profile), 100);
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

// ===== BRAND SPECIALIZATION LOGIC =====
const CAR_BRANDS = [
    "Toyota", "Nissan", "Honda", "Mitsubishi", "Lexus", "Hyundai", "Kia", "Ford",
    "Chevrolet", "GMC", "Jeep", "Dodge", "BMW", "Mercedes-Benz", "Audi", "Volkswagen",
    "Land Rover", "Range Rover", "Porsche", "Mazda", "Subaru", "Suzuki", "Isuzu",
    "Infiniti", "Cadillac", "Lincoln", "Chrysler", "Jaguar", "Volvo", "Peugeot",
    "Renault", "Citroen", "Fiat", "Mini", "Tesla", "Genesis", "Geely", "MG",
    "Chery", "Changan", "Haval", "Jetour", "BYD", "Great Wall", "Dongfeng",
    "Bentley", "Rolls Royce", "Ferrari", "Lamborghini", "Maserati", "Aston Martin"
];

let selectedBrands = new Set();

function initSupplierSettings(profile) {
    // 1. Set Supplier Type Logic
    if (profile.supplier_type) {
        const radio = document.querySelector(`input[name="supplier_type"][value="${profile.supplier_type}"]`);
        if (radio) radio.checked = true;
    }

    // 2. Set All Brands Toggle
    const allBrandsToggle = document.getElementById('allBrandsToggle');
    const container = document.getElementById('brandSelectionContainer');
    const label = document.getElementById('allBrandsLabel');

    // Improved logic: Default to true only if explicitly true, OR if null/undefined AND no specialized brands exist
    const hasSpecializedBrands = profile.specialized_brands && Array.isArray(profile.specialized_brands) && profile.specialized_brands.length > 0;
    const allBrandsEnabled = profile.all_brands === true || (profile.all_brands == null && !hasSpecializedBrands);

    if (allBrandsEnabled) {
        allBrandsToggle.checked = true;
        container.style.display = 'none';
        label.textContent = 'All Brands';
        label.style.color = 'var(--accent)';
    } else {
        allBrandsToggle.checked = false;
        container.style.display = 'block';
        label.textContent = 'Specific Brands';
        label.style.color = '#f59e0b';

        // Populate selected brands
        if (hasSpecializedBrands) {
            profile.specialized_brands.forEach(b => selectedBrands.add(b));
        }
    }

    renderBrandCheckboxes();
}

function toggleBrandsList() {
    const toggle = document.getElementById('allBrandsToggle');
    const container = document.getElementById('brandSelectionContainer');
    const label = document.getElementById('allBrandsLabel');

    if (toggle.checked) {
        container.style.display = 'none'; // Hide list
        label.textContent = 'All Brands';
        label.style.color = 'var(--accent)';
    } else {
        container.style.display = 'block'; // Show list
        label.textContent = 'Specific Brands';
        label.style.color = '#f59e0b';
        renderBrandCheckboxes(); // Ensure rendered
    }
}

function renderBrandCheckboxes(filterText = '') {
    const container = document.getElementById('brandCheckboxes');
    console.log('[DEBUG] Rendering brands start', {
        containerExists: !!container,
        carBrandsLength: typeof CAR_BRANDS !== 'undefined' ? CAR_BRANDS.length : 'undefined',
        filterText
    });

    if (!container) {
        console.error('[DEBUG] brandCheckboxes container not found!');
        return;
    }

    container.innerHTML = ''; // Clear current

    // Grid layout styling
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
    container.style.gap = '8px';

    const filtered = CAR_BRANDS.filter(b => b.toLowerCase().includes(filterText.toLowerCase()));

    filtered.forEach(brand => {
        const isChecked = selectedBrands.has(brand);
        const div = document.createElement('div');
        div.className = `brand-checkbox-item ${isChecked ? 'active' : ''}`;
        div.style.cssText = `
            display: flex; align-items: center; gap: 8px;
            padding: 8px; border-radius: 8px;
            background: ${isChecked ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-primary)'};
            border: 1px solid ${isChecked ? 'var(--success)' : 'var(--border)'};
            cursor: pointer; transition: 0.2s;
        `;
        div.onclick = () => toggleBrand(brand);

        div.innerHTML = `
            <div style="
                width: 18px; height: 18px; border-radius: 4px; border: 2px solid ${isChecked ? 'var(--success)' : 'var(--text-muted)'};
                display: flex; align-items: center; justify-content: center;
                background: ${isChecked ? 'var(--success)' : 'transparent'};
            ">
                ${isChecked ? '<i class="bi bi-check" style="color: white; font-size: 14px;"></i>' : ''}
            </div>
            <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${brand}</span>
        `;
        container.appendChild(div);
    });

    updateSelectedCount();
}

function toggleBrand(brand) {
    if (selectedBrands.has(brand)) {
        selectedBrands.delete(brand);
    } else {
        selectedBrands.add(brand);
    }
    renderBrandCheckboxes(document.getElementById('brandSearch').value);
}

function filterBrands() {
    const text = document.getElementById('brandSearch').value;
    renderBrandCheckboxes(text);
}

function updateSelectedCount() {
    const count = selectedBrands.size;
    const el = document.getElementById('selectedBrandsCount');
    if (el) el.textContent = `${count} brands selected`;
}

async function saveSupplierSettings(event) {
    event.preventDefault();

    // Get Supplier Type
    const typeNew = document.getElementById('typeNew').checked;
    const typeUsed = document.getElementById('typeUsed').checked;
    const typeBoth = document.getElementById('typeBoth').checked;

    let supplierType = 'both';
    if (typeNew) supplierType = 'new';
    if (typeUsed) supplierType = 'used';

    // Get Brands
    const allBrands = document.getElementById('allBrandsToggle').checked;
    const specializedBrands = Array.from(selectedBrands);

    if (!allBrands && specializedBrands.length === 0) {
        showToast('Please select at least one brand or enable All Brands', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/dashboard/garage/specialization`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                supplier_type: supplierType,
                all_brands: allBrands,
                specialized_brands: specializedBrands
            })
        });

        if (!res.ok) throw new Error('Failed to update specialization');

        showToast('Business settings saved successfully!', 'success');

        // Refresh profile data to update UI
        loadProfile();

    } catch (err) {
        console.error('Save settings error:', err);
        showToast('Failed to save settings', 'error');
    }
}

// Save business registration details (CR number, bank info)
async function saveBusinessDetails(event) {
    event.preventDefault();

    const crNumber = document.getElementById('crNumber').value.trim();
    const tradeLicense = document.getElementById('tradeLicense').value.trim();
    const bankName = document.getElementById('bankName').value.trim();
    const iban = document.getElementById('ibanNumber').value.trim();

    try {
        const res = await fetch(`${API_URL}/dashboard/garage/business-details`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cr_number: crNumber,
                trade_license_number: tradeLicense,
                bank_name: bankName,
                iban: iban
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('✅ Business details saved! Your CR number will now appear on invoices.', 'success');
            loadProfile(); // Refresh to show updated data
        } else {
            showToast(data.error || 'Failed to save', 'error');
        }
    } catch (err) {
        console.error('Save business details error:', err);
        showToast('Connection error', 'error');
    }
}

// ===== GOOGLE MAPS SDK LOCATION PICKER (Jan 27, 2026) =====
// Upgraded from Leaflet to Google Maps for enterprise-grade mapping
let locationMap = null;
let locationMarker = null;
let placesAutocomplete = null;
let geocoder = null;

// Qatar Premium Dark Theme for Google Maps
const QATAR_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8e8ea0' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2d2d44' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#A82050' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8D1B3D' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#D4AF37' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#D4AF37' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e3a2e' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] }
];

function initLocationMap(lat, lng) {
    const container = document.getElementById('locationMapContainer');
    if (!container) return;

    // Wait for Google Maps SDK to load
    if (!window.googleMapsReady) {
        console.log('[Google Maps] SDK not ready, queuing map init...');
        window.pendingMapInit = { lat, lng };
        return;
    }

    // Default to Doha, Qatar if no coordinates
    const defaultLat = lat ? parseFloat(lat) : 25.2854;
    const defaultLng = lng ? parseFloat(lng) : 51.5310;
    const hasLocation = lat && lng;

    // Destroy existing map
    if (locationMap) {
        locationMap = null;
        locationMarker = null;
        container.innerHTML = '';
    }

    // Create Google Map - Light theme with satellite toggle
    locationMap = new google.maps.Map(container, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: hasLocation ? 16 : 12,
        // No custom styles - use default light theme for readability
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT,
            mapTypeIds: ['roadmap', 'satellite', 'hybrid']
        },
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy'
    });

    // Initialize Geocoder
    geocoder = new google.maps.Geocoder();

    // Custom marker (SVG)
    const markerSvg = {
        path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z',
        fillColor: '#A82050',
        fillOpacity: 1,
        strokeColor: '#D4AF37',
        strokeWeight: 2,
        scale: 1.5,
        anchor: new google.maps.Point(12, 36)
    };

    // Add marker if coordinates exist
    if (hasLocation) {
        locationMarker = new google.maps.Marker({
            position: { lat: defaultLat, lng: defaultLng },
            map: locationMap,
            draggable: true,
            icon: markerSvg,
            animation: google.maps.Animation.DROP
        });

        // Marker drag handler
        locationMarker.addListener('dragend', () => {
            const pos = locationMarker.getPosition();
            updateLocationInputs(pos.lat(), pos.lng());
            reverseGeocode(pos.lat(), pos.lng());
        });
    }

    // Click to place marker
    locationMap.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        if (locationMarker) {
            locationMarker.setPosition(e.latLng);
        } else {
            locationMarker = new google.maps.Marker({
                position: e.latLng,
                map: locationMap,
                draggable: true,
                icon: markerSvg,
                animation: google.maps.Animation.DROP
            });

            locationMarker.addListener('dragend', () => {
                const pos = locationMarker.getPosition();
                updateLocationInputs(pos.lat(), pos.lng());
                reverseGeocode(pos.lat(), pos.lng());
            });
        }

        updateLocationInputs(lat, lng);
        reverseGeocode(lat, lng);
    });

    // Initialize Places Autocomplete
    initPlacesAutocomplete();

    console.log('[Google Maps] Map initialized for Garage Dashboard');
}

function initPlacesAutocomplete() {
    const input = document.getElementById('locationAddressInput');
    if (!input || !window.google?.maps?.places) return;

    placesAutocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'qa' },
        fields: ['geometry', 'formatted_address', 'name'],
        types: ['establishment', 'geocode']
    });

    placesAutocomplete.addListener('place_changed', () => {
        const place = placesAutocomplete.getPlace();

        if (!place.geometry) {
            showToast('Could not find that location', 'warning');
            return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Update map
        locationMap.setCenter(place.geometry.location);
        locationMap.setZoom(17);

        // Update or create marker
        if (locationMarker) {
            locationMarker.setPosition(place.geometry.location);
        } else {
            const markerSvg = {
                path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z',
                fillColor: '#A82050',
                fillOpacity: 1,
                strokeColor: '#D4AF37',
                strokeWeight: 2,
                scale: 1.5,
                anchor: new google.maps.Point(12, 36)
            };

            locationMarker = new google.maps.Marker({
                position: place.geometry.location,
                map: locationMap,
                draggable: true,
                icon: markerSvg,
                animation: google.maps.Animation.DROP
            });

            locationMarker.addListener('dragend', () => {
                const pos = locationMarker.getPosition();
                updateLocationInputs(pos.lat(), pos.lng());
                reverseGeocode(pos.lat(), pos.lng());
            });
        }

        updateLocationInputs(lat, lng);
        showToast('✓ Location selected! Click Save Location to confirm.', 'success');
    });
}

function reverseGeocode(lat, lng) {
    if (!geocoder) return;

    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
            let address = results[0].formatted_address;
            // Clean up address (remove ", Qatar" suffix for brevity)
            address = address.replace(/, Qatar$/, '');

            const input = document.getElementById('locationAddressInput');
            if (input) input.value = address;
        }
    });
}

function updateLocationInputs(lat, lng) {
    const latInput = document.getElementById('locationLatInput');
    const lngInput = document.getElementById('locationLngInput');
    const latDisplay = document.getElementById('locationLatDisplay');
    const lngDisplay = document.getElementById('locationLngDisplay');

    const latStr = lat.toFixed(8);
    const lngStr = lng.toFixed(8);

    if (latInput) latInput.value = latStr;
    if (lngInput) lngInput.value = lngStr;
    if (latDisplay) latDisplay.textContent = latStr;
    if (lngDisplay) lngDisplay.textContent = lngStr;
}

function useMyLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }

    showToast('📍 Getting your location...', 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Update inputs
            updateLocationInputs(lat, lng);

            // Update map
            if (locationMap) {
                locationMap.setCenter({ lat, lng });
                locationMap.setZoom(17);

                const markerSvg = {
                    path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z',
                    fillColor: '#A82050',
                    fillOpacity: 1,
                    strokeColor: '#D4AF37',
                    strokeWeight: 2,
                    scale: 1.5,
                    anchor: new google.maps.Point(12, 36)
                };

                if (locationMarker) {
                    locationMarker.setPosition({ lat, lng });
                } else {
                    locationMarker = new google.maps.Marker({
                        position: { lat, lng },
                        map: locationMap,
                        draggable: true,
                        icon: markerSvg,
                        animation: google.maps.Animation.DROP
                    });

                    locationMarker.addListener('dragend', () => {
                        const pos = locationMarker.getPosition();
                        updateLocationInputs(pos.lat(), pos.lng());
                        reverseGeocode(pos.lat(), pos.lng());
                    });
                }
            }

            // Reverse geocode to get address
            reverseGeocode(lat, lng);
            showToast('✓ Location detected! Click Save Location to confirm.', 'success');
        },
        (error) => {
            console.error('Geolocation error:', error);
            let message = 'Could not get your location.';
            if (error.code === 1) message = 'Location access denied. Please enable location permissions.';
            else if (error.code === 2) message = 'Location unavailable. Please place marker manually.';
            else if (error.code === 3) message = 'Location timeout. Please try again.';
            showToast(message, 'error');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

async function saveGarageLocation() {
    const lat = document.getElementById('locationLatInput').value;
    const lng = document.getElementById('locationLngInput').value;
    const address = document.getElementById('locationAddressInput').value.trim();

    if (!lat || !lng) {
        showToast('Please set your location on the map first', 'error');
        return;
    }

    const btn = document.querySelector('.gmap-btn-save');
    const originalContent = btn ? btn.innerHTML : 'Save Location';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    }

    try {
        const res = await fetch(`${API_URL}/dashboard/garage/location`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location_lat: parseFloat(lat),
                location_lng: parseFloat(lng),
                address: address || undefined
            })
        });

        const data = await res.json();

        if (res.ok) {
            if (btn) {
                btn.innerHTML = '<i class="bi bi-check-lg"></i> Saved!';
                btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            }
            showToast('📍 Location saved! Drivers can now navigate to your garage.', 'success');

            if (data.warning) {
                showToast(data.warning, 'warning');
            }

            // Delay reload slightly so user sees "Saved!"
            setTimeout(() => {
                loadProfile();
            }, 1500);
        } else {
            showToast(data.error || 'Failed to save location', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        }
    } catch (err) {
        console.error('Save location error:', err);
        showToast('Connection error', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order_status: newStatus })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Order status updated!', 'success');
            loadOrders();
        } else {
            showToast(data.error || 'Failed to update', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Handle hyphenated section names
    const sectionIdMap = {
        'pending-actions': 'PendingActions'
    };
    const sectionId = sectionIdMap[section] || section.charAt(0).toUpperCase() + section.slice(1);

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section' + sectionId).classList.add('active');

    // Refresh data based on section
    if (section === 'requests') loadRequests();
    if (section === 'bids') loadBids();
    if (section === 'orders') loadOrders();
    if (section === 'dashboard') { loadStats(); loadRequests(); }
    if (section === 'subscription') loadSubscription();
    if (section === 'analytics') loadAnalytics();
    if (section === 'showcase') loadShowcase();
    if (section === 'earnings') loadEarnings();
    if (section === 'reviews') loadMyReviews();
    if (section === 'profile') loadProfile();
    if (section === 'pending-actions') { loadPendingCounterOffers(); loadPendingDisputes(); }
    if (section === 'quick-services') { loadQuickServicesSettings(); loadQuickServicesRequests(); }
}

// Ignore/Skip request - now persists to database (per-garage) with 5-second undo
let currentUndoTimeout = null;
let currentUndoToast = null;

async function ignoreRequest(reqId) {
    if (!ignoredRequests.includes(reqId)) {
        // Immediately update UI (optimistic)
        ignoredRequests.push(reqId);
        localStorage.setItem('ignoredRequests', JSON.stringify(ignoredRequests));
        renderRequests();
        updateBadge();

        // Clear any existing undo toast
        if (currentUndoToast) {
            currentUndoToast.remove();
            clearTimeout(currentUndoTimeout);
        }

        // Show undo toast with countdown
        const toast = document.createElement('div');
        toast.className = 'toast info undo-toast';
        toast.innerHTML = `
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Request skipped</span>
            <button class="undo-btn" onclick="undoIgnoreRequest('${reqId}')">
                UNDO <span class="countdown">5</span>
            </button>
        `;
        document.getElementById('toastContainer').appendChild(toast);
        currentUndoToast = toast;

        // Countdown timer
        let secondsLeft = 5;
        const countdownEl = toast.querySelector('.countdown');
        const countdownInterval = setInterval(() => {
            secondsLeft--;
            if (countdownEl) countdownEl.textContent = secondsLeft;
            if (secondsLeft <= 0) clearInterval(countdownInterval);
        }, 1000);

        // After 5 seconds, persist to backend and remove toast
        currentUndoTimeout = setTimeout(async () => {
            if (currentUndoToast) {
                currentUndoToast.remove();
                currentUndoToast = null;
            }
            clearInterval(countdownInterval);

            // Persist to backend
            try {
                await fetch(`${API_URL}/requests/${reqId}/ignore`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Failed to persist ignore to backend:', err);
            }
        }, 5000);
    }
}

// Undo ignore - restore request to visible state
async function undoIgnoreRequest(reqId) {
    // Clear timeout to prevent backend persist
    if (currentUndoTimeout) {
        clearTimeout(currentUndoTimeout);
        currentUndoTimeout = null;
    }

    // Remove from local state
    ignoredRequests = ignoredRequests.filter(id => id !== reqId);
    localStorage.setItem('ignoredRequests', JSON.stringify(ignoredRequests));

    // Remove undo toast
    if (currentUndoToast) {
        currentUndoToast.remove();
        currentUndoToast = null;
    }

    // Update UI
    renderRequests();
    updateBadge();
    showToast('Request restored', 'success');

    // Also call backend to delete in case it was persisted earlier
    try {
        await fetch(`${API_URL}/requests/${reqId}/ignore`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (err) {
        // Ignore - might not exist yet
    }
}


function openBidModal(reqId, info) {
    document.getElementById('bidRequestId').value = reqId;
    document.getElementById('bidRequestInfo').textContent = info;
    bidPhotos = [];
    renderBidPhotos();
    document.getElementById('bidModal').classList.add('active');

    // Filter bid condition dropdown based on garage supplier type
    const conditionSelect = document.getElementById('bidCondition');
    if (conditionSelect) {
        // Reset to full options first
        conditionSelect.innerHTML = `
            <option value="">Select condition...</option>
            <option value="new">New</option>
            <option value="used_excellent">Used - Excellent</option>
            <option value="used_good">Used - Good</option>
            <option value="used_fair">Used - Fair</option>
            <option value="refurbished">Refurbished</option>
        `;

        // Filter based on supplier type
        if (garageSupplierType === 'new') {
            // New parts dealer - only show New
            conditionSelect.innerHTML = `
                <option value="">Select condition...</option>
                <option value="new">New</option>
            `;
        } else if (garageSupplierType === 'used') {
            // Used parts only - remove New
            conditionSelect.innerHTML = `
                <option value="">Select condition...</option>
                <option value="used_excellent">Used - Excellent</option>
                <option value="used_good">Used - Good</option>
                <option value="used_fair">Used - Fair</option>
                <option value="refurbished">Refurbished</option>
            `;
        }
        // 'both' keeps all options
    }

    // Setup photo upload handler
    const MAX_PHOTOS = 10;
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    document.getElementById('bidPhotoInput').onchange = (e) => {
        const files = Array.from(e.target.files);
        let addedCount = 0;
        let skippedSize = 0;

        files.forEach(file => {
            if (bidPhotos.length < MAX_PHOTOS) {
                if (file.size > MAX_FILE_SIZE) {
                    skippedSize++;
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    bidPhotos.push({ file, preview: e.target.result });
                    renderBidPhotos();
                    updatePhotoCounter();
                };
                reader.readAsDataURL(file);
                addedCount++;
            }
        });

        // Friendly feedback
        const remaining = MAX_PHOTOS - bidPhotos.length;
        if (remaining <= 0 && files.length > addedCount) {
            showToast(`Maximum ${MAX_PHOTOS} photos allowed. Extra photos were not added.`, 'info');
        }
        if (skippedSize > 0) {
            showToast(`${skippedSize} file(s) exceeded 5MB limit and were skipped.`, 'warning');
        }
    };

    updatePhotoCounter();
}

function updatePhotoCounter() {
    const counter = document.getElementById('photoCounter');
    if (counter) {
        counter.textContent = `${bidPhotos.length} / 10 photos`;
    }
}

function closeBidModal() {
    document.getElementById('bidModal').classList.remove('active');
    document.getElementById('bidForm').reset();
    bidPhotos = [];
    renderBidPhotos();
    // Reset edit mode
    currentEditBidId = null;
    const submitBtn = document.querySelector('#bidForm button[type="submit"]');
    submitBtn.innerHTML = '<i class="bi bi-send"></i> Submit Bid';
}

function renderBidPhotos() {
    const grid = document.getElementById('bidPhotoGrid');
    grid.innerHTML = bidPhotos.map((img, i) => `
                <div class="bid-photo-item">
                    <img src="${img.preview}" alt="Part photo">
                    <button type="button" class="bid-photo-remove" onclick="removeBidPhoto(${i})">&times;</button>
                </div>
            `).join('');
}

function removeBidPhoto(index) {
    bidPhotos.splice(index, 1);
    renderBidPhotos();
}

// Submission lock to prevent double-clicking
let isSubmittingBid = false;

document.getElementById('bidForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmittingBid) {
        console.log('[BID] Submission already in progress, ignoring duplicate');
        return;
    }
    isSubmittingBid = true;

    const submitBtn = document.querySelector('#bidForm button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Submitting...';

    const reqId = document.getElementById('bidRequestId').value;
    const amount = document.getElementById('bidAmount').value;
    const condition = document.getElementById('bidCondition').value;
    const warranty = document.getElementById('bidWarranty').value;
    const notes = document.getElementById('bidNotes').value;

    try {
        let res, data;

        if (currentEditBidId) {
            // UPDATE existing bid (PUT request, JSON body)
            res = await fetch(`${API_URL}/bids/${currentEditBidId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bid_amount: amount,
                    part_condition: condition,
                    warranty_days: warranty,
                    notes: notes
                })
            });
            data = await res.json();

            if (res.ok) {
                showToast('Bid updated successfully!', 'success');
                currentEditBidId = null; // Reset edit mode
                closeBidModal();
                loadBids();
                renderRequests();
            } else {
                showToast(data.error || 'Failed to update bid', 'error');
            }
        } else {
            // NEW bid (POST request, FormData for file uploads)
            const formData = new FormData();
            formData.append('request_id', reqId);
            formData.append('bid_amount', amount);
            formData.append('part_condition', condition);
            formData.append('warranty_days', warranty);
            formData.append('notes', notes);

            // Add optional fields
            const brand = document.getElementById('bidBrand').value;
            const partNumber = document.getElementById('bidPartNumber').value;
            if (brand) formData.append('brand_name', brand);
            if (partNumber) formData.append('part_number', partNumber);

            // Append photos
            bidPhotos.forEach(photo => {
                formData.append('images', photo.file);
            });

            console.log('Submitting bid:', { reqId, amount, condition, brand, partNumber, photos: bidPhotos.length });

            res = await fetch(`${API_URL}/bids`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            data = await res.json();

            if (data.bid_id) {
                showToast('Bid submitted successfully!', 'success');
                // Track this request as bidded and update UI
                if (!biddedRequests.includes(reqId)) {
                    biddedRequests.push(reqId);
                }
                closeBidModal();
                renderRequests(); // Update UI immediately
                loadBids();
                loadStats();
            } else {
                showToast(data.error || 'Failed to submit bid', 'error');
            }
        }
    } catch (err) {
        showToast('Connection error', 'error');
    } finally {
        // Always reset submission lock and button
        isSubmittingBid = false;
        const submitBtn = document.querySelector('#bidForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = currentEditBidId ? '<i class="bi bi-check-lg"></i> Update Bid' : '<i class="bi bi-send"></i> Submit Bid';
        }
    }
});

function updateBadge() {
    // Count only visible requests (exclude dismissed, ignored, and ones we've bid on)
    // This shows "new requests requiring garage action"
    const visibleCount = requests.filter(r =>
        !dismissedRequests.includes(r.request_id) &&
        !ignoredRequests.includes(r.request_id)
    ).length;
    document.getElementById('requestBadge').textContent = visibleCount;

    // Also update "My Bids" badge with pending bid count
    // This shows "bids awaiting customer response"
    const pendingBidsCount = biddedRequests ? biddedRequests.length : 0;
    const bidsBadge = document.getElementById('bidsBadge');
    if (bidsBadge) {
        bidsBadge.textContent = pendingBidsCount;
        bidsBadge.style.display = pendingBidsCount > 0 ? 'flex' : 'none';
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}


function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'exclamation-triangle'}"></i> ${message}`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// === Additional Scripts ===

// Lightbox Logic
let currentLightboxImages = [];
let currentLightboxIndex = 0;
let currentScale = 1;
let pannedX = 0;
let pannedY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

function openLightbox(images, index) {
    currentLightboxImages = images;
    currentLightboxIndex = index;
    document.getElementById('proLightbox').classList.add('active');
    updateLightboxImage();

    // Add event listeners for drag/zoom
    const container = document.getElementById('lightboxContent');
    container.addEventListener('mousedown', startDrag);
    container.addEventListener('mousemove', drag);
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('mouseleave', endDrag);
    container.addEventListener('wheel', handleWheel, { passive: false });
}

function closeLightbox() {
    document.getElementById('proLightbox').classList.remove('active');
    // Remove listeners
    const container = document.getElementById('lightboxContent');
    container.removeEventListener('mousedown', startDrag);
    container.removeEventListener('mousemove', drag);
    container.removeEventListener('mouseup', endDrag);
    container.removeEventListener('mouseleave', endDrag);
    container.removeEventListener('wheel', handleWheel);
}

function updateLightboxImage() {
    const img = document.getElementById('lightboxImg');

    // Fix URL format if needed (handle uploads/ vs /uploads/)
    let url = currentLightboxImages[currentLightboxIndex];
    if (url && !url.startsWith('http') && !url.startsWith('/')) {
        url = '/' + url;
    }

    img.src = url;
    resetZoom();

    // Nav buttons
    document.getElementById('lightboxPrev').style.display = currentLightboxIndex > 0 ? 'flex' : 'none';
    document.getElementById('lightboxNext').style.display = currentLightboxIndex < currentLightboxImages.length - 1 ? 'flex' : 'none';
}

function changeSlide(dir) {
    currentLightboxIndex += dir;
    if (currentLightboxIndex < 0) currentLightboxIndex = 0;
    if (currentLightboxIndex >= currentLightboxImages.length) currentLightboxIndex = currentLightboxImages.length - 1;
    updateLightboxImage();
}

function updateTransform() {
    const img = document.getElementById('lightboxImg');
    img.style.transform = `translate(${pannedX}px, ${pannedY}px) scale(${currentScale})`;
}

function zoomBox(amount) {
    currentScale += amount;
    if (currentScale < 0.5) currentScale = 0.5;
    if (currentScale > 5) currentScale = 5;
    updateTransform();
}

function resetZoom() {
    currentScale = 1;
    pannedX = 0;
    pannedY = 0;
    updateTransform();
}

function startDrag(e) {
    if (currentScale <= 1) return; // Only drag if zoomed
    isDragging = true;
    startX = e.clientX - pannedX;
    startY = e.clientY - pannedY;
    document.getElementById('lightboxContent').style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    pannedX = e.clientX - startX;
    pannedY = e.clientY - startY;
    updateTransform();
}

function endDrag() {
    isDragging = false;
    document.getElementById('lightboxContent').style.cursor = 'grab';
}

function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) zoomBox(0.2);
    else zoomBox(-0.2);
}

// ===== DISPUTE MODAL =====
let currentDisputeId = null;

const REASON_LABELS = {
    wrong_part: 'Wrong Part Sent',
    doesnt_fit: "Doesn't Fit Car",
    damaged: 'Damaged in Transit',
    not_as_described: 'Not as Described',
    changed_mind: 'Changed Mind'
};

function openDisputeModal(data) {
    currentDisputeId = data.dispute_id;
    document.getElementById('disputeOrderNumber').textContent = 'Order #' + (data.order_number || 'N/A');
    document.getElementById('disputeReason').textContent = REASON_LABELS[data.reason] || data.reason;
    document.getElementById('disputeRefundAmount').textContent = (data.refund_amount || 0) + ' QAR';
    document.getElementById('disputeRestockingFee').textContent = (data.restocking_fee || 0) + ' QAR';
    document.getElementById('contestInputSection').style.display = 'none';
    document.getElementById('contestReason').value = '';

    // Show description if available
    const descEl = document.getElementById('disputeDescription');
    if (data.description) {
        descEl.textContent = '"' + data.description + '"';
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }

    // Show photos if available
    const photosEl = document.getElementById('disputePhotos');
    if (data.photo_urls && data.photo_urls.length > 0) {
        photosEl.innerHTML = data.photo_urls.map(url => `
                    <img src="${url.startsWith('/') ? url : '/' + url}" 
                         style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; cursor: pointer;"
                         onclick="window.open('${url.startsWith('/') ? url : '/' + url}', '_blank')">
                `).join('');
    } else {
        photosEl.innerHTML = '';
    }

    document.getElementById('disputeRespondModal').classList.add('active');
}

function closeDisputeModal() {
    document.getElementById('disputeRespondModal').classList.remove('active');
    currentDisputeId = null;
}

function showContestInput() {
    document.getElementById('contestInputSection').style.display = 'block';
}

async function respondToDispute(action) {
    if (!currentDisputeId) return;

    const contestReason = document.getElementById('contestReason').value;

    if (action === 'contest' && !contestReason.trim()) {
        showToast('Please explain why you contest this dispute', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/disputes/${currentDisputeId}/garage-respond`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                response_message: contestReason
            })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            removeFromDisputeQueue(currentDisputeId);
            closeDisputeModal();
            loadOrders();
        } else {
            showToast(data.error || 'Failed to respond', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Load pending disputes on page load (queue-based approach)
async function loadPendingDisputes() {
    try {
        const res = await fetch(`${API_URL}/disputes/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.disputes && data.disputes.length > 0) {
            pendingDisputes = data.disputes.filter(d => d.status === 'pending');
            pendingDisputes = data.disputes.filter(d => d.status === 'pending');
            updateOrdersBadge();
            if (pendingDisputes.length > 0) {
                showToast(`${pendingDisputes.length} pending dispute(s) - check Orders section`, 'warning');
            }
        }
    } catch (err) {
        console.error('Failed to load disputes:', err);
    }
}

// ===== Flag & Supersede: Load flagged bids for correction =====
async function loadFlaggedBids() {
    try {
        const res = await fetch(`${API_URL}/bids/flagged`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.flagged_bids && data.flagged_bids.length > 0) {
            flaggedBids = data.flagged_bids;
            // Update pending actions count
            updatePendingActionsBadge();
            // Re-render pending actions to include flagged bids
            renderPendingActions();
        } else {
            flaggedBids = [];
        }
    } catch (err) {
        console.error('[FlaggedBids] Failed to load:', err);
    }
}

// Create premium flagged bid card for garage to review and correct
function createFlaggedBidCard(flag) {
    const bidRef = `BID-${String(flag.bid_id).padStart(4, '0')}`;

    // Calculate time since flagged
    const flaggedAt = new Date(flag.created_at || Date.now());
    const hoursAgo = Math.floor((Date.now() - flaggedAt.getTime()) / (1000 * 60 * 60));

    // Urgency based on time (higher urgency = longer flag is outstanding)
    let urgencyClass = 'urgency-low';
    let urgencyColor = '#10b981';
    if (hoursAgo > 12) {
        urgencyClass = 'urgency-critical';
        urgencyColor = '#ef4444';
    } else if (hoursAgo > 4) {
        urgencyClass = 'urgency-high';
        urgencyColor = '#f59e0b';
    }

    const isUrgent = flag.is_urgent === true;
    const timeText = hoursAgo > 0 ? `${hoursAgo}h ago` : 'Just now';

    // Reason labels for display
    const reasonLabels = {
        wrong_price: '💰 Wrong Price',
        wrong_part: '🔧 Wrong Part/Condition',
        wrong_photo: '📷 Photo Mismatch',
        other: '❓ Other Issue'
    };
    const reasonText = reasonLabels[flag.reason] || flag.reason || 'Issue Reported';

    return `
        <div class="pending-action-card flagged-bid-card ${urgencyClass}" style="
            background: linear-gradient(135deg, var(--bg-card) 0%, rgba(239, 68, 68, 0.08) 100%);
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 16px;
            padding: 20px;
            animation: slideIn 0.3s ease-out;
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                    <span style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">${bidRef}</span>
                    <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 8px; border-radius: 6px; font-size: 11px; margin-left: 8px;">
                        <i class="bi bi-flag-fill"></i> Flagged
                    </span>
                    ${isUrgent ? `<span style="background: rgba(249, 115, 22, 0.2); color: #f97316; padding: 4px 8px; border-radius: 6px; font-size: 11px; margin-left: 8px;">
                        <i class="bi bi-lightning-fill"></i> URGENT
                    </span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 6px; color: ${urgencyColor}; font-size: 13px; font-weight: 600;">
                    <i class="bi bi-clock"></i>
                    <span>${timeText}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">${escapeHTML(flag.car_summary || 'Vehicle')}</div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${escapeHTML(flag.part_description || 'Part Request')}</div>
            </div>
            
            <!-- Flag Details -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; margin-bottom: 16px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 12px; color: var(--text-muted);">Issue Reported</span>
                    <span style="font-size: 16px; font-weight: 600; color: #ef4444;">${reasonText}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; text-align: right;">
                    <span style="font-size: 12px; color: var(--text-muted);">Original Bid</span>
                    <span style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${parseFloat(flag.bid_amount || 0).toFixed(0)} QAR</span>
                </div>
            </div>
            
            ${flag.customer_note ? `
                <div style="padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); font-style: italic;">
                    <i class="bi bi-chat-dots"></i> "${escapeHTML(flag.customer_note)}"
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 12px;">
                <button onclick="openEditBidModal('${flag.bid_id}')" style="
                    flex: 1; padding: 12px; border: none; border-radius: 10px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    transition: transform 0.2s, box-shadow 0.2s;
                " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="bi bi-pencil-square"></i> Edit & Resubmit
                </button>
                <button onclick="acknowledgeFlaggedBid('${flag.flag_id}', '${flag.bid_id}')" style="
                    padding: 12px 16px; border: 1px solid var(--accent); border-radius: 10px;
                    background: transparent; color: var(--accent); font-weight: 600; cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='var(--accent)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='var(--accent)'">
                    <i class="bi bi-check-lg"></i> Acknowledge
                </button>
            </div>
        </div>
    `;
}

// Update dispute badge counter
// Update consolidated Orders badge (Active + Disputes merged)
function updateOrdersBadge() {
    const badge = document.getElementById('activeOrdersBadge');
    if (!badge) return;

    // Premium Logic: Single badge.
    // If disputes exist -> Show ORANGE warning badge (pulse)
    // Else -> Show PRIMARY info badge (if active orders > 0)

    const disputeCount = pendingDisputes.length;

    if (disputeCount > 0) {
        // Priority: Dispute Attention
        badge.textContent = `${activeOrdersCount} ⚠️`; // Show count plus warning
        badge.style.display = 'flex';
        badge.className = 'nav-badge pulse-badge'; // Add pulse
        badge.style.background = '#f59e0b'; // Warning Orange
        badge.title = `${disputeCount} Pending Disputes`;
    } else {
        // Normal State
        badge.textContent = activeOrdersCount;
        badge.style.display = activeOrdersCount > 0 ? 'flex' : 'none';
        badge.className = 'nav-badge'; // Remove pulse
        badge.style.background = 'var(--primary)'; // Default Primary
        badge.title = 'Active Orders';
    }
}

// Update earnings badge counter for awaiting confirmations
async function updateEarningsBadge() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts/awaiting-confirmation`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const badge = document.getElementById('earningsBadge');
        if (badge) {
            const count = data.count || (data.awaiting_confirmation ? data.awaiting_confirmation.length : 0);
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    } catch (err) {
        console.error('Failed to update earnings badge:', err);
    }
}

// Review next pending dispute from queue
function reviewNextDispute() {
    if (pendingDisputes.length === 0) {
        showToast('No pending disputes', 'info');
        return;
    }
    const next = pendingDisputes[0];
    openDisputeModal(next);
}

// Remove dispute from queue after handling
function removeFromDisputeQueue(disputeId) {
    pendingDisputes = pendingDisputes.filter(d => d.dispute_id !== disputeId);
    updateDisputeBadge();
}

// Review dispute from order card (fetches dispute data by order_id)
async function reviewDisputeForOrder(orderId) {
    // First check if we have it in pending queue
    const cached = pendingDisputes.find(d => d.order_id === orderId);
    if (cached) {
        openDisputeModal(cached);
        return;
    }

    // Otherwise fetch from API
    try {
        const res = await fetch(`${API_URL}/disputes/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.disputes) {
            const dispute = data.disputes.find(d => d.order_id === orderId);
            if (dispute) {
                openDisputeModal(dispute);
            } else {
                showToast('Dispute not found', 'error');
            }
        }
    } catch (err) {
        showToast('Failed to load dispute', 'error');
    }
}

// ===== SUBSCRIPTION MANAGEMENT =====
let currentPendingRequest = null;

async function loadSubscription() {
    try {
        console.log('Garage Dashboard v2026.01.10-FIXED-2: Loading subscription...');
        const res = await fetch(`${API_URL}/subscriptions/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Assign pending request from API response
        currentPendingRequest = data.pending_request || null;

        // CRITICAL FIX: If the "pending" request is for the plan we are ALREADY on, ignore it.
        // This handles cases where admin approved manually but didn't clear the request status.
        if (data.subscription && currentPendingRequest && currentPendingRequest.to_plan_id === data.subscription.plan_id) {
            console.log('Suppressing stale pending request (already on target plan)');
            currentPendingRequest = null;
        }

        if (data.subscription) {
            const sub = data.subscription;

            // Plan name
            document.getElementById('subPlanName').textContent = sub.plan_name || 'Free Trial';

            // Update Analytics badges based on plan
            const planCode = (sub.plan_code || '').toLowerCase();
            const analyticsBadge = document.getElementById('analyticsPlanBadge');
            const analyticsHeaderBadge = document.getElementById('analyticsHeaderBadge');

            let badgeText = 'PRO+';
            let badgeStyle = 'background: linear-gradient(135deg, #A82050, #8D1B3D);';

            if (planCode === 'enterprise') {
                badgeText = 'ENTERPRISE';
                badgeStyle = 'background: linear-gradient(135deg, #eab308, #f59e0b);';
            } else if (planCode === 'professional') {
                badgeText = 'PRO';
                badgeStyle = 'background: linear-gradient(135deg, #A82050, #8D1B3D);';
            } else if (planCode === 'starter') {
                badgeText = 'UPGRADE';
                badgeStyle = 'background: linear-gradient(135deg, #6b7280, #9ca3af);';
            }

            if (analyticsBadge) {
                analyticsBadge.textContent = badgeText;
                analyticsBadge.style.cssText += badgeStyle;
            }
            if (analyticsHeaderBadge) {
                analyticsHeaderBadge.textContent = badgeText;
                analyticsHeaderBadge.style.cssText += badgeStyle;
            }

            // Price display - commission plans have no monthly fee
            if (sub.is_commission_based || sub.monthly_fee === 0) {
                document.getElementById('subPrice').textContent = 'Free';
            } else {
                document.getElementById('subPrice').textContent = `${sub.monthly_fee} QAR`;
            }

            // Bids used this month (now dynamically computed)
            document.getElementById('subBidsUsed').textContent = sub.bids_used_this_cycle || 0;
            document.getElementById('subBidsLimit').textContent = sub.max_bids_per_month || '∞';

            // Commission rate - prominent for commission plans
            if (sub.commission_rate !== undefined) {
                document.getElementById('subCommission').textContent =
                    sub.commission_rate === 0 ? '0% (Demo)' : `${(sub.commission_rate * 100).toFixed(0)}%`;
            } else {
                document.getElementById('subCommission').textContent = '-';
            }

            // Renewal/Expiry date display
            if (sub.is_demo && sub.billing_cycle_end) {
                // Demo trial - show expiry date prominently
                const expiryDate = new Date(sub.billing_cycle_end);
                const today = new Date();
                const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                const dateStr = expiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                if (daysLeft <= 0) {
                    document.getElementById('subRenewal').innerHTML = `<span style="color: var(--danger);"><i class="bi bi-exclamation-triangle"></i> Expired</span>`;
                } else if (daysLeft <= 3) {
                    document.getElementById('subRenewal').innerHTML = `<span style="color: var(--danger);"><i class="bi bi-clock"></i> ${dateStr} (${daysLeft} days left!)</span>`;
                } else {
                    document.getElementById('subRenewal').innerHTML = `<span style="color: var(--warning);"><i class="bi bi-calendar-event"></i> ${dateStr} (${daysLeft} days left)</span>`;
                }
            } else if (sub.is_commission_based || (sub.monthly_fee === 0 && sub.commission_rate > 0)) {
                // Commission-based plans - no renewal needed
                document.getElementById('subRenewal').textContent = 'Never (Pay-Per-Sale)';
            } else if (sub.billing_cycle_end) {
                // Only show renewal date if there's an actual billing cycle
                const endDate = new Date(sub.billing_cycle_end);

                // Show scheduled change if present
                if (sub.next_plan_name) {
                    document.getElementById('subRenewal').innerHTML = `
                        ${endDate.toLocaleDateString()} 
                        <span class="badge" style="background: var(--warning); color: #000; margin-left:8px; font-size: 10px;">
                            <i class="bi bi-arrow-right"></i> ${sub.next_plan_name}
                        </span>
                    `;
                } else {
                    // Check if it's effectively a commission-only plan  
                    if (endDate.getFullYear() >= 2099 || (parseFloat(sub.monthly_fee || 0) === 0)) {
                        document.getElementById('subRenewal').textContent = 'Never (Pay-Per-Sale)';
                    } else {
                        document.getElementById('subRenewal').textContent = endDate.toLocaleDateString();
                    }
                }
            } else {
                document.getElementById('subRenewal').textContent = '-';
            }

            // Hide "Change Plan" button for commission plans (they're already on the best model)
            const changePlanBtn = document.querySelector('#currentSubscription .plan-actions button');

            // Check for pending request
            if (currentPendingRequest) {
                const req = currentPendingRequest;
                const banner = document.createElement('div');
                banner.className = 'alert alert-warning';
                banner.style.marginTop = '16px';
                banner.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <i class="bi bi-hourglass-split"></i> 
                            <strong>Pending Request:</strong> Your request to switch to 
                            <strong>${req.target_plan_name || 'New Plan'}</strong> 
                            is awaiting admin approval.
                        </div>
                        <button class="btn btn-sm" onclick="cancelPendingRequest()" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                            <i class="bi bi-x-circle"></i> Cancel Request
                        </button>
                    </div>
                `;
                // Remove existing banners if any to avoid stacking
                const existing = document.querySelector('#currentSubscription .alert-warning');
                if (existing) existing.remove();

                document.getElementById('currentSubscription').appendChild(banner);

                if (changePlanBtn) {
                    changePlanBtn.disabled = true;
                    changePlanBtn.innerHTML = '<i class="bi bi-hourglass"></i> Pending Approval';
                    changePlanBtn.onclick = null;
                }
            } else if (changePlanBtn && sub.is_commission_based) {
                changePlanBtn.style.display = 'none';
            }
        } else {
            document.getElementById('subPlanName').textContent = 'No Active Subscription';
            document.getElementById('subPrice').textContent = '-';
            document.getElementById('subBidsUsed').textContent = '0';
            document.getElementById('subBidsLimit').textContent = '-';
            document.getElementById('subCommission').textContent = '-';
            document.getElementById('subRenewal').textContent = '-';
        }
    } catch (err) {
        console.error('Failed to load subscription:', err);
        document.getElementById('subPlanName').textContent = 'Error loading';
    }
}

async function showPlanOptions() {
    const plansGrid = document.getElementById('plansGrid');

    if (plansGrid.style.display === 'none') {
        plansGrid.style.display = 'grid';
        plansGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><div class="loading-spinner"></div> Loading plans...</div>';

        try {
            const res = await fetch(`${API_URL}/subscriptions/plans`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data) {
                const plans = Array.isArray(data) ? data : (data.plans || []);
                const currentPlan = document.getElementById('subPlanName').textContent;

                // If there is a pending request, we should disable all buttons
                const isPending = !!currentPendingRequest;

                plansGrid.innerHTML = '<h3 style="grid-column: 1/-1; margin-bottom: 16px;">Available Plans</h3>' +
                    plans.map(plan => `
                        <div class="plan-card ${plan.plan_name === currentPlan ? 'current' : ''}">
                            <div class="plan-header">
                                ${plan.is_featured ? '<div class="plan-badge">Popular</div>' : ''}
                                <h3 class="plan-name">${plan.plan_name}</h3>
                            </div>
                            <div class="plan-details">
                                <div class="plan-price">
                                    <span class="price-amount">${plan.monthly_fee} QAR</span>
                                    <span class="price-period">/month</span>
                                </div>
                                <div class="plan-stats">
                                    <div class="plan-stat">
                                        <i class="bi bi-tags"></i>
                                        ${plan.max_bids_per_month || 'Unlimited'} bids/month
                                    </div>
                                    <div class="plan-stat">
                                        <i class="bi bi-percent"></i>
                                        ${(plan.commission_rate * 100).toFixed(1)}% commission
                                    </div>
                                </div>
                            </div>
                            <div class="plan-actions">
                                ${plan.plan_name === currentPlan ?
                            '<button class="btn" disabled>Current Plan</button>' :
                            isPending ?
                                `<button class="btn" disabled title="You have a pending request"><i class="bi bi-lock"></i> Request Pending</button>` :
                                parseFloat(plan.monthly_fee) > 0 ?
                                    `<button class="btn btn-primary" onclick="changePlan('${plan.plan_id}', '${plan.plan_name}', ${plan.monthly_fee})">
                                        <i class="bi bi-credit-card"></i> Pay Now
                                    </button>` :
                                    `<button class="btn btn-primary" onclick="changePlan('${plan.plan_id}', '${plan.plan_name}', 0)">
                                        Request Change
                                    </button>`
                        }
                            </div>
                        </div>
                    `).join('');
            }
        } catch (err) {
            plansGrid.innerHTML = '<p style="grid-column: 1/-1; color: var(--danger);">Failed to load plans</p>';
        }
    } else {
        plansGrid.style.display = 'none';
    }
}

async function changePlan(planId, planName, monthlyFee) {
    // If it's a paid plan (monthlyFee > 0), open payment modal
    if (monthlyFee && parseFloat(monthlyFee) > 0) {
        openPaymentModal(planId, planName, monthlyFee);
        return;
    }

    // Free plan - just submit request
    if (!confirm(`Request to switch to ${planName}? This will be sent to admin for approval.`)) return;

    try {
        const res = await fetch(`${API_URL}/subscriptions/change-plan`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan_id: planId })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'Request submitted', 'success');
            document.getElementById('plansGrid').style.display = 'none';
            loadSubscription(); // Reload to show pending state
        } else {
            showToast(data.error || 'Failed to submit request', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Cancel pending plan change request
async function cancelPendingRequest() {
    if (!confirm('Are you sure you want to cancel your pending plan change request?')) return;

    try {
        const res = await fetch(`${API_URL}/subscriptions/pending-request`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'Request cancelled', 'success');
            currentPendingRequest = null;
            loadSubscription(); // Reload to clear pending state
        } else {
            showToast(data.error || 'Failed to cancel request', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ===== STRIPE PAYMENT MODULE (Subscription Upgrades) =====
let stripe = null;
let cardElement = null;
let currentPaymentPlan = null;

// Initialize Stripe
function initStripe() {
    if (typeof Stripe === 'undefined') {
        console.warn('Stripe.js not loaded');
        return;
    }
    // Use the production Stripe publishable key
    stripe = Stripe('pk_live_51Qk350JDUPMQh2qj1zfwxgLJaRG1axEJeZdtZPq95sFMxoLpQVBa9LZ2LNLqv2z2VfWNkeMJ7qsckL6pGiIdvxm10044DsaELo');
}

// Open payment modal for paid plan upgrade
function openPaymentModal(planId, planName, monthlyFee) {
    // Store current payment info
    currentPaymentPlan = { planId, planName, monthlyFee };

    // Update modal content
    document.getElementById('paymentPlanName').textContent = planName;
    document.getElementById('paymentPlanPrice').textContent = `${monthlyFee} QAR`;
    document.getElementById('paymentBtnAmount').textContent = `${monthlyFee} QAR`;

    // Reset view states
    document.getElementById('paymentForm').style.display = 'block';
    document.getElementById('paymentProcessing').style.display = 'none';
    document.getElementById('paymentSuccess').style.display = 'none';

    // Show modal
    document.getElementById('paymentModal').classList.add('active');

    // Initialize Stripe if not already
    if (!stripe) initStripe();

    // Create or re-create card element
    if (stripe && !cardElement) {
        const elements = stripe.elements();
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#1f2937',
                    '::placeholder': { color: '#9ca3af' }
                },
                invalid: { color: '#ef4444' }
            }
        });
        cardElement.mount('#card-element');

        // Handle errors
        cardElement.on('change', function (event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
    }
}

// Close payment modal
function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    currentPaymentPlan = null;
}

// Handle payment form submission
document.addEventListener('DOMContentLoaded', function () {
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (!stripe || !cardElement || !currentPaymentPlan) {
                showToast('Payment not initialized', 'error');
                return;
            }

            const submitBtn = document.getElementById('paymentSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>';

            try {
                // Step 1: First create the upgrade request
                const reqRes = await fetch(`${API_URL}/subscriptions/change-plan`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ plan_id: currentPaymentPlan.planId })
                });

                const reqData = await reqRes.json();

                if (!reqRes.ok) {
                    throw new Error(reqData.error || 'Failed to create upgrade request');
                }

                const requestId = reqData.request_id;

                // Step 2: Create payment intent on server
                const payRes = await fetch(`${API_URL}/subscriptions/pay`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ request_id: requestId })
                });

                const payData = await payRes.json();

                if (!payRes.ok) {
                    throw new Error(payData.error || 'Failed to create payment');
                }

                const clientSecret = payData.client_secret;

                // Show processing state
                document.getElementById('paymentForm').style.display = 'none';
                document.getElementById('paymentProcessing').style.display = 'block';

                // Step 3: Confirm payment with Stripe
                const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: cardElement
                    }
                });

                if (error) {
                    throw new Error(error.message);
                }

                if (paymentIntent.status === 'succeeded') {
                    // Step 4: Confirm payment on our server
                    await fetch(`${API_URL}/subscriptions/confirm-payment`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ payment_intent_id: paymentIntent.id })
                    });

                    // Show success
                    document.getElementById('paymentProcessing').style.display = 'none';
                    document.getElementById('paymentSuccess').style.display = 'block';

                    showToast('Payment successful! Subscription activated.', 'success');

                    // Refresh subscription after delay
                    setTimeout(() => {
                        closePaymentModal();
                        document.getElementById('plansGrid').style.display = 'none';
                        loadSubscription();
                    }, 2000);
                }

            } catch (err) {
                console.error('Payment error:', err);
                showToast(err.message || 'Payment failed', 'error');

                // Reset form
                document.getElementById('paymentProcessing').style.display = 'none';
                document.getElementById('paymentForm').style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="bi bi-lock-fill"></i> Pay <span id="paymentBtnAmount">${currentPaymentPlan.monthlyFee} QAR</span>`;
            }
        });
    }
});


// ===== ANALYTICS MODULE (Pro/Enterprise) =====
let revenueChart = null;

async function loadAnalytics() {
    const period = document.getElementById('analyticsPeriod')?.value || '30';

    try {
        const res = await fetch(`${API_URL}/garage/analytics?period=${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            // User doesn't have access - show upgrade prompt
            const data = await res.json();
            document.getElementById('analyticsUpgradePrompt').style.display = 'flex';
            document.getElementById('analyticsContent').style.display = 'none';
            console.log('Analytics requires upgrade:', data.required_plans);
            return;
        }

        if (!res.ok) {
            showToast('Failed to load analytics', 'error');
            return;
        }

        const data = await res.json();

        // Show analytics content, hide upgrade prompt
        document.getElementById('analyticsUpgradePrompt').style.display = 'none';
        document.getElementById('analyticsContent').style.display = 'block';

        // Update summary cards
        document.getElementById('analyticsRevenue').textContent =
            (data.summary.total_revenue || 0).toLocaleString() + ' QAR';
        document.getElementById('analyticsOrders').textContent =
            data.summary.total_orders || 0;
        document.getElementById('analyticsAcceptRate').textContent =
            (data.summary.acceptance_rate || 0).toFixed(1) + '%';
        document.getElementById('analyticsResponseTime').textContent =
            (data.summary.avg_response_hours || 0).toFixed(1) + 'h';

        // Update bid performance
        document.getElementById('analyticsTotalBids').textContent = data.summary.total_bids || 0;
        document.getElementById('analyticsAcceptedBids').textContent =
            Math.round((data.summary.acceptance_rate / 100) * data.summary.total_bids) || 0;
        document.getElementById('analyticsRejectedBids').textContent =
            Math.round(((100 - data.summary.acceptance_rate - 10) / 100) * data.summary.total_bids) || 0;
        document.getElementById('analyticsPendingBids').textContent =
            Math.round((10 / 100) * data.summary.total_bids) || 0;

        // Render revenue chart
        renderRevenueChart(data.charts.revenue_trend);

        // Update top categories
        renderTopCategories(data.top_categories);

        // Show export button for Enterprise
        if (data.premium_insights?.can_export) {
            document.getElementById('exportAnalyticsBtn').style.display = 'inline-flex';
        }

        // Show customer insights for Enterprise
        if (data.premium_insights?.customer_insights_available) {
            document.getElementById('customerInsightsCard').style.display = 'block';
            loadCustomerInsights();
            loadMarketInsights();
        }

    } catch (err) {
        console.error('Failed to load analytics:', err);
        showToast('Error loading analytics', 'error');
    }
}

function renderRevenueChart(data) {
    const ctx = document.getElementById('revenueChart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (revenueChart) {
        revenueChart.destroy();
    }

    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const revenues = data.map(d => parseFloat(d.revenue) || 0);

    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (QAR)',
                data: revenues,
                borderColor: '#A82050',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderTopCategories(categories) {
    const container = document.getElementById('topCategoriesList');
    if (!container) return;

    if (!categories || categories.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No bid data yet</p>';
        return;
    }

    const maxBids = Math.max(...categories.map(c => c.bid_count));

    container.innerHTML = categories.map(cat => `
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>${escapeHTML(cat.part_name)}</span>
                <span style="color: var(--text-muted);">${cat.wins}/${cat.bid_count} wins</span>
            </div>
            <div style="background: var(--bg-tertiary); border-radius: 4px; height: 8px;">
                <div style="background: linear-gradient(90deg, #A82050, #8D1B3D); height: 100%; border-radius: 4px; width: ${(cat.bid_count / maxBids * 100)}%;"></div>
            </div>
        </div>
    `).join('');
}

async function loadCustomerInsights() {
    try {
        const res = await fetch(`${API_URL}/garage/analytics/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const container = document.getElementById('customerInsightsContent');

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
                <div class="stat-card" style="background: var(--bg-tertiary);">
                    <div class="stat-value">${data.insights.unique_customers}</div>
                    <div class="stat-label">Unique Customers</div>
                </div>
                <div class="stat-card" style="background: var(--bg-tertiary);">
                    <div class="stat-value">${data.insights.repeat_customers}</div>
                    <div class="stat-label">Repeat Customers</div>
                </div>
                <div class="stat-card" style="background: var(--bg-tertiary);">
                    <div class="stat-value">${data.insights.repeat_rate}%</div>
                    <div class="stat-label">Repeat Rate</div>
                </div>
            </div>
            <h4 style="margin-bottom: 12px;">Top Areas</h4>
            ${data.area_breakdown.map(area => `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                    <span>${escapeHTML(area.area)}</span>
                    <span>${parseFloat(area.revenue).toLocaleString()} QAR (${area.orders} orders)</span>
                </div>
            `).join('')}
        `;
    } catch (err) {
        console.error('Failed to load customer insights:', err);
    }
}

async function loadMarketInsights() {
    try {
        const res = await fetch(`${API_URL}/garage/analytics/market`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const container = document.getElementById('marketInsightsContent');

        // Show the card
        document.getElementById('marketInsightsCard').style.display = 'block';

        container.innerHTML = `
            <!-- Platform Stats & Your Position -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                <!-- Platform Stats -->
                <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05)); border-radius: 12px; padding: 20px;">
                    <h4 style="margin-bottom: 12px; font-size: 14px; color: var(--text-muted);">📊 Platform Stats</h4>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Active Garages</span>
                            <strong>${data.platform.active_garages}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Orders This Month</span>
                            <strong>${data.platform.orders_this_month}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Active Requests</span>
                            <strong>${data.platform.active_requests}</strong>
                        </div>
                    </div>
                </div>
                <!-- Your Position -->
                <div style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(245, 158, 11, 0.05)); border-radius: 12px; padding: 20px; text-align: center;">
                    <h4 style="margin-bottom: 8px; font-size: 14px; color: var(--text-muted);">🏆 Your Position</h4>
                    <div style="font-size: 48px; font-weight: 700; color: #eab308;">#${data.your_position.rank}</div>
                    <div style="color: var(--text-secondary);">of ${data.your_position.total_garages} garages</div>
                    <div style="margin-top: 8px; font-size: 12px; color: var(--success);">Top ${100 - data.your_position.percentile}%</div>
                </div>
            </div>

            <!-- Performance Benchmarks -->
            <h4 style="margin-bottom: 12px;">📈 Performance vs Market Average</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
                ${renderBenchmark('Rating', data.benchmarks.rating.yours.toFixed(1), data.benchmarks.rating.market_avg.toFixed(1), data.benchmarks.rating.is_above_avg, '⭐')}
                ${renderBenchmark('Win Rate', data.benchmarks.win_rate.yours.toFixed(1) + '%', data.benchmarks.win_rate.market_avg.toFixed(1) + '%', data.benchmarks.win_rate.is_above_avg, '🎯')}
                ${renderBenchmark('Response Time', data.benchmarks.response_time.yours + ' min', data.benchmarks.response_time.market_avg + ' min', data.benchmarks.response_time.is_above_avg, '⚡')}
                ${renderBenchmark('Fulfillment', data.benchmarks.fulfillment_rate.yours.toFixed(1) + '%', data.benchmarks.fulfillment_rate.market_avg.toFixed(1) + '%', data.benchmarks.fulfillment_rate.is_above_avg, '✅')}
            </div>

            <!-- Trending Parts -->
            <h4 style="margin-bottom: 12px;">🔥 Trending Parts (Last 30 Days)</h4>
            <div style="display: grid; gap: 8px;">
                ${data.trending_parts.map((part, i) => `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                        <span style="font-size: 20px; opacity: 0.5;">${i + 1}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${escapeHTML(part.name)}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">${part.requests} requests</div>
                        </div>
                        <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            Hot 🔥
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Failed to load market insights:', err);
    }
}

function renderBenchmark(label, yours, market, isAbove, icon) {
    const color = isAbove ? '#10b981' : '#ef4444';
    const indicator = isAbove ? '↑' : '↓';
    return `
        <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span>${icon}</span>
                <span style="font-weight: 500;">${label}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 20px; font-weight: 700; color: ${color};">${yours}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Market: ${market}</div>
                </div>
                <span style="font-size: 24px; color: ${color};">${indicator}</span>
            </div>
        </div>
    `;
}

async function exportAnalytics() {
    const period = document.getElementById('analyticsPeriod')?.value || '90';

    try {
        const res = await fetch(`${API_URL}/garage/analytics/export?period=${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            showToast('Export requires Enterprise plan', 'error');
            return;
        }

        const data = await res.json();

        // Convert to CSV
        const headers = ['Order ID', 'Date', 'Part Name', 'Car', 'Amount', 'Platform Fee', 'Payout'];
        const rows = data.data.map(row => [
            row.order_id,
            new Date(row.completed_at).toLocaleDateString(),
            row.part_name,
            `${row.car_make} ${row.car_model} ${row.car_year}`,
            row.bid_amount,
            row.platform_fee,
            row.garage_payout_amount
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qscrap-analytics-${period}days.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Analytics exported!', 'success');
    } catch (err) {
        showToast('Export failed', 'error');
    }
}

// ===== EARNINGS & PAYOUTS =====
async function loadEarnings() {
    try {
        // Load payout summary
        const summaryRes = await fetch(`${API_URL}/finance/payouts/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const summaryData = await summaryRes.json();

        if (summaryData.stats) {
            const s = summaryData.stats;
            document.getElementById('earningsPending').textContent = `${parseFloat(s.pending_payouts || 0).toFixed(2)} QAR`;
            document.getElementById('earningsProcessing').textContent = `${parseFloat(s.processing_payouts || 0).toFixed(2)} QAR`;
            document.getElementById('earningsTotal').textContent = `${parseFloat(s.total_paid || s.completed_payouts || 0).toFixed(2)} QAR`;
            document.getElementById('earningsMonth').textContent = `${parseFloat(s.this_month_completed || 0).toFixed(2)} QAR`;
        }

        // Load awaiting confirmation first
        await loadAwaitingConfirmation();

        // Load payout history
        loadPayoutHistory();
    } catch (err) {
        console.error('Failed to load earnings:', err);
    }
}

// Load payments awaiting garage confirmation
async function loadAwaitingConfirmation() {
    try {
        const res = await fetch(`${API_URL}/finance/payouts/awaiting-confirmation`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('awaitingConfirmationContainer');
        if (!container) return;

        if (!data.awaiting_confirmation || data.awaiting_confirmation.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        // Calculate total for bulk confirm button
        const totalAmount = data.awaiting_confirmation.reduce((sum, p) => sum + parseFloat(p.net_amount), 0);
        const count = data.awaiting_confirmation.length;

        container.style.display = 'block';
        container.innerHTML = `
            <div class="content-card" style="margin-bottom: 20px; border: 2px solid #10b981;">
                <div class="table-header" style="background: linear-gradient(135deg, #10b981, #059669); margin: -20px -20px 15px; padding: 15px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="color: white; margin: 0;"><i class="bi bi-bell-fill"></i> Payments Awaiting Your Confirmation</h3>
                    ${count > 1 ? `
                        <button class="btn" onclick="openConfirmAllModal(${count}, ${totalAmount.toFixed(2)})" 
                            style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            <i class="bi bi-check-all"></i> Confirm All (${count} payouts, ${totalAmount.toLocaleString()} QAR)
                        </button>
                    ` : ''}
                </div>
                ${data.awaiting_confirmation.map(p => `
                    <div class="awaiting-payment-card" style="background: var(--bg-tertiary); padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong style="font-size: 18px; color: var(--accent);">${parseFloat(p.net_amount).toLocaleString()} QAR</strong>
                                <span style="color: var(--text-secondary); margin-left: 10px;">Order: ${p.order_number || '-'}</span>
                            </div>
                            <span style="color: var(--text-secondary); font-size: 12px;">
                                <i class="bi bi-clock"></i> ${Math.max(0, Math.floor(p.days_remaining || 7))} days remaining
                            </span>
                        </div>
                        <div style="margin-bottom: 10px; font-size: 13px; color: var(--text-secondary);">
                            <span><i class="bi bi-bank"></i> ${(p.payout_method || 'unknown').replace(/_/g, ' ')}</span>
                            ${p.payout_reference ? `<span style="margin-left: 15px;"><i class="bi bi-hash"></i> Ref: ${p.payout_reference}</span>` : ''}
                        </div>
                        ${p.notes ? `
                        <div style="margin-bottom: 10px; padding: 10px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; border-left: 3px solid #6366f1;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;"><i class="bi bi-chat-left-text"></i> Note from Finance:</div>
                            <div style="font-size: 13px; color: var(--text-primary);">${escapeHTML(p.notes)}</div>
                        </div>` : ''}
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-success" onclick="confirmPaymentReceipt('${p.payout_id}')">
                                <i class="bi bi-check-lg"></i> I Received This Payment
                            </button>
                            <button class="btn btn-outline" onclick="reportPaymentIssue('${p.payout_id}', ${p.net_amount})">
                                <i class="bi bi-exclamation-triangle"></i> Report Issue
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Failed to load awaiting confirmations:', err);
    }
}

// Confirm payment receipt
async function confirmPaymentReceipt(payoutId) {
    if (!confirm('Confirm that you have received this payment?')) return;

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notes: 'Payment received and confirmed' })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('✅ Payment confirmed! Thank you.', 'success');
            loadEarnings();
        } else {
            showToast(data.error || 'Failed to confirm payment', 'error');
        }
    } catch (err) {
        showToast('Failed to confirm payment', 'error');
    }
}

// Open Confirm All Payouts modal with password verification
function openConfirmAllModal(count, totalAmount) {
    const modal = document.createElement('div');
    modal.id = 'confirmAllModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal" style="max-width: 450px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                <h3 style="margin: 0;"><i class="bi bi-check-all"></i> Confirm All Payouts</h3>
                <button class="modal-close" onclick="closeConfirmAllModal()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--success);">${totalAmount.toLocaleString()} QAR</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${count} payment${count > 1 ? 's' : ''} total</div>
                </div>
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-shield-lock" style="font-size: 20px; color: #f59e0b;"></i>
                    <span style="font-size: 13px; color: var(--text-secondary);">For security, please re-enter your password to confirm all payouts</span>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 8px; display: block;">Password</label>
                    <input type="password" id="confirmAllPassword" class="form-control" placeholder="Enter your password" style="width: 100%;" required>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--border);">
                <button class="btn btn-ghost" onclick="closeConfirmAllModal()">Cancel</button>
                <button class="btn btn-success" id="confirmAllBtn" onclick="submitConfirmAll()" style="min-width: 180px;">
                    <i class="bi bi-check-all"></i> Confirm All Payouts
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('confirmAllPassword').focus();
}

// Close Confirm All modal
function closeConfirmAllModal() {
    const modal = document.getElementById('confirmAllModal');
    if (modal) modal.remove();
}

// Submit bulk confirmation with password
async function submitConfirmAll() {
    const password = document.getElementById('confirmAllPassword').value;
    if (!password) {
        showToast('Please enter your password', 'error');
        return;
    }

    const btn = document.getElementById('confirmAllBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Confirming...';

    try {
        const res = await fetch(`${API_URL}/finance/payouts/confirm-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        const data = await res.json();

        if (res.ok) {
            closeConfirmAllModal();
            showToast(`✅ ${data.message}`, 'success');
            loadEarnings();
        } else {
            showToast(data.error || 'Failed to confirm payouts', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-all"></i> Confirm All Payouts';
        }
    } catch (err) {
        showToast('Connection error', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-all"></i> Confirm All Payouts';
    }
}

// Report payment issue
async function reportPaymentIssue(payoutId, amount) {
    const reason = prompt(`Report issue with payment of ${amount} QAR:\n\nSelect reason:\n1. not_received\n2. wrong_amount\n3. partial_payment\n4. other\n\nEnter reason (e.g. "not_received"):`);

    if (!reason) return;

    const validReasons = ['not_received', 'wrong_amount', 'partial_payment', 'other'];
    if (!validReasons.includes(reason)) {
        showToast('Invalid reason. Please enter: not_received, wrong_amount, partial_payment, or other', 'error');
        return;
    }

    const description = prompt('Please describe the issue:');

    try {
        const res = await fetch(`${API_URL}/finance/payouts/${payoutId}/dispute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                dispute_reason: reason,
                description: description || ''
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Issue reported. Operations will review and contact you.', 'warning');
            loadEarnings();
        } else {
            showToast(data.error || 'Failed to report issue', 'error');
        }
    } catch (err) {
        showToast('Failed to report issue', 'error');
    }
}

// Pagination state for payouts
let payoutsPage = 1;
const PAYOUTS_PAGE_SIZE = 15;

async function loadPayoutHistory(page = 1) {
    payoutsPage = page;
    const tbody = document.getElementById('payoutHistory');

    try {
        const res = await fetch(`${API_URL}/finance/payouts?page=${page}&limit=${PAYOUTS_PAGE_SIZE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.payouts && data.payouts.length > 0) {
            tbody.innerHTML = data.payouts.map(p => {
                // Map status to colors
                const statusColors = {
                    pending: 'var(--warning)',
                    awaiting_confirmation: '#f59e0b',
                    confirmed: 'var(--success)',
                    completed: 'var(--success)',
                    disputed: 'var(--error)',
                    on_hold: '#9ca3af'
                };
                const color = statusColors[p.payout_status] || 'var(--text-secondary)';

                // Invoice button for completed/confirmed payouts
                const canDownload = ['completed', 'confirmed'].includes(p.payout_status) && p.order_id;
                const invoiceBtn = canDownload
                    ? `<button class="btn btn-sm" onclick="downloadGarageInvoice('${p.order_id}')" title="Download Invoice"><i class="bi bi-file-pdf"></i></button>`
                    : '<span style="color: var(--text-muted);">-</span>';

                return `
                    <tr>
                        <td>${new Date(p.created_at).toLocaleDateString()}</td>
                        <td>${p.order_number || '-'}</td>
                        <td>${parseFloat(p.gross_amount).toLocaleString()} QAR</td>
                        <td>${parseFloat(p.commission_amount).toLocaleString()} QAR</td>
                        <td><strong>${parseFloat(p.net_amount).toLocaleString()} QAR</strong></td>
                        <td><span class="status-badge" style="background: ${color}; color: white;">${(p.payout_status || '').replace(/_/g, ' ')}</span></td>
                        <td>${invoiceBtn}</td>
                    </tr>
                `;
            }).join('');

            // Render pagination if multiple pages
            const total = data.total || data.payouts.length;
            const pages = Math.ceil(total / PAYOUTS_PAGE_SIZE);
            if (pages > 1) {
                renderPagination('payoutPagination', { page, pages, total }, 'loadPayoutHistory');
            } else {
                document.getElementById('payoutPagination').innerHTML = '';
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No payouts yet. Complete orders to earn!</td></tr>';
            document.getElementById('payoutPagination').innerHTML = '';
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Failed to load payouts</td></tr>';
    }
}

// Download invoice for garage (generates if not exists)
async function downloadGarageInvoice(orderId) {
    showToast('Generating invoice...', 'info');
    try {
        // Generate invoice if needed
        const genRes = await fetch(`${API_URL}/documents/invoice/${orderId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const genData = await genRes.json();

        if (!genRes.ok) {
            showToast(genData.error || 'Failed to generate invoice', 'error');
            return;
        }

        const docId = genData.document?.document_id;
        if (!docId) {
            showToast('Invoice generation failed', 'error');
            return;
        }

        // Download the PDF
        const pdfRes = await fetch(`${API_URL}/documents/${docId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!pdfRes.ok) {
            showToast('Failed to download invoice', 'error');
            return;
        }

        const blob = await pdfRes.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = genData.document?.document_number ? `${genData.document.document_number}.pdf` : `invoice-${orderId.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Invoice downloaded!', 'success');
    } catch (err) {
        console.error('Invoice download error:', err);
        showToast('Connection error', 'error');
    }
}

// ============================================
// NOTIFICATION SYSTEM UI
// ============================================

let unreadNotificationCount = 0;
// notifications array is defined at the top of the file (line 58)

// Helper function for escaping HTML (assuming it's not defined elsewhere)
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/notifications?limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.notifications) {
            notifications = data.notifications; // Update global array
            renderNotificationsList();

            unreadNotificationCount = data.unread_count || 0;
            updateNotificationBadge(false);
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function renderNotificationsList() {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="bi bi-bell-slash" style="font-size: 24px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                No notifications
            </div>
        `;
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead('${n.notification_id}')">
            <div class="icon">
                ${getNotificationIcon(n.type)}
            </div>
            <div class="notif-content">
                <div class="notif-title" style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${escapeHTML(n.title)}</div>
                <div class="notif-message" style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">${escapeHTML(n.message)}</div>
                <div class="notif-time" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${getTimeAgo(n.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function getNotificationIcon(type) {
    switch (type) {
        // Bid/Order
        case 'bid_accepted': return '<i class="bi bi-check-circle-fill text-success"></i>';
        case 'bid_rejected': return '<i class="bi bi-x-circle-fill text-danger"></i>';
        case 'bid_accepted_at_final_price': return '<i class="bi bi-check2-all text-success"></i>';
        case 'new_request': return '<i class="bi bi-inbox-fill text-primary"></i>';
        case 'request_deleted': return '<i class="bi bi-trash text-secondary"></i>';
        case 'request_cancelled': return '<i class="bi bi-slash-circle text-warning"></i>';
        case 'order_status': return '<i class="bi bi-box-seam text-info"></i>';
        case 'order_cancelled': return '<i class="bi bi-x-octagon text-danger"></i>';
        case 'order_delivered': return '<i class="bi bi-check2-square text-success"></i>';
        case 'order_collected': return '<i class="bi bi-box text-info"></i>';
        // Negotiation
        case 'counter_offer_received': return '<i class="bi bi-chat-quote-fill text-primary"></i>';
        case 'counter_offer_accepted': return '<i class="bi bi-hand-thumbs-up-fill text-success"></i>';
        case 'counter_offer_rejected': return '<i class="bi bi-hand-thumbs-down-fill text-danger"></i>';
        case 'garage_counter_offer': return '<i class="bi bi-chat-dots-fill text-info"></i>';
        // Finance
        case 'payment_sent': return '<i class="bi bi-cash-stack text-success"></i>';
        case 'refund_issued': return '<i class="bi bi-arrow-counterclockwise text-warning"></i>';
        case 'payout_completed': return '<i class="bi bi-wallet2 text-success"></i>';
        case 'payout_released': return '<i class="bi bi-unlock-fill text-info"></i>';
        // Review
        case 'new_review': return '<i class="bi bi-star-fill text-warning"></i>';
        // Dispute
        case 'dispute_created': return '<i class="bi bi-exclamation-triangle-fill text-danger"></i>';
        case 'dispute_resolved': return '<i class="bi bi-shield-check text-success"></i>';
        // Driver/Delivery
        case 'collection_driver_assigned': return '<i class="bi bi-truck text-info"></i>';
        case 'driver_assigned': return '<i class="bi bi-person-badge text-primary"></i>';
        case 'new_assignment': return '<i class="bi bi-geo-alt-fill text-primary"></i>';
        // Default
        default: return '<i class="bi bi-bell-fill text-secondary"></i>';
    }
}

function prependNotification(n) {
    notifications.unshift(n);
    if (notifications.length > 20) notifications.pop();
    renderNotificationsList();
}

function updateNotificationBadge(increment = false) {
    if (increment) unreadNotificationCount++;

    const badge = document.getElementById('notificationBadge');

    if (badge) {
        badge.textContent = unreadNotificationCount;
        badge.style.display = unreadNotificationCount > 0 ? 'flex' : 'none'; // Ops uses flex
    }
}

async function markNotificationRead(id) {
    try {
        await fetch(`${API_URL}/notifications/mark-read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notification_ids: [id] })
        });

        // Update local state
        const notif = notifications.find(n => n.notification_id === id);
        if (notif && !notif.is_read) {
            notif.is_read = true;
            unreadNotificationCount = Math.max(0, unreadNotificationCount - 1);
            updateNotificationBadge();
            renderNotificationsList();
        }
    } catch (err) {
        console.error('Failed to mark read:', err);
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show'); // Ops uses 'show', Garage used 'active'
    }
}

// Helper to format time
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// ============================================
// GLOBAL SEARCH
// ============================================
let searchTimeout = null;
const searchInput = document.getElementById('globalSearchInput');
const searchResultsDiv = document.getElementById('searchResults');

if (searchInput) {
    // Debounced search
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            searchResultsDiv.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(() => performSearch(query), 300);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResultsDiv.style.display = 'none';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
        if (e.key === 'Escape') {
            searchResultsDiv.style.display = 'none';
            searchInput.blur();
        }
    });
}

async function performSearch(query) {
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
            <div onclick="navigateToOrder('${o.order_id}', '${o.order_number}'); searchResultsDiv.style.display='none';" 
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600; color: var(--accent);">#${o.order_number}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${o.car_make} ${o.car_model} - ${o.part_description?.slice(0, 25) || ''}</div>
                </div>
                <span class="order-status ${o.order_status?.replace('_', '-')}" style="font-size: 10px;">${o.order_status}</span>
            </div>
        `).join('');
    }

    // Requests
    if (results.requests && results.requests.length > 0) {
        html += `<div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 8px;">Requests</div>`;
        html += results.requests.slice(0, 5).map(r => `
            <div onclick="switchSection('requests'); searchResultsDiv.style.display='none';"
                 style="padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight: 600;">${r.car_make} ${r.car_model}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${r.part_description?.slice(0, 35) || ''}</div>
                </div>
                <span style="font-size: 11px; color: var(--text-muted);">${r.status}</span>
            </div>
        `).join('');
    }

    searchResultsDiv.innerHTML = html || '<div style="padding: 16px; text-align: center; color: var(--text-muted);">No results found</div>';
    searchResultsDiv.style.display = 'block';
}

// Navigate to Orders section and highlight specific order
function navigateToOrder(orderId, orderNumber) {
    // Open the order detail modal
    viewOrder(orderId);
}

// View Order Detail Modal
async function viewOrder(orderId) {
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load order');

        const data = await res.json();
        const order = data.order;

        // Populate header
        document.getElementById('orderModalNumber').textContent = '#' + (order.order_number || orderId.slice(0, 8));
        document.getElementById('orderModalDate').textContent = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Status badge
        const statusLabels = {
            confirmed: 'Confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready for Pickup',
            collected: 'Picked Up',
            in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
            disputed: 'Disputed', refunded: 'Refunded'
        };
        const statusBadge = document.getElementById('orderModalStatus');
        statusBadge.textContent = statusLabels[order.order_status] || order.order_status;
        statusBadge.className = 'status-badge ' + (order.order_status?.replace('_', '-') || '');

        // Customer info (hidden for privacy if not available)
        document.getElementById('orderModalCustomer').textContent = order.customer_name || 'Customer';
        document.getElementById('orderModalCustomerPhone').textContent = order.customer_phone || '---';

        // Part details
        document.getElementById('orderModalVehicle').textContent = `${order.car_make || ''} ${order.car_model || ''} ${order.car_year || ''}`.trim();
        document.getElementById('orderModalPrice').textContent = (order.total_amount || order.part_price || 0) + ' QAR';

        // Category and Subcategory
        const categoryText = order.part_category
            ? (order.part_subcategory ? `${order.part_category} > ${order.part_subcategory}` : order.part_category)
            : '---';
        document.getElementById('orderModalCategory').textContent = categoryText;

        document.getElementById('orderModalPart').textContent = order.part_description || '---';
        document.getElementById('orderModalCondition').textContent = formatConditionLabel(order.part_condition);
        document.getElementById('orderModalWarranty').textContent = (order.warranty_days || 0) + ' days';

        // Images
        const imagesContainer = document.getElementById('orderModalImages');
        const allImages = [...(order.bid_images || []), ...(order.request_images || [])];
        if (allImages.length > 0) {
            imagesContainer.innerHTML = allImages.map(url =>
                `<img src="${url}" onclick="window.open('${url}', '_blank')" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid var(--border); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform=''">`
            ).join('');
        } else {
            imagesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;"><i class="bi bi-image"></i> No photos uploaded</div>';
        }

        // Timeline
        const timelineContainer = document.getElementById('orderModalTimeline');
        const statusHistory = [
            { status: 'Order Created', date: order.created_at },
            order.confirmed_at && { status: 'Confirmed', date: order.confirmed_at },
            order.pickup_at && { status: 'Collected', date: order.pickup_at },
            order.delivered_at && { status: 'Delivered', date: order.delivered_at }
        ].filter(Boolean);

        timelineContainer.innerHTML = statusHistory.map((h, i) => `
            <div style="position: relative; padding: 8px 0 ${i === statusHistory.length - 1 ? '0' : '16px'} 20px;">
                <div style="position: absolute; left: -6px; top: 10px; width: 10px; height: 10px; background: ${i === statusHistory.length - 1 ? 'var(--accent)' : 'var(--text-muted)'}; border-radius: 50%;"></div>
                <div style="font-weight: 500; color: var(--text-primary);">${h.status}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `).join('');

        // Delivery info
        if (order.driver_name) {
            document.getElementById('orderModalDeliverySection').style.display = 'block';
            document.getElementById('orderModalDriver').textContent = order.driver_name;
            document.getElementById('orderModalDeliveryStatus').textContent = order.delivery_status || 'Assigned';
        } else {
            document.getElementById('orderModalDeliverySection').style.display = 'none';
        }

        // Notes
        if (order.bid_notes) {
            document.getElementById('orderModalNotesSection').style.display = 'block';
            document.getElementById('orderModalNotes').textContent = order.bid_notes;
        } else {
            document.getElementById('orderModalNotesSection').style.display = 'none';
        }

        // Show modal
        document.getElementById('orderDetailModal').classList.add('active');

    } catch (err) {
        console.error('Error loading order:', err);
        showToast('Failed to load order details', 'error');
    }
}

function closeOrderModal() {
    document.getElementById('orderDetailModal').classList.remove('active');
}

function formatConditionLabel(condition) {
    const labels = {
        new: 'New', used_excellent: 'Used - Excellent', used_good: 'Used - Good',
        used_fair: 'Used - Fair', refurbished: 'Refurbished'
    };
    return labels[condition] || condition || '---';
}

// ==========================================
// ANIMATED COUNTER
// ==========================================

function animateCounter(elementId, endValue, duration = 1000, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const startTime = performance.now();

    // Add animation class
    element.classList.add('animated');

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        const currentValue = Math.floor(startValue + (endValue - startValue) * easedProgress);
        element.textContent = currentValue.toLocaleString() + suffix;

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = endValue.toLocaleString() + suffix;
        }
    }

    requestAnimationFrame(updateCounter);
}

// ==========================================
// SKELETON LOADERS
// ==========================================

function showSkeletonLoader(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-text title skeleton-shimmer"></div>
                <div class="skeleton-text long skeleton-shimmer"></div>
                <div class="skeleton-text medium skeleton-shimmer"></div>
                <div class="skeleton-text short skeleton-shimmer"></div>
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <div class="skeleton-btn skeleton-shimmer"></div>
                    <div class="skeleton-btn skeleton-shimmer"></div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function hideSkeletonLoader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove skeleton cards
    const skeletons = container.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

// ==========================================
// RIPPLE EFFECT
// ==========================================

function addRippleEffect(element) {
    element.classList.add('ripple');
}

// Auto-add ripple to all primary buttons
document.querySelectorAll('.btn-primary, .btn-action').forEach(btn => {
    btn.classList.add('ripple');
});

// ==========================================
// PAYOUT STATEMENT DOWNLOAD (Bilingual B2B)
// ==========================================

async function downloadPayoutStatement(orderId) {
    showToast('Generating payout statement...', 'info');
    try {
        // Generate the garage payout statement
        const genRes = await fetch(`${API_URL}/documents/invoice/${orderId}?type=garage`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const genData = await genRes.json();

        if (!genRes.ok) {
            showToast(genData.error || 'Failed to generate statement', 'error');
            return;
        }

        const docId = genData.document?.document_id;
        if (!docId) {
            showToast('Statement generation failed', 'error');
            return;
        }

        // Download the PDF
        const pdfRes = await fetch(`${API_URL}/documents/${docId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!pdfRes.ok) {
            showToast('Failed to download statement', 'error');
            return;
        }

        const blob = await pdfRes.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = genData.document?.document_number
            ? `payout-${genData.document.document_number}.pdf`
            : `payout-statement-${orderId.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Payout statement downloaded! كشف حساب الورشة', 'success');
    } catch (err) {
        console.error('Payout statement download error:', err);
        showToast('Connection error', 'error');
    }
}

// (Counter-offer handlers defined earlier in file - see lines 826-1968)

// ==========================================
// REUSABLE PAGINATION COMPONENT
// ==========================================

/**
 * Render pagination controls
 * @param {string} containerId - ID of the container element
 * @param {object} pagination - { page, limit, total, pages }
 * @param {function} onPageChange - Callback function with page number
 */
function renderPagination(containerId, pagination, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { page, pages, total } = pagination;

    if (!pages || pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';

    // Previous button
    html += `<button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${page - 1})">
        <i class="bi bi-chevron-left"></i>
    </button>`;

    // Page numbers with smart ellipsis
    const showPages = [];
    const addPage = (p) => { if (!showPages.includes(p)) showPages.push(p); };

    // Always show first page
    addPage(1);

    // Show pages around current
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
        addPage(i);
    }

    // Always show last page
    if (pages > 1) addPage(pages);

    // Sort and render with ellipsis
    showPages.sort((a, b) => a - b);
    let lastRendered = 0;

    showPages.forEach(p => {
        if (lastRendered && p - lastRendered > 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="pagination-btn ${p === page ? 'active' : ''}" onclick="${onPageChange}(${p})">${p}</button>`;
        lastRendered = p;
    });

    // Next button
    html += `<button class="pagination-btn" ${page >= pages ? 'disabled' : ''} onclick="${onPageChange}(${page + 1})">
        <i class="bi bi-chevron-right"></i>
    </button>`;

    // Info text
    html += `<span class="pagination-info">Page ${page} of ${pages} (${total} items)</span>`;

    html += '</div>';
    container.innerHTML = html;
}

// Pagination state for reviews
let reviewsPage = 1;
const REVIEWS_PAGE_SIZE = 10;

// ============================================
// PREMIUM UPGRADE - Live DateTime & Greeting
// ============================================

// (Variables declared at top of file to avoid TDZ issues)

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
    updateConnectionStatus(true);

    // Update header greeting with garage name
    const garageName = localStorage.getItem('garageName') || 'Partner';
    const greetingEl = document.getElementById('headerGreeting');
    if (greetingEl) {
        greetingEl.textContent = getTimeBasedGreeting() + ', ' + garageName;
    }
}

/**
 * Get time-based greeting
 */
function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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
        minute: '2-digit'
    };
    const formatted = now.toLocaleDateString('en-US', options);
    const el = document.getElementById('liveDateTime');
    if (el) el.textContent = formatted;
}

/**
 * Update greeting based on time of day
 */
function updateGreeting() {
    const garageName = localStorage.getItem('garageName') || 'Partner';
    const greetingEl = document.getElementById('headerGreeting');
    if (greetingEl) {
        greetingEl.textContent = getTimeBasedGreeting() + ', ' + garageName;
    }
}

// ============================================
// PREMIUM UPGRADE - Keyboard Shortcuts
// ============================================

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        // Section navigation (1-7)
        const sections = ['dashboard', 'requests', 'bids', 'orders', 'subscription', 'earnings', 'profile'];
        if (e.key >= '1' && e.key <= '7' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const index = parseInt(e.key) - 1;
            if (sections[index]) {
                e.preventDefault();
                switchSection(sections[index]);
            }
        }

        // R - Refresh
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            refreshCurrentSection();
        }

        // ? - Show shortcuts
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            showKeyboardShortcuts();
        }

        // Esc - Close modals
        if (e.key === 'Escape') {
            closeKeyboardShortcuts();
            closeBidModal();
            closeOrderModal();
            closeDisputeModal();
            closeLightbox();
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
    }
}

/**
 * Close keyboard shortcuts modal
 */
function closeKeyboardShortcuts() {
    const modal = document.getElementById('keyboardShortcutsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============================================
// PREMIUM UPGRADE - Notifications System
// ============================================

// (notifications variable declared at top of file)

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
async function markAllRead() {
    try {
        // Call backend to mark all notifications as read
        const res = await fetch(`${API_URL}/notifications/mark-read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notification_ids: ['all'] })
        });

        if (!res.ok) {
            throw new Error('API request failed');
        }

        // Mark all local notifications as read
        notifications.forEach(n => n.is_read = true);
        unreadNotificationCount = 0;

        // Update UI
        renderNotificationsList();
        updateNotificationBadge();

        // Also hide the dot if it exists
        const dot = document.getElementById('notificationDot');
        if (dot) dot.style.display = 'none';

        showToast('All notifications marked as read', 'success');
    } catch (err) {
        console.error('Failed to mark all read:', err);
        showToast('Failed to mark notifications as read', 'error');
    }
}

/**
 * Clear all notifications from the list (removes from UI)
 * Marks them as read in backend first, then clears locally
 */
async function clearAllNotifications() {
    try {
        // DELETE all notifications permanently from database
        await fetch(`${API_URL}/dashboard/notifications`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Clear local notifications array completely
        notifications = [];
        unreadNotificationCount = 0;

        // Update UI
        renderNotificationsList();
        updateNotificationBadge();

        // Hide badge and dot
        const dot = document.getElementById('notificationDot');
        if (dot) dot.style.display = 'none';

        showToast('Notifications cleared', 'success');
    } catch (err) {
        console.error('Failed to clear notifications:', err);
        showToast('Failed to clear notifications', 'error');
    }
}

/**
 * Add a notification
 */
function addNotification(title, type = 'info', section = null) {
    const now = new Date();
    notifications.unshift({
        title,
        type,
        section,
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });

    // Keep only last 10
    if (notifications.length > 10) {
        notifications = notifications.slice(0, 10);
    }

    renderNotifications();

    // Show dot
    const dot = document.getElementById('notificationDot');
    if (dot) dot.style.display = 'block';
}

/**
 * Render notifications list
 */
function renderNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="bi bi-bell-slash"></i>
                <span>No new notifications</span>
            </div>
        `;
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item" onclick="handleNotificationClick('${n.section || ''}')">
            <div class="icon ${n.type}">
                <i class="bi bi-${getNotificationIcon(n.type)}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${escapeHTML(n.title)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${n.time}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'warning': return 'exclamation-triangle';
        case 'danger': return 'x-circle';
        default: return 'info-circle';
    }
}

/**
 * Handle notification click
 */
function handleNotificationClick(section) {
    toggleNotifications();
    if (section) {
        switchSection(section);
    }
}

// Close notifications when clicking outside
document.addEventListener('click', (e) => {
    const container = document.querySelector('.header-notifications');
    const dropdown = document.getElementById('notificationsDropdown');

    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// ============================================
// PREMIUM UPGRADE - Auto Refresh & Activity
// ============================================

/**
 * Start auto-refresh interval (every 60 seconds)
 */
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = setInterval(() => {
        // Only refresh if user is active
        if (Date.now() - lastActivityTime < 5 * 60 * 1000) {
            refreshCurrentSection(true); // silent refresh
        }
    }, 60000);
}

/**
 * Refresh current section with optional spinning animation
 */
function refreshCurrentSection(silent = false) {
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');

    if (!silent && refreshBtn) {
        refreshBtn.classList.add('spinning');
        setTimeout(() => refreshBtn.classList.remove('spinning'), 1000);
    }

    // Find active section
    const activeNav = document.querySelector('.nav-item.active');
    const section = activeNav?.dataset?.section || 'dashboard';

    switch (section) {
        case 'dashboard':
            loadStats();
            loadOrders(); // This also populates dashboard recent orders
            break;
        case 'requests':
            loadRequests();
            break;
        case 'bids':
            loadBids();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'subscription':
            loadSubscription();
            break;
        case 'earnings':
            loadEarnings();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'profile':
            loadProfile();
            break;
    }

    if (!silent) {
        showToast('Refreshed', 'success');
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

// ============================================
// PREMIUM UPGRADE - Connection Status
// ============================================

/**
 * Update connection status indicator
 */
function updateConnectionStatus(isOnline) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    const container = document.getElementById('connectionStatus');

    if (indicator && text && container) {
        if (isOnline) {
            indicator.classList.remove('offline');
            text.textContent = 'Connected';
            container.style.background = 'rgba(16, 185, 129, 0.1)';
            container.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            container.style.color = 'var(--success)';
        } else {
            indicator.classList.add('offline');
            text.textContent = 'Offline';
            container.style.background = 'rgba(239, 68, 68, 0.1)';
            container.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            container.style.color = 'var(--danger)';
        }
    }
}

// Socket connection status listeners
if (typeof socket !== 'undefined' && socket) {
    socket.on('connect', () => {
        updateConnectionStatus(true);
        // Re-join room on reconnection (critical for notifications)
        if (userId) {
            socket.emit('join_garage_room', userId);
        }
    });

    socket.on('disconnect', () => {
        updateConnectionStatus(false);
    });
}

// Also listen for browser online/offline events
window.addEventListener('online', () => updateConnectionStatus(true));
window.addEventListener('offline', () => updateConnectionStatus(false));

// ============================================
// END OF SOCKET EVENT HANDLERS
// ============================================


// ===== NEGOTIATION HISTORY =====
async function viewNegotiationHistory(bidId) {
    try {
        const res = await fetch(`${API_URL}/negotiations/bids/${bidId}/negotiations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Failed to load history', 'error');
            return;
        }

        // Find bid info from local data
        const bid = allBidsData.find(b => b.bid_id === bidId);
        const history = data.negotiations || [];

        // Build timeline HTML
        let timelineHtml = `
            <div class="negotiation-timeline">
                <!-- Initial Bid -->
                <div class="timeline-item garage">
                    <div class="timeline-marker"><i class="bi bi-tag-fill"></i></div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-who">You (Initial Bid)</span>
                            <span class="timeline-time">${bid ? getTimeAgo(bid.created_at) : 'N/A'}</span>
                        </div>
                        <div class="timeline-amount">${bid ? bid.bid_amount : '?'} QAR</div>
                        ${bid?.notes ? `<div class="timeline-notes">${escapeHTML(bid.notes)}</div>` : ''}
                    </div>
                </div>
        `;

        // Add counter-offers
        history.forEach((co, idx) => {
            const isGarage = co.offered_by_type === 'garage';
            const statusIcon = co.status === 'accepted' ? 'check-circle-fill' :
                co.status === 'rejected' ? 'x-circle-fill' :
                    co.status === 'countered' ? 'arrow-repeat' : 'clock';
            const statusClass = co.status === 'accepted' ? 'accepted' :
                co.status === 'rejected' ? 'rejected' : '';

            timelineHtml += `
                <div class="timeline-item ${isGarage ? 'garage' : 'customer'} ${statusClass}">
                    <div class="timeline-marker"><i class="bi bi-${isGarage ? 'building' : 'person-fill'}"></i></div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-who">${isGarage ? 'You (Counter)' : 'Customer'} - Round ${co.round_number}</span>
                            <span class="timeline-time">${getTimeAgo(co.created_at)}</span>
                        </div>
                        <div class="timeline-amount">${co.proposed_amount} QAR</div>
                        ${co.message ? `<div class="timeline-notes">"${escapeHTML(co.message)}"</div>` : ''}
                        <div class="timeline-status ${co.status}">
                            <i class="bi bi-${statusIcon}"></i> ${co.status.charAt(0).toUpperCase() + co.status.slice(1)}
                        </div>
                    </div>
                </div>
            `;
        });

        if (history.length === 0) {
            timelineHtml += `
                <div class="timeline-empty">
                    <i class="bi bi-chat-dots"></i>
                    <p>No negotiation yet. Waiting for customer response.</p>
                </div>
            `;
        }

        timelineHtml += '</div>';

        // Create modal
        const modalHtml = `
            <div class="modal-overlay" id="negotiationHistoryModal" style="display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10000;">
                <div class="modal" style="max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; background: var(--bg-card); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i class="bi bi-clock-history" style="color: var(--accent);"></i>
                            Negotiation History
                        </h3>
                        <button onclick="closeNegotiationHistoryModal()" style="background: none; border: none; font-size: 24px; color: var(--text-secondary); cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; margin-bottom: 20px;">
                            <div style="font-size: 12px; color: var(--text-muted);">Part Request</div>
                            <div style="font-weight: 600;">${escapeHTML(bid.car_summary || 'Vehicle')} - ${escapeHTML(bid.part_description?.slice(0, 50) || 'Part')}</div>
                        </div>
                        ${timelineHtml}
                    </div>
                </div>
            </div>
            <style>
                .negotiation-timeline {display: flex; flex-direction: column; gap: 0; padding-left: 20px; }
                .timeline-item {position: relative; padding: 16px; padding-left: 32px; border-left: 2px solid var(--border); }
                .timeline-item:last-child {border-left-color: transparent; }
                .timeline-item.garage {border-left-color: var(--accent); }
                .timeline-item.customer {border-left-color: #10b981; }
                .timeline-item.accepted .timeline-content {background: rgba(16, 185, 129, 0.1); border-color: #10b981; }
                .timeline-item.rejected .timeline-content {background: rgba(239, 68, 68, 0.1); border-color: #ef4444; }
                .timeline-marker {position: absolute; left: -12px; width: 24px; height: 24px; background: var(--bg-card); border: 2px solid var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
                .timeline-item.garage .timeline-marker {border-color: var(--accent); color: var(--accent); }
                .timeline-item.customer .timeline-marker {border-color: #10b981; color: #10b981; }
                .timeline-content {background: var(--bg-secondary); padding: 12px; border-radius: 10px; border: 1px solid var(--border); }
                .timeline-header {display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
                .timeline-who {font-weight: 600; color: var(--text-primary); }
                .timeline-amount {font-size: 18px; font-weight: 700; color: var(--success); }
                .timeline-notes {font-size: 13px; color: var(--text-secondary); font-style: italic; margin-top: 6px; }
                .timeline-status {font-size: 11px; margin-top: 8px; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
                .timeline-status.pending {background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
                .timeline-status.accepted {background: rgba(16, 185, 129, 0.2); color: #10b981; }
                .timeline-status.rejected {background: rgba(239, 68, 68, 0.2); color: #ef4444; }
                .timeline-status.countered {background: rgba(99, 102, 241, 0.2); color: #8D1B3D; }
                .timeline-status.expired {background: rgba(107, 114, 128, 0.2); color: #6b7280; }
                .timeline-empty {text-align: center; padding: 30px; color: var(--text-muted); }
                .timeline-empty i {font-size: 32px; margin-bottom: 10px; display: block; }
            </style>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('negotiationHistoryModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (err) {
        console.error('Failed to load negotiation history:', err);
        showToast('Failed to load negotiation history', 'error');
    }
}

function closeNegotiationHistoryModal() {
    const modal = document.getElementById('negotiationHistoryModal');
    if (modal) modal.remove();
}

// ===== PARTS SHOWCASE (Enterprise Only) =====
let hasShowcaseAccess = false;

async function loadShowcase() {
    try {
        const res = await fetch(`${API_URL}/showcase/garage`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            // Not Enterprise - show upgrade prompt
            hasShowcaseAccess = false;
            document.getElementById('showcaseUpgradePrompt').style.display = 'block';
            document.getElementById('showcaseContent').style.display = 'none';
            document.getElementById('addPartBtn').style.display = 'none';
            return;
        }

        const data = await res.json();
        hasShowcaseAccess = true;

        // Show content, hide upgrade prompt
        document.getElementById('showcaseUpgradePrompt').style.display = 'none';
        document.getElementById('showcaseContent').style.display = 'block';
        document.getElementById('addPartBtn').style.display = 'inline-flex';

        // Update stats
        const analytics = data.analytics || {};
        document.getElementById('showcaseTotalParts').textContent = analytics.total_parts || 0;
        document.getElementById('showcaseActiveParts').textContent = analytics.active_parts || 0;
        document.getElementById('showcaseTotalViews').textContent = analytics.total_views || 0;
        document.getElementById('showcaseTotalOrders').textContent = analytics.total_orders || 0;

        // Render parts grid
        renderShowcaseParts(data.parts || []);

    } catch (err) {
        console.error('loadShowcase error:', err);
        showToast('Failed to load showcase', 'error');
    }
}

function renderShowcaseParts(parts) {
    // Cache parts for editing
    showcasePartsCache = parts;

    const grid = document.getElementById('showcasePartsGrid');

    if (!parts.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="bi bi-box-seam" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
                <h4 style="margin: 0 0 8px;">No parts yet</h4>
                <p style="color: var(--text-secondary);">Click "Add Part" to showcase your first part to customers!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = parts.map(part => {
        const statusClass = part.status === 'active' ? 'success' : (part.status === 'sold' ? 'warning' : 'secondary');
        const statusIcon = part.status === 'active' ? 'check-circle' : (part.status === 'sold' ? 'bag-check' : 'eye-slash');

        // Handle image URL - may be just filename or full path
        let imageUrl = '';
        if (part.image_urls && part.image_urls.length > 0) {
            const firstImage = part.image_urls[0];
            // If it's just a filename, add the full path
            imageUrl = firstImage.startsWith('/') ? firstImage : `/uploads/${firstImage}`;
        }
        const hasImage = !!imageUrl;

        return `
            <div class="request-card" style="position: relative;">
                <div style="position: absolute; top: 12px; right: 12px;">
                    <span class="badge badge-${statusClass}" style="font-size: 11px;">
                        <i class="bi bi-${statusIcon}"></i> ${part.status.charAt(0).toUpperCase() + part.status.slice(1)}
                    </span>
                </div>
                <div style="display: flex; gap: 12px;">
                    ${hasImage ? `
                        <img src="${imageUrl}" alt="${escapeHTML(part.title)}" 
                             style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="part-placeholder-icon" style="display: none; width: 80px; height: 80px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border); align-items: center; justify-content: center;">
                            <i class="bi bi-box-seam" style="font-size: 28px; color: var(--text-muted);"></i>
                        </div>
                    ` : `
                        <div style="width: 80px; height: 80px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-box-seam" style="font-size: 28px; color: var(--text-muted);"></i>
                        </div>
                    `}
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 4px; font-size: 15px; color: var(--text-primary);">${escapeHTML(part.title)}</h4>
                        <p style="margin: 0 0 8px; font-size: 13px; color: var(--text-secondary);">
                            ${escapeHTML(part.car_make)}${part.car_model ? ' ' + escapeHTML(part.car_model) : ''}
                        </p>
                        <div style="display: flex; gap: 16px; font-size: 13px;">
                            <span style="font-weight: 600; color: var(--success);">${part.price} QAR</span>
                            <span style="color: var(--text-muted);">${part.part_condition}</span>
                            <span style="color: var(--text-muted);">Qty: ${part.quantity}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                    <div style="display: flex; gap: 16px; font-size: 12px; color: var(--text-muted);">
                        <span><i class="bi bi-eye"></i> ${part.view_count || 0} views</span>
                        <span><i class="bi bi-cart-check"></i> ${part.order_count || 0} orders</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-outline" onclick="openPartPreviewModal('${part.part_id}')" title="Preview as customer" style="color: var(--accent);">
                            <i class="bi bi-phone"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="openEditPartModal('${part.part_id}')" title="Edit part">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="togglePartStatus('${part.part_id}')" title="Toggle visibility">
                            <i class="bi bi-${part.status === 'active' ? 'eye-slash' : 'eye'}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="color: var(--danger);" onclick="deleteShowcasePart('${part.part_id}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Track editing state
let editingPartId = null;
let showcasePartsCache = [];
let imagesToRemove = []; // Track images marked for removal during edit

function openAddPartModal() {
    if (!hasShowcaseAccess) {
        showToast('Enterprise plan required for Parts Showcase', 'warning');
        return;
    }
    editingPartId = null;
    imagesToRemove = []; // Reset removal list
    document.getElementById('addPartForm').reset();
    document.getElementById('partModalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Add Part to Showcase';
    document.getElementById('submitPartBtn').innerHTML = '<i class="bi bi-plus-lg"></i> Add Part';
    document.getElementById('currentImagesPreview').innerHTML = '';
    document.getElementById('currentImagesPreview').style.display = 'none';
    document.getElementById('addPartModal').classList.add('active');
}

// Mark an image for removal (visual only until save)
function markImageForRemoval(url, idx) {
    if (!imagesToRemove.includes(url)) {
        imagesToRemove.push(url);
    }
    // Update visual - strikethrough effect
    const imgWrapper = document.querySelector(`[data-img-idx="${idx}"]`);
    if (imgWrapper) {
        imgWrapper.classList.add('marked-for-removal');
        imgWrapper.querySelector('.remove-img-btn').innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
        imgWrapper.querySelector('.remove-img-btn').onclick = () => unmarkImageForRemoval(url, idx);
    }
    showToast(`Image marked for removal (${imagesToRemove.length})`, 'info');
}

// Undo removal marking
function unmarkImageForRemoval(url, idx) {
    imagesToRemove = imagesToRemove.filter(u => u !== url);
    const imgWrapper = document.querySelector(`[data-img-idx="${idx}"]`);
    if (imgWrapper) {
        imgWrapper.classList.remove('marked-for-removal');
        imgWrapper.querySelector('.remove-img-btn').innerHTML = '<i class="bi bi-x-circle"></i>';
        imgWrapper.querySelector('.remove-img-btn').onclick = () => markImageForRemoval(url, idx);
    }
}

function openEditPartModal(partId) {
    if (!hasShowcaseAccess) {
        showToast('Enterprise plan required for Parts Showcase', 'warning');
        return;
    }

    // Find part in cache
    const part = showcasePartsCache.find(p => p.part_id === partId);
    if (!part) {
        showToast('Part not found', 'error');
        return;
    }

    editingPartId = partId;
    imagesToRemove = []; // Reset removal tracking

    // Populate form fields
    document.getElementById('partTitle').value = part.title || '';
    document.getElementById('partCarMake').value = part.car_make || '';
    document.getElementById('partCarModel').value = part.car_model || '';
    document.getElementById('partCondition').value = part.part_condition || 'used';
    document.getElementById('partPrice').value = part.price || '';
    document.getElementById('partPriceType').value = part.price_type || 'fixed';
    document.getElementById('partWarranty').value = part.warranty_days || 0;
    document.getElementById('partQuantity').value = part.quantity || 1;
    document.getElementById('partDescription').value = part.part_description || '';

    // Show current images with REMOVE buttons
    const previewContainer = document.getElementById('currentImagesPreview');
    if (part.image_urls && part.image_urls.length > 0) {
        previewContainer.innerHTML = `
            <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">
                <i class="bi bi-images" style="color: var(--accent);"></i> Current Images 
                <span style="color: var(--text-muted);">(click ❌ to remove)</span>
            </label>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${part.image_urls.map((url, idx) => `
                    <div class="current-img-wrapper" data-img-idx="${idx}" style="position: relative; transition: all 0.3s;">
                        <img src="${url}" alt="Part image ${idx + 1}" 
                             style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 2px solid var(--border); transition: all 0.3s;"
                             onerror="this.parentElement.style.display='none';">
                        <button type="button" class="remove-img-btn" onclick="markImageForRemoval('${url}', ${idx})"
                                style="position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: var(--danger); color: white; border: 2px solid var(--bg-card); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all 0.2s;">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            <style>
                .current-img-wrapper.marked-for-removal img {
                    opacity: 0.3;
                    filter: grayscale(100%);
                    border-color: var(--danger) !important;
                }
                .current-img-wrapper.marked-for-removal::after {
                    content: "";
                    position: absolute;
                    top: 50%;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--danger);
                    transform: rotate(-45deg);
                }
                .remove-img-btn:hover {
                    transform: scale(1.1);
                }
            </style>
        `;
        previewContainer.style.display = 'block';
    } else {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
    }

    // Update modal title and button
    document.getElementById('partModalTitle').innerHTML = '<i class="bi bi-pencil-square"></i> Edit Part';
    document.getElementById('submitPartBtn').innerHTML = '<i class="bi bi-check-lg"></i> Save Changes';

    document.getElementById('addPartModal').classList.add('active');
}

function closeAddPartModal() {
    document.getElementById('addPartModal').classList.remove('active');
    editingPartId = null;
}

async function submitAddPart(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('submitPartBtn');
    const isEditing = !!editingPartId;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> ${isEditing ? 'Saving...' : 'Adding...'}`;

    try {
        const formData = new FormData();
        formData.append('title', document.getElementById('partTitle').value);
        formData.append('car_make', document.getElementById('partCarMake').value);
        formData.append('car_model', document.getElementById('partCarModel').value || '');
        formData.append('part_condition', document.getElementById('partCondition').value);
        formData.append('price', document.getElementById('partPrice').value);
        formData.append('price_type', document.getElementById('partPriceType').value);
        formData.append('warranty_days', document.getElementById('partWarranty').value || 0);
        formData.append('quantity', document.getElementById('partQuantity').value || 1);
        formData.append('part_description', document.getElementById('partDescription').value || '');

        // Add images marked for removal (only when editing)
        if (isEditing && imagesToRemove.length > 0) {
            formData.append('images_to_remove', JSON.stringify(imagesToRemove));
        }

        // Add new images
        const imagesInput = document.getElementById('partImages');
        if (imagesInput.files.length > 0) {
            for (let i = 0; i < Math.min(imagesInput.files.length, 5); i++) {
                formData.append('images', imagesInput.files[i]);
            }
        }

        const url = isEditing
            ? `${API_URL}/showcase/garage/${editingPartId}`
            : `${API_URL}/showcase/garage`;

        const method = isEditing ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            let message = isEditing ? 'Part updated successfully!' : 'Part added to showcase!';
            if (isEditing && data.images_removed > 0) {
                message += ` (${data.images_removed} image${data.images_removed > 1 ? 's' : ''} removed)`;
            }
            showToast(message, 'success');
            closeAddPartModal();
            imagesToRemove = []; // Reset
            loadShowcase(); // Reload parts
        } else {
            showToast(data.error || `Failed to ${isEditing ? 'update' : 'add'} part`, 'error');
        }
    } catch (err) {
        console.error('submitAddPart error:', err);
        showToast(`Failed to ${isEditing ? 'update' : 'add'} part`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = isEditing
            ? '<i class="bi bi-check-lg"></i> Save Changes'
            : '<i class="bi bi-plus-lg"></i> Add Part';
    }
}

async function togglePartStatus(partId) {
    try {
        const res = await fetch(`${API_URL}/showcase/garage/${partId}/toggle`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Part ${data.status === 'active' ? 'activated' : 'hidden'}`, 'success');
            loadShowcase();
        } else {
            showToast(data.error || 'Failed to toggle status', 'error');
        }
    } catch (err) {
        console.error('togglePartStatus error:', err);
        showToast('Failed to toggle status', 'error');
    }
}

async function deleteShowcasePart(partId) {
    if (!confirm('Are you sure you want to remove this part from your showcase?')) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/showcase/garage/${partId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Part removed from showcase', 'success');
            loadShowcase();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to remove part', 'error');
        }
    } catch (err) {
        console.error('deleteShowcasePart error:', err);
        showToast('Failed to remove part', 'error');
    }
}

// ===== PREMIUM PART PREVIEW MODAL =====
// Shows exactly what customers see in the app
function openPartPreviewModal(partId) {
    const part = showcasePartsCache.find(p => p.part_id === partId);
    if (!part) {
        showToast('Part not found', 'error');
        return;
    }

    // Format condition nicely
    const conditionLabels = {
        'new': '✨ New',
        'used': '♻️ Used',
        'refurbished': '🔧 Refurbished'
    };
    const conditionDisplay = conditionLabels[part.part_condition] || part.part_condition;

    // Build image gallery HTML
    const images = part.image_urls || [];
    const galleryHtml = images.length > 0 ? `
        <div class="preview-gallery" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px;">
            ${images.map((url, idx) => `
                <img src="${url}" alt="Part image ${idx + 1}" 
                     onclick="previewFullImage('${url}')"
                     style="width: 100px; height: 100px; object-fit: cover; border-radius: 12px; cursor: zoom-in; border: 2px solid var(--border); transition: transform 0.2s;"
                     onmouseover="this.style.transform='scale(1.05)'"
                     onmouseout="this.style.transform='scale(1)'"
                     onerror="this.style.display='none'">
            `).join('')}
        </div>
    ` : `
        <div style="text-align: center; padding: 40px; background: var(--bg-secondary); border-radius: 12px; color: var(--text-muted);">
            <i class="bi bi-image" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>
            <span>No images uploaded</span>
        </div>
    `;

    // Main image
    const mainImageHtml = images.length > 0 ? `
        <div style="position: relative; margin-bottom: 16px; border-radius: 16px; overflow: hidden; background: var(--bg-secondary);">
            <img src="${images[0]}" alt="${escapeHTML(part.title)}"
                 style="width: 100%; height: 220px; object-fit: cover; cursor: zoom-in;"
                 onclick="previewFullImage('${images[0]}')"
                 onerror="this.parentElement.innerHTML='<div style=\\'padding:60px; text-align:center; color:var(--text-muted);\\'><i class=\\'bi bi-image\\' style=\\'font-size:48px;\\'></i></div>'">
            ${images.length > 1 ? `<span style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px;">+${images.length - 1} more</span>` : ''}
        </div>
    ` : '';

    // Create modal
    const modalHtml = `
        <div class="part-preview-overlay" id="partPreviewModal" onclick="closePartPreviewModal()" style="display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000; backdrop-filter: blur(4px);">
            <div class="preview-modal" onclick="event.stopPropagation()" style="max-width: 420px; width: 95%; max-height: 90vh; overflow-y: auto; background: var(--bg-card); border-radius: 24px; box-shadow: 0 25px 80px rgba(0,0,0,0.4); animation: slideUp 0.3s ease;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, var(--accent), #A82050); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 24px 24px 0 0;">
                    <div style="display: flex; align-items: center; gap: 10px; color: white;">
                        <i class="bi bi-phone" style="font-size: 20px;"></i>
                        <span style="font-weight: 600;">Customer Preview</span>
                    </div>
                    <button onclick="closePartPreviewModal()" style="background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <!-- Content -->
                <div style="padding: 20px;">
                    <!-- Main Image -->
                    ${mainImageHtml}
                    
                    <!-- Title & Price -->
                    <div style="margin-bottom: 20px;">
                        <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: var(--text-primary);">${escapeHTML(part.title)}</h2>
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <span style="font-size: 26px; font-weight: 800; color: var(--success);">${part.price} QAR</span>
                            ${part.price_type === 'negotiable' ? '<span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">NEGOTIABLE</span>' : '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">FIXED PRICE</span>'}
                        </div>
                    </div>
                    
                    <!-- Quick Info Cards -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Condition</div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${conditionDisplay}</div>
                        </div>
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Warranty</div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${part.warranty_days || 0} days</div>
                        </div>
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">In Stock</div>
                            <div style="font-size: 13px; font-weight: 600; color: ${part.quantity > 0 ? 'var(--success)' : 'var(--danger)'};">${part.quantity || 0}</div>
                        </div>
                    </div>
                    
                    <!-- Vehicle Compatibility -->
                    <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1)); padding: 16px; border-radius: 16px; margin-bottom: 20px; border: 1px solid rgba(99, 102, 241, 0.2);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <i class="bi bi-car-front" style="color: var(--accent); font-size: 18px;"></i>
                            <span style="font-weight: 600; color: var(--text-primary);">Fits Vehicle</span>
                        </div>
                        <div style="font-size: 15px; color: var(--text-primary);">
                            <strong>${escapeHTML(part.car_make)}</strong>${part.car_model ? ' ' + escapeHTML(part.car_model) : ''}
                            ${part.car_year_from ? `<span style="color: var(--text-muted);"> (${part.car_year_from}${part.car_year_to ? '-' + part.car_year_to : '+'})</span>` : ''}
                        </div>
                    </div>
                    
                    <!-- Description -->
                    ${part.part_description ? `
                        <div style="margin-bottom: 20px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Description</div>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">${escapeHTML(part.part_description)}</p>
                        </div>
                    ` : ''}
                    
                    <!-- Image Gallery (if more than 1) -->
                    ${images.length > 1 ? `
                        <div style="margin-bottom: 20px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">All Photos (${images.length})</div>
                            ${galleryHtml}
                        </div>
                    ` : ''}
                    
                    <!-- Mock Buy Button (disabled) -->
                    <button disabled style="width: 100%; padding: 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: not-allowed; opacity: 0.7; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="bi bi-cart-plus"></i>
                        ${part.price_type === 'negotiable' ? 'Request Quote' : 'Buy Now'}
                        <span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 8px;">PREVIEW</span>
                    </button>
                </div>
            </div>
        </div>
        <style>
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('partPreviewModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closePartPreviewModal() {
    const modal = document.getElementById('partPreviewModal');
    if (modal) modal.remove();
}

// Full image preview helper
function previewFullImage(url) {
    // Use existing lightbox if available
    if (typeof openRequestLightbox === 'function') {
        // Create temp array for lightbox
        window.tempLightboxImages = [url];
        lightboxImages = window.tempLightboxImages;
        currentLightboxIndex = 0;
        document.getElementById('lightboxImg').src = url;
        document.getElementById('lightboxCounter').textContent = '1 / 1';
        document.getElementById('proLightbox').classList.add('active');
    } else {
        // Simple fallback - open in new tab
        window.open(url, '_blank');
    }
}

// ============================================
// QUICK SERVICES - REMOVED (Jan 19, 2026)
// ============================================
// Quick Services feature was purged per "Simplicity is Beauty" mandate
// Platform is now Parts Marketplace only (Used, Commercial, Genuine)
// ~367 lines of dead code removed


// ============================================
// BRAND SPECIALIZATION - Moved to Earlier Section
// ============================================
// Note: Brand specialization logic is now handled by:
// - CAR_BRANDS constant (line ~2161)
// - initSupplierSettings() (line ~2173)
// - toggleBrandsList() (line ~2205)
// - renderBrandCheckboxes() (line ~2222)
// - saveSupplierSettings() (line ~2295)
// Old duplicate code removed Jan 21, 2026


// End of file - Old duplicate code removed Jan 21, 2026

// ============================================
// END OF FILE
// ============================================


// Specialization logic moved to lines 2160-2340 - Jan 21, 2026








// End of garage-dashboard.js
// Supplier specialization logic at lines 2160-2340

// ============================================
// TAX INVOICE DOWNLOAD (Garage Portal)
// ============================================

/**
 * Initialize invoice date pickers with default values (last 30 days)
 */
function initInvoiceDatePickers() {
    const fromInput = document.getElementById('invoiceFromDate');
    const toInput = document.getElementById('invoiceToDate');

    if (fromInput && toInput) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        fromInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        toInput.value = today.toISOString().split('T')[0];
    }
}

/**
 * Download consolidated Tax Invoice for selected date range
 * @param {string} format - 'pdf' or 'html'
 */
async function downloadMyTaxInvoice(format = 'pdf') {
    const fromDate = document.getElementById('invoiceFromDate')?.value;
    const toDate = document.getElementById('invoiceToDate')?.value;

    if (!fromDate || !toDate) {
        showToast('Please select From and To dates', 'warning');
        return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
        showToast('From date cannot be after To date', 'error');
        return;
    }

    showToast(`Generating ${format.toUpperCase()} invoice...`, 'info');

    try {
        const url = `${API_URL}/dashboard/garage/my-payout-statement?from_date=${fromDate}&to_date=${toDate}&format=${format}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }

        if (format === 'pdf') {
            // Download PDF as blob
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `tax-invoice-${fromDate}-to-${toDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
            showToast('PDF Invoice downloaded!', 'success');
        } else {
            // Open HTML in new tab
            const html = await res.text();
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(html);
                newWindow.document.close();
                showToast('Invoice opened in new tab', 'success');
            } else {
                showToast('Pop-up blocked. Please allow pop-ups.', 'warning');
            }
        }
    } catch (err) {
        console.error('Invoice download error:', err);
        showToast(err.message || 'Failed to generate invoice', 'error');
    }
}

// Initialize date pickers when page loads
document.addEventListener('DOMContentLoaded', () => {
    initInvoiceDatePickers();
});

// Also try init immediately in case DOM already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initInvoiceDatePickers, 100);
}

