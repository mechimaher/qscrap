// ============================================
// ADMIN DASHBOARD JAVASCRIPT
// QScrap Premium Platform
// ============================================

const API_URL = '/api';
let token = localStorage.getItem('adminToken');
let currentGarageId = null;
let autoRefreshInterval = null;
let lastActivityTime = Date.now();

// ============================================
// UNIFIED DEBOUNCE UTILITY
// ============================================
const debounceTimers = {};
function createDebounce(key, fn, delay = 300) {
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(fn, delay);
}

// ============================================
// INITIALIZATION
// ============================================

if (token) {
    showApp();
    // Stagger premium features to avoid 429 rate limit
    setTimeout(() => initializePremiumFeatures(), 500);
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
        if (section) {
            switchSection(section);
        }
    });
});

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1));
    targetSection?.classList.add('active');

    // Scroll main-content to top - it's the ONLY scroll container now
    // Scroll main-content to top - force reset
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.scrollTop = 0;
        // Backup scroll reset for async rendering/layout shifts
        setTimeout(() => {
            mainContent.scrollTop = 0;
        }, 50);
    }

    if (section === 'dashboard') loadDashboard();
    if (section === 'approvals') loadPendingGarages();
    if (section === 'requests') loadPlanRequests();
    if (section === 'garages') loadGarages();
    if (section === 'users') loadUsers();
    if (section === 'staff') loadStaff();
    if (section === 'drivers') loadDrivers();
    if (section === 'audit') loadAuditLog();
    if (section === 'reports') loadReports();
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
            // Format revenue with currency
            const revenue = parseFloat(data.stats.monthly_revenue || 0);
            const formattedRevenue = revenue >= 1000
                ? `${(revenue / 1000).toFixed(1)}K`
                : revenue.toFixed(0);

            // Row 1: Critical Business Metrics
            animateStat('statRevenue', `QAR ${formattedRevenue}`);
            animateStat('statActiveOrders', data.stats.active_orders || 0);
            animateStat('statDisputes', data.stats.open_disputes || 0);
            animateStat('statPending', data.stats.pending_approvals || 0);

            // Row 2: Garage Metrics
            animateStat('statApproved', data.stats.approved_garages || 0);
            animateStat('statDemos', data.stats.active_demos || 0);
            animateStat('statExpiringSoon', data.stats.expiring_soon || 0);

            // Row 3: User Metrics
            animateStat('statTotalUsers', data.stats.total_users || 0);
            animateStat('statActiveDrivers', data.stats.active_drivers || 0);
            animateStat('statTodaySignups', data.stats.today_signups || 0);

            // Update pending badge
            const pendingCount = data.stats.pending_approvals || 0;
            const badge = document.getElementById('pendingBadge');
            if (badge) {
                badge.textContent = pendingCount;
                badge.style.display = pendingCount > 0 ? 'inline' : 'none';
            }

            // Update Plan Requests badge
            const planRequestsCount = data.stats.pending_plan_requests || 0;
            const planBadge = document.getElementById('planRequestsBadge');
            if (planBadge) {
                planBadge.textContent = planRequestsCount;
                planBadge.style.display = planRequestsCount > 0 ? 'inline-flex' : 'none';
            }

            // Update staff badge
            const staffCount = data.stats.total_staff || 0;
            const staffBadge = document.getElementById('staffBadge');
            if (staffBadge) {
                staffBadge.textContent = staffCount;
                staffBadge.style.display = staffCount > 0 ? 'inline' : 'none'; // Optional: hide if 0
            }

            // Highlight warning states
            const disputeCard = document.querySelector('.stat-card.danger');
            if (disputeCard && data.stats.open_disputes > 0) {
                disputeCard.classList.add('pulse');
            }
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

// Animate stat value updates for smooth UX
function animateStat(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.style.opacity = '0.5';
    el.style.transform = 'scale(0.95)';

    setTimeout(() => {
        el.textContent = value;
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
    }, 150);
}

// ============================================
// PENDING APPROVALS / GARAGE APPROVALS
// ============================================

function debounceApprovalSearch() {
    createDebounce('approval', () => loadPendingGarages(1));
}

