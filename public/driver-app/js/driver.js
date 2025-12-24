// ============================================================================
// QScrap Driver App - Main JavaScript
// ============================================================================

const API_URL = '/api';
let token = localStorage.getItem('driverToken');
let userId = localStorage.getItem('driverUserId');
let socket = null;
let gpsWatchId = null;
let currentAssignment = null;
let currentChatAssignment = null;
let currentStats = null;
let driverProfile = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/driver-app/sw.js')
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.error('[SW] Registration failed:', err));
}

// Check auth on load
if (token && userId) {
    showApp();
} else {
    document.getElementById('authScreen').style.display = 'flex';
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, password })
        });

        const data = await res.json();

        if (data.token && data.userType === 'driver') {
            localStorage.setItem('driverToken', data.token);
            localStorage.setItem('driverUserId', data.userId);
            token = data.token;
            userId = data.userId;
            errorDiv.classList.remove('show');
            showApp();
        } else if (data.token) {
            errorDiv.textContent = 'This app is for drivers only.';
            errorDiv.classList.add('show');
        } else {
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.add('show');
        }
    } catch (err) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.classList.add('show');
    }
});

function logout() {
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driverUserId');
    stopGpsTracking();
    if (socket) socket.disconnect();
    location.reload();
}

// ============================================================================
// MAIN APP
// ============================================================================

async function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').classList.add('active');

    // Initialize Socket.IO
    socket = io();
    socket.emit('join_driver_room', userId);

    // Socket event handlers
    socket.on('new_assignment', (data) => {
        showToast(`📦 New assignment: Order #${data.order_number}`, 'success');
        loadAssignments();
        loadStats();
        // Play notification sound
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
    });

    socket.on('assignment_cancelled', (data) => {
        showToast(`⚠️ Assignment cancelled: ${data.reason}`, 'warning');
        loadAssignments();
        loadStats();
    });

    socket.on('delivery_status_updated', (data) => {
        showToast(`📍 Order #${data.order_number}: ${data.status}`, 'info');
        loadAssignments();
    });

    socket.on('assignment_removed', (data) => {
        showToast(`⚠️ Assignment #${data.order_number} reassigned`, 'warning');
        loadAssignments();
        loadStats();
        if (currentAssignment && currentAssignment.assignment_id === data.assignment_id) {
            closeModal();
        }
    });

    // Chat message socket listeners
    socket.on('chat_message', (data) => {
        if (currentChatAssignment && data.assignment_id === currentChatAssignment.assignment_id) {
            loadChatMessages();
            // Play sound if message is from customer
            if (data.sender_type === 'customer') {
                playChatSound();
            }
        }
    });

    socket.on('chat_notification', (data) => {
        playChatSound();
        showToast(data.notification, 'info');
    });

    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Setup status toggle
    document.getElementById('statusToggle').addEventListener('click', toggleStatus);

    // Load initial data
    await Promise.all([
        loadProfile(),
        loadStats(),
        loadAssignments(),
        loadHistory()
    ]);

    // Start GPS tracking
    startGpsTracking();
}

// ============================================================================
// NAVIGATION
// ============================================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Load data for specific tabs
    if (tabId === 'tabHistory') loadHistory();
}

// ============================================================================
// API CALLS
// ============================================================================

