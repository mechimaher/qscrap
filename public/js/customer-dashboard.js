const API_URL = '/api';
let token = localStorage.getItem('token');
let userId = localStorage.getItem('userId');
let userType = localStorage.getItem('userType');

// STRICT ROLE CHECK: If logged in as garage, force logout on customer dashboard
if (token && userType && userType !== 'customer') {
    console.warn('Wrong user role for Customer Dashboard. Clearing session.');
    localStorage.clear();
    token = null;
    userId = null;
    userType = null;
}

let socket = null;
let currentlyOpenOrderId = null; // Track which order detail modal is open

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

// ===== THEME MANAGEMENT =====
function initTheme() {
    const savedTheme = localStorage.getItem('customerTheme');
    // Default to light for customers
    const theme = savedTheme || 'light';
    setTheme(theme);
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('customerTheme', theme);
}

function toggleTheme() {
    const isDark = document.documentElement.hasAttribute('data-theme');
    setTheme(isDark ? 'light' : 'dark');
}

// Initialize theme immediately
initTheme();

// ===== NOTIFICATION SYSTEM =====
let notificationSound = null;

function initNotificationSound() {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    notificationSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };
}

function playNotificationSound() {
    if (notificationSound) {
        try { notificationSound(); } catch (e) { }
    }
}

function showNotificationBadge(type) {
    const dotId = type === 'requests' ? 'requestsNotificationDot' : 'ordersNotificationDot';
    const dot = document.getElementById(dotId);
    if (dot) dot.style.display = 'block';
}

function clearNotificationBadge(type) {
    const dotId = type === 'requests' ? 'requestsNotificationDot' : 'ordersNotificationDot';
    const dot = document.getElementById(dotId);
    if (dot) dot.style.display = 'none';
}

// ===== VIN SCANNER =====
let scannerStream = null;
let scannerWorker = null;

async function openVinScanner() {
    const modal = document.getElementById('vinScannerModal');
    const video = document.getElementById('scannerVideo');

    try {
        // Request camera access
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = scannerStream;
        modal.classList.add('active');

        // Initialize Tesseract worker
        if (!scannerWorker) {
            showToast('Loading OCR engine...', 'info');
            scannerWorker = await Tesseract.createWorker('eng');
            await scannerWorker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
            });
        }
    } catch (err) {
        showToast('Camera access denied. Please allow camera access.', 'error');
        console.error('Camera error:', err);
    }
}

function closeVinScanner() {
    const modal = document.getElementById('vinScannerModal');
    modal.classList.remove('active');

    // Stop camera
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }

    // Reset result
    document.getElementById('scannerResult').classList.remove('visible');
    document.getElementById('scannerResult').textContent = '';
}

async function captureAndScan() {
    const video = document.getElementById('scannerVideo');
    const resultDiv = document.getElementById('scannerResult');

    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    showToast('Scanning for VIN...', 'info');

    try {
        const { data: { text } } = await scannerWorker.recognize(canvas);

        // Extract VIN pattern (17 alphanumeric, no I, O, Q)
        const vinRegex = /[A-HJ-NPR-Z0-9]{17}/g;
        const matches = text.match(vinRegex);

        if (matches && matches.length > 0) {
            const vin = matches[0];
            resultDiv.textContent = vin;
            resultDiv.classList.add('visible');

            // Update input field
            document.getElementById('vinNumber').value = vin;

            playNotificationSound();
            showToast('VIN detected! ðŸŽ‰', 'success');

            // Close after a moment
            setTimeout(() => closeVinScanner(), 1500);
        } else {
            showToast('No VIN found. Try focusing on the VIN area.', 'warning');
        }
    } catch (err) {
        showToast('Scan failed. Please try again.', 'error');
        console.error('OCR error:', err);
    }
}
let selectedCategory = '';
let uploadedImages = [];

// Check auth
if (token && localStorage.getItem('userType') === 'customer') {
    showApp();
}

// Auth tabs
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) => {
        t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
    });
    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: document.getElementById('loginPhone').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await res.json();
        if (data.token && data.userType === 'customer') {
            saveAuth(data);
            showApp();
        } else if (data.token) {
            showToast('Please use the Garage Portal', 'error');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

// Register
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: document.getElementById('regName').value,
                phone_number: document.getElementById('regPhone').value,
                password: document.getElementById('regPassword').value,
                user_type: 'customer'
            })
        });
        const data = await res.json();
        if (data.userId) {
            showToast('Account created! Please sign in.', 'success');
            switchAuthTab('login');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

function saveAuth(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userType', data.userType);
    token = data.token;
    userId = data.userId;
}

function logout() {
    localStorage.clear();
    location.reload();
}

async function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').classList.add('active');

    // Initialize notification sound
    initNotificationSound();

    socket = io();
    socket.emit('join_user_room', userId);

    socket.on('new_bid', (data) => {
        playNotificationSound();
        showNotificationBadge('requests');
        showToast(data.notification, 'success');
        loadRequests();
    });

    // Request expired notification
    socket.on('request_expired', (data) => {
        showToast(data.notification, 'warning');
        loadRequests();
    });

    // Counter offer expired notification
    socket.on('counter_offer_expired', (data) => {
        showToast(data.notification, 'warning');
        loadRequests();
    });

    // NEW: Handle bid updates from garages
    socket.on('bid_updated', (data) => {
        playNotificationSound();
        showNotificationBadge('requests');
        showToast('A garage updated their bid!', 'info');
        loadRequests();
    });

    // Handle bid withdrawal by garage
    socket.on('bid_withdrawn', (data) => {
        playNotificationSound();
        showNotificationBadge('requests');
        showToast(data.message, 'info');
        loadRequests();
    });

    socket.on('order_status_updated', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'success');
        loadOrders();
    });

    socket.on('order_cancelled', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(`${data.message}`, 'warning');
        loadOrders();
    });

    // Order created notification
    socket.on('order_created', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'success');
        loadOrders();
        loadRequests(); // Refresh requests as this one is now accepted
    });

    // Counter-offer socket handlers
    socket.on('counter_offer_accepted', (data) => {
        playNotificationSound();
        showToast(data.notification, 'success');
        loadRequests();
    });

    socket.on('counter_offer_rejected', (data) => {
        playNotificationSound();
        showToast(data.notification, 'warning');
        loadRequests();
    });

    socket.on('garage_counter_offer', (data) => {
        playNotificationSound();
        showNotificationBadge('requests');
        showToast(data.notification, 'info');
        loadRequests();
    });

    // ===== QC AND DELIVERY TRACKING EVENTS =====

    // QC Inspection passed
    socket.on('qc_passed', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'success');
        loadOrders();
    });

    // QC Inspection failed - order will be cancelled
    socket.on('qc_failed', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'error');
        loadOrders();
    });

    // Driver assigned - store driver info and show on order card
    socket.on('driver_assigned', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'success');

        // Store driver info globally for map display
        if (!window.activeDeliveries) window.activeDeliveries = {};
        window.activeDeliveries[data.order_id] = {
            driver: data.driver,
            estimated_delivery: data.estimated_delivery
        };

        loadOrders();
    });

    // Real-time driver location update
    socket.on('driver_location_update', (data) => {
        // Driver location update received

        // Update stored location
        if (!window.activeDeliveries) window.activeDeliveries = {};
        if (!window.activeDeliveries[data.order_id]) {
            window.activeDeliveries[data.order_id] = {};
        }
        window.activeDeliveries[data.order_id].location = data.location;

        // Update map marker if exists
        if (window.deliveryMaps && window.deliveryMaps[data.order_id]) {
            const map = window.deliveryMaps[data.order_id];
            if (map.driverMarker) {
                map.driverMarker.setLatLng([data.location.lat, data.location.lng]);
            }
        }
    });

    // ===== ORDER STATUS UPDATE - REAL-TIME NOTIFICATIONS =====

    // Generic order status update - refreshes orders and shows notification
    socket.on('order_status_updated', (data) => {
        console.log('[SOCKET] Order status updated:', data);
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification || `Order #${data.order_number} status: ${data.new_status}`, 'info');
        loadOrders().then(() => {
            // CRITICAL: If this order's modal is open, refresh it with new data
            if (currentlyOpenOrderId === data.order_id) {
                console.log('[SOCKET] Refreshing open order modal...');
                viewOrderDetail(data.order_id);
            }
        });
    });

    // Delivery completed - prompts customer to confirm receipt
    socket.on('delivery_completed', (data) => {
        console.log('[SOCKET] Delivery completed:', data);
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification || 'Your order has been delivered! Please confirm receipt.', 'success');
        loadOrders().then(() => {
            // CRITICAL: If this order's modal is open, refresh it with new data
            if (currentlyOpenOrderId === data.order_id) {
                console.log('[SOCKET] Refreshing open order modal for delivered order...');
                viewOrderDetail(data.order_id);
            }
        });
    });

    // Dispute socket handlers
    socket.on('dispute_accepted', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'success');
        loadOrders();
    });

    socket.on('dispute_contested', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'warning');
        loadOrders();
    });

    socket.on('dispute_resolved', (data) => {
        playNotificationSound();
        showNotificationBadge('orders');
        showToast(data.notification, 'success');
        loadOrders();
    });

    // Navigation with badge clearing
    document.querySelectorAll('.nav-tab, .mobile-nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
            // Clear badge when visiting section
            if (section === 'requests') clearNotificationBadge('requests');
            if (section === 'orders') clearNotificationBadge('orders');
            if (section === 'support') loadTickets();
        });
    });

    // VIN Camera button
    document.querySelector('.vin-camera-btn')?.addEventListener('click', openVinScanner);

    // Category selection
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedCategory = item.dataset.category;
            document.getElementById('partCategory').value = selectedCategory;
        });
    });

    // Image upload
    document.getElementById('imageUploadArea').addEventListener('click', () => {
        document.getElementById('imageInput').click();
    });

    document.getElementById('imageInput').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (uploadedImages.length < 5) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedImages.push({ file, preview: e.target.result });
                    renderImagePreviews();
                };
                reader.readAsDataURL(file);
            }
        });
    });

    // Support Chat Listeners
    socket.on('support_reply', (data) => {
        // Notification for new reply if chat is closed or looking at other ticket
        if (!chatOpen || activeTicketId !== data.ticket_id) {
            const badge = document.getElementById('chatBadge');
            badge.style.display = 'flex';
            let count = parseInt(badge.textContent || '0');
            badge.textContent = count + 1;
            showToast('New support message', 'info');
        }
    });

    socket.on('new_message', (message) => {
        if (activeTicketId === message.ticket_id) {
            const container = document.getElementById('chatMessages');
            if (message.sender_type === 'admin') {
                container.insertAdjacentHTML('beforeend', `
                    <div class="message admin">
                        ${message.message_text}
                        <div class="message-time">${new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `);
                container.scrollTop = container.scrollHeight;
            }
        }
    });

    // Chat message socket listeners (driver-customer chat)
    socket.on('chat_message', (data) => {
        if (activeChatAssignment && data.assignment_id === activeChatAssignment.assignment_id) {
            loadDriverChatMessages();
            // Play sound if message is from driver
            if (data.sender_type === 'driver') {
                playChatSound();
            }
        }
    });

    socket.on('chat_notification', (data) => {
        playChatSound();
        showToast(data.notification, 'info');
        // Increment badge if chat is not open
        const chatModal = document.getElementById('driverChatModal');
        if (chatModal && !chatModal.classList.contains('active')) {
            chatUnreadCount++;
            updateChatBadge();
        }
    });

    // Listen for delivery status updates (e.g. driver marks as delivered)
    socket.on('delivery_status_updated', (data) => {
        playNotificationSound();
        showToast(data.notification || `Order #${data.order_number}: ${data.new_status}`, 'info');
        loadOrders(); // Refresh order list to show new status

        // If delivered, check chat visibility
        if (data.new_status === 'delivered') {
            checkActiveDeliveryChat();
        }
    });
}

function renderImagePreviews() {
    const grid = document.getElementById('imagePreviewGrid');
    grid.innerHTML = uploadedImages.map((img, i) => `
                <div class="image-preview-item" onclick="openLightbox(${i})">
                    <img src="${img.preview}" alt="Preview">
                    <span class="image-preview-zoom-icon"><i class="bi bi-zoom-in"></i></span>
                    <button type="button" class="image-preview-remove" onclick="event.stopPropagation(); removeImage(${i})">&times;</button>
                </div>
            `).join('');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImagePreviews();
}

// ===== LIGHTBOX (Zoom/Pan) =====
let lightboxCurrentIndex = 0;
let lightboxZoomLevel = 1;
let lightboxPanX = 0;
let lightboxPanY = 0;
let lightboxIsDragging = false;
let lightboxStartX = 0;
let lightboxStartY = 0;

