# Operations Dashboard - Implementation Tasks
**Phase 1-3 Implementation Roadmap**

**Created:** 2026-02-25  
**Based on:** OPERATIONS-DASHBOARD-AUDIT-2026-02-25.md

---

## Phase 1: Critical Fixes (Week 1-2) - HIGH PRIORITY

### Task 1.1: ✅ Fix XSS Vulnerabilities [COMPLETED]
**File:** `/public/js/shared/utils.js`
**Status:** ✅ DONE - Added `sanitizeHTML()`, `safeHTML()`, `sanitizeInput()` utilities

**Next Steps:**
- [ ] Update all `innerHTML` assignments in `operations-dashboard.js` to use `safeHTML()` for user data
- [ ] Replace template literal interpolations with escaped values
- [ ] Audit other dashboards (admin, finance, support) for same issues

**Testing:**
```javascript
// Test vector: User enters "<script>alert('XSS')</script>" as part description
// Expected: Displayed as plain text, script not executed
```

---

### Task 1.2: Implement Bulk Operations for Orders
**Priority:** CRITICAL  
**Estimated Time:** 4-6 hours  
**Files to Modify:**
- `public/operations-dashboard.html` (add checkboxes + bulk action bar)
- `public/js/operations-dashboard.js` (add bulk selection logic)
- `src/controllers/operations.controller.ts` (add bulk update endpoint)
- `src/services/operations/order-management.service.ts` (add bulk method)

**Implementation Plan:**

#### Step 1: Add Checkbox Column to Orders Table
```html
<!-- operations-dashboard.html - Orders table thead -->
<thead>
    <tr>
        <th style="width: 40px;">
            <input type="checkbox" id="selectAllOrders" onchange="toggleSelectAllOrders()">
        </th>
        <th>Order #</th>
        <th>Customer</th>
        <!-- ... other columns ... -->
    </tr>
</thead>
```

#### Step 2: Add Checkbox to Each Row
```javascript
// In loadOrders() function
<tr class="${getRowClass(o)}">
    <td>
        <input type="checkbox" 
               class="order-checkbox" 
               data-order-id="${o.order_id}"
               data-order-status="${o.order_status}"
               onchange="updateBulkActionBar()">
    </td>
    <!-- ... rest of cells ... -->
</tr>
```

#### Step 3: Add Bulk Action Bar (Hidden by Default)
```html
<!-- Add below orders table -->
<div id="bulkActionBar" class="bulk-action-bar" style="display: none;">
    <div class="bulk-action-info">
        <span id="selectedCount">0</span> orders selected
    </div>
    <div class="bulk-action-buttons">
        <select id="bulkActionSelect" class="form-control">
            <option value="">Select action...</option>
            <option value="assign_driver">Assign Driver</option>
            <option value="mark_collected">Mark as Collected</option>
            <option value="mark_delivered">Mark as Delivered</option>
            <option value="export_selected">Export Selected</option>
        </select>
        <button class="btn btn-primary" onclick="executeBulkAction()">
            <i class="bi bi-play-circle"></i> Execute
        </button>
        <button class="btn btn-ghost" onclick="clearBulkSelection()">
            <i class="bi bi-x-circle"></i> Clear
        </button>
    </div>
</div>
```

#### Step 4: Implement JavaScript Logic
```javascript
// operations-dashboard.js

let selectedOrders = new Set();

function toggleSelectAllOrders() {
    const selectAll = document.getElementById('selectAllOrders');
    const checkboxes = document.querySelectorAll('.order-checkbox');
    
    if (selectAll.checked) {
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedOrders.add(cb.dataset.orderId);
        });
    } else {
        checkboxes.forEach(cb => {
            cb.checked = false;
            selectedOrders.delete(cb.dataset.orderId);
        });
    }
    updateBulkActionBar();
}

function updateBulkActionBar() {
    const actionBar = document.getElementById('bulkActionBar');
    const countLabel = document.getElementById('selectedCount');
    
    if (selectedOrders.size > 0) {
        actionBar.style.display = 'flex';
        countLabel.textContent = selectedOrders.size;
    } else {
        actionBar.style.display = 'none';
    }
}

function clearBulkSelection() {
    selectedOrders.clear();
    document.querySelectorAll('.order-checkbox, #selectAllOrders').forEach(cb => {
        cb.checked = false;
    });
    updateBulkActionBar();
}

async function executeBulkAction() {
    const action = document.getElementById('bulkActionSelect').value;
    if (!action || selectedOrders.size === 0) {
        showToast('Please select an action and orders', 'error');
        return;
    }
    
    const btn = document.querySelector('#bulkActionBar .btn-primary');
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
                order_ids: Array.from(selectedOrders),
                action: action
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast(`Bulk action completed: ${data.success_count}/${selectedOrders.size} successful`, 'success');
            clearBulkSelection();
            loadOrders();
            loadStats();
        } else {
            showToast(data.error || 'Bulk action failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-play-circle"></i> Execute';
    }
}
```