async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/driver/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.driver) {
            driverProfile = data.driver;
            updateProfileUI(driverProfile);
            updateStatusUI(driverProfile.status);
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/driver/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.stats) {
            currentStats = data.stats; // Store globally
            document.getElementById('statActive').textContent = data.stats.active_assignments || 0;
            document.getElementById('statToday').textContent = data.stats.today_deliveries || 0;
            document.getElementById('statWeek').textContent = data.stats.week_deliveries || 0;
            document.getElementById('statRating').textContent =
                data.stats.rating_average > 0 ? parseFloat(data.stats.rating_average).toFixed(1) : '-';
        }
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadAssignments() {
    try {
        const res = await fetch(`${API_URL}/driver/assignments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('assignmentsList');

        if (!data.assignments || data.assignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <div class="empty-title">No Active Assignments</div>
                    <div class="empty-text">Wait for new delivery assignments</div>
                </div>
            `;
            return;
        }

        container.innerHTML = data.assignments.map(a => `
            <div class="assignment-card ${a.assignment_status}" onclick="openAssignment('${a.assignment_id}')">
                <div class="assignment-header">
                    <span class="order-number">#${a.order_number}</span>
                    <span class="assignment-status ${a.assignment_status}">${formatStatus(a.assignment_status)}</span>
                </div>
                <div class="assignment-part">${escapeHTML(a.part_description)}</div>
                <div class="assignment-part">${escapeHTML(a.car_make)} ${escapeHTML(a.car_model)} ${a.car_year}</div>
                <div class="assignment-addresses">
                    <div class="address-row">
                        <span class="address-icon pickup"><i class="bi bi-geo-alt"></i></span>
                        <span class="address-text">${escapeHTML(a.garage_name)}<br><small>${escapeHTML(a.pickup_address || a.garage_address)}</small></span>
                    </div>
                    <div class="address-row">
                        <span class="address-icon delivery"><i class="bi bi-flag"></i></span>
                        <span class="address-text">${escapeHTML(a.customer_name)}<br><small>${escapeHTML(a.delivery_address)}</small></span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load assignments:', err);
        showToast('Failed to load assignments', 'error');
    }
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_URL}/driver/assignments?status=completed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('historyList');

        if (!data.assignments || data.assignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-title">No Delivery History</div>
                    <div class="empty-text">Your completed deliveries will appear here</div>
                </div>
            `;
            return;
        }

        // Render function for a single history item
        const renderItem = (a) => {
            const statusIcon = a.assignment_status === 'delivered' ? '✅' :
                a.assignment_status === 'failed' ? '❌' : '📦';
            return `
            <div class="history-item" onclick="openAssignment('${a.assignment_id}')">
                <div class="history-header">
                    <span class="history-order">#${a.order_number}</span>
                    <span class="history-status-icon">${statusIcon}</span>
                </div>
                <div class="history-part">${escapeHTML(a.part_description)}</div>
                <div class="history-footer">
                    <span class="history-customer">${escapeHTML(a.customer_name || 'Customer')}</span>
                    <span class="history-date">${formatDate(a.delivered_at || a.assigned_at)}</span>
                </div>
                <span class="history-status ${a.assignment_status}">${formatStatus(a.assignment_status)}</span>
            </div>
            `;
        };

        // Compact View Logic
        if (data.assignments.length > 1) {
            const firstItem = data.assignments[0];
            const remainingItems = data.assignments.slice(1);

            container.innerHTML = `
                ${renderItem(firstItem)}
                
                <div id="historyExpanded" style="display: none; opacity: 0; transition: opacity 0.3s ease;">
                    ${remainingItems.map(renderItem).join('')}
                </div>

                <button class="history-toggle-btn" onclick="toggleHistory()" id="historyToggleBtn">
                    <span id="historyToggleText">Show All (${data.assignments.length})</span>
                    <i class="bi bi-chevron-down" id="historyToggleIcon"></i>
                </button>
            `;
        } else {
            // Just one item, render normally
            container.innerHTML = data.assignments.map(renderItem).join('');
        }

    } catch (err) {
        console.error('Failed to load history:', err);
        document.getElementById('historyList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Could not load history</div>
                <div class="empty-text">Tap to retry</div>
            </div>
        `;
        document.getElementById('historyList').onclick = () => loadHistory();
    }
}

function toggleHistory() {
    const expandedDiv = document.getElementById('historyExpanded');
    const toggleIcon = document.getElementById('historyToggleIcon');
    const toggleText = document.getElementById('historyToggleText');
    const btn = document.getElementById('historyToggleBtn');

    if (expandedDiv.style.display === 'none') {
        // Expand
        expandedDiv.style.display = 'block';
        // Small timeout to allow display:block to apply before opacity transition
        setTimeout(() => expandedDiv.style.opacity = '1', 10);

        toggleIcon.style.transform = 'rotate(180deg)';
        toggleText.textContent = 'Show Less';
        btn.classList.add('active');
    } else {
        // Collapse
        expandedDiv.style.opacity = '0';
        setTimeout(() => expandedDiv.style.display = 'none', 300);

        toggleIcon.style.transform = 'rotate(0deg)';
        toggleText.textContent = 'Show All';
        btn.classList.remove('active');
    }
}

// ============================================================================
// ASSIGNMENT DETAIL MODAL
// ============================================================================

async function openAssignment(assignmentId) {
    try {
        const res = await fetch(`${API_URL}/driver/assignments/${assignmentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.assignment) {
            showToast('Assignment not found', 'error');
            return;
        }

        currentAssignment = data.assignment;
        renderAssignmentModal(currentAssignment);
        document.getElementById('assignmentModal').classList.add('active');
    } catch (err) {
        showToast('Failed to load assignment', 'error');
    }
}

// Build visual timeline for assignment progress
function buildTimeline(a) {
    const statuses = ['assigned', 'picked_up', 'in_transit', 'delivered'];
    const statusLabels = {
        'assigned': 'Assigned',
        'picked_up': 'Picked Up',
        'in_transit': 'In Transit',
        'delivered': 'Delivered'
    };
    const currentIndex = statuses.indexOf(a.status);

    let html = '<div class="order-timeline">';

    statuses.forEach((status, idx) => {
        let dotClass = 'timeline-dot';
        if (idx < currentIndex) dotClass += ' completed';
        else if (idx === currentIndex) dotClass += ' current';

        let time = '';
        if (status === 'assigned' && a.created_at) {
            time = formatDate(a.created_at);
        } else if (status === 'picked_up' && a.pickup_at) {
            time = formatDate(a.pickup_at);
        } else if (status === 'delivered' && a.delivered_at) {
            time = formatDate(a.delivered_at);
        }

        html += `
            <div class="timeline-item">
                <div class="${dotClass}"></div>
                <div class="timeline-content">
                    <div class="timeline-title">${statusLabels[status]}</div>
                    ${time ? `<div class="timeline-time">${time}</div>` : ''}
                </div>
            </div>
            `;
    });

    html += '</div>';
    return html;
}

function renderAssignmentModal(a) {
    document.getElementById('modalOrderNumber').textContent = `#${a.order_number} `;

    // Build timeline based on status
    const timeline = buildTimeline(a);

    // Payment method indicator for COD collection
    const paymentMethod = a.payment_method || 'cod';
    const isCOD = paymentMethod === 'cod' || paymentMethod === 'cash';

    document.getElementById('modalContent').innerHTML = `
        ${isCOD ? `
        <div class="cod-banner" style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
            <i class="bi bi-cash-coin" style="font-size: 24px;"></i>
            <div>
                <div style="font-weight: 600;">Cash on Delivery</div>
                <div style="font-size: 12px; opacity: 0.9;">Collect payment from customer</div>
            </div>
        </div>
        ` : `
        <div class="paid-banner" style="background: linear-gradient(135deg, #10b981, #059669); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
            <i class="bi bi-credit-card-2-front" style="font-size: 24px;"></i>
            <div>
                <div style="font-weight: 600;">Already Paid</div>
                <div style="font-size: 12px; opacity: 0.9;">No payment collection needed</div>
            </div>
        </div>
        `}

        ${a.delivery_notes || a.driver_notes ? `
        <div class="notes-banner" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <i class="bi bi-info-circle" style="font-size: 20px; margin-top: 2px;"></i>
                <div>
                    <div style="font-weight: 600;">Delivery Instructions</div>
                    <div style="font-size: 13px; opacity: 0.95; margin-top: 4px;">${escapeHTML(a.delivery_notes || a.driver_notes)}</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${a.estimated_delivery ? `
        <div class="eta-banner" style="background: rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <i class="bi bi-clock" style="font-size: 18px;"></i>
            <div>
                <span style="font-size: 12px; opacity: 0.8;">ETA</span>
                <div style="font-weight: 600;">${formatDate(a.estimated_delivery)}</div>
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <div class="detail-section-title">Order Details</div>
            <div class="detail-card">
                <div class="detail-row">
                    <span class="detail-label">Part</span>
                    <span class="detail-value">${escapeHTML(a.part_description)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Vehicle</span>
                    <span class="detail-value">${escapeHTML(a.car_make || '')} ${escapeHTML(a.car_model || '')} ${a.car_year || ''}</span>
                </div>
            </div>
        </div>

        <!--Order Timeline-- >
        <div class="detail-section">
            <div class="detail-section-title">Delivery Timeline</div>
            ${timeline}
        </div>

        <div class="detail-section">
            <div class="detail-section-title">Pickup - ${escapeHTML(a.garage_name)}</div>
            <div class="detail-card">
                <div style="margin-bottom: 8px;">${escapeHTML(a.pickup_address || a.garage_address || 'Address not available')}</div>
                <div class="contact-buttons">
                    ${a.garage_phone ? `
                    <a href="tel:${a.garage_phone}" class="contact-btn call">
                        <i class="bi bi-telephone"></i> Call Garage
                    </a>` : ''}
                    ${(a.pickup_lat && a.pickup_lng) ? `
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${a.pickup_lat},${a.pickup_lng}" 
                       target="_blank" class="contact-btn">
                        <i class="bi bi-map"></i> Navigate
                    </a>` : `
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.pickup_address || a.garage_address || '')}" 
                       target="_blank" class="contact-btn">
                        <i class="bi bi-map"></i> Navigate
                    </a>`}
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">Delivery - ${escapeHTML(a.customer_name || 'Customer')}</div>
            <div class="customer-card">
                <div class="customer-name">${escapeHTML(a.customer_name || 'Customer')}</div>
                ${a.customer_phone ? `<div class="customer-phone"><i class="bi bi-telephone"></i> ${a.customer_phone}</div>` : ''}
            </div>
            <div class="detail-card" style="margin-top: 8px;">
                <div style="margin-bottom: 8px;">${escapeHTML(a.delivery_address || 'Address not available')}</div>
                <div class="contact-buttons">
                    ${a.customer_phone ? `
                    <a href="tel:${a.customer_phone}" class="contact-btn call">
                        <i class="bi bi-telephone"></i> Call
                    </a>` : ''}
                    ${(a.delivery_lat && a.delivery_lng) ? `
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${a.delivery_lat},${a.delivery_lng}" 
                       target="_blank" class="contact-btn">
                        <i class="bi bi-map"></i> Navigate
                    </a>` : `
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.delivery_address || '')}" 
                       target="_blank" class="contact-btn">
                        <i class="bi bi-map"></i> Navigate
                    </a>`}
                </div>
            </div>
        </div>
        `;

    // Render action buttons based on status
    const actionsContainer = document.getElementById('modalActions');
    const status = a.status;

    if (status === 'assigned' || status === 'picked_up') {
        // Both assigned and picked_up show Start Delivery + View Map
        actionsContainer.innerHTML = `
            <button class="btn btn-primary btn-large" onclick="updateStatus('in_transit')">
                <i class="bi bi-truck"></i> Start Delivery
            </button>
            <button class="btn btn-map" onclick="openFullMap()">
                <i class="bi bi-map"></i>
            </button>
        `;
    } else if (status === 'in_transit') {
        actionsContainer.innerHTML = `
            <button class="btn btn-success btn-large" onclick="completeDelivery()">
                <i class="bi bi-check-circle"></i> Complete
            </button>
            <button class="btn btn-map" onclick="openFullMap()">
                <i class="bi bi-map"></i>
            </button>
            <button class="btn chat-button" onclick="openChat()">
                <i class="bi bi-chat-dots"></i>
            </button>
            <button class="btn btn-danger" onclick="reportProblem()">
                <i class="bi bi-exclamation-triangle"></i>
            </button>
        `;
    } else {
        actionsContainer.innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Close</button>
        `;
    }
}

function closeModal() {
    document.getElementById('assignmentModal').classList.remove('active');
    currentAssignment = null;
}

// ============================================================================
// STATUS UPDATES
// ============================================================================

async function updateStatus(newStatus) {
    if (!currentAssignment) return;

    try {
        const res = await fetch(`${API_URL}/driver/assignments/${currentAssignment.assignment_id}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Status updated to ${formatStatus(newStatus)}`, 'success');
            closeModal();
            loadAssignments();
            loadStats();
        } else {
            showToast(data.error || 'Failed to update status', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function toggleStatus() {
    const currentStatus = driverProfile?.status || 'offline';
    const newStatus = currentStatus === 'available' ? 'offline' : 'available';

    try {
        const res = await fetch(`${API_URL}/driver/availability`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();

        if (res.ok) {
            driverProfile.status = newStatus;
            updateStatusUI(newStatus);
            showToast(data.message, 'success');

            // Start/stop GPS based on status
            if (newStatus === 'available') {
                startGpsTracking();
            } else {
                stopGpsTracking();
            }
        } else {
            showToast(data.error || 'Failed to update status', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function reportProblem() {
    const reason = prompt('Please describe the issue:');
    if (reason && currentAssignment) {
        updateStatusWithReason('failed', reason);
    }
}

/**
 * Complete delivery without photo (simplified workflow)
 */
async function completeDelivery() {
    if (!currentAssignment) return;
    await updateStatusDirect('delivered');
}

async function updateStatusWithReason(newStatus, reason) {
    try {
        const res = await fetch(`${API_URL}/driver/assignments/${currentAssignment.assignment_id}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus, failure_reason: reason })
        });

        if (res.ok) {
            showToast('Issue reported', 'warning');
            closeModal();
            loadAssignments();
        }
    } catch (err) {
        showToast('Failed to report issue', 'error');
    }
}

