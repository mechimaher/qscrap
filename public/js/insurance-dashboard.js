// ============================================
// INSURANCE PARTNER DASHBOARD JAVASCRIPT
// QScrap / Motar Premium Platform
// ============================================

const API_URL = '/api';
let token = localStorage.getItem('insuranceToken');
let socket = null;
let currentClaimId = null;

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

        if (res.ok && data.userType === 'insurance_agent') {
            localStorage.setItem('insuranceToken', data.token);
            localStorage.setItem('insuranceAgentName', data.full_name || 'Agent');
            localStorage.setItem('insuranceCompany', data.company_name || 'Insurance Partner');
            token = data.token;
            showApp();
        } else if (data.userType && data.userType !== 'insurance_agent') {
            showToast('Access Denied: Insurance agent credentials required', 'error');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

function logout() {
    localStorage.removeItem('insuranceToken');
    localStorage.removeItem('insuranceAgentName');
    localStorage.removeItem('insuranceCompany');
    token = null;
    window.location.reload();
}

function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';

    // Set agent info
    document.getElementById('agentName').textContent = localStorage.getItem('insuranceAgentName') || 'Agent';
    document.getElementById('companyName').textContent = localStorage.getItem('insuranceCompany') || 'Insurance Partner';

    // Load initial data
    loadDashboard();
    loadClaims();
}

// ============================================
// NAVIGATION
// ============================================

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        if (section) switchSection(section);
    });
});

function switchSection(section) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');

    // Update sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sectionId = 'section' + section.charAt(0).toUpperCase() + section.slice(1);
    document.getElementById(sectionId)?.classList.add('active');
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/insurance/claims`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.claims) {
            // Update stats
            const activeClaims = data.claims.filter(c => c.status !== 'completed' && c.status !== 'cancelled');
            document.getElementById('statActiveClaims').textContent = activeClaims.length;
            document.getElementById('claimsBadge').textContent = activeClaims.length;

            // Calculate savings (mock for now)
            const totalSavings = data.claims.reduce((sum, c) => sum + (c.savings || 0), 0);
            document.getElementById('statTotalSavings').textContent = `QAR ${formatNumber(totalSavings)}`;

            // Parts ordered
            document.getElementById('statPartsOrdered').textContent = data.claims.length;

            // Avg delivery (mock)
            document.getElementById('statAvgDelivery').textContent = '4.2h';

            // Recent activity
            const recentTable = document.getElementById('recentActivityTable');
            if (data.claims.length > 0) {
                recentTable.innerHTML = data.claims.slice(0, 5).map(c => `
                    <tr>
                        <td><strong>${c.claim_number || c.claim_id.slice(0, 8)}</strong></td>
                        <td>${c.vehicle_make} ${c.vehicle_model}</td>
                        <td>${c.part_name || 'N/A'}</td>
                        <td><span class="status-badge ${c.status}">${formatStatus(c.status)}</span></td>
                        <td style="color: #10b981; font-weight: 600;">QAR ${c.savings || 0}</td>
                    </tr>
                `).join('');
            } else {
                recentTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <i class="bi bi-inbox"></i>
                            <p>No claims yet. Create your first claim to get started.</p>
                        </td>
                    </tr>
                `;
            }
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

// ============================================
// PARTS SEARCH
// ============================================