function openLightbox(index) {
    if (uploadedImages.length === 0) return;
    simpleLightboxMode = false; // Reset mode
    lightboxCurrentIndex = index;
    lightboxZoomLevel = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;

    updateLightboxImage();
    updateLightboxNav();
    document.getElementById('lightboxOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Setup drag handlers
    const container = document.getElementById('lightboxImageContainer');
    container.onmousedown = startDrag;
    container.ontouchstart = startDrag;
    document.onmouseup = stopDrag;
    document.ontouchend = stopDrag;
    document.onmousemove = doDrag;
    document.ontouchmove = doDrag;

    // Wheel zoom
    container.onwheel = (e) => {
        e.preventDefault();
        lightboxZoom(e.deltaY > 0 ? -0.1 : 0.1);
    };
}

// New Helper Variables
let simpleLightboxMode = false;
let simpleLightboxImages = [];

function openSimpleLightbox(urls, index) {
    simpleLightboxMode = true;
    simpleLightboxImages = urls;

    lightboxCurrentIndex = index;
    lightboxZoomLevel = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;

    updateLightboxImage();
    updateLightboxNav();
    document.getElementById('lightboxOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    const container = document.getElementById('lightboxImageContainer');
    container.onmousedown = startDrag;
    container.ontouchstart = startDrag;
    container.onwheel = (e) => {
        e.preventDefault();
        lightboxZoom(e.deltaY > 0 ? -0.1 : 0.1);
    };
}

async function rejectBid(bidId) {
    if (!confirm('Are you sure you want to reject this bid?')) return;
    try {
        const res = await fetch(`${API_URL}/bids/${bidId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Bid rejected', 'success');
            loadRequests();
        } else {
            showToast(data.error || 'Failed to reject', 'error');
        }
    } catch (e) { showToast('Connection error', 'error'); }
}

function closeLightbox() {
    document.getElementById('lightboxOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function updateLightboxImage() {
    const img = document.getElementById('lightboxImage');
    if (simpleLightboxMode) {
        img.src = simpleLightboxImages[lightboxCurrentIndex];
        document.getElementById('lightboxTitle').textContent = `Image ${lightboxCurrentIndex + 1} of ${simpleLightboxImages.length}`;
    } else {
        img.src = uploadedImages[lightboxCurrentIndex].preview;
        document.getElementById('lightboxTitle').textContent = `Image ${lightboxCurrentIndex + 1} of ${uploadedImages.length}`;
    }
    img.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxZoomLevel})`;
    document.getElementById('lightboxZoomInfo').textContent = `${Math.round(lightboxZoomLevel * 100)}%`;
}

function updateLightboxNav() {
    const nav = document.getElementById('lightboxNav');
    if (simpleLightboxMode) {
        // External URLs mode (viewing bid images)
        nav.innerHTML = simpleLightboxImages.map((url, i) => `
                    <div class="lightbox-thumb ${i === lightboxCurrentIndex ? 'active' : ''}" onclick="lightboxGoTo(${i})">
                        <img src="${url}" alt="Thumbnail" onerror="this.src='https://placehold.co/60?text=Error'">
                    </div>
                `).join('');
    } else {
        // Upload preview mode
        nav.innerHTML = uploadedImages.map((img, i) => `
                    <div class="lightbox-thumb ${i === lightboxCurrentIndex ? 'active' : ''}" onclick="lightboxGoTo(${i})">
                        <img src="${img.preview}" alt="Thumbnail">
                    </div>
                `).join('');
    }
}

function lightboxGoTo(index) {
    lightboxCurrentIndex = index;
    lightboxZoomLevel = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    updateLightboxImage();
    updateLightboxNav();
}

function lightboxZoom(delta) {
    lightboxZoomLevel = Math.max(0.5, Math.min(4, lightboxZoomLevel + delta));
    if (lightboxZoomLevel <= 1) {
        lightboxPanX = 0;
        lightboxPanY = 0;
    }
    updateLightboxImage();
}

function lightboxReset() {
    lightboxZoomLevel = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    updateLightboxImage();
}

function startDrag(e) {
    if (lightboxZoomLevel <= 1) return;
    lightboxIsDragging = true;
    const pos = e.touches ? e.touches[0] : e;
    lightboxStartX = pos.clientX - lightboxPanX;
    lightboxStartY = pos.clientY - lightboxPanY;
}

function stopDrag() {
    lightboxIsDragging = false;
}

function doDrag(e) {
    if (!lightboxIsDragging) return;
    e.preventDefault();
    const pos = e.touches ? e.touches[0] : e;
    lightboxPanX = pos.clientX - lightboxStartX;
    lightboxPanY = pos.clientY - lightboxStartY;
    updateLightboxImage();
}

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' && uploadedImages.length > 1) lightboxGoTo((lightboxCurrentIndex - 1 + uploadedImages.length) % uploadedImages.length);
    if (e.key === 'ArrowRight' && uploadedImages.length > 1) lightboxGoTo((lightboxCurrentIndex + 1) % uploadedImages.length);
});

function switchSection(section) {
    document.querySelectorAll('.nav-tab, .mobile-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`[data-section="${section}"]`).forEach(b => b.classList.add('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1)).classList.add('active');

    if (section === 'requests') loadRequests();
    if (section === 'orders') loadOrders();
    if (section === 'profile') loadProfile();

    // Initialize delivery map when switching to new request section
    if (section === 'New') initDeliveryMap();
}

// ===== LOCATION PICKER (Uber-like) =====
let deliveryMap = null;
let deliveryMarker = null;
const QATAR_CENTER = [25.2854, 51.5310]; // Doha, Qatar

function initDeliveryMap() {
    // Only init once
    if (deliveryMap) return;

    const mapEl = document.getElementById('deliveryMap');
    if (!mapEl || typeof L === 'undefined') return;

    // Initialize map centered on Qatar
    deliveryMap = L.map('deliveryMap', {
        center: QATAR_CENTER,
        zoom: 11,
        zoomControl: true
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(deliveryMap);

    // Add draggable marker
    deliveryMarker = L.marker(QATAR_CENTER, {
        draggable: true
    }).addTo(deliveryMap);

    // Update address when marker is dragged
    deliveryMarker.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        updateDeliveryLocation(pos.lat, pos.lng);
    });

    // Allow clicking on map to move marker
    deliveryMap.on('click', function (e) {
        deliveryMarker.setLatLng(e.latlng);
        updateDeliveryLocation(e.latlng.lat, e.latlng.lng);
    });

    // Fix map size after it becomes visible
    setTimeout(() => {
        deliveryMap.invalidateSize();
    }, 100);
}

function detectCurrentLocation() {
    const btn = document.querySelector('.location-btn');
    const icon = document.getElementById('locationIcon');
    const text = document.getElementById('locationBtnText');

    if (!navigator.geolocation) {
        showToast('GPS not supported in your browser', 'error');
        return;
    }

    // Show loading state
    icon.className = 'bi bi-arrow-clockwise spin';
    text.textContent = 'Detecting...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            // Update map and marker
            if (deliveryMap && deliveryMarker) {
                deliveryMap.setView([latitude, longitude], 16);
                deliveryMarker.setLatLng([latitude, longitude]);
            }

            // Update hidden fields and reverse geocode
            updateDeliveryLocation(latitude, longitude);

            // Reset button
            icon.className = 'bi bi-check-circle';
            text.textContent = 'Location Set';
            btn.disabled = false;

            setTimeout(() => {
                icon.className = 'bi bi-crosshair';
                text.textContent = 'Use My Location';
            }, 2000);
        },
        (error) => {
            console.error('Location error:', error);
            icon.className = 'bi bi-x-circle';
            text.textContent = 'Location Failed';
            btn.disabled = false;

            if (error.code === 1) {
                showToast('Location permission denied. Please allow location access.', 'error');
            } else if (error.code === 2) {
                showToast('Location unavailable. Try again or drag the map marker.', 'error');
            } else if (error.code === 3) {
                showToast('Location timed out. Try again or drag the map marker.', 'error');
            } else {
                showToast('Could not get location. Drag the map marker instead.', 'error');
            }

            setTimeout(() => {
                icon.className = 'bi bi-crosshair';
                text.textContent = 'Use My Location';
            }, 2000);
        },
        {
            enableHighAccuracy: true,
            timeout: 30000,  // 30 seconds (increased from 10s)
            maximumAge: 60000 // Accept cached position up to 1 minute old
        }
    );
}

function updateDeliveryLocation(lat, lng) {
    // Update hidden fields
    document.getElementById('deliveryLat').value = lat;
    document.getElementById('deliveryLng').value = lng;

    // Reverse geocode to get address
    reverseGeocode(lat, lng);
}

async function reverseGeocode(lat, lng) {
    try {
        // Use Nominatim for free reverse geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await response.json();

        if (data.display_name) {
            // Format address nicely
            const addr = data.address || {};
            let formatted = '';

            if (addr.road) formatted += addr.road;
            if (addr.building || addr.house_number) formatted += (formatted ? ', ' : '') + (addr.building || addr.house_number);
            if (addr.suburb || addr.neighbourhood) formatted += (formatted ? ', ' : '') + (addr.suburb || addr.neighbourhood);
            if (addr.city || addr.town || addr.village) formatted += (formatted ? ', ' : '') + (addr.city || addr.town || addr.village);

            // Fallback to full display name if we couldn't build a nice one
            if (!formatted) formatted = data.display_name.split(',').slice(0, 3).join(',');

            document.getElementById('deliveryAddress').value = formatted;
        }
    } catch (err) {
        console.error('Reverse geocode failed:', err);
        // Don't overwrite manual entry on error
    }
}

// Initialize map when New Request section is shown
document.addEventListener('DOMContentLoaded', () => {
    // Delay init to allow DOM to settle
    setTimeout(() => {
        if (document.getElementById('sectionNew')?.classList.contains('active')) {
            initDeliveryMap();
        }
    }, 500);
});