// ============================================================================
// GPS TRACKING
// ============================================================================

function startGpsTracking() {
    if (!navigator.geolocation) {
        updateGpsStatus('error', 'GPS not supported');
        return;
    }

    // Check if geolocation is available (may be blocked by permissions policy)
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
            updateGpsStatus('error', 'GPS: Permission denied');
            showToast('Location permission denied - tracking disabled', 'warning');
            return;
        }

        updateGpsStatus('active', 'GPS: Initializing...');

        gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, heading, speed } = position.coords;
                updateGpsStatus('active', `GPS: Active (±${Math.round(accuracy)}m)`);
                sendLocation(latitude, longitude, accuracy, heading, speed);
            },
            (error) => {
                console.error('GPS Error:', error);
                if (error.code === 1) {
                    updateGpsStatus('error', 'GPS: Permission denied');
                } else if (error.code === 2) {
                    updateGpsStatus('error', 'GPS: Unavailable');
                } else {
                    updateGpsStatus('error', `GPS: Timeout`);
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000
            }
        );
    }).catch(() => {
        // Permissions API not available, try directly
        updateGpsStatus('active', 'GPS: Initializing...');
        gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, heading, speed } = position.coords;
                updateGpsStatus('active', `GPS: Active (±${Math.round(accuracy)}m)`);
                sendLocation(latitude, longitude, accuracy, heading, speed);
                // Update map marker in real-time
                updateDriverMarker(latitude, longitude);
            },
            (error) => {
                console.error('GPS Error:', error);
                updateGpsStatus('error', `GPS: ${error.message}`);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000
            }
        );
    });
}