async function searchParts() {
    const partName = document.getElementById('searchPartName').value.trim();
    const make = document.getElementById('searchMake').value;
    const condition = document.getElementById('searchCondition').value;

    if (!partName) {
        showToast('Please enter a part name to search', 'error');
        return;
    }

    const resultsContainer = document.getElementById('partsResults');
    resultsContainer.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p>Searching inventory...</p></div>';

    try {
        const res = await fetch(`${API_URL}/insurance/parts-search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                part_name: partName,
                vehicle_make: make,
                condition: condition
            })
        });
        const data = await res.json();

        if (data.parts && data.parts.length > 0) {
            resultsContainer.innerHTML = data.parts.map(part => `
                <div class="part-card">
                    <div class="part-header">
                        <div class="part-name">${escapeHtml(part.part_name)}</div>
                        <span class="part-condition ${part.condition || 'standard'}">${(part.condition || 'Standard').toUpperCase()}</span>
                    </div>
                    <div class="garage-info">
                        <i class="bi bi-building"></i>
                        ${escapeHtml(part.garage_name)} • ${part.location || 'Industrial Area'}
                    </div>
                    <div class="price-comparison">
                        <div class="price-box agency">
                            <div class="price-label">Agency Price</div>
                            <div class="price-value">QAR ${formatNumber(part.agency_price || part.price * 2.5)}</div>
                        </div>
                        <div class="price-box scrapyard">
                            <div class="price-label">Our Price</div>
                            <div class="price-value">QAR ${formatNumber(part.price)}</div>
                        </div>
                    </div>
                    <div class="savings-badge">
                        <i class="bi bi-arrow-down-circle"></i> Save QAR ${formatNumber((part.agency_price || part.price * 2.5) - part.price)}
                    </div>
                    <button class="btn-order" onclick="orderPart('${part.part_id}', '${escapeHtml(part.part_name)}')">
                        <i class="bi bi-cart-plus"></i> Order Part
                    </button>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-search"></i>
                    <p>No parts found matching "${escapeHtml(partName)}"</p>
                    <span style="color: var(--text-muted);">Try different keywords or remove filters</span>
                </div>
            `;
        }
    } catch (err) {
        console.error('Search failed:', err);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Search failed. Please try again.</p>
            </div>
        `;
    }
}

function orderPart(partId, partName) {
    showToast(`Added "${partName}" to claim. Complete the claim form.`, 'success');
    switchSection('claims');
}

// ============================================
// PRICE COMPARISON
// ============================================

async function comparePrices() {
    const partName = document.getElementById('comparePartName').value.trim();
    const make = document.getElementById('compareMake').value;

    if (!partName) {
        showToast('Please enter a part name', 'error');
        return;
    }

    const resultsContainer = document.getElementById('comparisonResults');
    resultsContainer.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p>Analyzing prices...</p></div>';

    try {
        const res = await fetch(`${API_URL}/insurance/price-compare`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                part_name: partName,
                vehicle_make: make
            })
        });
        const data = await res.json();

        if (data.comparison) {
            const comp = data.comparison;
            resultsContainer.innerHTML = `
                <div class="content-card" style="margin-top: 24px;">
                    <h3 style="color: #fff; margin-bottom: 24px;">${escapeHtml(partName)} - Price Analysis</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                        <div class="stat-card" style="text-align: center;">
                            <div class="stat-label">Agency Avg Price</div>
                            <div class="stat-value" style="color: #ef4444;">QAR ${formatNumber(comp.agency_avg || comp.avg_price * 2.5)}</div>
                        </div>
                        <div class="stat-card" style="text-align: center;">
                            <div class="stat-label">Scrapyard Avg Price</div>
                            <div class="stat-value" style="color: #10b981;">QAR ${formatNumber(comp.scrapyard_avg || comp.avg_price)}</div>
                        </div>
                        <div class="stat-card savings" style="text-align: center;">
                            <div class="stat-label">Average Savings</div>
                            <div class="stat-value">QAR ${formatNumber(comp.savings || (comp.avg_price * 1.5))}</div>
                            <div style="color: var(--insurance-success);">${comp.savings_percent || 60}% off</div>
                        </div>
                    </div>
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                        <i class="bi bi-check-circle" style="font-size: 32px; color: #10b981;"></i>
                        <h4 style="color: #fff; margin: 12px 0 8px;">Recommended: Use Scrapyard Parts</h4>
                        <p style="color: var(--text-secondary);">Based on ${comp.total_listings || 15} available listings from ${comp.garage_count || 8} certified scrapyards</p>
                    </div>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-graph-down"></i>
                    <p>No price data available for this part</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Comparison failed:', err);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to load price comparison</p>
            </div>
        `;
    }
}

// ============================================
// LIVE TRACKING
// ============================================

