// ============================================
// REPAIR GARAGE DASHBOARD JAVASCRIPT
// Motar - Repair Partner Portal
// ============================================

const API_URL = '/api';
let token = localStorage.getItem('repairGarageToken');

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

        // Allow garage users to access repair portal
        if (res.ok && (data.userType === 'garage' || data.userType === 'repair_garage')) {
            localStorage.setItem('repairGarageToken', data.token);
            localStorage.setItem('repairGarageName', data.garage_name || data.full_name || 'Repair Workshop');
            localStorage.setItem('repairUserName', data.full_name || 'User');
            localStorage.setItem('repairGarageId', data.garage_id || '');
            token = data.token;
            showApp();
        } else if (data.userType && data.userType !== 'garage' && data.userType !== 'repair_garage') {
            showToast('Access Denied: Repair garage credentials required', 'error');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
});

function logout() {
    localStorage.removeItem('repairGarageToken');
    localStorage.removeItem('repairGarageName');
    localStorage.removeItem('repairUserName');
    localStorage.removeItem('repairGarageId');
    token = null;
    window.location.reload();
}

function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';

    document.getElementById('garageName').textContent = localStorage.getItem('repairGarageName') || 'Repair Workshop';
    document.getElementById('userName').textContent = localStorage.getItem('repairUserName') || 'User';

    loadDashboard();
    loadInsuranceCompanies();
    loadMyClaims();
    setupSavingsCalculator();
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
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sectionId = 'section' + section.charAt(0).toUpperCase() + section.slice(1);
    document.getElementById(sectionId)?.classList.add('active');
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
    // Load stats - for now use mock data, will integrate with real endpoints
    document.getElementById('statPendingClaims').textContent = '0';
    document.getElementById('statApprovedClaims').textContent = '0';
    document.getElementById('statActiveOrders').textContent = '0';
    document.getElementById('statTotalSavings').textContent = '0 QAR';
}

// ============================================
// INSURANCE COMPANIES
// ============================================