function stopGpsTracking() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    updateGpsStatus('', 'GPS: Off');
}

let lastLocationSent = 0;
const LOCATION_INTERVAL = 5000; // 5 seconds - matches backend rate limit

async function sendLocation(lat, lng, accuracy, heading, speed) {
    const now = Date.now();
    if (now - lastLocationSent < LOCATION_INTERVAL) return;
    lastLocationSent = now;

    try {
        const response = await fetch(`${API_URL}/driver/location`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lng, accuracy, heading, speed })
        });

        if (response.status === 429) {
            // Rate limit hit - back off for 30 seconds
            console.warn('Rate limit hit, backing off...');
            lastLocationSent += 30000;
            return;
        }
    } catch (err) {
        console.error('Location update failed:', err);
    }
}

function updateGpsStatus(status, text) {
    const gpsEl = document.getElementById('gpsStatus');
    gpsEl.className = `gps-status ${status}`;
    document.getElementById('gpsText').textContent = text;
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateProfileUI(profile) {
    document.getElementById('profileName').textContent = profile.full_name || '-';
    document.getElementById('profilePhone').textContent = profile.phone || '-';
    document.getElementById('profileRating').textContent =
        parseFloat(profile.rating_average) > 0 ? parseFloat(profile.rating_average).toFixed(1) : '-';
    document.getElementById('profileRatingCount').textContent = profile.rating_count || 0;

    // Avatar initial
    const initial = (profile.full_name || 'D')[0].toUpperCase();
    document.getElementById('profileAvatar').textContent = initial;

    // Vehicle info
    const vehicleTypeEl = document.getElementById('profileVehicleType');
    const vehiclePlateEl = document.getElementById('profileVehiclePlate');
    const vehicleIconEl = document.querySelector('.vehicle-icon');

    if (vehicleTypeEl) {
        vehicleTypeEl.textContent = profile.vehicle_type || 'Not Set';
    }
    if (vehiclePlateEl) {
        vehiclePlateEl.textContent = profile.vehicle_plate || '-';
    }
    if (vehicleIconEl) {
        // Set icon based on vehicle type
        const icons = {
            'car': '🚗',
            'motorcycle': '🏍️',
            'van': '🚐',
            'truck': '🚚',
            'bicycle': '🚲'
        };
        const type = (profile.vehicle_type || '').toLowerCase();
        vehicleIconEl.textContent = icons[type] || '🚗';
    }

    // Profile stats - no earnings for salaried drivers
    let totalDeliveries = 0;
    if (profile.total_deliveries !== undefined && profile.total_deliveries !== null) {
        totalDeliveries = parseInt(profile.total_deliveries);
        if (isNaN(totalDeliveries)) totalDeliveries = 0;
    }

    const totalDeliveriesEl = document.getElementById('profileTotalDeliveries');
    const completionRateEl = document.getElementById('profileCompletionRate');

    if (totalDeliveriesEl) {
        totalDeliveriesEl.textContent = totalDeliveries.toString();
    }

    if (completionRateEl) {
        // Calculate completion rate or use provided if available
        // For now hardcoded to 100% or based on failed statuses if we had that data
        const rate = totalDeliveries > 0 ? 100 : 0;
        completionRateEl.textContent = `${rate}%`;
    }
}

function updateStatusUI(status) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    dot.className = `status-dot ${status}`;
    text.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatStatus(status) {
    const statusMap = {
        'assigned': 'Assigned',
        'picked_up': 'Picked Up',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'failed': 'Failed'
    };
    return statusMap[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Profile options (placeholder functions)
function showVehicleInfo() {
    if (driverProfile) {
        showToast(`${driverProfile.vehicle_type || 'Vehicle'}: ${driverProfile.vehicle_plate || 'N/A'}`, 'info');
    }
}

function showDeliveryStats() {
    if (!currentStats) {
        loadStats().then(() => showDeliveryStats());
        return;
    }

    const s = currentStats;
    const rating = s.rating_average > 0 ? parseFloat(s.rating_average).toFixed(1) : 'N/A';

    document.getElementById('statsModalContent').innerHTML = `
        <div class="earnings-card">
             <div class="earnings-label">Overall Rating</div>
             <div class="earnings-value">⭐ ${rating}</div>
             <div class="earnings-subtitle">Based on ${s.rating_count} reviews</div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">Performance Metrics</div>
            <div class="detail-card">
                <div class="detail-row">
                    <span class="detail-label">Total Deliveries</span>
                    <span class="detail-value">${s.total_deliveries}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Today's Deliveries</span>
                    <span class="detail-value">${s.today_deliveries}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">This Week</span>
                    <span class="detail-value">${s.week_deliveries}</span>
                </div>
            </div>
            
            <div class="detail-section-title" style="margin-top: 20px;">Efficiency</div>
            <div class="detail-card">
                 <div class="detail-row">
                    <span class="detail-label">Completion Rate</span>
                    <span class="detail-value">100%</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('statsModal').classList.add('active');
}

function closeStatsModal() {
    document.getElementById('statsModal').classList.remove('active');
}

async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Notifications enabled!', 'success');
        } else {
            showToast('Notifications denied', 'warning');
        }
    }
}

// ============================================================================
// PHOTO CAPTURE FOR DELIVERY PROOF
// ============================================================================

let cameraStream = null;
let capturedPhotoBlob = null;

function openPhotoModal() {
    document.getElementById('photoModal').classList.add('active');
    startCamera();
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('active');
    stopCamera();
    resetPhotoUI();
}

async function startCamera() {
    try {
        const video = document.getElementById('cameraVideo');
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = cameraStream;
        document.getElementById('cameraPreview').style.display = 'block';
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('photoActions').style.display = 'flex';
        document.getElementById('photoCapturedActions').style.display = 'none';
    } catch (err) {
        console.error('Camera error:', err);
        showToast('Cannot access camera. Please allow camera permission.', 'error');
        // Fallback: Allow delivery without photo
        document.getElementById('photoHint').innerHTML = `
            <i class="bi bi-exclamation-triangle"></i>
            Camera unavailable. You can proceed without photo.
        `;
        document.getElementById('photoActions').innerHTML = `
            <button class="btn btn-outline" onclick="closePhotoModal()">Cancel</button>
            <button class="btn btn-success" onclick="openConfirmModal()">Proceed Anyway</button>
        `;
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob((blob) => {
        capturedPhotoBlob = blob;
        const url = URL.createObjectURL(blob);
        document.getElementById('capturedPhoto').src = url;

        // Update UI
        document.getElementById('cameraPreview').style.display = 'none';
        document.getElementById('photoPreview').style.display = 'block';
        document.getElementById('photoActions').style.display = 'none';
        document.getElementById('photoCapturedActions').style.display = 'flex';
        document.getElementById('photoHint').innerHTML = `
            <i class="bi bi-check-circle"></i>
            Photo captured! Confirm to complete delivery.
        `;
    }, 'image/jpeg', 0.8);
}

function retakePhoto() {
    capturedPhotoBlob = null;
    document.getElementById('cameraPreview').style.display = 'block';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoActions').style.display = 'flex';
    document.getElementById('photoCapturedActions').style.display = 'none';
    document.getElementById('photoHint').innerHTML = `
        <i class="bi bi-info-circle"></i>
        Take a clear photo of the delivered item with recipient
    `;
}

function resetPhotoUI() {
    capturedPhotoBlob = null;
    document.getElementById('cameraPreview').style.display = 'block';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoActions').style.display = 'flex';
    document.getElementById('photoCapturedActions').style.display = 'none';
    document.getElementById('photoHint').innerHTML = `
        <i class="bi bi-info-circle"></i>
        Take a clear photo of the delivered item with recipient
    `;
}

async function confirmDeliveryWithPhoto() {
    if (!currentAssignment) return;

    closePhotoModal();
    showToast('Uploading photo...', 'info');

    try {
        // Upload photo first
        if (capturedPhotoBlob) {
            const formData = new FormData();
            formData.append('photo', capturedPhotoBlob, 'delivery_proof.jpg');

            const uploadRes = await fetch(`${API_URL}/driver/assignments/${currentAssignment.assignment_id}/proof`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!uploadRes.ok) {
                console.warn('Photo upload failed, continuing with delivery...');
            }
        }

        // Mark as delivered
        await updateStatusDirect('delivered');

    } catch (err) {
        console.error('Delivery error:', err);
        showToast('Error completing delivery', 'error');
    }
}

function openConfirmModal() {
    closePhotoModal();
    document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

async function finalizeDelivery() {
    closeConfirmModal();
    await updateStatusDirect('delivered');
}

async function updateStatusDirect(newStatus) {
    if (!currentAssignment) return;

    try {
        const res = await fetch(`${API_URL}/driver/assignments/${currentAssignment.assignment_id}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`✅ Delivery completed!`, 'success');
            closeModal();
            loadAssignments();
            loadStats();
        } else {
            showToast(data.error || 'Failed to update status', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================================================
// CUSTOMER CHAT FUNCTIONALITY
// ============================================================================

// Variable moved to top of file

function openChat() {
    if (!currentAssignment) return;

    currentChatAssignment = currentAssignment;
    document.getElementById('chatCustomerName').textContent = currentAssignment.customer_name || 'Customer';
    document.getElementById('chatOrderNumber').textContent = `#${currentAssignment.order_number}`;
    document.getElementById('chatModal').classList.add('active');

    // Join chat room
    if (socket) {
        socket.emit('join_delivery_chat', currentAssignment.assignment_id);
    }

    // Load existing messages
    loadChatMessages();

    // Focus input
    setTimeout(() => document.getElementById('chatInput').focus(), 100);
}

function closeChat() {
    if (currentChatAssignment && socket) {
        socket.emit('leave_delivery_chat', currentChatAssignment.assignment_id);
    }
    document.getElementById('chatModal').classList.remove('active');
    currentChatAssignment = null;
}

async function loadChatMessages() {
    if (!currentChatAssignment) return;

    try {
        const res = await fetch(`${API_URL}/chat/assignment/${currentChatAssignment.assignment_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.messages) {
            renderChatMessages(data.messages);
        }
    } catch (err) {
        console.error('Failed to load messages:', err);
    }
}

/**
 * Convert URLs in text to clickable links
 */
function linkifyText(text) {
    const escapedText = escapeHTML(text);
    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    return escapedText.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener" class="chat-link">$1</a>');
}

function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <i class="bi bi-chat-dots"></i>
                <p>No messages yet. Start the conversation!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isDriver = msg.sender_type === 'driver';
        const time = formatChatTime(msg.created_at);
        return `
            <div class="chat-message ${msg.sender_type}">
                <div>${linkifyText(msg.message)}</div>
                <div class="chat-message-time">${time}</div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function formatChatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || !currentChatAssignment) return;

    input.value = '';
    input.disabled = true;

    try {
        const res = await fetch(`${API_URL}/chat/assignment/${currentChatAssignment.assignment_id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Failed to send message', 'error');
        }
    } catch (err) {
        showToast('Failed to send message', 'error');
    }

    input.disabled = false;
    input.focus();
}

// Handle Enter key in chat input
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
});

/**
 * Play notification sound for incoming chat message
 */
function playChatSound() {
    try {
        // Create audio context
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Pleasant notification beep (like WhatsApp)
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        oscillator.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.1); // E6 note

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (err) {
        console.log('Sound not played:', err);
    }
}

// ============================================================================
// PREMIUM MAP MODULE - Uber/Talabat Quality
// ============================================================================

let deliveryMap = null;
let mapDriverMarker = null;
let mapPickupMarker = null;
let mapDeliveryMarker = null;
let mapRouteLine = null;
let currentDriverPosition = null;

// Custom SVG Markers for premium look
const MARKER_ICONS = {
    driver: L.divIcon({
        className: 'driver-marker',
        html: `<div class="driver-marker-inner">
            <div class="driver-pulse"></div>
            <div class="driver-car">🚗</div>
        </div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    }),

    pickup: L.divIcon({
        className: 'location-marker pickup-marker',
        html: `<div class="marker-pin pickup">
            <i class="bi bi-shop"></i>
        </div>
        <div class="marker-label">Pickup</div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50]
    }),

    delivery: L.divIcon({
        className: 'location-marker delivery-marker',
        html: `<div class="marker-pin delivery">
            <i class="bi bi-house-door-fill"></i>
        </div>
        <div class="marker-label">Delivery</div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50]
    })
};

/**
 * Initialize the Leaflet map with premium features
 */
function initDeliveryMap(containerId) {
    if (deliveryMap) {
        deliveryMap.remove();
    }

    // Create premium map with smooth animations
    deliveryMap = L.map(containerId, {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        minZoom: 8,
        maxZoom: 19
    }).setView([25.2854, 51.5310], 14); // Qatar default, closer zoom

    // OpenStreetMap tiles with smooth loading
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 4
    }).addTo(deliveryMap);

    // Premium zoom controls (bottom-right)
    L.control.zoom({
        position: 'bottomright',
        zoomInTitle: 'Zoom in',
        zoomOutTitle: 'Zoom out'
    }).addTo(deliveryMap);

    // Custom control: Locate Me button
    const LocateControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'map-control-btn locate-btn');
            btn.innerHTML = '<i class="bi bi-crosshairs"></i>';
            btn.title = 'Center on my location';
            btn.onclick = function (e) {
                e.stopPropagation();
                e.preventDefault();
                if (currentDriverPosition) {
                    deliveryMap.flyTo([currentDriverPosition.lat, currentDriverPosition.lng], 16, {
                        duration: 1
                    });
                }
            };
            return btn;
        }
    });
    deliveryMap.addControl(new LocateControl());

    // Custom control: Fit All button
    const FitAllControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'map-control-btn fit-btn');
            btn.innerHTML = '<i class="bi bi-arrows-angle-expand"></i>';
            btn.title = 'Fit all locations';
            btn.onclick = function (e) {
                e.stopPropagation();
                e.preventDefault();
                fitMapToAllPoints();
            };
            return btn;
        }
    });
    deliveryMap.addControl(new FitAllControl());

    return deliveryMap;
}