#### Step 5: Backend Endpoint
```typescript
// src/controllers/operations.controller.ts
export const bulkOrderAction = async (req: AuthRequest, res: Response) => {
    const { order_ids, action } = req.body;
    const staffId = getUserId(req);
    
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: 'order_ids array is required' });
    }
    
    if (!action) {
        return res.status(400).json({ error: 'action is required' });
    }
    
    try {
        const result = await orderService.bulkUpdateOrders(order_ids, action, staffId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// src/services/operations/order-management.service.ts
async bulkUpdateOrders(
    orderIds: string[],
    action: string,
    staffId: string
): Promise<{ success_count: number; failed_count: number; errors: any[] }> {
    const client = await this.pool.connect();
    let successCount = 0;
    const errors = [];
    
    try {
        await client.query('BEGIN');
        
        for (const orderId of orderIds) {
            try {
                // Get current order
                const orderResult = await client.query(
                    'SELECT order_status FROM orders WHERE order_id = $1',
                    [orderId]
                );
                
                if (orderResult.rows.length === 0) {
                    errors.push({ order_id: orderId, error: 'Order not found' });
                    continue;
                }
                
                const currentStatus = orderResult.rows[0].order_status;
                let newStatus: string | null = null;
                
                // Determine new status based on action
                switch (action) {
                    case 'assign_driver':
                        // Skip - requires driver_id parameter
                        errors.push({ order_id: orderId, error: 'Assign driver requires manual assignment' });
                        continue;
                    case 'mark_collected':
                        if (currentStatus === 'ready_for_pickup') {
                            newStatus = 'collected';
                        } else {
                            errors.push({ order_id: orderId, error: `Invalid status: ${currentStatus}` });
                            continue;
                        }
                        break;
                    case 'mark_delivered':
                        if (currentStatus === 'in_transit') {
                            newStatus = 'delivered';
                        } else {
                            errors.push({ order_id: orderId, error: `Invalid status: ${currentStatus}` });
                            continue;
                        }
                        break;
                }
                
                if (newStatus) {
                    await client.query(
                        `UPDATE orders SET order_status = $1, updated_at = NOW() 
                         WHERE order_id = $2`,
                        [newStatus, orderId]
                    );
                    
                    // Record in history
                    await client.query(
                        `INSERT INTO order_status_history 
                         (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                         VALUES ($1, $2, $3, $4, 'operations', 'Bulk update')`,
                        [orderId, currentStatus, newStatus, staffId]
                    );
                    
                    successCount++;
                }
            } catch (err) {
                errors.push({ order_id: orderId, error: getErrorMessage(err) });
            }
        }
        
        await client.query('COMMIT');
        
        return {
            success_count: successCount,
            failed_count: errors.length,
            errors
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
```

**CSS Styling:**
```css
/* operations-dashboard.css */
.bulk-action-bar {
    position: sticky;
    bottom: 0;
    background: var(--bg-secondary);
    border: 2px solid var(--accent);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
    z-index: 100;
    animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.bulk-action-info {
    font-weight: 600;
    font-size: 14px;
}

.bulk-action-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
}

#bulkActionSelect {
    min-width: 200px;
}
```

---

### Task 1.3: Add Stuck Order Detection
**Priority:** HIGH  
**Estimated Time:** 3-4 hours

**Implementation:**
Add automatic detection and highlighting of orders stuck in same status too long.

```javascript
// operations-dashboard.js - Add to loadOrders()

const STUCK_THRESHOLDS = {
    pending_payment: 30 * 60 * 1000,  // 30 minutes
    confirmed: 2 * 60 * 60 * 1000,    // 2 hours
    preparing: 4 * 60 * 60 * 1000,    // 4 hours
    ready_for_pickup: 2 * 60 * 60 * 1000, // 2 hours without driver
    in_transit: 4 * 60 * 60 * 1000    // 4 hours
};

function getRowClass(order) {
    const status = order.order_status;
    const now = new Date().getTime();
    const updatedAt = new Date(order.updated_at).getTime();
    const timeInStatus = now - updatedAt;
    
    // Check if stuck
    const threshold = STUCK_THRESHOLDS[status];
    if (threshold && timeInStatus > threshold) {
        if (status === 'pending_payment') return 'needs-attention-red';
        if (status === 'ready_for_pickup' && !order.driver_id) return 'needs-attention-red';
        return 'needs-attention-amber';
    }
    
    // Original logic
    switch (status) {
        case 'pending_payment': return 'needs-attention-red';
        case 'confirmed': return 'needs-attention-amber';
        case 'disputed': return 'needs-attention-red';
        case 'ready_for_pickup':
            return !order.driver_id ? 'needs-attention-green' : '';
        default: return '';
    }
}
```

**Add visual indicator:**
```html
<!-- Add to order row -->
<td>
    <span class="status-badge ${statusClass[o.order_status]}">
        ${statusLabels[o.order_status]}
    </span>
    ${isStuck ? '<i class="bi bi-exclamation-circle" style="color: #ef4444; margin-left: 4px;" title="Stuck order"></i>' : ''}
</td>
```

---

### Task 1.4: Improve Driver Assignment Context
**Priority:** HIGH  
**Estimated Time:** 4-5 hours

**Enhanced Driver Card:**
```javascript
// In openUnifiedAssignmentModal() - Enhanced driver cards

const driverCards = drivers.slice(0, 5).map((d, idx) => {
    const isFirst = idx === 0;
    const borderColor = isFirst ? '#22c55e' : 'var(--border-color)';
    const workload = d.active_assignments || 0;
    const rating = d.rating_average?.toFixed(1) || 'N/A';
    const onTimeRate = d.on_time_delivery_rate || 0;
    
    return `
        <div class="driver-card" onclick="document.getElementById('unifiedDriverSelect').value='${d.driver_id}'"
             style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 2px solid ${borderColor}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; ${isFirst ? 'background: rgba(34, 197, 94, 0.1);' : ''}"
             onmouseover="this.style.borderColor='#f59e0b'" onmouseout="this.style.borderColor='${borderColor}'">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                ${d.full_name.charAt(0)}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-primary);">
                    ${escapeHTML(d.full_name)} 
                    ${isFirst ? '<i class="bi bi-star-fill" style="color:#f59e0b"></i>' : ''}
                    ${d.shift_end_time ? `<span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">(Shift ends: ${d.shift_end_time})</span>` : ''}
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                    ${d.vehicle_type || 'Car'} • 
                    ${d.total_deliveries || 0} deliveries • 
                    <i class="bi bi-star-fill" style="color:#f59e0b;font-size:10px"></i> ${rating} •
                    On-time: ${onTimeRate}% •
                    ${workload} active
                </div>
                ${workload >= 3 ? '<div style="font-size: 11px; color: #f59e0b; margin-top: 4px;"><i class="bi bi-exclamation-triangle"></i> High workload</div>' : ''}
            </div>
            <div>
                ${getDistanceBadge(d.distance_km)}
            </div>
        </div>
    `;
}).join('');
```