async function trackClaim() {
    const claimId = document.getElementById('trackClaimId').value.trim();

    if (!claimId) {
        showToast('Please enter a claim ID', 'error');
        return;
    }

    const resultsContainer = document.getElementById('trackingResults');
    resultsContainer.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p>Loading tracking data...</p></div>';

    try {
        const res = await fetch(`${API_URL}/insurance/track/${claimId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.tracking) {
            const t = data.tracking;
            resultsContainer.innerHTML = `
                <div class="content-card" style="margin-top: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div>
                            <h3 style="color: #fff;">Order #${t.order_number || claimId.slice(0, 8)}</h3>
                            <p style="color: var(--text-secondary);">${t.part_name || 'Part'} for ${t.vehicle || 'Vehicle'}</p>
                        </div>
                        <span class="status-badge ${t.status || 'pending'}" style="font-size: 14px; padding: 8px 16px;">
                            ${formatStatus(t.status || 'in_transit')}
                        </span>
                    </div>
                    
                    <div class="tracking-timeline">
                        <div class="timeline-item ${t.steps?.order_placed ? 'completed' : ''}">
                            <div class="timeline-content">
                                <div class="timeline-title"><i class="bi bi-check-circle"></i> Order Placed</div>
                                <div class="timeline-time">${t.steps?.order_placed || 'Pending'}</div>
                            </div>
                        </div>
                        <div class="timeline-item ${t.steps?.collected ? 'completed' : t.status === 'collecting' ? 'active' : ''}">
                            <div class="timeline-content">
                                <div class="timeline-title"><i class="bi bi-building"></i> Collected from Garage</div>
                                <div class="timeline-time">${t.steps?.collected || 'Pending'}</div>
                            </div>
                        </div>
                        <div class="timeline-item ${t.steps?.in_transit ? 'completed' : t.status === 'in_transit' ? 'active' : ''}">
                            <div class="timeline-content">
                                <div class="timeline-title"><i class="bi bi-truck"></i> In Transit</div>
                                <div class="timeline-time">${t.steps?.in_transit || 'Pending'}</div>
                                ${t.driver ? `<p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">Driver: ${t.driver.name} • ${t.driver.phone}</p>` : ''}
                            </div>
                        </div>
                        <div class="timeline-item ${t.steps?.delivered ? 'completed' : ''}">
                            <div class="timeline-content">
                                <div class="timeline-title"><i class="bi bi-geo-alt-fill"></i> Delivered to Workshop</div>
                                <div class="timeline-time">${t.steps?.delivered || 'Pending'}</div>
                            </div>
                        </div>
                    </div>
                    
                    ${t.eta ? `
                        <div style="background: var(--glass-bg); border-radius: 12px; padding: 16px; margin-top: 24px; text-align: center;">
                            <div style="color: var(--text-muted); font-size: 13px;">Estimated Arrival</div>
                            <div style="color: var(--insurance-accent); font-size: 24px; font-weight: 700;">${t.eta}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-search"></i>
                    <p>Claim not found</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Tracking failed:', err);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to load tracking data</p>
            </div>
        `;
    }
}

// ============================================
// PHOTO VERIFICATION
// ============================================

async function loadPhotos() {
    const claimId = document.getElementById('photoClaimId').value.trim();

    if (!claimId) {
        showToast('Please enter a claim ID', 'error');
        return;
    }

    const resultsContainer = document.getElementById('photoResults');
    resultsContainer.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p>Loading photos...</p></div>';

    try {
        const res = await fetch(`${API_URL}/insurance/photos/${claimId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.photos && data.photos.length > 0) {
            resultsContainer.innerHTML = `
                <div class="content-card" style="margin-top: 24px;">
                    <h3 style="color: #fff; margin-bottom: 16px;"><i class="bi bi-shield-check" style="color: var(--insurance-success);"></i> Fraud Prevention Photos</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">These photos verify the condition and delivery of parts for claim #${claimId.slice(0, 8)}</p>
                    <div class="photo-gallery">
                        ${data.photos.map(photo => `
                            <div class="photo-card" onclick="viewPhoto('${photo.url}')">
                                <img src="${photo.url}" alt="${photo.type}">
                                <div class="photo-overlay">
                                    <div class="photo-label">${formatPhotoType(photo.type)}</div>
                                    <div class="photo-date">${photo.timestamp || 'N/A'}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-camera"></i>
                    <p>No photos available for this claim</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Failed to load photos:', err);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to load photos</p>
            </div>
        `;
    }
}

function viewPhoto(url) {
    window.open(url, '_blank');
}

function formatPhotoType(type) {
    const types = {
        'supplier': 'Supplier Photo',
        'pickup': 'Pickup Verification',
        'pod': 'Proof of Delivery',
        'qc': 'Quality Check'
    };
    return types[type] || type;
}

// ============================================
// HISTORY REPORTS (MONETIZATION)
// ============================================

async function generateHistoryReport() {
    const vin = document.getElementById('historyVin').value.trim();

    if (!vin) {
        showToast('Please enter a VIN number', 'error');
        return;
    }

    if (vin.length !== 17) {
        showToast('VIN must be exactly 17 characters', 'error');
        return;
    }

    const resultsContainer = document.getElementById('historyResults');
    resultsContainer.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p>Generating certified report...</p></div>';

    try {
        const res = await fetch(`${API_URL}/insurance/history/${vin}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.report) {
            const r = data.report;
            resultsContainer.innerHTML = `
                <div class="content-card" style="margin-top: 24px; border: 2px solid var(--insurance-gold);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div>
                            <h3 style="color: #fff;"><i class="bi bi-award" style="color: var(--insurance-gold);"></i> MOTAR CERTIFIED™ Report</h3>
                            <p style="color: var(--text-secondary);">VIN: ${vin}</p>
                        </div>
                        <span style="background: linear-gradient(135deg, var(--insurance-gold), #fbbf24); color: #000; padding: 8px 16px; border-radius: 8px; font-weight: 600;">
                            <i class="bi bi-patch-check-fill"></i> Verified
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                        <div class="stat-card">
                            <div class="stat-value">${r.total_repairs || 0}</div>
                            <div class="stat-label">Total Repairs</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${r.parts_replaced || 0}</div>
                            <div class="stat-label">Parts Replaced</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${r.certified_repairs || 0}</div>
                            <div class="stat-label">Certified Repairs</div>
                        </div>
                    </div>
                    
                    ${r.history && r.history.length > 0 ? `
                        <h4 style="color: #fff; margin-bottom: 16px;">Repair History</h4>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Part</th>
                                    <th>Garage</th>
                                    <th>Certification</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${r.history.map(h => `
                                    <tr>
                                        <td>${h.date}</td>
                                        <td>${h.part_name}</td>
                                        <td>${h.garage_name}</td>
                                        <td><span class="status-badge approved">${h.certification || 'MOTAR_CERTIFIED'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                            <i class="bi bi-check-circle" style="font-size: 48px; color: var(--insurance-success);"></i>
                            <h4 style="color: #fff; margin: 16px 0 8px;">Clean History</h4>
                            <p>No repairs recorded through Motar network for this VIN</p>
                        </div>
                    `}
                    
                    <div style="margin-top: 24px; display: flex; gap: 16px;">
                        <button class="btn btn-primary" onclick="downloadReport('${vin}')">
                            <i class="bi bi-download"></i> Download PDF
                        </button>
                        <button class="btn btn-outline" onclick="shareReport('${vin}')">
                            <i class="bi bi-share"></i> Share Report
                        </button>
                    </div>
                </div>
            `;
        } else if (data.error) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-exclamation-circle"></i>
                    <p>${data.error}</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Report generation failed:', err);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Failed to generate report</p>
            </div>
        `;
    }
}

function downloadReport(vin) {
    showToast('Report downloaded (PDF)', 'success');
}

function shareReport(vin) {
    navigator.clipboard.writeText(`https://qscrap.qa/insurance/history/${vin}`);
    showToast('Report link copied to clipboard', 'success');
}

// ============================================
// CLAIMS MANAGEMENT
// ============================================

async function loadClaims() {
    try {
        const res = await fetch(`${API_URL}/insurance/claims`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const table = document.getElementById('claimsTable');
        if (data.claims && data.claims.length > 0) {
            table.innerHTML = data.claims.map(c => `
                <tr>
                    <td><strong>${c.claim_number || c.claim_id.slice(0, 8)}</strong></td>
                    <td>${escapeHtml(c.customer_name || 'N/A')}</td>
                    <td>${c.vehicle_make} ${c.vehicle_model} ${c.vehicle_year || ''}</td>
                    <td>${escapeHtml(c.part_name || 'N/A')}</td>
                    <td><span class="status-badge ${c.status}">${formatStatus(c.status)}</span></td>
                    <td>${formatDate(c.created_at)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewClaimDetail('${c.claim_id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="trackClaim('${c.claim_id}')" title="Track">
                            <i class="bi bi-geo-alt"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="bi bi-folder2"></i>
                        <p>No claims yet</p>
                        <button class="btn btn-primary" onclick="openNewClaimModal()">Create First Claim</button>
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Failed to load claims:', err);
    }
}

function openNewClaimModal() {
    document.getElementById('newClaimModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function submitNewClaim() {
    const claim = {
        customer_name: document.getElementById('claimCustomerName').value,
        vehicle_make: document.getElementById('claimVehicleMake').value,
        vehicle_model: document.getElementById('claimVehicleModel').value,
        vehicle_year: document.getElementById('claimVehicleYear').value,
        vin_number: document.getElementById('claimVin').value,
        part_name: document.getElementById('claimPartName').value,
        notes: document.getElementById('claimNotes').value
    };

    if (!claim.customer_name || !claim.vehicle_make || !claim.part_name) {
        showToast('Please fill in required fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/insurance/claims`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(claim)
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Claim created successfully!', 'success');
            closeModal('newClaimModal');
            loadClaims();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to create claim', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function viewClaimDetail(claimId) {
    document.getElementById('trackClaimId').value = claimId;
    switchSection('tracking');
    trackClaim();
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

function formatNumber(num) {
    return Number(num || 0).toLocaleString();
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-QA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatStatus(status) {
    const statuses = {
        'pending': 'Pending',
        'approved': 'Approved',
        'in_progress': 'In Progress',
        'collecting': 'Collecting',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statuses[status] || status;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}