/**
 * Fit map to show all points (driver, pickup, delivery)
 */
function fitMapToAllPoints() {
    if (!deliveryMap) return;

    const bounds = [];
    if (currentDriverPosition) {
        bounds.push([currentDriverPosition.lat, currentDriverPosition.lng]);
    }
    if (mapPickupMarker) {
        bounds.push(mapPickupMarker.getLatLng());
    }
    if (mapDeliveryMarker) {
        bounds.push(mapDeliveryMarker.getLatLng());
    }

    if (bounds.length >= 2) {
        deliveryMap.flyToBounds(bounds, {
            padding: [60, 60],
            duration: 1,
            maxZoom: 16
        });
    } else if (bounds.length === 1) {
        deliveryMap.flyTo(bounds[0], 16, { duration: 1 });
    }
}


/**
 * Update map with assignment locations
 */
function updateMapWithAssignment(assignment) {
    if (!deliveryMap) return;

    // Clear existing markers
    if (mapPickupMarker) deliveryMap.removeLayer(mapPickupMarker);
    if (mapDeliveryMarker) deliveryMap.removeLayer(mapDeliveryMarker);
    if (mapRouteLine) deliveryMap.removeLayer(mapRouteLine);

    const bounds = [];

    // Add pickup marker (garage)
    if (assignment.pickup_lat && assignment.pickup_lng) {
        const pickupLatLng = [parseFloat(assignment.pickup_lat), parseFloat(assignment.pickup_lng)];
        mapPickupMarker = L.marker(pickupLatLng, { icon: MARKER_ICONS.pickup })
            .addTo(deliveryMap)
            .bindPopup(`<b>${assignment.garage_name || 'Pickup'}</b><br>${assignment.pickup_address || ''}`);
        bounds.push(pickupLatLng);
    }

    // Add delivery marker (customer)
    if (assignment.delivery_lat && assignment.delivery_lng) {
        const deliveryLatLng = [parseFloat(assignment.delivery_lat), parseFloat(assignment.delivery_lng)];
        mapDeliveryMarker = L.marker(deliveryLatLng, { icon: MARKER_ICONS.delivery })
            .addTo(deliveryMap)
            .bindPopup(`<b>${assignment.customer_name || 'Delivery'}</b><br>${assignment.delivery_address || ''}`);
        bounds.push(deliveryLatLng);
    }

    // Add driver marker if we have position
    if (currentDriverPosition) {
        updateDriverMarker(currentDriverPosition.lat, currentDriverPosition.lng);
        bounds.push([currentDriverPosition.lat, currentDriverPosition.lng]);
    }

    // Draw route line
    if (bounds.length >= 2) {
        mapRouteLine = L.polyline(bounds, {
            color: '#00d26a',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10',
            lineCap: 'round'
        }).addTo(deliveryMap);

        // Fit map to show all points
        deliveryMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

/**
 * Update driver's position marker on the map
 */
function updateDriverMarker(lat, lng) {
    if (!deliveryMap) return;

    currentDriverPosition = { lat, lng };
    const latLng = [lat, lng];

    if (mapDriverMarker) {
        // Smooth animation to new position
        mapDriverMarker.setLatLng(latLng);
    } else {
        mapDriverMarker = L.marker(latLng, {
            icon: MARKER_ICONS.driver,
            zIndexOffset: 1000 // Keep driver on top
        }).addTo(deliveryMap);
    }

    // Update ETA if we have delivery location
    if (currentAssignment && currentAssignment.delivery_lat && currentAssignment.delivery_lng) {
        const distance = calculateDistance(
            lat, lng,
            parseFloat(currentAssignment.delivery_lat),
            parseFloat(currentAssignment.delivery_lng)
        );
        updateETADisplay(distance);
    }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

/**
 * Update ETA display based on distance
 */
function updateETADisplay(distanceKm) {
    // Average speed 25 km/h in city traffic
    const etaMinutes = Math.round(distanceKm * 60 / 25);
    const etaElement = document.getElementById('liveETA');

    if (etaElement) {
        if (etaMinutes < 1) {
            etaElement.textContent = 'Arriving now';
        } else if (etaMinutes === 1) {
            etaElement.textContent = '1 min away';
        } else {
            etaElement.textContent = `${etaMinutes} min away`;
        }
    }

    // Also update distance display
    const distanceElement = document.getElementById('liveDistance');
    if (distanceElement) {
        if (distanceKm < 1) {
            distanceElement.textContent = `${Math.round(distanceKm * 1000)} m`;
        } else {
            distanceElement.textContent = `${distanceKm.toFixed(1)} km`;
        }
    }
}

/**
 * Open the map in full-screen mode
 */
function openFullMap() {
    if (!currentAssignment) return;

    const modal = document.getElementById('mapModal');
    if (!modal) {
        // Create map modal dynamically
        createMapModal();
    }

    document.getElementById('mapModal').classList.add('active');

    // Initialize map after modal is visible
    setTimeout(() => {
        initDeliveryMap('fullMapContainer');
        updateMapWithAssignment(currentAssignment);
    }, 100);
}

/**
 * Close full-screen map
 */
function closeMapModal() {
    document.getElementById('mapModal').classList.remove('active');
    if (deliveryMap) {
        deliveryMap.remove();
        deliveryMap = null;
    }
}

/**
 * Create map modal HTML dynamically
 */
function createMapModal() {
    const modalHTML = `
    <div class="modal-overlay map-modal" id="mapModal">
        <div class="map-modal-container">
            <div class="map-header">
                <div class="map-info">
                    <div class="map-eta" id="liveETA">Calculating...</div>
                    <div class="map-distance" id="liveDistance">--</div>
                </div>
                <button class="map-close-btn" onclick="closeMapModal()">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div id="fullMapContainer" class="full-map-container"></div>
            <div class="map-bottom-bar">
                <div class="map-addresses">
                    <div class="map-address pickup">
                        <i class="bi bi-circle-fill"></i>
                        <span id="mapPickupAddress">Pickup location</span>
                    </div>
                    <div class="map-route-line"></div>
                    <div class="map-address delivery">
                        <i class="bi bi-geo-alt-fill"></i>
                        <span id="mapDeliveryAddress">Delivery location</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="openGoogleMapsNavigation()">
                    <i class="bi bi-navigation-fill"></i>
                    Open Google Maps
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Open Google Maps with turn-by-turn navigation
 */
function openGoogleMapsNavigation() {
    if (!currentAssignment) return;

    let url;
    if (currentAssignment.delivery_lat && currentAssignment.delivery_lng) {
        url = `https://www.google.com/maps/dir/?api=1&destination=${currentAssignment.delivery_lat},${currentAssignment.delivery_lng}&travelmode=driving`;
    } else if (currentAssignment.delivery_address) {
        url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentAssignment.delivery_address)}&travelmode=driving`;
    }

    if (url) {
        window.open(url, '_blank');
    }
}

// NOTE: Map updates are triggered via updateDriverMarker() called from GPS watch
// The sendLocation function already works; we call updateDriverMarker separately