---

### Task 1.5: Add Search History
**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours

```javascript
// operations-dashboard.js

const SEARCH_HISTORY_KEY = 'ops_search_history';
const MAX_SEARCH_HISTORY = 10;

function saveToSearchHistory(searchTerm) {
    if (!searchTerm.trim()) return;
    
    let history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    
    // Remove if already exists
    history = history.filter(item => item.term !== searchTerm);
    
    // Add to front
    history.unshift({
        term: searchTerm,
        timestamp: new Date().toISOString()
    });
    
    // Limit size
    if (history.length > MAX_SEARCH_HISTORY) {
        history = history.slice(0, MAX_SEARCH_HISTORY);
    }
    
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function getSearchHistory() {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
}

function showSearchHistory() {
    const history = getSearchHistory();
    const resultsDiv = document.getElementById('searchResults');
    
    if (history.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 12px; color: var(--text-muted);">No recent searches</div>';
        return;
    }
    
    resultsDiv.innerHTML = history.map(item => `
        <div class="search-result-item" onclick="selectSearchTerm('${escapeHTML(item.term)}')"
             style="padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <span><i class="bi bi-clock-history" style="margin-right: 8px;"></i>${escapeHTML(item.term)}</span>
            <span style="font-size: 11px; color: var(--text-muted);">${formatTimeAgo(item.timestamp)}</span>
        </div>
    `).join('');
    
    resultsDiv.style.display = 'block';
}

function selectSearchTerm(term) {
    document.getElementById('orderSearch').value = term;
    document.getElementById('searchResults').style.display = 'none';
    orderFilters.search = term;
    loadOrders(1);
}

function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    document.getElementById('searchResults').style.display = 'none';
    showToast('Search history cleared', 'info');
}

// Update debounceSearch to save history
function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        const searchTerm = document.getElementById('orderSearch').value.trim();
        orderFilters.search = searchTerm;
        saveToSearchHistory(searchTerm);
        loadOrders(1);
    }, 300);
}

// Show history when search input focused
document.getElementById('orderSearch')?.addEventListener('focus', showSearchHistory);

// Hide history when clicking outside
document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.search-box');
    if (searchContainer && !searchContainer.contains(e.target)) {
        document.getElementById('searchResults')?.style.display = 'none';
    }
});
```