// Submit Request
document.getElementById('requestForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('car_make', document.getElementById('carMake').value);
    formData.append('car_model', document.getElementById('carModel').value);
    formData.append('car_year', document.getElementById('carYear').value);
    formData.append('vin_number', document.getElementById('vinNumber').value.toUpperCase());
    formData.append('part_description', document.getElementById('partDesc').value);
    formData.append('part_number', document.getElementById('partNumber').value);
    formData.append('part_category', selectedCategory);
    formData.append('condition_required', document.getElementById('condition').value);
    formData.append('delivery_address_text', document.getElementById('deliveryAddress').value);

    // Add location coordinates if set
    const deliveryLat = document.getElementById('deliveryLat').value;
    const deliveryLng = document.getElementById('deliveryLng').value;
    if (deliveryLat && deliveryLng) {
        formData.append('delivery_lat', deliveryLat);
        formData.append('delivery_lng', deliveryLng);
    }

    uploadedImages.forEach(img => formData.append('images', img.file));

    try {
        const res = await fetch(`${API_URL}/requests`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();

        if (data.request_id) {
            showToast('Request submitted! Garages will send bids.', 'success');
            document.getElementById('requestForm').reset();
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
            selectedCategory = '';
            uploadedImages = [];
            renderImagePreviews();
            switchSection('requests');
        } else {
            showToast(data.error || 'Failed to submit', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

async function loadRequests() {
    try {
        const res = await fetch(`${API_URL}/requests/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Handle both old array format and new wrapped format
        const requests = Array.isArray(data) ? data : (data.requests || []);

        // Store requests for filtering
        allCustomerRequests = requests;

        // Update profile stats
        if (typeof updateProfileStats === 'function') {
            updateProfileStats(allCustomerRequests, allCustomerOrders);
        }

        if (!requests.length) {
            document.getElementById('requestsList').innerHTML = `
                        <div class="empty-state">
                            <i class="bi bi-inbox empty-state-icon"></i>
                            <h3 class="empty-state-title">No requests yet</h3>
                            <p class="empty-state-text">Create your first part request to get started</p>
                        </div>
                    `;
            return;
        }

        const html = await Promise.all(requests.map(async r => {
            let bidsHtml = '';
            const isCancelled = r.status.includes('cancelled');

            if (r.status === 'active' && r.bid_count > 0) {
                const bidsRes = await fetch(`${API_URL}/requests/${r.request_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const { bids } = await bidsRes.json();

                if (bids && bids.length) {
                    bidsHtml = `
                                <div class="bids-section">
                                    <h4 class="bids-title">Received Bids (${bids.length})</h4>
                                    ${bids.map(b => `
                                        <div class="bid-card ${b.garage_counter_amount ? 'has-counter-offer' : ''}">
                                            <div class="bid-info">
                                                <div class="bid-header">
                                                    ${b.garage_counter_amount ? `
                                                        <div class="counter-offer-prices">
                                                            <span class="original-price">${b.bid_amount} QAR</span>
                                                            <i class="bi bi-arrow-right" style="color: var(--text-muted);"></i>
                                                            <span class="counter-price">${b.garage_counter_amount} QAR</span>
                                                            <span class="counter-offer-label"><i class="bi bi-tag-fill"></i> New Price</span>
                                                        </div>
                                                    ` : `
                                                        <span class="bid-price">${b.bid_amount} QAR</span>
                                                    `}
                                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                                        <span class="bid-garage">${escapeHTML(b.garage_name) || 'Garage'}</span>
                                                        <span class="garage-rating" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 2px 8px; border-radius: 12px;">
                                                            <i class="bi bi-star-fill"></i>
                                                            <span>${parseFloat(b.garage_rating || 0).toFixed(1)}</span>
                                                            <span style="color: var(--text-muted);">(${b.garage_review_count || 0})</span>
                                                        </span>
                                                        <button type="button" onclick="event.stopPropagation(); openGarageReviews('${b.garage_id}', '${escapeHTML(b.garage_name)}')" 
                                                            style="background: none; border: none; color: var(--primary); font-size: 12px; cursor: pointer; text-decoration: underline;">
                                                            View Reviews
                                                        </button>
                                                    </div>
                                                </div>
                                                <div class="bid-details">
                                                    <span class="badge condition-${b.part_condition}">${b.part_condition}</span>
                                                    <span><i class="bi bi-shield-check"></i> ${b.warranty_days} days warranty</span>
                                                </div>
                                                ${b.garage_counter_message ? `
                                                    <div class="garage-message">
                                                        <i class="bi bi-chat-quote-fill"></i>
                                                        <span>"${escapeHTML(b.garage_counter_message)}"</span>
                                                    </div>
                                                ` : (b.notes ? `<div class="bid-notes">"${escapeHTML(b.notes)}"</div>` : '')}
                                                
                                                ${b.image_urls && b.image_urls.length ? (() => {
                            const normalizedUrls = b.image_urls.map(url => url.startsWith('/') ? url : '/' + url);
                            return `
                                                    <div class="bid-thumbnails">
                                                        ${normalizedUrls.map((url, i) => `
                                                            <div class="thumb" onclick='openSimpleLightbox(${JSON.stringify(normalizedUrls).replace(/"/g, "&quot;")}, ${i})'>
                                                                <img src="${url}" loading="lazy" onerror="this.src='https://placehold.co/100?text=No+Image'">
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                `;
                        })() : ''}
                                            </div>
                                            ${(() => {
                            // Check if bid notes indicate negotiation completed
                            const isNegotiated = b.notes && b.notes.includes('[Negotiated');
                            const hasGarageCounterOffer = b.garage_counter_amount;
                            const hasActivePendingCounter = b.has_pending_counter && !hasGarageCounterOffer;

                            if (isNegotiated) {
                                // Price was agreed - only show Accept (at agreed price) or Reject
                                return `
                                                        <div class="bid-negotiated-badge">
                                                            <i class="bi bi-check-circle-fill"></i> Price Agreed
                                                        </div>
                                                        <div class="bid-actions">
                                                            <button class="btn-reject" onclick="rejectBid('${b.bid_id}')">Reject</button>
                                                            <button class="btn-accept" onclick="acceptBid('${b.bid_id}')">
                                                                <i class="bi bi-cart-check"></i> Accept at ${b.bid_amount} QAR
                                                            </button>
                                                        </div>
                                                    `;
                            } else if (hasGarageCounterOffer) {
                                // Garage made a counter-offer - show prominent accept/counter/reject
                                return `
                                                        <div class="counter-action-badge">
                                                            <i class="bi bi-bell-fill"></i> 
                                                            <span>Garage has responded - make your decision!</span>
                                                        </div>
                                                        <div class="bid-actions-grid">
                                                            <button class="btn-reject" onclick="rejectBid('${b.bid_id}')">
                                                                <i class="bi bi-x-lg"></i> Reject
                                                            </button>
                                                            <button class="btn-counter" onclick="openCounterOfferModal('${b.bid_id}', ${b.garage_counter_amount}, '${b.garage_counter_id}')">
                                                                <i class="bi bi-arrow-repeat"></i> Counter
                                                            </button>
                                                            <button class="btn-accept" onclick="acceptGarageCounter('${b.garage_counter_id}')">
                                                                <i class="bi bi-cart-check"></i> Accept ${b.garage_counter_amount} QAR
                                                            </button>
                                                        </div>
                                                    `;
                            } else if (hasActivePendingCounter) {
                                // There's a customer pending counter-offer - show waiting status
                                return `
                                                        <div class="bid-pending-badge">
                                                            <i class="bi bi-hourglass-split"></i> Your Counter-Offer Pending
                                                        </div>
                                                        <div class="bid-actions">
                                                            <button class="btn-reject" onclick="rejectBid('${b.bid_id}')">Reject</button>
                                                            <button class="btn-accept" onclick="acceptBid('${b.bid_id}')">Accept Original</button>
                                                        </div>
                                                    `;
                            } else {
                                // Normal state - can negotiate
                                return `
                                                        <div class="bid-actions">
                                                            <button class="btn-reject" onclick="rejectBid('${b.bid_id}')">Reject</button>
                                                            <button class="btn-counter" onclick="openCounterOfferModal('${b.bid_id}', ${b.bid_amount})">
                                                                <i class="bi bi-cash-coin"></i> Negotiate
                                                            </button>
                                                            <button class="btn-accept" onclick="acceptBid('${b.bid_id}')">Accept</button>
                                                        </div>
                                                    `;
                            }
                        })()}
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                }
            }

            const statusLabel = isCancelled ? 'Cancelled' : r.status;
            const statusClass = isCancelled ? 'cancelled' : r.status;

            return `
                        <div class="request-card ${isCancelled ? 'cancelled' : ''}">
                            ${isCancelled ? '<div class="cancelled-overlay"></div>' : ''}
                            <div class="request-header">
                                <div class="request-title">${r.car_make} ${r.car_model} ${r.car_year || ''}</div>
                                <span class="request-badge ${statusClass}">${statusLabel}</span>
                            </div>
                            <p class="request-desc">${r.part_description}</p>
                            <div class="request-meta">
                                <span><i class="bi bi-tag"></i> ${r.bid_count || 0} bids</span>
                                <span><i class="bi bi-clock"></i> ${getTimeAgo(r.created_at)}</span>
                            </div>
                            ${bidsHtml}
                            ${r.status === 'active' ? `
                                <div class="request-actions">
                                    <button class="btn-cancel" onclick="openCancelModal('request', '${r.request_id}')">
                                        <i class="bi bi-x-circle"></i> Cancel Request
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
        }));

        document.getElementById('requestsList').innerHTML = html.join('');
    } catch (err) {
        console.error('Failed to load requests:', err);
    }
}

async function acceptBid(bidId) {
    if (!confirm('Accept this bid and create an order?')) return;
    try {
        const res = await fetch(`${API_URL}/orders/accept-bid/${bidId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ payment_method: 'cash' })
        });
        const data = await res.json();
        if (data.order_id) {
            showToast('Order created!', 'success');
            switchSection('orders');
        } else {
            showToast(data.error || 'Failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Accept garage counter-offer (agrees to their price)
async function acceptGarageCounter(counterOfferId) {
    if (!counterOfferId) {
        showToast('Counter-offer not found', 'error');
        return;
    }
    if (!confirm('Accept this counter-offer and create an order at this price?')) return;
    try {
        const res = await fetch(`${API_URL}/negotiations/counter-offers/${counterOfferId}/customer-respond`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'accept' })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Counter-offer accepted! Order will be created.', 'success');
            loadRequests();
        } else {
            showToast(data.error || 'Failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API_URL}/orders/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Handle both old array format and new wrapped format  
        const orders = Array.isArray(data) ? data : (data.orders || []);

        // Store orders for filtering
        allCustomerOrders = orders;

        if (!orders.length) {
            document.getElementById('ordersList').innerHTML = `
                        <div class="empty-state">
                            <i class="bi bi-box-seam empty-state-icon"></i>
                            <h3 class="empty-state-title">No orders yet</h3>
                            <p class="empty-state-text">Accept a bid to create your first order</p>
                        </div>
                    `;
            return;
        }

        const statuses = ['confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered'];
        const statusLabels = {
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            ready_for_pickup: 'Ready',
            in_transit: 'In Transit',
            delivered: 'Delivered',
            completed: 'Completed',
            disputed: 'Disputed',
            refunded: 'Refunded'
        };

        document.getElementById('ordersList').innerHTML = orders.map(o => {
            const currentIdx = statuses.indexOf(o.order_status);
            const isCancelled = o.order_status?.includes('cancelled');
            const isDisputed = o.order_status === 'disputed';
            const isRefunded = o.order_status === 'refunded';
            const canCancel = ['confirmed', 'preparing'].includes(o.order_status);
            const showTimeline = !isCancelled && !isDisputed && !isRefunded;

            const timeline = showTimeline ? statuses.map((s, i) => {
                let cls = i < currentIdx ? 'completed' : i === currentIdx ? 'current' : '';
                return `
                            <div class="timeline-step ${cls}">
                                <div class="timeline-dot"><i class="bi bi-${i < currentIdx ? 'check' : 'circle'}"></i></div>
                                <div class="timeline-label">${statusLabels[s]}</div>
                            </div>
                        `;
            }).join('') : '';

            const statusLabel = isCancelled ? 'Cancelled' : (statusLabels[o.order_status] || o.order_status);
            const statusClass = isCancelled ? 'cancelled' : (isDisputed ? 'disputed' : (isRefunded ? 'refunded' : o.order_status));

            // Build actions HTML based on status
            let actionsHtml = '';
            if (o.order_status === 'delivered') {
                actionsHtml = `
                            <button class="btn-report-issue" onclick="openReportIssueModal('${o.order_id}')">
                                <i class="bi bi-exclamation-triangle"></i> Report Issue
                            </button>
                            <button class="btn-confirm-delivery" onclick="confirmDelivery('${o.order_id}')">
                                <i class="bi bi-check-lg"></i> Confirm Delivery
                            </button>
                        `;
            } else if (isDisputed) {
                actionsHtml = `<span class="dispute-badge"><i class="bi bi-hourglass-split"></i> Dispute in Progress</span>`;
            } else if (isRefunded) {
                // Option A: Platform-managed refund with actual amount
                const refundAmount = o.total_amount || o.part_price || 0;
                actionsHtml = `
                            <div style="padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%); border-radius: 12px; text-align: center;">
                                <i class="bi bi-check-circle-fill" style="font-size: 32px; color: #10b981;"></i>
                                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">Refund Approved</div>
                                <div style="font-size: 22px; font-weight: 800; color: #10b981;">${refundAmount} QAR</div>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Will be credited within 1-3 business days</div>
                            </div>
                        `;
            } else if (canCancel) {
                actionsHtml = `<button class="btn-cancel" onclick="openCancelModal('order', '${o.order_id}')"><i class="bi bi-x-circle"></i> Cancel Order</button>`;
            } else if (o.order_status === 'completed') {
                // Invoice download button always visible for completed orders
                const invoiceBtn = `
                    <button class="btn btn-outline" style="width: 100%; margin-bottom: 8px;" onclick="event.stopPropagation(); downloadInvoice('${o.order_id}')">
                        <i class="bi bi-file-earmark-pdf"></i> Download Invoice
                    </button>
                `;
                if (o.review_id) {
                    actionsHtml = `
                        ${invoiceBtn}
                        <div style="padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; color: var(--primary); font-size: 14px; text-align: center;">
                            <i class="bi bi-star-fill"></i> Review Submitted
                        </div>
                    `;
                } else {
                    actionsHtml = `
                        ${invoiceBtn}
                        <button class="btn btn-primary" style="width: 100%;" onclick="event.stopPropagation(); openReviewModal('${o.order_id}', '${o.garage_id}', '${o.garage_name}')">
                            <i class="bi bi-star"></i> Write Review
                        </button>
                    `;
                }
            }

            // Build tracking panel HTML for in_transit orders
            let trackingHtml = '';
            if (o.order_status === 'in_transit') {
                // Use API data (primary) or socket data (fallback)
                const delivery = window.activeDeliveries?.[o.order_id] || {};
                const driverName = o.driver_name || delivery.driver?.name;
                const vehicleType = o.vehicle_type || delivery.driver?.vehicle_type;
                const vehiclePlate = o.vehicle_plate || delivery.driver?.vehicle_plate;
                const driverPhone = o.driver_phone || delivery.driver?.phone;
                const eta = o.estimated_delivery || delivery.estimated_delivery;
                trackingHtml = `
                            <div class="driver-tracking-panel" style="margin-top: 16px; padding: 16px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 12px; border: 1px solid var(--primary);">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 48px; height: 48px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <i class="bi bi-truck" style="font-size: 24px; color: white;"></i>
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 700; color: var(--text-primary);">🚚 ${driverName || 'Driver Assigned'}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                            ${vehicleType || 'Vehicle'} • ${vehiclePlate || ''}
                                        </div>
                                        ${driverPhone ? `<a href="tel:${driverPhone}" style="font-size: 12px; color: var(--primary); text-decoration: none;"><i class="bi bi-telephone"></i> ${driverPhone}</a>` : ''}
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 11px; color: var(--text-muted);">LIVE</div>
                                        <div style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; margin-left: auto;"></div>
                                    </div>
                                </div>
                                <div id="tracking-map-${o.order_id}" style="height: 200px; border-radius: 8px; overflow: hidden; background: #1e293b;"></div>
                                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                                    <span><i class="bi bi-geo-alt"></i> Delivery in progress</span>
                                    <span id="eta-${o.order_id}">${eta ? 'ETA: ' + new Date(eta).toLocaleTimeString('en-QA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                </div>
                            </div>
                        `;
            }

            return `
                        <div class="order-card ${isCancelled ? 'cancelled' : ''} ${isDisputed ? 'disputed' : ''} ${isRefunded ? 'refunded' : ''}" data-order-id="${o.order_id}" onclick="viewOrderDetail('${o.order_id}')"  style="cursor: pointer;">
                            ${isCancelled ? '<div class="cancelled-overlay"></div>' : ''}
                            <div class="order-header">
                                <div class="order-number">Order #${o.order_number || o.order_id.slice(0, 8)}</div>
                                <span class="order-status ${statusClass}">${statusLabel}</span>
                            </div>
                            <p style="color: var(--text-secondary);">${o.car_make} ${o.car_model} - ${o.part_description}</p>
                            <div style="font-size: 24px; font-weight: 800; color: var(--success); margin-top: 8px;">${o.total_amount} QAR</div>
                            ${timeline ? `<div class="order-timeline">${timeline}</div>` : ''}
                            ${trackingHtml}
                            <div class="request-actions">
                                ${actionsHtml}
                            </div>
                        </div>
                    `;
        }).join('');

        // Initialize maps for in_transit orders after render
        setTimeout(() => initializeTrackingMaps(orders), 100);
    } catch (err) {
        console.error('Failed to load orders:', err);
    }
}

async function confirmDelivery(orderId) {
    if (!confirm('Confirm you received the delivery?')) return;
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/confirm-delivery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.prompt_review) {
            showToast('Delivery confirmed! Thank you.', 'success');
            closeOrderDetailModal();
            currentlyOpenOrderId = null;
            loadOrders();
        } else if (res.status === 400) {
            // Order status may have changed - reload to refresh UI
            showToast(data.error || 'Order status has changed. Refreshing...', 'warning');
            closeOrderDetailModal();
            currentlyOpenOrderId = null;
            loadOrders();
        } else {
            showToast(data.error || 'Failed to confirm delivery', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// Alias for button compatibility
async function confirmDeliveryCustomer(orderId) {
    return confirmDelivery(orderId);
}

// ===== INVOICE DOWNLOAD =====
async function downloadInvoice(orderId) {
    showToast('Generating invoice...', 'info');
    try {
        // First, generate the invoice if it doesn't exist
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

// Initialize Leaflet maps for in_transit orders (Talabat-style tracking)
function initializeTrackingMaps(orders) {
    if (!window.L) {
        console.warn('Leaflet not loaded');
        return;
    }

    // Initialize map storage
    if (!window.deliveryMaps) window.deliveryMaps = {};

    orders.filter(o => o.order_status === 'in_transit').forEach(order => {
        const mapId = `tracking-map-${order.order_id}`;
        const container = document.getElementById(mapId);

        if (!container) return;

        // Skip if already initialized
        if (window.deliveryMaps[order.order_id]) return;

        try {
            // Qatar center coordinates (Doha)
            const qatarCenter = [25.2854, 51.5310];

            // Create map
            const map = L.map(mapId, {
                zoomControl: false,
                attributionControl: false
            }).setView(qatarCenter, 13);

            // Add tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18
            }).addTo(map);

            // Custom truck icon
            const truckIcon = L.divIcon({
                className: 'driver-marker',
                html: `<div style="width: 40px; height: 40px; background: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); border: 3px solid white;">
                            <span style="font-size: 20px;">🚚</span>
                        </div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            // Get stored location or use center
            const delivery = window.activeDeliveries?.[order.order_id] || {};
            // Prioritize API data -> Socket data -> Default center
            const lat = order.driver_lat ? parseFloat(order.driver_lat) : (delivery.location?.lat || qatarCenter[0]);
            const lng = order.driver_lng ? parseFloat(order.driver_lng) : (delivery.location?.lng || qatarCenter[1]);
            const location = { lat, lng };

            // Add driver marker
            const driverMarker = L.marker([location.lat, location.lng], { icon: truckIcon }).addTo(map);

            // Store map reference for live updates
            window.deliveryMaps[order.order_id] = {
                map: map,
                driverMarker: driverMarker
            };

            // Center on marker
            map.setView([location.lat, location.lng], 14);

        } catch (e) {
            console.error('Map init error:', e);
        }
    });
}

// ===== CANCEL MODAL =====
let cancelType = '';
let cancelId = '';

function openCancelModal(type, id) {
    cancelType = type;
    cancelId = id;

    if (type === 'request') {
        document.getElementById('cancelModalTitle').textContent = 'Cancel Request?';
        document.getElementById('cancelModalMessage').textContent = 'This will reject all bids and remove the request. This action cannot be undone.';
    } else {
        document.getElementById('cancelModalTitle').textContent = 'Cancel Order?';
        document.getElementById('cancelModalMessage').textContent = 'The garage will be notified. Cancellation policy may apply.';
    }

    document.getElementById('cancelModal').classList.add('active');
}

function closeCancelModal() {
    document.getElementById('cancelModal').classList.remove('active');
    cancelType = '';
    cancelId = '';
}

async function confirmCancel() {
    try {
        let endpoint = '';
        if (cancelType === 'request') {
            endpoint = `${API_URL}/cancellations/requests/${cancelId}/cancel`;
        } else {
            endpoint = `${API_URL}/cancellations/orders/${cancelId}/cancel/customer`;
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Customer requested cancellation' })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`${cancelType === 'request' ? 'Request' : 'Order'} cancelled successfully`, 'success');
            const wasRequest = cancelType === 'request';
            closeCancelModal();
            // Reload data after modal closes
            if (wasRequest) {
                await loadRequests();
            } else {
                await loadOrders();
            }
        } else {
            showToast(data.error || 'Failed to cancel', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

// ===== COUNTER-OFFER MODAL =====
let currentCounterBidId = null;
let currentCounterOriginalPrice = 0;
let currentGarageCounterId = null; // New variable to track what we are responding to
const MAX_NEGOTIATION_ROUNDS = 3;

function openCounterOfferModal(bidId, originalPrice, garageCounterId = null) {
    currentCounterBidId = bidId;
    currentCounterOriginalPrice = originalPrice;
    currentGarageCounterId = garageCounterId;

    document.getElementById('counterOriginalPrice').textContent = originalPrice.toFixed(2) + ' QAR';
    document.getElementById('counterAmount').value = '';
    document.getElementById('counterYourPrice').textContent = '? QAR';
    document.getElementById('counterMessage').value = '';

    // Load negotiation history
    loadNegotiationHistory(bidId);

    document.getElementById('counterOfferModal').classList.add('active');
}

function closeCounterOfferModal() {
    document.getElementById('counterOfferModal').classList.remove('active');
    currentCounterBidId = null;
    currentCounterOriginalPrice = 0;
    currentGarageCounterId = null;
}

function updateCounterPreview() {
    const amount = document.getElementById('counterAmount').value;
    if (amount && !isNaN(amount)) {
        document.getElementById('counterYourPrice').textContent = parseFloat(amount).toFixed(2) + ' QAR';
    } else {
        document.getElementById('counterYourPrice').textContent = '? QAR';
    }
}

async function sendCounterOffer() {
    const amount = parseFloat(document.getElementById('counterAmount').value);
    const message = document.getElementById('counterMessage').value;

    if (!amount || amount <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }

    if (amount >= currentCounterOriginalPrice) {
        showToast('Counter-offer must be lower than the current price', 'error');
        return;
    }

    try {
        let endpoint, body;

        if (currentGarageCounterId) {
            // Responding to a garage counter-offer
            endpoint = `${API_URL}/negotiations/counter-offers/${currentGarageCounterId}/customer-respond`;
            body = {
                action: 'counter',
                counter_amount: amount,
                message: message
            };
        } else {
            // Initiating a new counter-offer on a bid
            endpoint = `${API_URL}/negotiations/bids/${currentCounterBidId}/counter-offer`;
            body = {
                proposed_amount: amount,
                message: message
            };
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`ðŸ’° Counter-offer of ${amount} QAR sent! (Round ${data.round || '?'}/${MAX_NEGOTIATION_ROUNDS})`, 'success');
            closeCounterOfferModal();
            loadRequests();
        } else {
            showToast(data.error || 'Failed to send counter-offer', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function loadNegotiationHistory(bidId) {
    try {
        const res = await fetch(`${API_URL}/negotiations/bids/${bidId}/negotiations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const historyDiv = document.getElementById('negotiationHistory');
        const historyList = document.getElementById('negotiationHistoryList');
        const roundsRemaining = document.getElementById('roundsRemaining');

        if (data.negotiations && data.negotiations.length > 0) {
            historyDiv.style.display = 'block';
            historyList.innerHTML = data.negotiations.map(n => `
                        <div class="negotiation-item ${n.offered_by_type}">
                            <span class="round-badge">${n.round_number}</span>
                            <span>${n.offered_by_type === 'customer' ? 'You' : 'Garage'} offered <strong>${n.proposed_amount} QAR</strong></span>
                            <span class="text-muted">(${n.status})</span>
                        </div>
                    `).join('');

            const remaining = MAX_NEGOTIATION_ROUNDS - data.current_round;
            roundsRemaining.textContent = remaining > 0 ? `${remaining} round(s) remaining` : 'Final round - no more negotiations';
        } else {
            historyDiv.style.display = 'none';
            roundsRemaining.textContent = '3 rounds remaining in negotiation';
        }
    } catch (err) {
        console.error('Failed to load negotiation history:', err);
    }
}

// ===== REPORT ISSUE MODAL =====
let currentDisputeOrderId = null;
let currentOrderPrice = 0;
let issuePhotosFiles = [];

const REFUND_CONFIGS = {
    wrong_part: { refundPercent: 100, restockingFee: 0 },
    doesnt_fit: { refundPercent: 85, restockingFee: 15 },
    damaged: { refundPercent: 100, restockingFee: 0 },
    not_as_described: { refundPercent: 100, restockingFee: 0 },
    changed_mind: { refundPercent: 70, restockingFee: 30 }
};

function openReportIssueModal(orderId) {
    currentDisputeOrderId = orderId;
    issuePhotosFiles = [];
    document.getElementById('issueReason').value = '';
    document.getElementById('issueDescription').value = '';
    document.getElementById('issuePhotoPreview').innerHTML = '';
    document.getElementById('refundPreview').style.display = 'none';
    document.getElementById('reportIssueModal').classList.add('active');
}

function closeReportIssueModal() {
    document.getElementById('reportIssueModal').classList.remove('active');
    currentDisputeOrderId = null;
    issuePhotosFiles = [];
}

function updateRefundPreview() {
    const reason = document.getElementById('issueReason').value;
    const preview = document.getElementById('refundPreview');

    if (reason && REFUND_CONFIGS[reason]) {
        const config = REFUND_CONFIGS[reason];
        // For now, estimate with 0 price - actual will come from API
        preview.style.display = 'block';
        document.getElementById('previewRefund').textContent = config.refundPercent + '% of part price';
        document.getElementById('previewFee').textContent = config.restockingFee + '% restocking';
    } else {
        preview.style.display = 'none';
    }
}

function previewIssuePhotos() {
    const input = document.getElementById('issuePhotos');
    const preview = document.getElementById('issuePhotoPreview');
    const files = Array.from(input.files);

    files.forEach(file => {
        if (issuePhotosFiles.length < 5) {
            const reader = new FileReader();
            reader.onload = (e) => {
                issuePhotosFiles.push(file);
                preview.innerHTML += `
                            <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 2px solid var(--border);">
                                <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        `;
            };
            reader.readAsDataURL(file);
        }
    });
}

async function submitDispute() {
    const reason = document.getElementById('issueReason').value;
    const description = document.getElementById('issueDescription').value;

    if (!reason) {
        showToast('Please select a reason', 'error');
        return;
    }

    if (!description.trim()) {
        showToast('Please describe the issue', 'error');
        return;
    }

    // Check if photos required
    if (['damaged', 'wrong_part', 'not_as_described'].includes(reason) && issuePhotosFiles.length === 0) {
        showToast('Photos are required for this type of issue', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('order_id', currentDisputeOrderId);
    formData.append('reason', reason);
    formData.append('description', description);
    issuePhotosFiles.forEach(file => {
        formData.append('photos', file);
    });

    try {
        const res = await fetch(`${API_URL}/disputes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Dispute submitted! Expected refund: ${data.expected_refund} QAR`, 'success');
            closeReportIssueModal();
            loadOrders();
        } else {
            showToast(data.error || 'Failed to submit dispute', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'x-circle-fill'}"></i> ${message}`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== NOTIFICATION PANEL =====
let notifications = [];

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
        loadNotifications();
    }
}

async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/dashboard/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.notifications) {
            notifications = data.notifications;
            renderNotifications();
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const countBadge = document.getElementById('notificationCount');

    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (unreadCount > 0) {
        countBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        countBadge.style.display = 'flex';
    } else {
        countBadge.style.display = 'none';
    }

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="bi bi-bell-slash"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }

    list.innerHTML = notifications.slice(0, 20).map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead('${n.notification_id}')">
            <div class="title">${n.title}</div>
            <div class="body">${n.body}</div>
            <div class="time">${getTimeAgo(n.created_at)}</div>
        </div>
    `).join('');
}

async function markNotificationRead(notificationId) {
    try {
        await fetch(`${API_URL}/dashboard/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadNotifications();
    } catch (err) {
        console.error('Failed to mark notification read:', err);
    }
}

async function markAllNotificationsRead() {
    try {
        await fetch(`${API_URL}/dashboard/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadNotifications();
        showToast('All notifications marked as read', 'success');
    } catch (err) {
        console.error('Failed to mark all read:', err);
    }
}

function getTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notification-wrapper');
    const panel = document.getElementById('notificationPanel');
    if (wrapper && !wrapper.contains(e.target) && panel.classList.contains('active')) {
        panel.classList.remove('active');
    }
});

// ===== PROFILE SECTION =====
async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/dashboard/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.user) {
            document.getElementById('profileName').textContent = data.user.full_name || '-';
            document.getElementById('profilePhone').textContent = data.user.phone_number || '-';
            document.getElementById('profileEmail').textContent = data.user.email || 'Not set';
            document.getElementById('profileCreated').textContent = data.user.created_at ?
                new Date(data.user.created_at).toLocaleDateString() : '-';

            // Update enhanced profile header
            if (typeof updateProfileHeader === 'function') {
                updateProfileHeader(data.user.full_name);
            }
        }

        if (data.stats) {
            document.getElementById('statRequests').textContent = data.stats.total_requests || 0;
            document.getElementById('statOrders').textContent = data.stats.completed_orders || 0;
            document.getElementById('statReviews').textContent = data.stats.reviews_given || 0;

            // Also update large stats in header
            const statRequestsLarge = document.getElementById('statRequestsLarge');
            const statOrdersLarge = document.getElementById('statOrdersLarge');
            const statCompletedLarge = document.getElementById('statCompletedLarge');
            const statReviewsLarge = document.getElementById('statReviewsLarge');

            if (statRequestsLarge) statRequestsLarge.textContent = data.stats.total_requests || 0;
            if (statOrdersLarge) statOrdersLarge.textContent = data.stats.total_orders || 0;
            if (statCompletedLarge) statCompletedLarge.textContent = data.stats.completed_orders || 0;
            if (statReviewsLarge) statReviewsLarge.textContent = data.stats.reviews_given || 0;
        }

        if (data.addresses) {
            renderAddresses(data.addresses);
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

function renderAddresses(addresses) {
    const container = document.getElementById('addressesList');

    if (!addresses || addresses.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="bi bi-geo-alt"></i>
                <p>No saved addresses</p>
            </div>
        `;
        return;
    }

    container.innerHTML = addresses.map(addr => `
        <div class="address-item">
            <div class="address-info">
                <div class="address-label">
                    ${addr.label || 'Address'}
                    ${addr.is_default ? '<span class="default-badge">Default</span>' : ''}
                </div>
                <div class="address-text">${addr.address_line}${addr.area ? ', ' + addr.area : ''}</div>
            </div>
            <div class="address-actions">
                <button onclick="setDefaultAddress('${addr.address_id}')" title="Set as default">
                    <i class="bi bi-star${addr.is_default ? '-fill' : ''}"></i>
                </button>
                <button onclick="deleteAddress('${addr.address_id}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function openEditProfileModal() {
    // Pre-fill with current values
    const name = document.getElementById('profileName').textContent;
    const email = document.getElementById('profileEmail').textContent;
    const phone = document.getElementById('profilePhone').textContent;

    document.getElementById('editFullName').value = name !== '-' ? name : '';
    document.getElementById('editEmail').value = email !== 'Not set' ? email : '';
    document.getElementById('editPhone').value = phone;

    document.getElementById('editProfileModal').classList.add('active');
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('active');
}

async function saveProfile() {
    const full_name = document.getElementById('editFullName').value.trim();
    const email = document.getElementById('editEmail').value.trim();

    if (!full_name) {
        showToast('Please enter your name', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/dashboard/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ full_name, email })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Profile updated!', 'success');
            closeEditProfileModal();
            loadProfile();
        } else {
            showToast(data.error || 'Failed to update', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function openAddAddressModal() {
    // Reset form
    document.getElementById('addressLabel').value = 'Home';
    document.getElementById('addressLine').value = '';
    document.getElementById('addressArea').value = '';
    document.getElementById('addressDefault').checked = false;

    document.getElementById('addAddressModal').classList.add('active');
}

function closeAddAddressModal() {
    document.getElementById('addAddressModal').classList.remove('active');
}

async function saveAddress() {
    const address_line = document.getElementById('addressLine').value.trim();

    if (!address_line) {
        showToast('Please enter an address', 'error');
        return;
    }

    const payload = {
        label: document.getElementById('addressLabel').value,
        address_line: address_line,
        area: document.getElementById('addressArea').value.trim(),
        is_default: document.getElementById('addressDefault').checked
    };

    try {
        const res = await fetch(`${API_URL}/dashboard/addresses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Address added!', 'success');
            closeAddAddressModal();
            loadProfile();
        } else {
            showToast(data.error || 'Failed to add address', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function setDefaultAddress(addressId) {
    try {
        const res = await fetch(`${API_URL}/dashboard/addresses/${addressId}/default`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Default address updated', 'success');
            loadProfile();
        }
    } catch (err) {
        showToast('Failed to update default address', 'error');
    }
}

async function deleteAddress(addressId) {
    if (!confirm('Delete this address?')) return;
    try {
        const res = await fetch(`${API_URL}/dashboard/addresses/${addressId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Address deleted', 'success');
            loadProfile();
        }
    } catch (err) {
        showToast('Failed to delete address', 'error');
    }
}

// ===== REVIEW MODAL =====
let currentReviewRatings = {
    overall: 0,
    quality: 0,
    communication: 0
};

// ===== VIEW GARAGE REVIEWS =====
async function openGarageReviews(garageId, garageName) {
    // Create or show modal
    let modal = document.getElementById('garageReviewsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'garageReviewsModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="bi bi-star-fill" style="color: #f59e0b;"></i> <span id="garageReviewsTitle">Garage Reviews</span></h3>
                    <button class="modal-close" onclick="closeGarageReviewsModal()">&times;</button>
                </div>
                <div id="garageReviewsStats" style="padding: 0 20px;"></div>
                <div id="garageReviewsList" style="padding: 20px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('garageReviewsTitle').textContent = `${garageName} - Reviews`;
    document.getElementById('garageReviewsStats').innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> Loading...</div>';
    document.getElementById('garageReviewsList').innerHTML = '';
    modal.classList.add('active');

    try {
        const res = await fetch(`${API_URL}/reviews/garage/${garageId}`);
        const data = await res.json();

        if (data.stats) {
            const s = data.stats;
            document.getElementById('garageReviewsStats').innerHTML = `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-primary); border-radius: 12px; margin-bottom: 16px;">
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: 800; color: #f59e0b;">${s.avg_rating || '0.0'}</div>
                        <div style="display: flex; gap: 2px; justify-content: center;">
                            ${[1, 2, 3, 4, 5].map(i => `<i class="bi bi-star${i <= Math.round(s.avg_rating) ? '-fill' : ''}" style="color: #f59e0b;"></i>`).join('')}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${s.total_reviews || 0} reviews</div>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                        ${[5, 4, 3, 2, 1].map(star => {
                const count = parseInt(s[['one', 'two', 'three', 'four', 'five'][star - 1] + '_star'] || 0);
                const pct = s.total_reviews > 0 ? (count / s.total_reviews * 100) : 0;
                return `
                                <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                                    <span style="width: 12px;">${star}</span>
                                    <div style="flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${pct}%; height: 100%; background: #f59e0b;"></div>
                                    </div>
                                    <span style="width: 24px; color: var(--text-muted);">${count}</span>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        if (data.reviews && data.reviews.length > 0) {
            document.getElementById('garageReviewsList').innerHTML = data.reviews.map(r => `
                <div style="padding: 16px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div style="font-weight: 600;">${r.customer_initial}</div>
                        <div style="display: flex; gap: 2px;">
                            ${[1, 2, 3, 4, 5].map(i => `<i class="bi bi-star${i <= r.overall_rating ? '-fill' : ''}" style="color: #f59e0b; font-size: 12px;"></i>`).join('')}
                        </div>
                    </div>
                    ${r.review_text ? `<p style="color: var(--text-secondary); font-size: 14px; margin: 0;">"${r.review_text}"</p>` : ''}
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
                        ${new Date(r.created_at).toLocaleDateString()} • Order ${r.order_number || 'N/A'}
                    </div>
                </div>
            `).join('');
        } else {
            document.getElementById('garageReviewsList').innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="bi bi-chat-square" style="font-size: 48px;"></i>
                    <p>No reviews yet for this garage</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
        document.getElementById('garageReviewsList').innerHTML = '<p style="color: var(--error); padding: 20px;">Failed to load reviews</p>';
    }
}

function closeGarageReviewsModal() {
    const modal = document.getElementById('garageReviewsModal');
    if (modal) modal.classList.remove('active');
}

function openReviewModal(orderId, garageId, garageName) {
    document.getElementById('reviewOrderId').value = orderId;
    document.getElementById('reviewGarageId').value = garageId;
    document.getElementById('reviewGarageInfo').querySelector('.garage-name').textContent = garageName;

    // Reset ratings
    currentReviewRatings = { overall: 0, quality: 0, communication: 0 };
    document.querySelectorAll('.star-rating i').forEach(star => {
        star.classList.remove('bi-star-fill');
        star.classList.add('bi-star');
        star.classList.remove('active');
    });
    document.getElementById('reviewText').value = '';

    document.getElementById('reviewModal').classList.add('active');
    initStarRatings();
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('active');
}

function initStarRatings() {
    const ratingContainers = document.querySelectorAll('.star-rating');

    ratingContainers.forEach(container => {
        const ratingType = container.id.replace('Rating', '');
        const stars = container.querySelectorAll('i');

        stars.forEach(star => {
            star.onclick = () => {
                const rating = parseInt(star.dataset.rating);
                currentReviewRatings[ratingType] = rating;

                // Update visual
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.remove('bi-star');
                        s.classList.add('bi-star-fill');
                        s.classList.add('active');
                    } else {
                        s.classList.add('bi-star');
                        s.classList.remove('bi-star-fill');
                        s.classList.remove('active');
                    }
                });
            };

            // Hover effect
            star.onmouseenter = () => {
                const rating = parseInt(star.dataset.rating);
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.add('active');
                    }
                });
            };

            star.onmouseleave = () => {
                const currentRating = currentReviewRatings[ratingType];
                stars.forEach((s, i) => {
                    if (i >= currentRating) {
                        s.classList.remove('active');
                    }
                });
            };
        });
    });
}

async function submitReview() {
    const orderId = document.getElementById('reviewOrderId').value;
    const reviewText = document.getElementById('reviewText').value;

    if (currentReviewRatings.overall === 0) {
        showToast('Please select an overall rating', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/review`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                overall_rating: currentReviewRatings.overall,
                part_quality_rating: currentReviewRatings.quality || null,
                communication_rating: currentReviewRatings.communication || null,
                review_text: reviewText || null
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Thank you for your review!', 'success');
            closeReviewModal();
            loadOrders();
            loadProfile(); // Update stats
        } else {
            showToast(data.error || 'Failed to submit review', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}



// ===== SUPPORT UI LOGIC =====
let chatOpen = false;
let activeTicketId = null;

function openCreateTicketModal() {
    document.getElementById('createTicketModal').classList.add('active');
}

function closeCreateTicketModal() {
    document.getElementById('createTicketModal').classList.remove('active');
}

async function loadTickets() {
    try {
        const res = await fetch(`${API_URL}/support/tickets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tickets = await res.json();
        renderTickets(tickets);
    } catch (err) {
        console.error('Failed to load tickets', err);
    }
}

function renderTickets(tickets) {
    const list = document.getElementById('ticketsList');
    if (tickets.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-chat-square-dots empty-state-icon"></i>
                <p>No support tickets yet</p>
            </div>
        `;
        return;
    }

    list.innerHTML = tickets.map(t => `
        <div class="ticket-item ${activeTicketId === t.ticket_id ? 'active' : ''}" onclick="showConversationView('${t.ticket_id}', '${t.subject}', '${t.status}')">
            <div class="ticket-header">
                <span class="ticket-subject">${t.subject}</span>
                <span class="ticket-status status-${t.status}">${t.status}</span>
            </div>
            <div class="ticket-meta">
                <span>#${t.ticket_id.slice(0, 8)}</span>
                <span>${new Date(t.created_at).toLocaleDateString()}</span>
            </div>
            ${t.last_message ? `<div class="ticket-preview">${t.last_message}</div>` : ''}
        </div>
    `).join('');
}

function showConversationView(ticketId, subject, status) {
    activeTicketId = ticketId;
    chatOpen = true;

    // Update List UI
    document.querySelectorAll('.ticket-item').forEach(el => el.classList.remove('active'));
    // (Optional: highlight clicked item, but we might re-render)

    // Update Chat UI
    document.getElementById('chatTitle').textContent = subject;
    document.getElementById('chatStatus').textContent = status;
    document.getElementById('chatStatus').className = `chat-status status-${status}`;

    // Show Chat Column
    document.getElementById('chatEmptyState').style.display = 'none';
    const chatView = document.getElementById('chatView');
    chatView.style.display = 'flex';

    // Mobile logic: hide list, show chat
    if (window.innerWidth <= 768) {
        document.querySelector('.ticket-list-container').style.display = 'none';
    }

    // Join real-time updates room
    socket.emit('join_ticket', ticketId);

    loadMessages(ticketId);
}

function closeChatView() {
    activeTicketId = null;
    chatOpen = false;
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('chatEmptyState').style.display = 'flex';

    // Mobile logic: show list
    document.querySelector('.ticket-list-container').style.display = 'block';
}

async function createTicket() {
    const subject = document.getElementById('ticketSubject').value;
    const message = document.getElementById('ticketMessage').value;

    if (!message) return showToast('Please enter a message', 'error');

    try {
        const res = await fetch(`${API_URL}/support/tickets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subject, message })
        });

        const data = await res.json();
        if (res.ok) {
            document.getElementById('ticketMessage').value = '';
            showConversationView(data.ticket.ticket_id, data.ticket.subject, data.ticket.status);
        }
    } catch (err) {
        showToast('Failed to create ticket', 'error');
    }
}

async function loadMessages(ticketId) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="spinner"></div></div>';

    try {
        const res = await fetch(`${API_URL}/support/tickets/${ticketId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await res.json();

        renderMessages(messages);
    } catch (err) {
        // container.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load messages</div>'; 
        // Silent fail or retry
    }
}

function renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = messages.map(m => {
        const isMe = m.sender_type === 'customer';
        return `
            <div class="message ${isMe ? 'customer' : 'admin'}">
                ${m.message_text}
                <div class="message-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    if (!activeTicketId) return;

    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    // Optimistic UI update
    const tempId = Date.now();
    const container = document.getElementById('chatMessages');
    container.insertAdjacentHTML('beforeend', `
        <div class="message customer" id="msg-${tempId}">
            ${message}
            <div class="message-time">Sending...</div>
        </div>
    `);
    container.scrollTop = container.scrollHeight;
    input.value = '';

    try {
        const res = await fetch(`${API_URL}/support/tickets/${activeTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message_text: message })
        });

        if (res.ok) {
            const data = await res.json();
            const el = document.getElementById(`msg-${tempId}`);
            if (el) {
                el.outerHTML = `
                    <div class="message customer">
                        ${data.message_text}
                        <div class="message-time">${new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
            }
        }
    } catch (err) {
        showToast('Failed to send message', 'error');
    }
}



// Allow Enter to send
document.getElementById('chatInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

// ==========================================
// ORDER FILTERING & DETAIL MODAL
// ==========================================

let allCustomerOrders = [];
let currentOrderFilter = 'all';

// Filter customer orders
function filterCustomerOrders(filter) {
    currentOrderFilter = filter;

    // Update button styles
    document.querySelectorAll('#sectionOrders .filter-tab').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Apply filter
    let filtered = allCustomerOrders;

    if (filter === 'active') {
        filtered = allCustomerOrders.filter(o =>
            !['completed', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'refunded'].includes(o.order_status)
        );
    } else if (filter === 'completed') {
        filtered = allCustomerOrders.filter(o => o.order_status === 'completed');
    } else if (filter === 'cancelled') {
        filtered = allCustomerOrders.filter(o =>
            ['cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'refunded'].includes(o.order_status)
        );
    }

    renderFilteredOrders(filtered);
}

// Render filtered orders
function renderFilteredOrders(orders) {
    const container = document.getElementById('ordersList');

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                <i class="bi bi-box-seam" style="font-size: 48px; color: var(--text-muted); display: block; margin-bottom: 16px;"></i>
                <h3 style="color: var(--text-secondary);">No orders match this filter</h3>
                <p style="color: var(--text-muted);">Try a different filter or place a new order</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(o => createOrderCardHtml(o)).join('');
}

// Create order card HTML (enhanced with onclick)
function createOrderCardHtml(order) {
    const statusColors = {
        'confirmed': '#3b82f6',
        'preparing': '#f59e0b',
        'ready_for_collection': '#8b5cf6',
        'collected': '#6366f1',
        'qc_in_progress': '#f59e0b',
        'qc_passed': '#10b981',
        'in_transit': '#3b82f6',
        'delivered': '#10b981',
        'completed': '#059669',
        'cancelled_by_customer': '#ef4444',
        'cancelled_by_garage': '#ef4444',
        'disputed': '#dc2626'
    };

    const statusLabels = {
        'confirmed': 'Confirmed',
        'preparing': 'Preparing',
        'ready_for_collection': 'Ready for Pickup',
        'collected': 'Collected',
        'qc_in_progress': 'Quality Check',
        'qc_passed': 'QC Passed',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'completed': 'Completed',
        'cancelled_by_customer': 'Cancelled',
        'cancelled_by_garage': 'Cancelled',
        'disputed': 'Disputed'
    };

    const color = statusColors[order.order_status] || '#6b7280';
    const label = statusLabels[order.order_status] || order.order_status?.replace(/_/g, ' ') || 'Unknown';

    return `
        <div class="order-card" onclick="viewOrderDetail('${order.order_id}')" style="background: var(--bg-card); border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid var(--border); cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <div style="font-weight: 700; font-size: 16px;">${order.part_description?.slice(0, 40) || 'Part'}${order.part_description?.length > 40 ? '...' : ''}</div>
                    <div style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">${order.car_make || ''} ${order.car_model || ''} ${order.car_year || ''}</div>
                </div>
                <span style="background: ${color}15; color: ${color}; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${label}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 16px; color: var(--text-muted); font-size: 13px;">
                    <span><i class="bi bi-building"></i> ${order.garage_name || 'Garage'}</span>
                    <span><i class="bi bi-calendar"></i> ${new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <div style="font-weight: 700; font-size: 18px; color: var(--success);">${parseFloat(order.total_amount || 0).toFixed(0)} QAR</div>
            </div>
        </div>
    `;
}

// View order detail modal
async function viewOrderDetail(orderId) {
    const modal = document.getElementById('orderDetailModal');
    modal.style.display = 'flex';
    currentlyOpenOrderId = orderId; // Track which order is open for real-time refresh

    // Find order in cache or fetch (force re-fetch to get latest status)
    await loadOrders(); // Refresh cached orders first
    let order = allCustomerOrders.find(o => o.order_id === orderId);

    if (!order) {
        try {
            const res = await fetch(`${API_URL}/orders/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                order = await res.json();
            }
        } catch (err) {
            console.error('Failed to fetch order:', err);
        }
    }

    if (!order) {
        showToast('Order not found', 'error');
        closeOrderDetailModal();
        return;
    }

    // Populate modal
    document.getElementById('orderDetailNumber').textContent = '#' + (order.order_number || order.order_id.slice(0, 8));

    // Status banner
    const statusConfig = getOrderStatusConfig(order.order_status);
    document.getElementById('orderStatusIcon').innerHTML = `<i class="bi bi-${statusConfig.icon}"></i>`;
    document.getElementById('orderStatusIcon').style.background = statusConfig.bgColor;
    document.getElementById('orderStatusIcon').style.color = statusConfig.color;
    document.getElementById('orderStatusText').textContent = statusConfig.label;
    document.getElementById('orderStatusDesc').textContent = statusConfig.description;

    // Part info
    document.getElementById('orderPartInfo').textContent = order.part_description || 'Part';
    document.getElementById('orderCarInfo').textContent = `${order.car_make || ''} ${order.car_model || ''} ${order.car_year || ''}`.trim() || 'Vehicle';

    // Garage info
    document.getElementById('orderGarageName').textContent = order.garage_name || 'Garage';
    document.getElementById('orderGarageRating').textContent = `★ ${parseFloat(order.rating_average || 0).toFixed(1)} (${order.rating_count || 0} reviews)`;

    // Pricing
    document.getElementById('orderPartPrice').textContent = `${parseFloat(order.part_price || 0).toFixed(2)} QAR`;
    document.getElementById('orderDeliveryFee').textContent = `${parseFloat(order.delivery_fee || 25).toFixed(2)} QAR`;
    document.getElementById('orderTotalAmount').textContent = `${parseFloat(order.total_amount || 0).toFixed(2)} QAR`;

    // Actions
    let actionsHtml = '';
    if (order.order_status === 'delivered') {
        actionsHtml = `
            <button class="btn btn-primary" onclick="confirmDeliveryCustomer('${order.order_id}')" style="flex: 1;">
                <i class="bi bi-check-lg"></i> Confirm Receipt
            </button>
            <button class="btn btn-outline" onclick="openReviewModal('${order.order_id}', '${order.garage_id}')" style="flex: 1;">
                <i class="bi bi-star"></i> Rate Order
            </button>
        `;
    } else if (order.order_status === 'in_transit') {
        actionsHtml = `
            <button class="btn btn-primary" onclick="trackDelivery('${order.order_id}')" style="flex: 1;">
                <i class="bi bi-geo-alt"></i> Track Delivery
            </button>
        `;
    } else if (order.order_status === 'completed') {
        // Check if review already submitted
        if (order.review_id) {
            actionsHtml = `
                <div style="padding: 16px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; text-align: center; color: var(--primary);">
                    <i class="bi bi-star-fill" style="font-size: 24px;"></i>
                    <div style="font-weight: 600; margin-top: 8px;">Review Submitted</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Thank you for your feedback!</div>
                </div>
            `;
        } else {
            actionsHtml = `
                <button class="btn btn-outline" onclick="openReviewModal('${order.order_id}', '${order.garage_id}')" style="flex: 1;">
                    <i class="bi bi-star"></i> Leave a Review
                </button>
            `;
        }
    }
    document.getElementById('orderActions').innerHTML = actionsHtml;
}

// Get order status configuration
function getOrderStatusConfig(status) {
    const configs = {
        'confirmed': { icon: 'check-circle', label: 'Order Confirmed', description: 'Your order has been confirmed', color: '#3b82f6', bgColor: '#dbeafe' },
        'preparing': { icon: 'box-seam', label: 'Preparing', description: 'Garage is preparing your part', color: '#f59e0b', bgColor: '#fef3c7' },
        'ready_for_collection': { icon: 'bag-check', label: 'Ready for Pickup', description: 'Ready for driver to collect', color: '#8b5cf6', bgColor: '#ede9fe' },
        'collected': { icon: 'truck', label: 'Collected', description: 'Driver has picked up your part', color: '#6366f1', bgColor: '#e0e7ff' },
        'qc_in_progress': { icon: 'search', label: 'Quality Check', description: 'Part is being inspected', color: '#f59e0b', bgColor: '#fef3c7' },
        'qc_passed': { icon: 'patch-check', label: 'QC Passed', description: 'Part passed quality inspection', color: '#10b981', bgColor: '#d1fae5' },
        'in_transit': { icon: 'truck', label: 'In Transit', description: 'On the way to you', color: '#3b82f6', bgColor: '#dbeafe' },
        'delivered': { icon: 'box-arrow-in-down', label: 'Delivered', description: 'Part has been delivered', color: '#10b981', bgColor: '#d1fae5' },
        'completed': { icon: 'check-circle-fill', label: 'Completed', description: 'Order completed successfully', color: '#059669', bgColor: '#d1fae5' },
        'cancelled_by_customer': { icon: 'x-circle', label: 'Cancelled', description: 'You cancelled this order', color: '#ef4444', bgColor: '#fee2e2' },
        'cancelled_by_garage': { icon: 'x-circle', label: 'Cancelled', description: 'Garage cancelled this order', color: '#ef4444', bgColor: '#fee2e2' },
        'disputed': { icon: 'exclamation-triangle', label: 'Disputed', description: 'Order is under review', color: '#dc2626', bgColor: '#fee2e2' }
    };
    return configs[status] || { icon: 'question-circle', label: status?.replace(/_/g, ' ') || 'Unknown', description: '', color: '#6b7280', bgColor: '#f3f4f6' };
}

// Close order detail modal
function closeOrderDetailModal() {
    document.getElementById('orderDetailModal').style.display = 'none';
}

// Track delivery in real-time
async function trackDelivery(orderId) {
    showToast('Opening delivery tracker...', 'info');

    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            showToast('Failed to load order details', 'error');
            return;
        }

        const order = await res.json();

        let modal = document.getElementById('deliveryTrackingModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'deliveryTrackingModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3><i class="bi bi-truck"></i> Track Delivery</h3>
                        <button class="modal-close" onclick="closeDeliveryTracking()">&times;</button>
                    </div>
                    <div class="modal-body" id="deliveryTrackingContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const content = document.getElementById('deliveryTrackingContent');

        if (order.driver_name) {
            content.innerHTML = `
                <div style="padding: 20px;">
                    <div class="info-card" style="margin-bottom: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                        <h4 style="margin: 0 0 12px 0;"><i class="bi bi-person-circle"></i> Driver Information</h4>
                        <p style="margin: 4px 0;"><strong>Name:</strong> ${escapeHTML(order.driver_name)}</p>
                        <p style="margin: 4px 0;"><strong>Phone:</strong> ${escapeHTML(order.driver_phone)}</p>
                        <p style="margin: 4px 0;"><strong>Status:</strong> <span class="badge" style="background: #3b82f6; padding: 4px 12px; border-radius: 12px;">In Transit</span></p>
                    </div>
                    
                    <div class="info-card" style="padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                        <h4 style="margin: 0 0 12px 0;"><i class="bi bi-box-seam"></i> Delivery Details</h4>
                        <p style="margin: 4px 0;"><strong>Order:</strong> #${order.order_number || orderId.slice(0, 8)}</p>
                        <p style="margin: 4px 0;"><strong>Part:</strong> ${escapeHTML(order.part_description || 'Spare Part')}</p>
                        <p style="margin: 4px 0;"><strong>Address:</strong> ${escapeHTML(order.delivery_address_text || 'N/A')}</p>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 16px; background: var(--bg-secondary); border-radius: 12px; text-align: center;">
                        <i class="bi bi-info-circle" style="font-size: 20px; color: var(--primary);"></i>
                        <p style="margin: 8px 0; color: var(--text-secondary);">
                            You can contact the driver directly using the phone number above.
                        </p>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <i class="bi bi-hourglass-split" style="font-size: 48px; color: var(--text-muted);"></i>
                    <h4 style="color: var(--text-secondary); margin-top: 16px;">Driver Assignment Pending</h4>
                    <p style="color: var(--text-muted); margin-top: 8px;">A driver will be assigned soon.</p>
                </div>
            `;
        }

        modal.classList.add('active');
    } catch (err) {
        showToast('Failed to load delivery tracking', 'error');
    }
}

function closeDeliveryTracking() {
    const modal = document.getElementById('deliveryTrackingModal');
    if (modal) modal.classList.remove('active');
}

// Close modal on overlay click
document.getElementById('orderDetailModal')?.addEventListener('click', function (e) {
    if (e.target === this) closeOrderDetailModal();
});

// ==========================================
// REQUEST FILTERING
// ==========================================

let allCustomerRequests = [];
let currentRequestFilter = 'all';

// Filter customer requests
function filterCustomerRequests(filter) {
    currentRequestFilter = filter;

    // Update button styles
    document.querySelectorAll('#sectionRequests .filter-tab').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Apply filter
    let filtered = allCustomerRequests;

    if (filter === 'active') {
        filtered = allCustomerRequests.filter(r =>
            r.status === 'open' || r.status === 'bidding'
        );
    } else if (filter === 'with_bids') {
        filtered = allCustomerRequests.filter(r => r.bid_count > 0);
    } else if (filter === 'expired') {
        filtered = allCustomerRequests.filter(r =>
            r.status === 'expired' || r.status === 'cancelled' || r.status === 'accepted'
        );
    }

    renderFilteredRequests(filtered);
}

// Render filtered requests
function renderFilteredRequests(requests) {
    const container = document.getElementById('requestsList');

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                <i class="bi bi-list-task" style="font-size: 48px; color: var(--text-muted); display: block; margin-bottom: 16px;"></i>
                <h3 style="color: var(--text-secondary);">No requests match this filter</h3>
                <p style="color: var(--text-muted);">Try a different filter or create a new request</p>
            </div>
        `;
        return;
    }

    // Re-render using existing rendering logic - trigger a re-render
    if (typeof renderRequests === 'function') {
        renderRequests(requests);
    } else {
        // Fallback basic rendering
        container.innerHTML = requests.map(r => `
            <div class="request-card" style="background: var(--bg-card); border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 700; font-size: 16px;">${r.part_description?.slice(0, 40) || 'Part request'}${r.part_description?.length > 40 ? '...' : ''}</div>
                        <div style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">${r.car_make || ''} ${r.car_model || ''} ${r.car_year || ''}</div>
                    </div>
                    <span style="background: ${r.status === 'open' ? '#dbeafe' : r.status === 'bidding' ? '#fef3c7' : '#f3f4f6'}; color: ${r.status === 'open' ? '#3b82f6' : r.status === 'bidding' ? '#f59e0b' : '#6b7280'}; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${r.status}</span>
                </div>
                <div style="display: flex; gap: 16px; color: var(--text-muted); font-size: 13px;">
                    <span><i class="bi bi-chat-dots"></i> ${r.bid_count || 0} bids</span>
                    <span><i class="bi bi-calendar"></i> ${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    }
}

// ==========================================
// PROFILE STATS POPULATION
// ==========================================

function updateProfileStats(requests, orders) {
    // Update header stats
    const totalRequests = requests?.length || 0;
    const totalOrders = orders?.length || 0;
    const completedOrders = orders?.filter(o => o.order_status === 'completed')?.length || 0;
    const reviewsGiven = orders?.filter(o => o.review_id)?.length || 0;

    // Large stats in header
    const statRequestsLarge = document.getElementById('statRequestsLarge');
    const statOrdersLarge = document.getElementById('statOrdersLarge');
    const statCompletedLarge = document.getElementById('statCompletedLarge');
    const statReviewsLarge = document.getElementById('statReviewsLarge');

    if (statRequestsLarge) statRequestsLarge.textContent = totalRequests;
    if (statOrdersLarge) statOrdersLarge.textContent = totalOrders;
    if (statCompletedLarge) statCompletedLarge.textContent = completedOrders;
    if (statReviewsLarge) statReviewsLarge.textContent = reviewsGiven;

    // Existing stat elements
    const statRequests = document.getElementById('statRequests');
    const statOrders = document.getElementById('statOrders');
    const statReviews = document.getElementById('statReviews');

    if (statRequests) statRequests.textContent = totalRequests;
    if (statOrders) statOrders.textContent = completedOrders;
    if (statReviews) statReviews.textContent = reviewsGiven;
}

// Update profile name in header
function updateProfileHeader(name) {
    const avatarLarge = document.getElementById('profileAvatarLarge');
    const nameLarge = document.getElementById('profileNameLarge');

    if (avatarLarge && name) {
        avatarLarge.textContent = name.charAt(0).toUpperCase();
    }
    if (nameLarge && name) {
        nameLarge.textContent = `Welcome, ${name.split(' ')[0]}!`;
    }
}

// ===== SUPPORT TICKET FILTER =====
/**
 * Filter support tickets by status
 */
function filterTickets(status) {
    // Filtering tickets

    // Update active filter button
    const filterButtons = document.querySelectorAll('.ticket-filter');
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === status || (status === 'all' && btn.textContent.toLowerCase() === 'all')) {
            btn.classList.add('active');
        }
    });

    // Filter ticket list items
    const ticketItems = document.querySelectorAll('.ticket-item');
    ticketItems.forEach(item => {
        const ticketStatus = item.dataset.status || 'open';

        if (status === 'all') {
            item.style.display = '';
        } else if (status === 'open' && ticketStatus === 'open') {
            item.style.display = '';
        } else if (status === 'resolved' && ticketStatus === 'resolved') {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============================================================================
// DRIVER CHAT FUNCTIONALITY
// ============================================================================

let activeChatAssignment = null;
let chatUnreadCount = 0;

/**
 * Check if customer has an active delivery and set up chat context
 * FAB is always visible now, but this sets the active assignment for chat
 */
async function checkActiveDeliveryChat() {
    try {
        const res = await fetch(`${API_URL}/orders/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.orders) return;

        // Find order with active delivery (expanded status check)
        // Include multiple statuses where driver might be involved
        const activeStatuses = ['in_transit', 'out_for_delivery', 'collected', 'qc_passed', 'ready_for_collection'];
        const activeOrder = data.orders.find(o =>
            (activeStatuses.includes(o.order_status) || activeStatuses.includes(o.delivery_status)) &&
            (o.assignment_id || o.driver_id)
        );

        if (activeOrder && (activeOrder.assignment_id || activeOrder.driver_id)) {
            activeChatAssignment = {
                assignment_id: activeOrder.assignment_id,
                order_id: activeOrder.order_id,
                order_number: activeOrder.order_number,
                driver_name: activeOrder.driver_name || 'Driver'
            };

            // Check for unread messages
            checkUnreadMessages();

            // Update FAB tooltip to show active delivery
            const chatFab = document.getElementById('driverChatFab');
            if (chatFab) chatFab.title = `Chat with ${activeChatAssignment.driver_name}`;
        } else {
            // No active delivery, but FAB stays visible
            activeChatAssignment = null;
            const chatFab = document.getElementById('driverChatFab');
            if (chatFab) chatFab.title = 'No active delivery';
        }
    } catch (err) {
        console.error('Failed to check active delivery:', err);
    }
}

/**
 * Check for unread chat messages
 */
async function checkUnreadMessages() {
    try {
        const res = await fetch(`${API_URL}/chat/unread`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        chatUnreadCount = data.unread_count || 0;
        updateChatBadge();
    } catch (err) {
        console.error('Failed to check unread messages:', err);
    }
}

/**
 * Update chat FAB badge with unread count
 */
function updateChatBadge() {
    const badge = document.getElementById('chatFabBadge');
    if (chatUnreadCount > 0) {
        badge.textContent = chatUnreadCount > 9 ? '9+' : chatUnreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Open driver chat modal
 */
function openDriverChat() {
    // If no active delivery, show helpful message in modal instead of blocking
    if (!activeChatAssignment) {
        document.getElementById('chatDriverName').textContent = 'Driver Chat';
        document.getElementById('chatOrderBadge').textContent = '';
        document.getElementById('chatDriverAvatar').textContent = '🚚';

        // Show modal with no-chat message
        document.getElementById('driverChatModal').classList.add('active');
        document.getElementById('chatMessagesArea').innerHTML = `
            <div class="chat-welcome-message" style="text-align: center; padding: 40px 20px;">
                <div class="welcome-icon" style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <h4 style="margin: 0 0 8px 0;">No Active Delivery</h4>
                <p style="color: var(--text-secondary); margin: 0;">
                    When your order is being delivered, you'll be able to chat with your driver here in real-time.
                </p>
            </div>
        `;
        // Disable input when no active delivery
        const input = document.getElementById('customerChatInput');
        if (input) {
            input.placeholder = 'Chat available during delivery...';
            input.disabled = true;
        }
        return;
    }

    // Enable input for active delivery
    const input = document.getElementById('customerChatInput');
    if (input) {
        input.placeholder = 'Type a message...';
        input.disabled = false;
    }

    // Update header info
    document.getElementById('chatDriverName').textContent = activeChatAssignment.driver_name || 'Driver';
    document.getElementById('chatOrderBadge').textContent = `#${activeChatAssignment.order_number}`;
    document.getElementById('chatDriverAvatar').textContent = (activeChatAssignment.driver_name || 'D')[0].toUpperCase();

    // Show modal
    document.getElementById('driverChatModal').classList.add('active');

    // Join chat room via Socket.IO
    if (socket) {
        socket.emit('join_delivery_chat', activeChatAssignment.assignment_id);
    }

    // Load messages
    loadDriverChatMessages();

    // Focus input
    setTimeout(() => document.getElementById('customerChatInput').focus(), 100);

    // Reset unread count for this chat
    chatUnreadCount = 0;
    updateChatBadge();
}

/**
 * Close driver chat modal
 */
function closeDriverChat() {
    document.getElementById('driverChatModal').classList.remove('active');

    // Leave chat room
    if (socket && activeChatAssignment) {
        socket.emit('leave_delivery_chat', activeChatAssignment.assignment_id);
    }
}

/**
 * Load chat messages from server
 */
async function loadDriverChatMessages() {
    if (!activeChatAssignment) return;

    try {
        const res = await fetch(`${API_URL}/chat/assignment/${activeChatAssignment.assignment_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.messages) {
            renderChatMessages(data.messages);
        }
    } catch (err) {
        console.error('Failed to load chat messages:', err);
        showToast('Failed to load messages', 'error');
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

/**
 * Render chat messages in the chat area
 */
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessagesArea');

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="chat-date-divider"><span>Today</span></div>
            <div class="chat-welcome-message">
                <div class="welcome-icon">💬</div>
                <h4>Chat with your driver</h4>
                <p>Coordinate delivery details in real-time</p>
            </div>
        `;
        return;
    }

    let html = '<div class="chat-date-divider"><span>Today</span></div>';

    messages.forEach(msg => {
        const time = formatChatTime(msg.created_at);
        html += `
            <div class="chat-message ${msg.sender_type}">
                <div>${linkifyText(msg.message)}</div>
                <div class="chat-message-time">${time}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Format timestamp for chat
 */
function formatChatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Send message to driver
 */
async function sendDriverMessage() {
    const input = document.getElementById('customerChatInput');
    const message = input.value.trim();

    if (!message || !activeChatAssignment) return;

    input.value = '';
    input.disabled = true;

    try {
        const res = await fetch(`${API_URL}/chat/assignment/${activeChatAssignment.assignment_id}`, {
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

// ============================================================================
// CHAT SOCKET.IO INTEGRATION
// ============================================================================

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

/**
 * Initialize chat socket listeners
 */
function initChatSocketListeners() {
    if (!socket) return;

    // Listen for incoming chat messages
    socket.on('chat_message', (data) => {
        if (activeChatAssignment && data.assignment_id === activeChatAssignment.assignment_id) {
            // Chat is open, reload messages
            loadDriverChatMessages();
            // Play sound if message is from driver
            if (data.sender_type === 'driver') {
                playChatSound();
            }
        }
    });

    // Listen for chat notifications
    socket.on('chat_notification', (data) => {
        // Play notification sound
        playChatSound();

        // Show toast notification
        showToast(data.notification, 'info');

        // Increment badge if chat is not open
        const chatModal = document.getElementById('driverChatModal');
        if (!chatModal.classList.contains('active')) {
            chatUnreadCount++;
            updateChatBadge();
        }
    });
}

// ============================================================================
// CHAT INITIALIZATION
// ============================================================================

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Handle Enter key in chat input
    const chatInput = document.getElementById('customerChatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendDriverMessage();
            }
        });
    }

    // Close chat on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const chatModal = document.getElementById('driverChatModal');
            if (chatModal && chatModal.classList.contains('active')) {
                closeDriverChat();
            }
        }
    });
});

// Check for active delivery periodically (every 30 seconds)
setInterval(() => {
    if (token) {
        checkActiveDeliveryChat();
    }
}, 30000);

// Initialize on page load
if (token) {
    setTimeout(checkActiveDeliveryChat, 2000);
}

// Hook into socket initialization
const originalSocketSetup = window.onload;
window.addEventListener('load', () => {
    // Give socket time to connect
    setTimeout(() => {
        initChatSocketListeners();
    }, 1000);
});

// ============================================================================
// PHASE B: ORDER TIMELINE VISUAL (2030 Level)
// ============================================================================

/**
 * Generate visual timeline HTML for order progression
 * @param {string} status - Current order status
 * @returns {string} HTML for timeline
 */
function generateOrderTimeline(status) {
    const stages = [
        { key: 'confirmed', icon: 'check-circle', label: 'Confirmed' },
        { key: 'preparing', icon: 'box-seam', label: 'Preparing' },
        { key: 'qc_passed', icon: 'shield-check', label: 'QC Passed' },
        { key: 'in_transit', icon: 'truck', label: 'In Transit' },
        { key: 'delivered', icon: 'house-check', label: 'Delivered' }
    ];

    const statusOrder = ['confirmed', 'preparing', 'ready_for_pickup', 'collected', 'qc_in_progress', 'qc_passed', 'in_transit', 'delivered', 'completed'];
    const currentIndex = statusOrder.indexOf(status);

    const getStageState = (stageKey) => {
        const stageToCheck = {
            'confirmed': 0,
            'preparing': 1,
            'qc_passed': 2,
            'in_transit': 3,
            'delivered': 4
        };
        const mappedIndex = {
            'confirmed': 0, 'preparing': 1, 'ready_for_pickup': 1,
            'collected': 2, 'qc_in_progress': 2, 'qc_passed': 2,
            'in_transit': 3, 'delivered': 4, 'completed': 4
        }[status] || 0;

        const stageIdx = stageToCheck[stageKey];
        if (stageIdx < mappedIndex) return 'completed';
        if (stageIdx === mappedIndex) return 'active';
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

// ============================================================================
// PHASE C: PAGINATION COMPONENT
// ============================================================================

/**
 * Render pagination controls
 * @param {string} containerId - Container element ID
 * @param {object} pagination - { page, limit, total, pages }
 * @param {string} onPageChange - Function name to call on page change
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

    addPage(1);
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
        addPage(i);
    }
    if (pages > 1) addPage(pages);

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

    html += `<span class="pagination-info">Page ${page} of ${pages} (${total} items)</span>`;
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function showSkeletonLoader(containerId, count = 3, type = 'card') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    for (let i = 0; i < count; i++) {
        if (type === 'card') {
            html += `
                <div class="skeleton-card">
                    <div class="skeleton-text title skeleton-shimmer"></div>
                    <div class="skeleton-text long skeleton-shimmer"></div>
                    <div class="skeleton-text medium skeleton-shimmer"></div>
                    <div style="display: flex; gap: 10px; margin-top: 16px;">
                        <div class="skeleton-btn skeleton-shimmer"></div>
                        <div class="skeleton-btn skeleton-shimmer"></div>
                    </div>
                </div>
            `;
        } else if (type === 'row') {
            html += `
                <div class="skeleton-card" style="display: flex; align-items: center; gap: 16px; padding: 16px;">
                    <div class="skeleton-avatar skeleton-shimmer"></div>
                    <div style="flex: 1;">
                        <div class="skeleton-text medium skeleton-shimmer"></div>
                        <div class="skeleton-text short skeleton-shimmer"></div>
                    </div>
                </div>
            `;
        }
    }
    container.innerHTML = html;
}

function hideSkeletonLoader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const skeletons = container.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

// ============================================================================
// PHASE D: VOICE INPUT (Web Speech API - FREE)
// ============================================================================

let voiceRecognition = null;
let isListening = false;

function initVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Voice input not supported');
        return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.lang = 'en-US'; // Can switch to 'ar-QA' for Arabic

    voiceRecognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');

        const partDescInput = document.getElementById('partDescription');
        if (partDescInput) {
            partDescInput.value = transcript;
        }
    };

    voiceRecognition.onend = () => {
        isListening = false;
        updateVoiceButtonState();
    };

    voiceRecognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        isListening = false;
        updateVoiceButtonState();
        showToast('Voice input error. Please try again.', 'error');
    };

    return true;
}

function toggleVoiceInput() {
    if (!voiceRecognition) {
        if (!initVoiceInput()) {
            showToast('Voice input not supported in this browser', 'error');
            return;
        }
    }

    if (isListening) {
        voiceRecognition.stop();
        isListening = false;
    } else {
        voiceRecognition.start();
        isListening = true;
        showToast('Listening... Speak now', 'info');
    }

    updateVoiceButtonState();
}

function updateVoiceButtonState() {
    const btn = document.getElementById('voiceInputBtn');
    if (btn) {
        if (isListening) {
            btn.classList.add('listening');
            btn.innerHTML = '<i class="bi bi-mic-fill"></i>';
        } else {
            btn.classList.remove('listening');
            btn.innerHTML = '<i class="bi bi-mic"></i>';
        }
    }
}

// Switch voice language
function setVoiceLanguage(lang) {
    if (voiceRecognition) {
        voiceRecognition.lang = lang; // 'en-US' or 'ar-QA'
    }
}

// ============================================================================
// PHASE D: BID URGENCY CALCULATION
// ============================================================================

/**
 * Calculate urgency level for a request based on bid count and time
 * @param {object} request - Request object
 * @returns {object} { level: 'hot'|'warm'|'cool', label: string }
 */
function getBidUrgency(request) {
    const bidCount = request.bid_count || 0;
    const createdAt = new Date(request.created_at);
    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    // Hot: many bids and relatively new
    if (bidCount >= 5 || (bidCount >= 3 && hoursOld < 6)) {
        return { level: 'hot', label: '🔥 Hot' };
    }

    // Warm: some interest
    if (bidCount >= 2 || hoursOld < 12) {
        return { level: 'warm', label: '⚡ Active' };
    }

    // Cool: low interest or old
    return { level: 'cool', label: '✓ Open' };
}

/**
 * Get time remaining until request expires (72h default)
 * @param {string} createdAt - ISO date string
 * @returns {object} { text: string, isUrgent: boolean }
 */
function getTimeRemaining(createdAt) {
    const created = new Date(createdAt);
    const expires = new Date(created.getTime() + 72 * 60 * 60 * 1000);
    const hoursLeft = (expires - Date.now()) / (1000 * 60 * 60);

    if (hoursLeft <= 0) {
        return { text: 'Expired', isUrgent: true };
    } else if (hoursLeft < 12) {
        return { text: `${Math.floor(hoursLeft)}h left`, isUrgent: true };
    } else if (hoursLeft < 24) {
        return { text: `${Math.floor(hoursLeft)}h left`, isUrgent: false };
    } else {
        const days = Math.floor(hoursLeft / 24);
        const hours = Math.floor(hoursLeft % 24);
        return { text: `${days}d ${hours}h left`, isUrgent: false };
    }
}

// ============================================================================
// PHASE D: SMART RECOMMENDATIONS (Database-driven, no external AI)
// ============================================================================

let recentSearches = [];

/**
 * Track user search/request for recommendations
 * @param {object} searchData - { car_make, car_model, part_category }
 */
function trackSearch(searchData) {
    recentSearches.push({
        ...searchData,
        timestamp: Date.now()
    });
    // Keep only last 10
    if (recentSearches.length > 10) {
        recentSearches.shift();
    }
    localStorage.setItem('qscrap_searches', JSON.stringify(recentSearches));
}

/**
 * Get recommendations based on user history
 * @returns {array} Array of recommendation objects
 */
function getRecommendations() {
    // Load from localStorage
    const saved = localStorage.getItem('qscrap_searches');
    if (saved) {
        recentSearches = JSON.parse(saved);
    }

    // Extract patterns
    const carMakes = recentSearches.map(s => s.car_make).filter(Boolean);
    const categories = recentSearches.map(s => s.part_category).filter(Boolean);

    // Return most common
    const recommendations = [];

    // Most searched car make
    if (carMakes.length > 0) {
        const topMake = mode(carMakes);
        recommendations.push({
            type: 'car',
            label: `Parts for ${topMake}`,
            action: () => document.getElementById('carMake').value = topMake
        });
    }

    // Most searched category
    if (categories.length > 0) {
        const topCategory = mode(categories);
        recommendations.push({
            type: 'category',
            label: `Popular: ${topCategory}`,
            action: () => { selectedCategory = topCategory; }
        });
    }

    return recommendations;
}

// Helper: find mode (most frequent) in array
function mode(arr) {
    const freq = {};
    arr.forEach(item => freq[item] = (freq[item] || 0) + 1);
    return Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b);
}

/**
 * Render recommendations UI
 */
function renderRecommendations() {
    const recommendations = getRecommendations();
    if (recommendations.length === 0) return;

    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="recommendation-card">
            <div class="recommendation-title">
                <i class="bi bi-lightbulb"></i> Quick Fill
            </div>
            <div class="recommendation-items">
                ${recommendations.map((r, i) => `
                    <div class="recommendation-item" onclick="applyRecommendation(${i})">
                        <i class="bi bi-${r.type === 'car' ? 'car-front' : 'tag'}"></i>
                        <span>${r.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function applyRecommendation(index) {
    const recommendations = getRecommendations();
    if (recommendations[index] && recommendations[index].action) {
        recommendations[index].action();
        showToast('Applied!', 'success');
    }
}

// ============================================================================
// PHASE D: PRICE ALERTS (Notify when bid below target)
// ============================================================================

let priceAlerts = [];

function loadPriceAlerts() {
    const saved = localStorage.getItem('qscrap_price_alerts');
    if (saved) priceAlerts = JSON.parse(saved);
}

function savePriceAlerts() {
    localStorage.setItem('qscrap_price_alerts', JSON.stringify(priceAlerts));
}

/**
 * Set a price alert for a request
 * @param {string} requestId 
 * @param {number} targetPrice 
 */
function setPriceAlert(requestId, targetPrice) {
    loadPriceAlerts();
    priceAlerts = priceAlerts.filter(a => a.requestId !== requestId);
    priceAlerts.push({ requestId, targetPrice, createdAt: Date.now() });
    savePriceAlerts();
    showToast(`Alert set! We'll notify you when a bid is ≤ ${targetPrice} QAR`, 'success');
}

/**
 * Check if any bids meet price alert criteria
 * @param {array} requests - Array of requests with bids
 */
function checkPriceAlerts(requests) {
    loadPriceAlerts();

    requests.forEach(req => {
        const alert = priceAlerts.find(a => a.requestId === req.request_id);
        if (!alert) return;

        const lowestBid = Math.min(...(req.bids || []).map(b => b.price));
        if (lowestBid <= alert.targetPrice) {
            showToast(`🎉 Price Alert: A bid of ${lowestBid} QAR meets your target!`, 'success');
            playNotificationSound();
            // Remove triggered alert
            priceAlerts = priceAlerts.filter(a => a.requestId !== req.request_id);
            savePriceAlerts();
        }
    });
}

// Initialize recommendations on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderRecommendations, 1000);
});