async function loadInsuranceCompanies() {
    try {
        const res = await fetch(`${API_URL}/insurance/companies`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const select = document.getElementById('claimInsuranceCompany');
        if (data.companies && data.companies.length > 0) {
            select.innerHTML = '<option value="">Select insurance company...</option>' +
                data.companies.map(c => `<option value="${c.company_id}">${escapeHtml(c.name)}</option>`).join('');
        } else {
            // Default companies if API fails
            select.innerHTML = `
                <option value="">Select insurance company...</option>
                <option value="qic">Qatar Insurance Company (QIC)</option>
                <option value="doha">Doha Insurance</option>
                <option value="qgic">Qatar General Insurance</option>
                <option value="alkhaleej">Al Khaleej Insurance</option>
            `;
        }
    } catch (err) {
        console.error('Failed to load insurance companies:', err);
        // Fallback
        document.getElementById('claimInsuranceCompany').innerHTML = `
            <option value="">Select insurance company...</option>
            <option value="qic">Qatar Insurance Company (QIC)</option>
            <option value="doha">Doha Insurance</option>
            <option value="qgic">Qatar General Insurance</option>
        `;
    }
}

// ============================================
// SAVINGS CALCULATOR
// ============================================

function setupSavingsCalculator() {
    const agencyInput = document.getElementById('claimAgencyEstimate');
    const scrapyardInput = document.getElementById('claimScrapyardEstimate');

    [agencyInput, scrapyardInput].forEach(input => {
        input.addEventListener('input', updateSavingsPreview);
    });
}

function updateSavingsPreview() {
    const agency = parseFloat(document.getElementById('claimAgencyEstimate').value) || 0;
    const scrapyard = parseFloat(document.getElementById('claimScrapyardEstimate').value) || 0;
    const preview = document.getElementById('savingsPreview');

    if (agency > 0 && scrapyard > 0 && agency > scrapyard) {
        const savings = agency - scrapyard;
        const percent = Math.round((savings / agency) * 100);
        document.getElementById('savingsAmount').textContent = formatNumber(savings);
        document.getElementById('savingsPercent').textContent = percent;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

// ============================================
// SUBMIT INSURANCE CLAIM
// ============================================

document.getElementById('insuranceClaimForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        insurance_company_id: document.getElementById('claimInsuranceCompany').value,
        police_report_number: document.getElementById('claimPoliceReport').value,
        customer_name: document.getElementById('claimCustomerName').value,
        vin_number: document.getElementById('claimVin').value,
        vehicle_make: document.getElementById('claimVehicleMake').value,
        vehicle_model: document.getElementById('claimVehicleModel').value,
        vehicle_year: document.getElementById('claimVehicleYear').value,
        part_name: document.getElementById('claimPartName').value,
        damage_description: document.getElementById('claimDamageDescription').value,
        agency_estimate: parseFloat(document.getElementById('claimAgencyEstimate').value) || 0,
        scrapyard_estimate: parseFloat(document.getElementById('claimScrapyardEstimate').value) || 0
    };

    if (!formData.insurance_company_id || !formData.customer_name || !formData.part_name) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/insurance/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Claim ${data.claim_reference} submitted successfully!`, 'success');
            document.getElementById('insuranceClaimForm').reset();
            document.getElementById('savingsPreview').style.display = 'none';
            loadMyClaims();
            switchSection('myClaims');
        } else {
            showToast(data.error || 'Failed to submit claim', 'error');
        }
    } catch (err) {
        showToast('Connection error. Please try again.', 'error');
    }
});

// ============================================
// MY CLAIMS
// ============================================

async function loadMyClaims() {
    const table = document.getElementById('myClaimsTable');
    table.innerHTML = '<tr><td colspan="6" class="empty-state">Loading...</td></tr>';

    try {
        // Use garage's claims endpoint - repair garages submit claims
        const res = await fetch(`${API_URL}/insurance/claims`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.claims && data.claims.length > 0) {
            document.getElementById('claimsBadge').textContent = data.claims.length;

            table.innerHTML = data.claims.map(claim => `
                <tr>
                    <td><strong>${claim.claim_reference_number || claim.claim_id?.slice(0, 8) || 'N/A'}</strong></td>
                    <td>${escapeHtml(claim.customer_name || 'N/A')}</td>
                    <td>${escapeHtml(claim.vehicle_make || '')} ${escapeHtml(claim.vehicle_model || '')}</td>
                    <td>${escapeHtml(claim.part_name || 'N/A')}</td>
                    <td><span class="status-badge ${claim.approval_status || claim.status || 'pending'}">${formatStatus(claim.approval_status || claim.status)}</span></td>
                    <td>${claim.created_at ? new Date(claim.created_at).toLocaleDateString() : 'N/A'}</td>
                </tr>
            `).join('');
        } else {
            document.getElementById('claimsBadge').textContent = '0';
            table.innerHTML = '<tr><td colspan="6" class="empty-state">No claims submitted yet. Submit your first claim!</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load claims:', err);
        table.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load claims</td></tr>';
    }
}

// ============================================
// PARTS SEARCH
// ============================================

async function searchParts() {
    const partName = document.getElementById('searchPartName').value.trim();
    const make = document.getElementById('searchMake').value.trim();
    const container = document.getElementById('partsResults');

    if (!partName) {
        showToast('Please enter a part name', 'error');
        return;
    }

    container.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass"></i> Searching...</div>';

    try {
        const res = await fetch(`${API_URL}/insurance/parts-search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ part_name: partName, vehicle_make: make })
        });
        const data = await res.json();

        if (data.parts && data.parts.length > 0) {
            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                    ${data.parts.map(part => `
                        <div class="content-card" style="margin-bottom: 0;">
                            <h4 style="color: #fff; margin: 0 0 8px;">${escapeHtml(part.title || part.part_type || 'Part')}</h4>
                            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
                                ${escapeHtml(part.car_make || '')} ${escapeHtml(part.car_model || '')} • ${escapeHtml(part.condition || 'Used')}
                            </p>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="color: #10b981; font-size: 20px; font-weight: 700;">
                                    QAR ${formatNumber(part.price || 0)}
                                </div>
                                <span style="color: var(--text-muted); font-size: 12px;">${escapeHtml(part.garage_name || 'Scrapyard')}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container.innerHTML = '<div class="empty-state"><i class="bi bi-search"></i><p>No parts found matching your search</p></div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>Search failed</p></div>';
    }
}

// ============================================
// UTILITIES
// ============================================

function formatNumber(num) {
    return Number(num).toLocaleString();
}

function formatStatus(status) {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'}"></i> ${message}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease;
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