---

### Task 1.6: Add 'Orders Needing Attention' Widget
**Priority:** HIGH  
**Estimated Time:** 3-4 hours

```html
<!-- operations-dashboard.html - Add to Overview section -->
<div class="content-card" style="margin-bottom: 20px; border-left: 4px solid #f59e0b;">
    <div class="content-header">
        <h3 class="content-title">
            <i class="bi bi-exclamation-triangle" style="color: #f59e0b;"></i>
            Requires Your Attention
        </h3>
        <span class="badge" id="attentionCount" style="background: #f59e0b; color: white;">0</span>
    </div>
    <div id="attentionWidgetContent">
        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
            <i class="bi bi-hourglass-split" style="font-size: 24px;"></i>
            <p>Loading...</p>
        </div>
    </div>
</div>
```

```javascript
// operations-dashboard.js

async function loadAttentionWidget() {
    try {
        const res = await fetch(`${API_URL}/operations/orders/requires-attention`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const items = data.orders || [];
        const container = document.getElementById('attentionWidgetContent');
        const countBadge = document.getElementById('attentionCount');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--success);">
                    <i class="bi bi-check-circle" style="font-size: 32px;"></i>
                    <p style="margin-top: 8px;">All caught up! No orders need attention.</p>
                </div>
            `;
            countBadge.style.display = 'none';
            return;
        }
        
        countBadge.textContent = items.length;
        countBadge.style.display = 'inline-block';
        
        container.innerHTML = `
            <div style="max-height: 300px; overflow-y: auto;">
                ${items.map(item => `
                    <div style="padding: 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; ${item.priority === 'urgent' ? 'background: rgba(239, 68, 68, 0.05);' : ''}">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 4px;">
                                <a href="#" onclick="viewOrder('${item.order_id}'); return false;" style="color: var(--accent);">
                                    #${item.order_number}
                                </a>
                                ${item.priority === 'urgent' ? '<span class="status-badge urgent" style="margin-left: 8px; font-size: 10px;">URGENT</span>' : ''}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                <i class="bi bi-info-circle"></i> ${item.reason}
                                <br>
                                <i class="bi bi-clock"></i> ${timeAgo(item.updated_at)} in current status
                            </div>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="viewOrder('${item.order_id}')">
                            Review
                        </button>
                    </div>
                `).join('')}
            </div>
            <div style="padding: 12px; border-top: 1px solid var(--border); text-align: center;">
                <button class="btn btn-ghost btn-sm" onclick="switchSection('orders')">
                    View All Orders <i class="bi bi-arrow-right"></i>
                </button>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load attention widget:', err);
    }
}

// Call in showDashboard()
await loadAttentionWidget();

// Auto-refresh every 2 minutes
setInterval(loadAttentionWidget, 2 * 60 * 1000);
```

