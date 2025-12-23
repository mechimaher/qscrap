// ============================================
// ADMIN DASHBOARD JAVASCRIPT
// QScrap Premium Platform
// ============================================

const API_URL = '/api';
let token = localStorage.getItem('adminToken');
let currentGarageId = null;
let searchDebounce = null;

// ============================================
// INITIALIZATION
// ============================================

if (token) {
    showApp();
} else {
    document.getElementById('authScreen').style.display = 'flex';
}

// ============================================
// AUTHENTICATION
// ============================================

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

        if (res.ok && data.userType === 'admin') {
            localStorage.setItem('adminToken', data.token);
            token = data.token;
            showApp();
        } else if (data.userType && data.userType !== 'admin') {
            showToast('Access denied. Admin privileges required.', 'error');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

function logout() {
    localStorage.removeItem('adminToken');
    token = null;
    window.location.reload();
}

function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    loadDashboard();
}

// ============================================
// NAVIGATION
// ============================================

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        switchSection(section);
    });
});

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1))?.classList.add('active');

    if (section === 'dashboard') loadDashboard();
    if (section === 'approvals') loadPendingGarages();
    if (section === 'garages') loadGarages();
    if (section === 'audit') loadAuditLog();
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.stats) {
            document.getElementById('statPending').textContent = data.stats.pending_approvals || 0;
            document.getElementById('statApproved').textContent = data.stats.approved_garages || 0;
            document.getElementById('statDemos').textContent = data.stats.active_demos || 0;
            document.getElementById('statCustomers').textContent = data.stats.total_customers || 0;
            document.getElementById('statDrivers').textContent = data.stats.total_drivers || 0;
            document.getElementById('statActiveOrders').textContent = data.stats.active_orders || 0;

            // Update pending badge
            const pendingCount = data.stats.pending_approvals || 0;
            const badge = document.getElementById('pendingBadge');
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline' : 'none';
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

// ============================================
// PENDING APPROVALS
// ============================================

async function loadPendingGarages() {
    const container = document.getElementById('pendingList');
    container.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass"></i><p>Loading...</p></div>';

    try {
        const res = await fetch(`${API_URL}/admin/garages/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.garages && data.garages.length > 0) {
            container.innerHTML = data.garages.map(g => renderGarageCard(g, true)).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-check-circle"></i>
                    <p>No pending approvals! All caught up.</p>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>Failed to load</p></div>';
    }
}

// ============================================
// ALL GARAGES
// ============================================

async function loadGarages(page = 1) {
    const container = document.getElementById('garagesList');
    const status = document.getElementById('garageStatusFilter').value;
    const search = document.getElementById('garageSearch').value;

    container.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass"></i><p>Loading...</p></div>';

    try {
        const params = new URLSearchParams({ status, search, page, limit: 12 });
        const res = await fetch(`${API_URL}/admin/garages?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.garages && data.garages.length > 0) {
            container.innerHTML = data.garages.map(g => renderGarageCard(g, false)).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-shop"></i>
                    <p>No garages found</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('loadGarages error:', err);
        container.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>Failed to load</p></div>';
    }
}

function debounceSearch() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => loadGarages(), 300);
}

// ============================================
// GARAGE CARD RENDERER
// ============================================