async function loadPendingGarages(page = 1) {
    const container = document.getElementById('pendingList');
    const statusFilter = document.getElementById('approvalStatusFilter')?.value || 'pending';
    const search = document.getElementById('approvalSearch')?.value || '';

    // Show skeleton loading state
    container.innerHTML = Array(4).fill(0).map(() => `
        <div class="garage-card skeleton-card">
            <div class="skeleton skeleton-text medium"></div>
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-text full" style="height: 60px; margin-top: 12px;"></div>
        </div>
    `).join('');

    try {
        let url = `${API_URL}/admin/garages/pending?page=${page}&status=${statusFilter}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.garages && data.garages.length > 0) {
            container.innerHTML = data.garages.map(g => renderGarageCard(g, statusFilter === 'pending')).join('');
            renderPagination('approvalsPagination', data.pagination, 'loadPendingGarages', { showInfo: true });
        } else {
            const emptyMessages = {
                pending: { icon: 'check-circle', text: 'No pending approvals! All caught up.' },
                demo: { icon: 'clock-history', text: 'No garages currently in demo period.' },
                expired: { icon: 'hourglass-bottom', text: 'No expired demos found.' },
                rejected: { icon: 'x-circle', text: 'No rejected applications.' }
            };
            const msg = emptyMessages[statusFilter] || { icon: 'inbox', text: 'No garages found.' };

            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-${msg.icon}"></i>
                    <p>${msg.text}</p>
                    ${search ? '<span style="font-size: 13px; color: var(--text-muted);">Try adjusting your search</span>' : ''}
                </div>
            `;
            document.getElementById('approvalsPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('loadPendingGarages error:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to load garages</p>
                <button class="btn btn-outline" onclick="loadPendingGarages(${page})">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
        document.getElementById('approvalsPagination').innerHTML = '';
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
        const params = new URLSearchParams({ status, search, page, limit: 20 });
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
    createDebounce('garage', () => loadGarages());
}

// ============================================
// GARAGE CARD RENDERER
// ============================================

function renderGarageCard(garage, isPending) {
    const status = garage.approval_status || 'pending';
    const statusClass = status;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    // Determine plan badge class
    const planName = garage.plan_name || 'None';
    const planBadgeClass = planName === 'None' ? 'none' :
        status === 'demo' ? 'demo' : 'professional';

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
                        <span class="plan-badge ${planBadgeClass}">
                            <i class="bi bi-${planName === 'None' ? 'x-circle' : status === 'demo' ? 'clock' : 'award'}"></i>
                            ${planName}
                        </span>
                        <span class="garage-stat-label">Plan</span>
                    </div>
                </div>
                ${(status === 'approved' || status === 'demo') ? `
                    <div class="garage-plan-actions">
                        <button class="btn btn-sm btn-outline" onclick="openManagePlanModal('${garage.garage_id}', '${escapeHtml(garage.garage_name)}', '${planName}', '${status}')">
                            <i class="bi bi-credit-card"></i> Manage Plan
                        </button>
                    </div>
                ` : ''}
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
// PLAN MANAGEMENT
// ============================================

async function openManagePlanModal(garageId, garageName, currentPlan, status) {
    document.getElementById('subscriptionGarageId').value = garageId;
    document.getElementById('subscriptionGarageName').textContent = garageName;
    document.getElementById('subscriptionDays').value = 30;
    document.getElementById('commissionOverride').value = '';
    document.getElementById('subscriptionNotes').value = '';

    // Load available plans
    try {
        const res = await fetch(`${API_URL}/admin/plans`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const planSelect = document.getElementById('subscriptionPlan');
        planSelect.innerHTML = `
            <option value="">-- Select Plan --</option>
            <optgroup label="🎁 Trial Options">
                <option value="demo_30">🎁 Demo Trial (30 days free, unlimited bids)</option>
                ${status === 'demo' ? '<option value="demo_extend">🔄 Extend Demo (+30 days)</option>' : ''}
            </optgroup>
            <optgroup label="💼 Paid Plans">
                ${(data.plans || []).map(p => `
                    <option value="${p.plan_id}" data-commission="${p.commission_rate}">
                        💼 ${p.plan_name} - ${(p.commission_rate * 100).toFixed(0)}% commission${p.max_bids_per_month ? ` (${p.max_bids_per_month} bids/month)` : ' (unlimited)'}
                    </option>
                `).join('')}
            </optgroup>
        `;

        // Show/hide revoke button based on current plan
        const revokeBtn = document.getElementById('btnRevokeSubscription');
        if (revokeBtn) {
            revokeBtn.style.display = currentPlan && currentPlan !== 'None' ? 'inline-flex' : 'none';
        }

        // Update modal title based on status
        const modalTitle = document.querySelector('#subscriptionModal .modal-header h3');
        if (modalTitle) {
            if (status === 'demo') {
                modalTitle.innerHTML = '<i class="bi bi-arrow-up-circle"></i> Upgrade from Demo';
            } else if (currentPlan && currentPlan !== 'None') {
                modalTitle.innerHTML = '<i class="bi bi-pencil-square"></i> Change Plan';
            } else {
                modalTitle.innerHTML = '<i class="bi bi-credit-card"></i> Assign Plan';
            }
        }

    } catch (err) {
        console.error('Failed to load plans:', err);
        showToast('Failed to load subscription plans', 'error');
        return;
    }

    document.getElementById('subscriptionModal').classList.add('active');
}

async function confirmAssignSubscription() {
    const garageId = document.getElementById('subscriptionGarageId').value;
    const planValue = document.getElementById('subscriptionPlan').value;
    const days = parseInt(document.getElementById('subscriptionDays').value) || 30;
    const commissionOverride = document.getElementById('commissionOverride').value;
    const notes = document.getElementById('subscriptionNotes').value;

    if (!planValue) {
        showToast('Please select a plan', 'error');
        return;
    }

    try {
        let endpoint, body;

        if (planValue === 'demo_30' || planValue === 'demo_extend') {
            // Grant or extend demo
            endpoint = `${API_URL}/admin/garages/${garageId}/demo`;
            body = {
                days: planValue === 'demo_30' ? 30 : days,
                notes: notes || (planValue === 'demo_30' ? 'Demo assigned by admin' : 'Demo extended by admin')
            };
        } else {
            // Assign paid plan
            endpoint = `${API_URL}/admin/garages/${garageId}/plan`;
            body = {
                plan_id: planValue,
                months: Math.ceil(days / 30),
                notes: notes || 'Plan assigned by admin'
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
            // Handle commission override for paid plans
            if (commissionOverride && planValue !== 'demo_30' && planValue !== 'demo_extend') {
                try {
                    await fetch(`${API_URL}/admin/garages/${garageId}/commission`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            commission_rate: parseFloat(commissionOverride) / 100,
                            notes: `Custom commission: ${commissionOverride}%`
                        })
                    });
                } catch (e) {
                    console.warn('Commission override failed:', e);
                }
            }

            showToast(data.message || 'Plan assigned successfully!', 'success');
            closeModal('subscriptionModal');
            loadGarages();
            loadPendingGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to assign plan', 'error');
        }
    } catch (err) {
        console.error('Plan assignment error:', err);
        showToast('Connection error', 'error');
    }
}

async function revokeSubscription() {
    const garageId = document.getElementById('subscriptionGarageId').value;

    if (!confirm('Are you sure you want to revoke this subscription? The garage will no longer be able to bid.')) return;

    try {
        const res = await fetch(`${API_URL}/admin/garages/${garageId}/plan/revoke`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Revoked by admin' })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Subscription revoked', 'success');
            closeModal('subscriptionModal');
            loadGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to revoke subscription', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================
// AUDIT LOG
// ============================================

async function loadAuditLog(page = 1) {
    const container = document.getElementById('auditList');
    const actionFilter = document.getElementById('auditActionFilter')?.value || 'all';
    const targetFilter = document.getElementById('auditTargetFilter')?.value || 'all';

    // Show skeleton loading state
    container.innerHTML = Array(5).fill(0).map(() => `
        <div class="audit-item skeleton-row">
            <div class="skeleton skeleton-avatar"></div>
            <div style="flex: 1;">
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        </div>
    `).join('');

    try {
        let url = `${API_URL}/admin/audit?page=${page}&limit=20`;
        if (actionFilter !== 'all') url += `&action_type=${actionFilter}`;
        if (targetFilter !== 'all') url += `&target_type=${targetFilter}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.logs && data.logs.length > 0) {
            container.innerHTML = data.logs.map((log, idx) => `
                <div class="audit-item collapsed" data-idx="${idx}">
                    <button class="audit-toggle" onclick="toggleAuditItem(${idx})" title="Expand details">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                    <div class="audit-icon ${getAuditIconClass(log.action_type)}">
                        <i class="bi bi-${getAuditIcon(log.action_type)}"></i>
                    </div>
                    <div class="audit-content">
                        <div class="audit-summary">
                            <span class="audit-action">${formatActionType(log.action_type)}</span>
                            <span class="audit-brief">• By ${escapeHtml(log.admin_name || 'Admin')} on ${log.target_type}</span>
                        </div>
                        <div class="audit-expanded">
                            <div class="audit-detail-row"><strong>Target ID:</strong> ${log.target_id || 'N/A'}</div>
                            ${log.notes ? `<div class="audit-detail-row"><strong>Notes:</strong> ${escapeHtml(log.notes)}</div>` : ''}
                            <div class="audit-detail-row"><strong>Admin:</strong> ${escapeHtml(log.admin_name || 'Unknown')} (${log.admin_id ? log.admin_id.slice(0, 8) + '...' : 'N/A'})</div>
                            <div class="audit-detail-row"><strong>Full Timestamp:</strong> ${formatDateTime(log.created_at, true)}</div>
                        </div>
                    </div>
                    <div class="audit-time">${formatDateTime(log.created_at)}</div>
                </div>
            `).join('');

            // Render pagination
            renderPagination('auditPagination', data.pagination, 'loadAuditLog', { showInfo: true });
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-journal-bookmark"></i>
                    <p>No audit logs found</p>
                    <span style="font-size: 13px; color: var(--text-muted);">
                        ${actionFilter !== 'all' || targetFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Admin actions will appear here'}
                    </span>
                </div>
            `;
            document.getElementById('auditPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('loadAuditLog error:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to load audit log</p>
                <button class="btn btn-outline" onclick="loadAuditLog(${page})">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
        document.getElementById('auditPagination').innerHTML = '';
    }
}

function getAuditIconClass(action) {
    if (action?.includes('approved') || action?.includes('activate')) return 'success';
    if (action?.includes('rejected') || action?.includes('revoked') || action?.includes('suspended')) return 'danger';
    if (action?.includes('demo') || action?.includes('created')) return 'info';
    return '';
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

/**
 * Toggle audit log item expansion
 */
function toggleAuditItem(idx) {
    const item = document.querySelector(`.audit-item[data-idx="${idx}"]`);
    if (!item) return;

    const expanded = item.querySelector('.audit-expanded');
    const icon = item.querySelector('.audit-toggle i');

    item.classList.toggle('collapsed');

    if (item.classList.contains('collapsed')) {
        expanded.style.display = 'none';
        icon.className = 'bi bi-chevron-right';
    } else {
        expanded.style.display = 'block';
        icon.className = 'bi bi-chevron-down';
    }
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

// ============================================
// REUSABLE PAGINATION COMPONENT
// ============================================

/**
 * Renders a premium pagination component
 * @param {string} containerId - ID of the container element
 * @param {object} pagination - { current_page, total_pages, total, limit }
 * @param {string} loadFunctionName - Name of the function to call for page changes
 * @param {object} options - { showPageSize: bool, showInfo: bool }
 */
function renderPagination(containerId, pagination, loadFunctionName, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { showPageSize = false, showInfo = true } = options;
    // Handle both 'page' and 'current_page' from different API responses
    const current_page = pagination?.current_page || pagination?.page || 1;
    const total_pages = pagination?.total_pages || pagination?.pages || 1;
    const total = pagination?.total || 0;
    const limit = pagination?.limit || 20;

    if (!pagination || total_pages <= 1) {
        container.innerHTML = total > 0 ? `<div class="pagination-info-only">Showing all ${total} items</div>` : '';
        return;
    }

    let html = '<div class="pagination">';

    // Info section
    if (showInfo) {
        const startItem = (current_page - 1) * limit + 1;
        const endItem = Math.min(current_page * limit, total);
        html += `<span class="pagination-info">Showing ${startItem}-${endItem} of ${total}</span>`;

        // Large dataset warning
        if (total > 1000) {
            html += `<span class="pagination-warning" title="Large dataset - use filters for better performance">
                <i class="bi bi-exclamation-triangle"></i> Use filters
            </span>`;
        }
    }

    // Page size selector (optional) - capped at 50 max for performance
    if (showPageSize) {
        html += `
            <select class="pagination-size" onchange="${loadFunctionName}(1, this.value)">
                <option value="15" ${limit == 15 ? 'selected' : ''}>15 / page</option>
                <option value="25" ${limit == 25 ? 'selected' : ''}>25 / page</option>
                <option value="50" ${limit == 50 ? 'selected' : ''}>50 / page</option>
            </select>
        `;
    }

    html += '<div class="pagination-buttons">';

    // First page button
    if (current_page > 2) {
        html += `<button class="pagination-btn" onclick="${loadFunctionName}(1)" title="First page">
            <i class="bi bi-chevron-double-left"></i>
        </button>`;
    }

    // Previous button
    if (current_page > 1) {
        html += `<button class="pagination-btn" onclick="${loadFunctionName}(${current_page - 1})" title="Previous">
            <i class="bi bi-chevron-left"></i>
        </button>`;
    }

    // Page numbers with smart ellipsis
    const pages = [];
    const showEllipsisStart = current_page > 3;
    const showEllipsisEnd = current_page < total_pages - 2;

    // Always show first page
    pages.push(1);

    if (showEllipsisStart) pages.push('...');

    // Show pages around current
    for (let i = Math.max(2, current_page - 1); i <= Math.min(total_pages - 1, current_page + 1); i++) {
        if (!pages.includes(i)) pages.push(i);
    }

    if (showEllipsisEnd) pages.push('...');

    // Always show last page
    if (total_pages > 1 && !pages.includes(total_pages)) pages.push(total_pages);

    pages.forEach(p => {
        if (p === '...') {
            html += '<span class="pagination-ellipsis">...</span>';
        } else {
            html += `<button class="pagination-btn ${p === current_page ? 'active' : ''}" 
                onclick="${loadFunctionName}(${p})">${p}</button>`;
        }
    });

    // Next button
    if (current_page < total_pages) {
        html += `<button class="pagination-btn" onclick="${loadFunctionName}(${current_page + 1})" title="Next">
            <i class="bi bi-chevron-right"></i>
        </button>`;
    }

    // Last page button
    if (current_page < total_pages - 1) {
        html += `<button class="pagination-btn" onclick="${loadFunctionName}(${total_pages})" title="Last page">
            <i class="bi bi-chevron-double-right"></i>
        </button>`;
    }

    html += '</div></div>';
    container.innerHTML = html;
}

// ============================================
// USER MANAGEMENT
// ============================================

let currentUsersPage = 1;
let currentUserData = null;

function debounceUserSearch() {
    createDebounce('user', () => loadUsers());
}

async function loadUsers(page = 1) {
    currentUsersPage = page;
    const tbody = document.getElementById('usersTableBody');
    const userType = document.getElementById('userTypeFilter').value;
    const status = document.getElementById('userStatusFilter').value;
    const search = document.getElementById('userSearch').value;

    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell"><i class="bi bi-hourglass"></i> Loading...</td></tr>';

    try {
        const params = new URLSearchParams({
            user_type: userType,
            status,
            search,
            page,
            limit: 25
        });
        const res = await fetch(`${API_URL}/admin/users?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.users && data.users.length > 0) {
            tbody.innerHTML = data.users.map(user => renderUserRow(user)).join('');
            renderUsersPagination(data.pagination);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-cell"><i class="bi bi-people"></i> No users found</td></tr>';
            document.getElementById('usersPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('loadUsers error:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-cell"><i class="bi bi-exclamation-triangle"></i> Failed to load users</td></tr>';
    }
}

function renderUserRow(user) {
    const statusClass = user.is_suspended ? 'suspended' : (user.is_active ? 'active' : 'inactive');
    const statusLabel = user.is_suspended ? 'Suspended' : (user.is_active ? 'Active' : 'Inactive');
    const typeIcon = user.user_type === 'customer' ? 'person' :
        user.user_type === 'garage' ? 'shop' :
            user.user_type === 'driver' ? 'truck' : 'person';

    return `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar"><i class="bi bi-${typeIcon}"></i></div>
                    <div class="user-info">
                        <span class="user-name">${escapeHtml(user.full_name || 'N/A')}</span>
                        <span class="user-id">${user.user_id.slice(0, 8)}...</span>
                    </div>
                </div>
            </td>
            <td><span class="type-badge ${user.user_type}">${user.user_type}</span></td>
            <td>
                <div class="contact-info">
                    <span><i class="bi bi-telephone"></i> ${user.phone_number || '-'}</span>
                    <span><i class="bi bi-envelope"></i> ${user.email || '-'}</span>
                </div>
            </td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <div class="action-buttons-row">
                    <button class="btn-icon" onclick="viewUserDetails('${user.user_id}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="openEditUserModal('${user.user_id}', '${escapeHtml(user.full_name || '')}', '${user.email || ''}', '${user.phone_number || ''}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${user.is_suspended ? `
                        <button class="btn-icon success" onclick="activateUser('${user.user_id}')" title="Activate">
                            <i class="bi bi-check-circle"></i>
                        </button>
                    ` : `
                        <button class="btn-icon danger" onclick="suspendUser('${user.user_id}')" title="Suspend">
                            <i class="bi bi-slash-circle"></i>
                        </button>
                    `}
                    <button class="btn-icon warning" onclick="openResetPasswordModal('${user.user_id}', '${escapeHtml(user.full_name || user.phone_number)}')" title="Reset Password">
                        <i class="bi bi-key"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function renderUsersPagination(pagination) {
    renderPagination('usersPagination', pagination, 'loadUsers', { showInfo: true, showPageSize: true });
}

async function viewUserDetails(userId) {
    document.getElementById('userDetailContent').innerHTML = '<div class="loading-spinner">Loading...</div>';
    document.getElementById('userDetailActions').innerHTML = '';
    document.getElementById('userDetailModal').classList.add('active');

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.user) {
            currentUserData = data.user;
            renderUserDetails(data.user, data.type_data, data.activity);
        } else {
            document.getElementById('userDetailContent').innerHTML = '<p class="error">Failed to load user details</p>';
        }
    } catch (err) {
        document.getElementById('userDetailContent').innerHTML = '<p class="error">Connection error</p>';
    }
}

function renderUserDetails(user, typeData, activity) {
    const statusClass = user.is_suspended ? 'suspended' : (user.is_active ? 'active' : 'inactive');
    const statusLabel = user.is_suspended ? 'Suspended' : (user.is_active ? 'Active' : 'Inactive');

    let html = `
        <div class="detail-section">
            <h4>Basic Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Full Name</label>
                    <span>${escapeHtml(user.full_name || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <label>User Type</label>
                    <span class="type-badge ${user.user_type}">${user.user_type}</span>
                </div>
                <div class="detail-item">
                    <label>Phone</label>
                    <span>${user.phone_number || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>Email</label>
                    <span>${user.email || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>Status</label>
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="detail-item">
                    <label>Registered</label>
                    <span>${formatDateTime(user.created_at)}</span>
                </div>
            </div>
        </div>
    `;

    // Type-specific data
    if (user.user_type === 'garage' && typeData) {
        html += `
            <div class="detail-section">
                <h4>Garage Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Garage Name</label>
                        <span>${escapeHtml(typeData.garage_name || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Approval Status</label>
                        <span class="status-badge ${typeData.approval_status || 'pending'}">${typeData.approval_status || 'Pending'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Address</label>
                        <span>${escapeHtml(typeData.address || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Subscription</label>
                        <span>${typeData.subscription_status || 'None'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Driver-specific data
    if (user.user_type === 'driver' && typeData) {
        html += `
            <div class="detail-section">
                <h4>Driver Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Driver ID</label>
                        <span>${typeData.driver_id || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Status</label>
                        <span class="status-badge ${typeData.status || 'offline'}">${typeData.status || 'Offline'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Vehicle Type</label>
                        <span>${escapeHtml(typeData.vehicle_type || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Vehicle Plate</label>
                        <span>${escapeHtml(typeData.vehicle_plate || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Vehicle Model</label>
                        <span>${escapeHtml(typeData.vehicle_model || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Rating</label>
                        <span>${typeData.rating ? `⭐ ${parseFloat(typeData.rating).toFixed(1)}` : 'No rating'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Total Earnings</label>
                        <span>${typeData.total_earnings ? `QAR ${parseFloat(typeData.total_earnings).toFixed(2)}` : 'QAR 0.00'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Activity summary
    if (activity) {
        html += `
            <div class="detail-section">
                <h4>Activity Summary</h4>
                <div class="activity-stats">
                    ${activity.orders_count !== undefined ? `<div class="activity-stat"><span class="value">${activity.orders_count}</span><span class="label">Orders</span></div>` : ''}
                    ${activity.bids_count !== undefined ? `<div class="activity-stat"><span class="value">${activity.bids_count}</span><span class="label">Bids</span></div>` : ''}
                    ${activity.deliveries_count !== undefined ? `<div class="activity-stat"><span class="value">${activity.deliveries_count}</span><span class="label">Deliveries</span></div>` : ''}
                </div>
            </div>
        `;
    }

    document.getElementById('userDetailContent').innerHTML = html;

    // Action buttons
    let actions = `<button class="btn btn-outline" onclick="closeModal('userDetailModal')">Close</button>`;

    if (user.is_suspended) {
        actions += `<button class="btn btn-success" onclick="activateUser('${user.user_id}'); closeModal('userDetailModal');"><i class="bi bi-check-circle"></i> Activate</button>`;
    } else {
        actions += `<button class="btn btn-danger" onclick="suspendUser('${user.user_id}'); closeModal('userDetailModal');"><i class="bi bi-slash-circle"></i> Suspend</button>`;
    }

    if (user.user_type === 'garage') {
        actions += `<button class="btn btn-primary" onclick="openSubscriptionModal('${user.user_id}', '${escapeHtml(typeData?.garage_name || user.full_name)}')"><i class="bi bi-credit-card"></i> Manage Subscription</button>`;
    }

    document.getElementById('userDetailActions').innerHTML = actions;
}

function openEditUserModal(userId, name, email, phone) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUserName').value = name;
    document.getElementById('editUserEmail').value = email;
    document.getElementById('editUserPhone').value = phone;
    document.getElementById('editUserModal').classList.add('active');
}

async function confirmEditUser() {
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value;
    const email = document.getElementById('editUserEmail').value;
    const phone = document.getElementById('editUserPhone').value;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ full_name: name, email, phone_number: phone })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('User updated successfully', 'success');
            closeModal('editUserModal');
            loadUsers(currentUsersPage);
        } else {
            showToast(data.error || 'Failed to update', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function openResetPasswordModal(userId, userName) {
    document.getElementById('resetPasswordUserId').value = userId;
    document.getElementById('resetPasswordUserName').textContent = userName;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('resetPasswordModal').classList.add('active');
}

async function confirmResetPassword() {
    const userId = document.getElementById('resetPasswordUserId').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/reset-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_password: newPassword })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Password reset successfully', 'success');
            closeModal('resetPasswordModal');
        } else {
            showToast(data.error || 'Failed to reset password', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function suspendUser(userId) {
    if (!confirm('Are you sure you want to suspend this user?')) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Suspended by admin' })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('User suspended', 'success');
            loadUsers(currentUsersPage);
        } else {
            showToast(data.error || 'Failed to suspend', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function activateUser(userId) {
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/activate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();

        if (res.ok) {
            showToast('User activated', 'success');
            loadUsers(currentUsersPage);
        } else {
            showToast(data.error || 'Failed to activate', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

let subscriptionPlansCache = null;

async function loadSubscriptionPlans() {
    if (subscriptionPlansCache) return subscriptionPlansCache;

    try {
        const res = await fetch(`${API_URL}/admin/plans`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        subscriptionPlansCache = data.plans || [];
        return subscriptionPlansCache;
    } catch (err) {
        console.error('Failed to load plans:', err);
        return [];
    }
}

async function openSubscriptionModal(garageId, garageName) {
    document.getElementById('subscriptionGarageId').value = garageId;
    document.getElementById('subscriptionGarageName').textContent = garageName;
    document.getElementById('subscriptionDays').value = 30;
    document.getElementById('commissionOverride').value = '';
    document.getElementById('subscriptionNotes').value = '';

    const planSelect = document.getElementById('subscriptionPlan');
    planSelect.innerHTML = '<option value="">Loading plans...</option>';

    document.getElementById('subscriptionModal').classList.add('active');

    const plans = await loadSubscriptionPlans();
    planSelect.innerHTML = plans.map(p =>
        `<option value="${p.plan_id}">${escapeHtml(p.plan_name)} - QAR ${p.monthly_price}/mo (${p.commission_rate}% commission)</option>`
    ).join('');

    if (plans.length === 0) {
        planSelect.innerHTML = '<option value="">No plans available</option>';
    }
}

async function confirmAssignSubscription() {
    const garageId = document.getElementById('subscriptionGarageId').value;
    const planValue = document.getElementById('subscriptionPlan').value;
    const days = parseInt(document.getElementById('subscriptionDays').value) || 30;
    const commission = document.getElementById('commissionOverride').value;
    const notes = document.getElementById('subscriptionNotes').value;

    if (!planValue) {
        showToast('Please select a plan', 'error');
        return;
    }

    try {
        let endpoint, body;

        // Handle demo plans specially - route to /demo endpoint
        if (planValue === 'demo_30' || planValue === 'demo_extend') {
            endpoint = `${API_URL}/admin/garages/${garageId}/demo`;
            body = {
                days: planValue === 'demo_30' ? 30 : days,
                notes: notes || (planValue === 'demo_30' ? 'Demo assigned by admin' : 'Demo extended by admin')
            };
        } else {
            // Paid plans go to /plan endpoint
            endpoint = `${API_URL}/admin/garages/${garageId}/plan`;
            body = {
                plan_id: planValue,
                months: Math.ceil(days / 30),
                notes: notes || 'Plan assigned by admin'
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
            // Handle commission override for paid plans
            if (commission && planValue !== 'demo_30' && planValue !== 'demo_extend') {
                try {
                    await fetch(`${API_URL}/admin/garages/${garageId}/commission`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            commission_rate: parseFloat(commission) / 100,
                            notes: `Custom commission: ${commission}%`
                        })
                    });
                } catch (e) {
                    console.warn('Commission override failed:', e);
                }
            }

            showToast(data.message || 'Plan assigned successfully!', 'success');
            closeModal('subscriptionModal');
            loadGarages();
            loadPendingGarages();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to assign plan', 'error');
        }
    } catch (err) {
        console.error('Plan assignment error:', err);
        showToast('Connection error', 'error');
    }
}

async function revokeSubscription() {
    const garageId = document.getElementById('subscriptionGarageId').value;

    if (!confirm('Are you sure you want to revoke this subscription?')) return;

    try {
        const res = await fetch(`${API_URL}/admin/garages/${garageId}/plan/revoke`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Revoked by admin' })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Subscription revoked', 'success');
            closeModal('subscriptionModal');
            loadGarages();
        } else {
            showToast(data.error || 'Failed to revoke', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function openExtendSubscriptionModal(garageId, garageName) {
    document.getElementById('extendGarageId').value = garageId;
    document.getElementById('extendGarageName').textContent = garageName;
    document.getElementById('extendDays').value = 30;
    document.getElementById('extendReason').value = '';
    document.getElementById('extendSubscriptionModal').classList.add('active');
}

async function confirmExtendSubscription() {
    const garageId = document.getElementById('extendGarageId').value;
    const days = document.getElementById('extendDays').value;
    const reason = document.getElementById('extendReason').value;

    try {
        const res = await fetch(`${API_URL}/admin/garages/${garageId}/plan/extend`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days: parseInt(days), reason })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Subscription extended by ${days} days`, 'success');
            closeModal('extendSubscriptionModal');
            loadGarages();
        } else {
            showToast(data.error || 'Failed to extend', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================
// ENHANCED UTILITIES
// ============================================

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// CREATE USER FUNCTIONALITY
// ============================================

let selectedUserType = null;

function openCreateUserModal() {
    // Reset modal state
    selectedUserType = null;
    document.getElementById('createUserStep1').style.display = 'block';
    document.getElementById('createUserStep2').style.display = 'none';
    document.getElementById('createUserActions').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal('createUserModal')">Cancel</button>
    `;

    // Clear form
    document.getElementById('createUserForm')?.reset();
    document.querySelectorAll('.garage-fields, .driver-fields, .staff-fields').forEach(el => el.style.display = 'none');

    // Open modal
    document.getElementById('createUserModal').classList.add('active');
}

function selectUserType(type) {
    selectedUserType = type;

    // Show step 2
    document.getElementById('createUserStep1').style.display = 'none';
    document.getElementById('createUserStep2').style.display = 'block';

    // Update badge
    const typeLabels = {
        customer: 'Customer',
        garage: 'Garage',
        driver: 'Driver',
        staff: 'Staff Member',
        admin: 'Administrator'
    };
    document.getElementById('selectedTypeBadge').textContent = typeLabels[type] || type;

    // Show type-specific fields
    document.querySelectorAll('.garage-fields, .driver-fields, .staff-fields').forEach(el => el.style.display = 'none');
    if (type === 'garage') {
        document.querySelector('.garage-fields').style.display = 'block';
    } else if (type === 'driver') {
        document.querySelector('.driver-fields').style.display = 'block';
    } else if (type === 'staff') {
        document.querySelector('.staff-fields').style.display = 'block';
    }

    // Update action buttons
    document.getElementById('createUserActions').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal('createUserModal')">Cancel</button>
        <button class="btn btn-success" onclick="submitCreateUser()">
            <i class="bi bi-person-plus"></i> Create ${typeLabels[type]}
        </button>
    `;
}

function backToTypeSelection() {
    selectedUserType = null;
    document.getElementById('createUserStep1').style.display = 'block';
    document.getElementById('createUserStep2').style.display = 'none';
    document.getElementById('createUserActions').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal('createUserModal')">Cancel</button>
    `;
}

async function submitCreateUser() {
    // Gather common fields
    const phone = document.getElementById('newUserPhone').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const fullName = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const isActive = document.getElementById('newUserActive').checked;

    // Validation
    if (!phone) {
        showToast('Phone number is required', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    if (!fullName) {
        showToast('Full name is required', 'error');
        return;
    }

    // Build request body
    const userData = {
        phone_number: phone,
        password,
        full_name: fullName,
        email: email || null,
        user_type: selectedUserType,
        is_active: isActive
    };

    // Add garage-specific fields
    if (selectedUserType === 'garage') {
        const garageName = document.getElementById('newGarageName').value.trim();
        if (!garageName) {
            showToast('Garage name is required', 'error');
            return;
        }
        userData.garage_data = {
            garage_name: garageName,
            trade_license_number: document.getElementById('newGarageLicense').value.trim(),
            address: document.getElementById('newGarageAddress').value.trim(),
            cr_number: document.getElementById('newGarageCR').value.trim(),
            approval_status: document.getElementById('newGarageStatus').value
        };
    }

    // Add driver-specific fields
    if (selectedUserType === 'driver') {
        userData.driver_data = {
            vehicle_type: document.getElementById('newDriverVehicle').value,
            license_plate: document.getElementById('newDriverPlate').value.trim()
        };
    }

    // Add staff-specific fields
    if (selectedUserType === 'staff') {
        const staffRole = document.getElementById('newStaffRole').value;
        if (!staffRole) {
            showToast('Please select a staff role', 'error');
            return;
        }
        userData.staff_data = {
            role: staffRole,
            department: document.getElementById('newStaffDepartment').value.trim(),
            employee_id: document.getElementById('newStaffEmployeeId').value.trim(),
            hire_date: document.getElementById('newStaffHireDate').value || null
        };
    }

    try {
        const res = await fetch(`${API_URL}/admin/users/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`${selectedUserType.charAt(0).toUpperCase() + selectedUserType.slice(1)} created successfully!`, 'success');
            closeModal('createUserModal');

            // Refresh relevant section
            if (selectedUserType === 'garage') {
                loadGarages();
                loadDashboard();
            } else {
                loadUsers();
            }
        } else {
            showToast(data.error || 'Failed to create user', 'error');
        }
    } catch (err) {
        console.error('Create user error:', err);
        showToast('Connection error', 'error');
    }
}

// ============================================
// STAFF MANAGEMENT
// ============================================

const STAFF_ROLE_ICONS = {
    operations: '🎯',
    finance: '💰',
    customer_service: '🎧',
    quality_control: '✅',
    logistics: '🚚',
    hr: '👥',
    management: '📊'
};

function debounceStaffSearch() {
    createDebounce('staff', () => loadStaff());
}

async function loadStaff(page = 1) {
    const container = document.getElementById('staffGrid');
    const roleFilter = document.getElementById('staffRoleFilter')?.value || 'all';
    const search = document.getElementById('staffSearch')?.value || '';

    container.innerHTML = '<div class="loading-spinner"><i class="bi bi-hourglass"></i> Loading staff...</div>';

    try {
        const params = new URLSearchParams({
            user_type: 'staff',
            role: roleFilter,  // Server-side role filtering
            search,
            page,
            limit: 20
        });

        const res = await fetch(`${API_URL}/admin/users?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.users && data.users.length > 0) {
            let staffUsers = data.users;

            container.innerHTML = staffUsers.map(staff => renderStaffCard(staff)).join('');

            // Update staff badge count
            const staffBadge = document.getElementById('staffBadge');
            if (staffBadge) {
                staffBadge.textContent = data.pagination?.total || staffUsers.length;
                staffBadge.style.display = 'inline';
            }

            renderPagination('staffPagination', data.pagination, 'loadStaff', { showInfo: true });
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-briefcase"></i>
                    <p>No staff members found</p>
                    <button class="btn btn-primary" onclick="openCreateUserModal(); setTimeout(() => selectUserType('staff'), 100);">
                        <i class="bi bi-person-plus"></i> Add Staff Member
                    </button>
                </div>
            `;
            document.getElementById('staffPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('loadStaff error:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to load staff</p>
                <button class="btn btn-outline" onclick="loadStaff(${page})">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
    }
}

function renderStaffCard(staff) {
    const role = staff.staff_role || 'operations';
    const roleIcon = STAFF_ROLE_ICONS[role] || '👤';
    const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const statusClass = staff.is_suspended ? 'suspended' : (staff.is_active ? 'active' : 'inactive');

    return `
        <div class="staff-card">
            <div class="staff-header">
                <div class="staff-avatar">
                    <span class="role-icon">${roleIcon}</span>
                </div>
                <div class="staff-info">
                    <span class="staff-name">${escapeHtml(staff.full_name || 'N/A')}</span>
                    <span class="staff-role">${roleLabel}</span>
                </div>
                <span class="status-dot ${statusClass}" title="${statusClass}"></span>
            </div>
            <div class="staff-details">
                <div class="detail-row">
                    <i class="bi bi-telephone"></i>
                    <span>${staff.phone_number || '-'}</span>
                </div>
                <div class="detail-row">
                    <i class="bi bi-envelope"></i>
                    <span>${staff.email || '-'}</span>
                </div>
            </div>
            <div class="staff-actions">
                <button class="btn btn-sm btn-outline" onclick="viewUserDetails('${staff.user_id}')">
                    <i class="bi bi-eye"></i> View
                </button>
                ${staff.is_suspended
            ? `<button class="btn btn-sm btn-success" onclick="activateUser('${staff.user_id}'); loadStaff();">Activate</button>`
            : `<button class="btn btn-sm btn-danger" onclick="suspendUser('${staff.user_id}'); loadStaff();">Suspend</button>`
        }
            </div>
        </div>
    `;
}

// ============================================
// DRIVER MANAGEMENT
// ============================================

function debounceDriverSearch() {
    createDebounce('driver', () => loadDrivers());
}

async function loadDrivers(page = 1) {
    const tbody = document.getElementById('driversTableBody');
    const statusFilter = document.getElementById('driverStatusFilter')?.value || 'all';
    const search = document.getElementById('driverSearch')?.value || '';

    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell"><i class="bi bi-hourglass"></i> Loading drivers...</td></tr>';

    try {
        const params = new URLSearchParams({
            user_type: 'driver',
            search,
            page,
            limit: 25
        });

        const res = await fetch(`${API_URL}/admin/users?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.users && data.users.length > 0) {
            // Get driver details (we need to make additional calls or enhance API later)
            tbody.innerHTML = data.users.map(driver => renderDriverRow(driver)).join('');
            renderPagination('driversPagination', data.pagination, 'loadDrivers', { showInfo: true });
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-cell">
                        <i class="bi bi-truck"></i> No drivers found
                        <br><br>
                        <button class="btn btn-primary btn-sm" onclick="openCreateUserModal(); setTimeout(() => selectUserType('driver'), 100);">
                            <i class="bi bi-person-plus"></i> Add Driver
                        </button>
                    </td>
                </tr>
            `;
            document.getElementById('driversPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('loadDrivers error:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell"><i class="bi bi-exclamation-triangle"></i> Failed to load drivers</td></tr>';
    }
}

function renderDriverRow(driver) {
    const statusClass = driver.is_suspended ? 'suspended' : (driver.is_active ? 'active' : 'inactive');
    const statusLabel = driver.is_suspended ? 'Offline' : (driver.is_active ? 'Available' : 'Inactive');
    const statusIcon = driver.is_suspended ? '⚫' : (driver.is_active ? '🟢' : '🔴');

    return `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar driver"><i class="bi bi-truck"></i></div>
                    <div class="user-info">
                        <span class="user-name">${escapeHtml(driver.full_name || 'N/A')}</span>
                        <span class="user-id">${driver.user_id.slice(0, 8)}...</span>
                    </div>
                </div>
            </td>
            <td>${driver.phone_number || '-'}</td>
            <td><span class="vehicle-badge">🏍️ Motorcycle</span></td>
            <td><span class="status-badge ${statusClass}">${statusIcon} ${statusLabel}</span></td>
            <td>0</td>
            <td>⭐ -</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="viewUserDetails('${driver.user_id}')">
                    <i class="bi bi-eye"></i>
                </button>
                ${driver.is_suspended
            ? `<button class="btn btn-sm btn-success" onclick="activateUser('${driver.user_id}'); loadDrivers();"><i class="bi bi-check"></i></button>`
            : `<button class="btn btn-sm btn-warning" onclick="suspendUser('${driver.user_id}'); loadDrivers();"><i class="bi bi-pause"></i></button>`
        }
            </td>
        </tr>
    `;
}

// ============================================
// REPORTS MODULE
// ============================================

let currentReportPeriod = '30d';
let lastReportData = null;

// Report column configurations
const REPORT_COLUMNS = {
    demo_garages: [
        { key: 'garage_name', label: 'Garage Name' },
        { key: 'phone_number', label: 'Phone' },
        { key: 'days_left', label: 'Days Left', format: 'days' },
        { key: 'total_bids', label: 'Bids' },
        { key: 'total_orders', label: 'Orders' },
        { key: 'total_revenue', label: 'Revenue', format: 'currency' }
    ],
    expired_demos: [
        { key: 'garage_name', label: 'Garage Name' },
        { key: 'phone_number', label: 'Phone' },
        { key: 'days_since_expired', label: 'Days Since Expired' },
        { key: 'total_bids', label: 'Bids' },
        { key: 'total_orders', label: 'Orders' },
        { key: 'activity_level', label: 'Activity', format: 'badge' }
    ],
    demo_conversions: [
        { key: 'garage_name', label: 'Garage Name' },
        { key: 'phone_number', label: 'Phone' },
        { key: 'days_to_convert', label: 'Days to Convert' },
        { key: 'plan_name', label: 'Plan' },
        { key: 'lifetime_revenue', label: 'Lifetime Revenue', format: 'currency' }
    ],
    subscription_renewals: [
        { key: 'garage_name', label: 'Garage Name' },
        { key: 'phone_number', label: 'Phone' },
        { key: 'plan_name', label: 'Plan' },
        { key: 'days_until_expiry', label: 'Days Until Expiry', format: 'urgency' },
        { key: 'months_subscribed', label: 'Months Subscribed' },
        { key: 'total_revenue', label: 'Revenue', format: 'currency' }
    ],
    all_garages: [
        { key: 'garage_name', label: 'Garage Name' },
        { key: 'approval_status', label: 'Status', format: 'status' },
        { key: 'phone_number', label: 'Phone' },
        { key: 'subscription_plan', label: 'Plan' },
        { key: 'total_orders', label: 'Orders' },
        { key: 'total_revenue', label: 'Revenue', format: 'currency' }
    ],
    registrations: [
        { key: 'date', label: 'Date' },
        { key: 'user_type', label: 'User Type' },
        { key: 'count', label: 'Count' }
    ],
    commission_revenue: [
        { key: 'period', label: 'Period' },
        { key: 'order_count', label: 'Orders' },
        { key: 'gross_revenue', label: 'Gross Revenue', format: 'currency' },
        { key: 'commission_revenue', label: 'Commission', format: 'currency' }
    ]
};

// Initialize period tabs
document.getElementById('reportPeriodTabs')?.addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
        document.querySelectorAll('#reportPeriodTabs .tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentReportPeriod = e.target.dataset.period;
        loadReports(1);
    }
});

async function loadReports(page = 1) {
    const reportType = document.getElementById('reportType')?.value || 'demo_garages';
    const content = document.getElementById('reportContent');
    const summary = document.getElementById('reportSummary');

    // Show loading
    content.innerHTML = `
        <div class="report-table-wrapper">
            <div class="skeleton skeleton-text full" style="height: 40px;"></div>
            ${Array(5).fill('<div class="skeleton skeleton-text full" style="height: 50px; margin-top: 8px;"></div>').join('')}
        </div>
    `;
    summary.innerHTML = '';

    try {
        // Map report type to endpoint
        const endpointMap = {
            demo_garages: 'demo-garages',
            expired_demos: 'expired-demos',
            demo_conversions: 'demo-conversions',
            subscription_renewals: 'subscription-renewals',
            commission_revenue: 'commission-revenue',
            all_garages: 'all-garages',
            registrations: 'registrations'
        };

        const endpoint = endpointMap[reportType] || 'demo-garages';
        const url = `${API_URL}/admin/reports/${endpoint}?page=${page}&period=${currentReportPeriod}&limit=20`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        lastReportData = data;

        // Render summary cards
        if (data.summary) {
            summary.innerHTML = renderReportSummary(data.summary, reportType);
        }

        // Render table
        const columns = REPORT_COLUMNS[reportType] || REPORT_COLUMNS.demo_garages;
        const rows = data.data || data.breakdown || data.daily_breakdown || [];

        if (rows.length > 0) {
            content.innerHTML = renderReportTable(rows, columns);
            if (data.pagination) {
                renderPagination('reportsPagination', data.pagination, 'loadReports', { showInfo: true });
            } else {
                document.getElementById('reportsPagination').innerHTML = '';
            }
        } else {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-file-earmark-x"></i>
                    <p>No data found for this report</p>
                    <span style="font-size: 13px; color: var(--text-muted);">Try adjusting the time period</span>
                </div>
            `;
            document.getElementById('reportsPagination').innerHTML = '';
        }
    } catch (err) {
        console.error('loadReports error:', err);
        content.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to generate report</p>
                <button class="btn btn-outline" onclick="loadReports(${page})">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
    }
}

function renderReportSummary(summary, reportType) {
    const cards = Object.entries(summary).map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const formattedValue = typeof value === 'number' && key.includes('revenue')
            ? `${parseFloat(value).toLocaleString()} QAR`
            : value;
        return `
            <div class="summary-card">
                <span class="summary-value">${formattedValue}</span>
                <span class="summary-label">${label}</span>
            </div>
        `;
    });
    return `<div class="summary-grid">${cards.join('')}</div>`;
}

function renderReportTable(rows, columns) {
    const headerHTML = columns.map(c => `<th>${c.label}</th>`).join('');
    const bodyHTML = rows.map(row => {
        const cells = columns.map(c => {
            let value = row[c.key];
            value = formatCellValue(value, c.format);
            return `<td>${value}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    return `
        <div class="report-table-wrapper" id="printableReport">
            <table class="report-table">
                <thead><tr>${headerHTML}</tr></thead>
                <tbody>${bodyHTML}</tbody>
            </table>
        </div>
    `;
}

function formatCellValue(value, format) {
    if (value === null || value === undefined) return '-';

    switch (format) {
        case 'currency':
            return `${parseFloat(value).toLocaleString()} QAR`;
        case 'days':
            const days = parseInt(value);
            if (days <= 3) return `<span class="badge danger">${days} days</span>`;
            if (days <= 7) return `<span class="badge warning">${days} days</span>`;
            return `<span class="badge success">${days} days</span>`;
        case 'urgency':
            const d = parseInt(value);
            if (d <= 7) return `<span class="badge danger">${d} days</span>`;
            if (d <= 14) return `<span class="badge warning">${d} days</span>`;
            return `${d} days`;
        case 'status':
            const statusColors = {
                pending: 'warning',
                demo: 'info',
                approved: 'success',
                expired: 'danger',
                rejected: 'danger'
            };
            return `<span class="badge ${statusColors[value] || ''}">${value}</span>`;
        case 'badge':
            const badgeColors = {
                had_activity: 'success',
                bids_only: 'warning',
                no_activity: 'danger'
            };
            const label = value.replace(/_/g, ' ');
            return `<span class="badge ${badgeColors[value] || ''}">${label}</span>`;
        default:
            return value;
    }
}

function exportReport(format) {
    const reportType = document.getElementById('reportType')?.value || 'demo_garages';

    if (format === 'csv') {
        const endpointMap = {
            demo_garages: 'demo-garages',
            expired_demos: 'expired-demos',
            demo_conversions: 'demo-conversions',
            subscription_renewals: 'subscription-renewals',
            commission_revenue: 'commission-revenue',
            all_garages: 'all-garages',
            registrations: 'registrations'
        };
        const endpoint = endpointMap[reportType];
        const url = `${API_URL}/admin/reports/${endpoint}?format=csv&period=${currentReportPeriod}&limit=1000`;

        // Create temporary link and trigger download
        fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
                showToast('Report exported successfully', 'success');
            })
            .catch(err => {
                console.error('Export error:', err);
                showToast('Failed to export report', 'error');
            });
    }
}

function printReport() {
    const printContent = document.getElementById('printableReport');
    if (!printContent) {
        showToast('No report to print. Generate a report first.', 'error');
        return;
    }

    const reportType = document.getElementById('reportType')?.value || 'Report';
    const reportName = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QScrap Admin Report - ${reportName}</title>
            <style>
                body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; }
                h1 { font-size: 24px; margin-bottom: 8px; }
                .meta { color: #666; margin-bottom: 24px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #f8f9fa; font-weight: 600; }
                .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                .badge.success { background: #d1fae5; color: #059669; }
                .badge.warning { background: #fef3c7; color: #d97706; }
                .badge.danger { background: #fee2e2; color: #dc2626; }
                .badge.info { background: #dbeafe; color: #2563eb; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <h1>QScrap Admin Report: ${reportName}</h1>
            <p class="meta">Generated: ${new Date().toLocaleString()} | Period: ${currentReportPeriod}</p>
            ${printContent.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ============================================
// PREMIUM FEATURES
// ============================================

function initializePremiumFeatures() {
    // Start live datetime update
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Start auto-refresh every 30 seconds
    startAutoRefresh();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup activity tracking for session timeout
    setupActivityTracking();

    // Update greeting based on time of day
    updateGreeting();

    // Load notifications
    loadNotifications();

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-notifications')) {
            document.getElementById('notificationsDropdown')?.classList.remove('active');
        }
    });
}

// ============================================
// LIVE DATETIME
// ============================================

function updateDateTime() {
    const el = document.getElementById('liveDateTime');
    if (!el) return;

    const now = new Date();
    const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    el.textContent = now.toLocaleString('en-US', options);
}

function updateGreeting() {
    const el = document.getElementById('headerGreeting');
    if (!el) return;

    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 18) greeting = 'Good afternoon';

    el.textContent = `${greeting}, Admin`;
}

// ============================================
// AUTO REFRESH
// ============================================

function startAutoRefresh() {
    // Refresh dashboard every 30 seconds
    autoRefreshInterval = setInterval(() => {
        // Only refresh if on dashboard section and no modals open
        const dashboardVisible = document.getElementById('sectionDashboard')?.classList.contains('active');
        const anyModalOpen = document.querySelector('.modal-overlay.active');

        if (dashboardVisible && !anyModalOpen) {
            loadDashboard();
            loadNotifications();
        }
    }, 30000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Skip if typing in an input
        if (e.target.matches('input, textarea, select')) return;

        // Skip if modifier keys are pressed (except for ?)
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        const key = e.key.toLowerCase();

        // Section navigation with numbers
        const sections = ['dashboard', 'approvals', 'garages', 'users', 'staff', 'drivers', 'audit', 'reports'];
        const numKey = parseInt(key);
        if (numKey >= 1 && numKey <= 8) {
            e.preventDefault();
            switchSection(sections[numKey - 1]);
            return;
        }

        // Action shortcuts
        switch (key) {
            case 'n':
                e.preventDefault();
                openCreateUserModal();
                break;
            case 'r':
                e.preventDefault();
                refreshCurrentSection();
                break;
            case '?':
                e.preventDefault();
                showKeyboardShortcuts();
                break;
            case 'escape':
                closeAllModals();
                break;
        }
    });
}

function showKeyboardShortcuts() {
    document.getElementById('keyboardShortcutsModal')?.classList.add('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
    });
}

function refreshCurrentSection() {
    const icon = document.getElementById('refreshIcon');
    if (icon) {
        icon.classList.add('spinning');
        setTimeout(() => icon.classList.remove('spinning'), 800);
    }

    // Determine active section and refresh
    const activeSection = document.querySelector('.section.active');
    const sectionId = activeSection?.id || 'sectionDashboard';

    switch (sectionId) {
        case 'sectionDashboard': loadDashboard(); break;
        case 'sectionApprovals': loadPendingGarages(); break;
        case 'sectionGarages': loadGarages(); break;
        case 'sectionUsers': loadUsers(); break;
        case 'sectionStaff': loadStaff(); break;
        case 'sectionDrivers': loadDrivers(); break;
        case 'sectionAudit': loadAuditLog(); break;
        case 'sectionReports': loadReports(); break;
    }

    showToast('Data refreshed', 'success');
}

// ============================================
// NOTIFICATIONS
// ============================================

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown?.classList.toggle('active');
}

function markAllRead() {
    document.getElementById('notificationDot').style.display = 'none';
    const list = document.getElementById('notificationsList');
    list.innerHTML = `
        <div class="notification-empty">
            <i class="bi bi-bell-slash"></i>
            <span>No new notifications</span>
        </div>
    `;
    toggleNotifications();
}

async function loadNotifications() {
    try {
        // Get pending approvals and expiring demos
        const res = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const notifications = [];

        if (data.stats?.pending_approvals > 0) {
            notifications.push({
                type: 'warning',
                icon: 'bi-hourglass-split',
                title: `${data.stats.pending_approvals} pending approvals`,
                time: 'Review required',
                action: () => switchSection('approvals')
            });
        }

        if (data.stats?.expiring_soon > 0) {
            notifications.push({
                type: 'danger',
                icon: 'bi-exclamation-diamond',
                title: `${data.stats.expiring_soon} demos expiring soon`,
                time: 'Within 7 days',
                action: () => switchSection('approvals')
            });
        }

        if (data.stats?.open_disputes > 0) {
            notifications.push({
                type: 'danger',
                icon: 'bi-exclamation-triangle',
                title: `${data.stats.open_disputes} open disputes`,
                time: 'Needs attention',
                action: () => switchSection('audit')
            });
        }

        renderNotifications(notifications);
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function renderNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    const dot = document.getElementById('notificationDot');

    if (!list || !dot) return;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="bi bi-bell-slash"></i>
                <span>No new notifications</span>
            </div>
        `;
        dot.style.display = 'none';
    } else {
        list.innerHTML = notifications.map((n, i) => `
            <div class="notification-item" onclick="handleNotificationClick(${i})">
                <div class="icon ${n.type}">
                    <i class="bi ${n.icon}"></i>
                </div>
                <div class="content">
                    <div class="title">${n.title}</div>
                    <div class="time">${n.time}</div>
                </div>
            </div>
        `).join('');
        dot.style.display = 'block';

        // Store notification actions
        window._notificationActions = notifications.map(n => n.action);
    }
}

function handleNotificationClick(index) {
    const action = window._notificationActions?.[index];
    if (action) {
        toggleNotifications();
        action();
    }
}

// ============================================
// SESSION & ACTIVITY TRACKING
// ============================================

function setupActivityTracking() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, () => {
            lastActivityTime = Date.now();
        }, { passive: true });
    });

    // Check for inactivity every minute
    setInterval(checkInactivity, 60000);
}

function checkInactivity() {
    const inactiveMinutes = (Date.now() - lastActivityTime) / 60000;

    // Warn after 25 minutes of inactivity
    if (inactiveMinutes >= 25 && inactiveMinutes < 30) {
        showToast('Session will expire in 5 minutes due to inactivity', 'info');
    }

    // Auto-logout after 30 minutes
    if (inactiveMinutes >= 30) {
        showToast('Session expired due to inactivity', 'error');
        setTimeout(logout, 2000);
    }
}

// ============================================
// PLAN REQUESTS MANAGEMENT
// ============================================

async function loadPlanRequests() {
    const container = document.getElementById('planRequestsList');
    const status = document.getElementById('requestStatusFilter').value;

    container.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass"></i><p>Loading requests...</p></div>';

    try {
        // Pass status filter to backend
        const res = await fetch(`${API_URL}/admin/requests?status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const requests = data.requests || [];

        // Update badge if viewing pending
        if (status === 'pending') {
            const badge = document.getElementById('planRequestsBadge');
            if (badge) {
                badge.textContent = requests.length;
                badge.style.display = requests.length > 0 ? 'inline-flex' : 'none';
            }
        }

        if (requests.length > 0) {
            container.innerHTML = requests.map(renderRequestCard).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>No ${status} requests found</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('loadPlanRequests error:', err);
        container.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>Failed to load requests</p></div>';
    }
}

function renderRequestCard(req) {
    const isPending = req.status === 'pending';
    const typeLabel = req.request_type === 'upgrade' ? '<span class="badge success">Upgrade</span>' :
        req.request_type === 'downgrade' ? '<span class="badge warning">Downgrade</span>' :
            '<span class="badge info">Change</span>';

    return `
        <div class="garage-card request-card">
            <div class="garage-card-header">
                <div>
                    <h3>${req.garage_name || 'Unknown Garage'}</h3>
                    <div class="garage-meta">
                        <i class="bi bi-clock"></i> ${new Date(req.created_at).toLocaleDateString()}
                    </div>
                </div>
                ${typeLabel}
            </div>
            
            <div class="garage-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
                <div class="detail-item">
                    <label>Current Plan</label>
                    <div class="value">${req.from_plan_name || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>Requested Plan</label>
                    <div class="value" style="color: var(--primary-color); font-weight: bold;">
                        ${req.target_plan_name || req.to_plan_name || 'New Plan'} <i class="bi bi-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="detail-item full">
                <label>Reason</label>
                <div class="value">${req.request_reason || 'No reason provided'}</div>
            </div>

            ${req.admin_notes ? `
            <div class="detail-item full" style="margin-top: 10px; background: #f9fafb; padding: 8px; border-radius: 6px;">
                <label>Admin Notes</label>
                <div class="value small text-muted">${req.admin_notes}</div>
            </div>` : ''}

            <div class="garage-actions" style="margin-top: 20px;">
                ${isPending ? `
                <button class="btn btn-outline" onclick="rejectRequest('${req.request_id}')">Reject</button>
                <button class="btn btn-primary" onclick="approveRequest('${req.request_id}')">Approve</button>
                ` : `
                <div class="status-badge ${req.status}">${req.status.toUpperCase()}</div>
                `}
            </div>
        </div>
    `;
}

async function approveRequest(id) {
    if (!confirm('Are you sure you want to approve this plan change?')) return;

    try {
        const res = await fetch(`${API_URL}/admin/requests/${id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Request approved successfully', 'success');
            loadPlanRequests();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to approve', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function rejectRequest(id) {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return; // Cancelled

    try {
        const res = await fetch(`${API_URL}/admin/requests/${id}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        if (res.ok) {
            showToast('Request rejected', 'success');
            loadPlanRequests();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to reject', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// ============================================
// REAL-TIME WEBSOCKET UPDATES
// ============================================

let socket = null;

function initializeWebSocket() {
    if (typeof io === 'undefined') {
        console.warn('[WebSocket] Socket.IO not loaded');
        return;
    }

    try {
        socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('[WebSocket] Connected to server');
            // Join admin room for real-time updates
            socket.emit('join_admin_room');
            updateConnectionStatus(true);
        });

        socket.on('disconnect', () => {
            console.log('[WebSocket] Disconnected');
            updateConnectionStatus(false);
        });

        // Real-time stats update
        socket.on('admin_stats_update', (data) => {
            console.log('[WebSocket] Stats update received:', data);
            updateBadgesRealtime(data);
            showToast('📊 Dashboard updated', 'info');
        });

        // New garage registration - update pending count
        socket.on('new_garage_registration', (data) => {
            console.log('[WebSocket] New garage registration:', data);
            incrementBadge('pendingBadge');
            showToast(`🏪 New garage: ${data.garage_name || 'New registration'}`, 'info');

            // Refresh approvals section if currently viewing
            if (document.getElementById('sectionApprovals')?.classList.contains('active')) {
                loadPendingGarages();
            }
        });

        // New plan request - update plan requests count
        socket.on('new_plan_request', (data) => {
            console.log('[WebSocket] New plan request:', data);
            incrementBadge('planRequestsBadge');
            showToast(`📋 New plan request from ${data.garage_name || 'a garage'}`, 'info');

            // Refresh requests section if currently viewing
            if (document.getElementById('sectionRequests')?.classList.contains('active')) {
                loadPlanRequests();
            }
        });

        // Garage approved/rejected - update counts
        socket.on('garage_status_changed', (data) => {
            console.log('[WebSocket] Garage status changed:', data);
            // Refresh dashboard stats
            loadDashboard();
        });

        socket.on('connect_error', (err) => {
            console.warn('[WebSocket] Connection error:', err.message);
        });

    } catch (err) {
        console.error('[WebSocket] Initialization error:', err);
    }
}

function updateConnectionStatus(isOnline) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.header-status span:last-child');

    if (statusIndicator) {
        statusIndicator.classList.toggle('online', isOnline);
    }
    if (statusText) {
        statusText.textContent = isOnline ? 'Live' : 'Offline';
    }
}

function updateBadgesRealtime(data) {
    if (data.pending_approvals !== undefined) {
        updateBadge('pendingBadge', data.pending_approvals);
        animateStat('statPending', data.pending_approvals);
    }
    if (data.pending_plan_requests !== undefined) {
        updateBadge('planRequestsBadge', data.pending_plan_requests);
    }
    if (data.active_orders !== undefined) {
        animateStat('statActiveOrders', data.active_orders);
    }
    if (data.open_disputes !== undefined) {
        animateStat('statDisputes', data.open_disputes);
    }
}

function updateBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
        // Pulse animation on update
        badge.classList.add('pulse-update');
        setTimeout(() => badge.classList.remove('pulse-update'), 500);
    }
}

function incrementBadge(badgeId) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        const current = parseInt(badge.textContent) || 0;
        updateBadge(badgeId, current + 1);
    }
}

// Initialize WebSocket when app loads
if (token) {
    setTimeout(() => {
        initializeWebSocket();
    }, 500);
}