**Backend Endpoint:**
```typescript
// src/controllers/operations.controller.ts
export const getRequiresAttention = async (req: AuthRequest, res: Response) => {
    try {
        const result = await orderService.getRequiresAttention();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// src/services/operations/order-management.service.ts
async getRequiresAttention(): Promise<{ orders: any[] }> {
    const now = new Date().toISOString();
    
    const result = await this.pool.query(`
        SELECT o.order_id, o.order_number, o.order_status, o.customer_id, o.garage_id,
               o.driver_id, o.created_at, o.updated_at,
               u.full_name as customer_name, g.garage_name,
               CASE
                   WHEN o.order_status = 'pending_payment' AND o.updated_at < NOW() - INTERVAL '30 minutes'
                       THEN 'Stuck in pending payment for >30 min'
                   WHEN o.order_status = 'ready_for_pickup' AND o.driver_id IS NULL AND o.updated_at < NOW() - INTERVAL '2 hours'
                       THEN 'Ready for pickup >2h without driver'
                   WHEN o.order_status = 'in_transit' AND o.updated_at < NOW() - INTERVAL '4 hours'
                       THEN 'In transit >4 hours'
                   WHEN o.order_status = 'disputed' AND o.updated_at < NOW() - INTERVAL '2 hours'
                       THEN 'Dispute pending >2 hours'
                   ELSE 'Requires review'
               END as reason,
               CASE
                   WHEN o.order_status = 'pending_payment' AND o.updated_at < NOW() - INTERVAL '30 minutes' THEN 'urgent'
                   WHEN o.order_status = 'ready_for_pickup' AND o.driver_id IS NULL THEN 'high'
                   ELSE 'normal'
               END as priority
        FROM orders o
        JOIN users u ON o.customer_id = u.user_id
        JOIN garages g ON o.garage_id = g.garage_id
        WHERE o.order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')
        AND (
            (o.order_status = 'pending_payment' AND o.updated_at < NOW() - INTERVAL '30 minutes')
            OR (o.order_status = 'ready_for_pickup' AND o.driver_id IS NULL AND o.updated_at < NOW() - INTERVAL '2 hours')
            OR (o.order_status = 'in_transit' AND o.updated_at < NOW() - INTERVAL '4 hours')
            OR (o.order_status = 'disputed' AND o.updated_at < NOW() - INTERVAL '2 hours')
        )
        ORDER BY
            CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
            o.updated_at ASC
        LIMIT 20
    `);
    
    return { orders: result.rows };
}
```

---

## Phase 2: High Priority (Week 3-4)

[Tasks 2.1-2.5 detailed implementation in next section...]

---

## Phase 3: Medium Priority (Month 2)

[Tasks 3.1-3.5 detailed implementation in next section...]

---

## Testing Checklist

### Security Testing
- [ ] XSS injection attempts in all input fields
- [ ] SQL injection attempts in search
- [ ] CSRF token validation
- [ ] Session timeout handling

### Performance Testing
- [ ] Load 1000+ orders (pagination works?)
- [ ] Multiple operators using simultaneously
- [ ] Socket reconnection after network loss
- [ ] Memory leaks (Chrome DevTools)

### UX Testing
- [ ] All features work on mobile/tablet
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Color contrast meets WCAG AA

### Edge Cases
- [ ] No internet connection
- [ ] API returns 500 error
- [ ] Socket.IO disconnected
- [ ] Token expires mid-session
- [ ] Browser back button during modal

---

## Deployment Checklist

- [ ] Run database migrations (if any)
- [ ] Update frontend assets (cache busting)
- [ ] Test on staging environment
- [ ] Backup production database
- [ ] Deploy during low-traffic period
- [ ] Monitor error logs for 24h
- [ ] Gather operator feedback

---

*End of Implementation Tasks Document*