function renderGarageCard(garage, isPending) {
    const status = garage.approval_status || 'pending';
    const statusClass = status;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    return `
        <div class="garage-card">
            <div class="garage-card-header">
                <span class="garage-name">${escapeHtml(garage.garage_name)}</span>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="garage-info">
                <div class="garage-info-row">
                    <i class="bi bi-telephone"></i>
                    <span>${garage.phone_number || '-'}</span>
                </div>
                <div class="garage-info-row">
                    <i class="bi bi-envelope"></i>
                    <span>${garage.email || '-'}</span>
                </div>
                <div class="garage-info-row">
                    <i class="bi bi-geo-alt"></i>
                    <span>${garage.address || 'No address'}</span>
                </div>
                <div class="garage-info-row">
                    <i class="bi bi-calendar"></i>
                    <span>Registered: ${formatDate(garage.registration_date || garage.created_at)}</span>
                </div>
            </div>
            ${!isPending ? `
                <div class="garage-stats">
                    <div class="garage-stat">
                        <span class="garage-stat-value">${garage.total_orders || 0}</span>
                        <span class="garage-stat-label">Orders</span>
                    </div>
                    <div class="garage-stat">
                        <span class="garage-stat-value">${garage.total_bids || 0}</span>
                        <span class="garage-stat-label">Bids</span>
                    </div>
                    <div class="garage-stat">
                        <span class="garage-stat-value">${garage.plan_name || 'None'}</span>
                        <span class="garage-stat-label">Plan</span>
                    </div>
                </div>
            ` : ''}
            <div class="garage-actions">
                ${status === 'pending' ? `
                    <button class="btn btn-success" onclick="openApproveModal('${garage.garage_id}', '${escapeHtml(garage.garage_name)}')">
                        <i class="bi bi-check-circle"></i> Approve
                    </button>
                    <button class="btn btn-primary" onclick="openDemoModal('${garage.garage_id}', '${escapeHtml(garage.garage_name)}')">
                        <i class="bi bi-clock"></i> Demo
                    </button>
                    <button class="btn btn-danger" onclick="openRejectModal('${garage.garage_id}', '${escapeHtml(garage.garage_name)}')">
                        <i class="bi bi-x-circle"></i> Reject
                    </button>
                ` : status === 'approved' || status === 'demo' ? `
                    <button class="btn btn-outline" onclick="revokeAccess('${garage.garage_id}')">
                        <i class="bi bi-slash-circle"></i> Revoke
                    </button>
                ` : status === 'rejected' ? `
                    <button class="btn btn-success" onclick="openApproveModal('${garage.garage_id}', '${escapeHtml(garage.garage_name)}')">
                        <i class="bi bi-check-circle"></i> Approve
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================
// MODALS
// ============================================

function openApproveModal(garageId, garageName) {
    currentGarageId = garageId;
    document.getElementById('approveGarageName').textContent = garageName;
    document.getElementById('approveNotes').value = '';
    document.getElementById('approveModal').classList.add('active');
}

function openRejectModal(garageId, garageName) {
    currentGarageId = garageId;
    document.getElementById('rejectGarageName').textContent = garageName;
    document.getElementById('rejectReason').value = '';
    document.getElementById('rejectModal').classList.add('active');
}

function openDemoModal(garageId, garageName) {
    currentGarageId = garageId;
    document.getElementById('demoGarageName').textContent = garageName;
    document.getElementById('demoDays').value = 30;
    document.getElementById('demoNotes').value = '';
    document.getElementById('demoModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    currentGarageId = null;
}

// ============================================
// ACTIONS
// ============================================

async function confirmApprove() {
    const notes = document.getElementById('approveNotes').value;

    try {
        const res = await fetch(`${API_URL}/admin/garages/${currentGarageId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Garage approved successfully!', 'success');
            closeModal('approveModal');
            loadPendingGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to approve', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function confirmReject() {
    const reason = document.getElementById('rejectReason').value;

    if (!reason.trim()) {
        showToast('Please provide a rejection reason', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/garages/${currentGarageId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Garage rejected', 'success');
            closeModal('rejectModal');
            loadPendingGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to reject', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function confirmDemo() {
    const days = document.getElementById('demoDays').value;
    const notes = document.getElementById('demoNotes').value;

    try {
        const res = await fetch(`${API_URL}/admin/garages/${currentGarageId}/demo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days: parseInt(days), notes })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Demo access granted for ${days} days!`, 'success');
            closeModal('demoModal');
            loadPendingGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to grant demo', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function revokeAccess(garageId) {
    if (!confirm('Are you sure you want to revoke this garage\'s access?')) return;

    try {
        const res = await fetch(`${API_URL}/admin/garages/${garageId}/revoke`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Access revoked by admin' })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Access revoked', 'success');
            loadGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to revoke', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================
// AUDIT LOG
// ============================================

async function loadAuditLog() {
    const container = document.getElementById('auditList');

    try {
        const res = await fetch(`${API_URL}/admin/audit`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.logs && data.logs.length > 0) {
            container.innerHTML = data.logs.map(log => `
                <div class="audit-item">
                    <div class="audit-icon">
                        <i class="bi bi-${getAuditIcon(log.action_type)}"></i>
                    </div>
                    <div class="audit-content">
                        <div class="audit-action">${formatActionType(log.action_type)}</div>
                        <div class="audit-details">By ${log.admin_name || 'System'} on ${log.target_type}</div>
                    </div>
                    <div class="audit-time">${formatDate(log.created_at)}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="empty-state"><i class="bi bi-journal"></i><p>No audit logs yet</p></div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>Failed to load</p></div>';
    }
}

function getAuditIcon(action) {
    const icons = {
        approve_garage: 'check-circle',
        reject_garage: 'x-circle',
        grant_demo: 'clock',
        revoke_access: 'slash-circle'
    };
    return icons[action] || 'journal';
}

function formatActionType(action) {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
