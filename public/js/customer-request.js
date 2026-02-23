/**
 * QScrap Customer Web Request — JavaScript
 * 
 * Handles: Auth (login + email-OTP signup), Request creation,
 * My Requests listing, bilingual support (EN/AR).
 *
 * API contract aligned 100% with:
 *   POST /api/auth/login                → { phone_number, password }
 *   POST /api/auth/register-with-email  → { full_name, email, phone_number, password }
 *   POST /api/auth/verify-email-otp     → { full_name, email, phone_number, password, otp }
 *   POST /api/auth/resend-otp           → { email, full_name }
 *   POST /api/requests (multipart)      → car_make, car_model, car_year, vin_number?,
 *                                         part_description, part_category?, part_subcategory?,
 *                                         part_number?, condition_required, delivery_address_text?,
 *                                         images[]?, car_front_image?, car_rear_image?
 *   GET  /api/requests/my               → paginated list
 */

'use strict';

(function () {

    // ─── Config ────────────────────────────────────────────────────────────────
    const API = '/api';

    // ─── Part Categories (mirrors mobile categoryData.ts) ─────────────────────
    const PART_CATEGORIES = [
        'Engine & Components', 'Transmission & Drivetrain', 'Turbo & Supercharger',
        'Fuel System', 'Exhaust & Emission System', 'Cooling System',
        'Suspension & Steering', 'Brakes & ABS', 'Wheels & Tires', 'Axles & Differential',
        'Body Panels & Bumpers', 'Doors & Fenders', 'Glass & Windows', 'Lights & Lamps',
        'Grilles & Trim', 'Mirrors & Accessories', 'Seats & Upholstery',
        'Dashboard & Instruments', 'Center Console & Storage', 'Interior Trim & Carpet',
        'Climate Control (HVAC)', 'Battery & Charging', 'Alternator & Starter',
        'Wiring & Fuses', 'Audio & Infotainment', 'Navigation & Display', 'Lighting Control',
        'Airbags & SRS', 'Seatbelts & Restraints', 'Anti-theft & Security',
        'Cameras & Sensors', 'Radar & Lidar Systems', 'Parking Assist',
        'Adaptive Cruise Control', 'Lane Keep Assist', 'EV Battery Packs', 'Electric Motors',
        'Inverters & Converters', 'Charging Components', 'Hybrid Systems',
        'Roof Racks & Carriers', 'Towing & Hitches', 'Performance Parts', 'Off-Road & 4x4', 'Other Parts'
    ];

    const PART_SUBCATEGORIES = {
        'Engine & Components': ['Complete Engine Assembly', 'Cylinder Head', 'Engine Block (Short/Long)', 'Crankshaft', 'Camshaft', 'Pistons & Rings', 'Connecting Rods', 'Timing Chain/Belt', 'Valve Cover', 'Oil Pan', 'Intake Manifold', 'Exhaust Manifold', 'Engine Mount', 'Flywheel', 'Harmonic Balancer', 'Oil Pump', 'Water Pump'],
        'Transmission & Drivetrain': ['Automatic Transmission', 'Manual Transmission', 'CVT Transmission', 'Dual-Clutch Transmission (DCT)', 'Transmission Control Module (TCM)', 'Torque Converter', 'Clutch Kit', 'Pressure Plate', 'Release Bearing', 'Driveshaft', 'CV Axle', 'Transfer Case', 'Propeller Shaft', 'Universal Joint', 'Shift Cable'],
        'Turbo & Supercharger': ['Turbocharger Assembly', 'Supercharger', 'Intercooler', 'Wastegate', 'Blow-off Valve', 'Boost Controller', 'Turbo Manifold', 'Downpipe'],
        'Fuel System': ['Fuel Pump', 'Fuel Injector', 'Fuel Tank', 'Fuel Rail', 'Fuel Pressure Regulator', 'Throttle Body', 'Fuel Filter', 'Fuel Cap', 'Fuel Filler Neck', 'Fuel Lines', 'Gas Pedal'],
        'Exhaust & Emission System': ['Catalytic Converter', 'Muffler', 'Resonator', 'Exhaust Pipe', 'Header/Manifold', 'EGR Valve', 'DPF (Diesel Particle Filter)', 'SCR System (Urea)', 'Exhaust Flange', 'Tail Pipe'],
        'Cooling System': ['Radiator', 'Water Pump', 'Thermostat', 'Radiator Fan', 'Cooling Fan Motor', 'Radiator Hose', 'Overflow Tank', 'Radiator Cap', 'Temperature Sensor'],
        'Suspension & Steering': ['Shock Absorber', 'Strut Assembly', 'Coil Spring', 'Leaf Spring', 'Control Arm (Upper/Lower)', 'Ball Joint', 'Tie Rod End', 'Steering Rack', 'Power Steering Pump', 'Steering Column', 'Steering Wheel', 'Sway Bar', 'Sway Bar Link', 'Wheel Hub Assembly', 'Wheel Bearing'],
        'Brakes & ABS': ['ABS Module', 'ABS Pump', 'Brake Caliper', 'Brake Rotor/Disc', 'Brake Pad', 'Brake Drum', 'Brake Shoe', 'Master Cylinder', 'Brake Booster', 'Brake Line', 'Wheel Speed Sensor'],
        'Wheels & Tires': ['Alloy Wheel', 'Steel Wheel', 'Tire (New)', 'Tire (Used)', 'Spare Tire', 'TPMS Sensor', 'Wheel Center Cap', 'Lug Nuts'],
        'Lights & Lamps': ['Headlight Assembly', 'LED Headlight', 'Taillight Assembly', 'Fog Light', 'Turn Signal Light', 'DRL', 'License Plate Light'],
        'Climate Control (HVAC)': ['A/C Compressor', 'Condenser', 'Evaporator Core', 'Heater Core', 'Blower Motor', 'HVAC Control Panel', 'Expansion Valve', 'Receiver Drier', 'Cabin Air Filter'],
        'Airbags & SRS': ['Driver Airbag', 'Passenger Airbag', 'Side Airbag', 'Curtain Airbag', 'SRS Control Module', 'Airbag Clockspring'],
        'Cameras & Sensors': ['Backup Camera', 'Front Camera', '360° Camera System', 'Parking Sensor', 'Rain Sensor', 'Light Sensor'],
    };

    // ─── State ─────────────────────────────────────────────────────────────────
    let state = {
        token: null,
        userId: null,
        userName: null,
        userEmail: null,
        userPhone: null,
        // Auth form
        authTab: 'login',   // 'login' | 'register' | 'otp'
        regTemp: {},        // temp storage for otp step
        otpTimer: null,
        otpCountdown: 0,
        // Request form
        activeView: 'new',  // 'new' | 'requests'
        condition: 'any',
        quantity: 1,
        images: [],         // File[]
        // My Requests
        myRequests: [],
        requestsLoading: false,
    };

    // ─── DOM refs ──────────────────────────────────────────────────────────────
    let dom = {};

    // ─── Init ──────────────────────────────────────────────────────────────────
    function init() {
        // Restore session
        const stored = localStorage.getItem('crq_auth');
        if (stored) {
            try {
                const s = JSON.parse(stored);
                if (s.token && s.userId) {
                    Object.assign(state, s);
                }
            } catch (_) { }
        }

        bindDOM();
        renderAuthOrApp();
        populateCategories();
    }

    function bindDOM() {
        dom = {
            authWrap: q('#crqAuthWrap'),
            appWrap: q('#crqApp'),
            // Auth
            tabLogin: q('#crqTabLogin'),
            tabRegister: q('#crqTabRegister'),
            formLogin: q('#crqFormLogin'),
            formRegister: q('#crqFormRegister'),
            formOtp: q('#crqFormOtp'),
            alertLogin: q('#crqAlertLogin'),
            alertRegister: q('#crqAlertRegister'),
            alertOtp: q('#crqAlertOtp'),
            // Login fields
            inpLoginPhone: q('#crqLoginPhone'),
            inpLoginPwd: q('#crqLoginPwd'),
            btnLogin: q('#crqBtnLogin'),
            // Register fields
            inpRegName: q('#crqRegName'),
            inpRegEmail: q('#crqRegEmail'),
            inpRegPhone: q('#crqRegPhone'),
            inpRegPwd: q('#crqRegPwd'),
            btnRegister: q('#crqBtnRegister'),
            // OTP
            otpEmailDisplay: q('#crqOtpEmail'),
            inpOtp: q('#crqOtpCode'),
            btnVerifyOtp: q('#crqBtnVerifyOtp'),
            btnResendOtp: q('#crqBtnResendOtp'),
            otpTimerDisplay: q('#crqOtpTimer'),
            // App header
            userChipName: q('#crqUserName'),
            btnLogout: q('#crqBtnLogout'),
            // View tabs
            viewTabNew: q('#crqViewTabNew'),
            viewTabRequests: q('#crqViewTabRequests'),
            // Views
            viewNew: q('#crqViewNew'),
            viewRequests: q('#crqViewRequests'),
            // Request form
            inpCarMake: q('#crqCarMake'),
            inpCarModel: q('#crqCarModel'),
            inpCarYear: q('#crqCarYear'),
            inpVin: q('#crqVin'),
            selCategory: q('#crqCategory'),
            selSubcategory: q('#crqSubcategory'),
            subGroup: q('#crqSubcategoryGroup'),
            inpDesc: q('#crqDesc'),
            descCount: q('#crqDescCount'),
            inpPartNum: q('#crqPartNum'),
            condAny: q('#crqCondAny'),
            condNew: q('#crqCondNew'),
            condUsed: q('#crqCondUsed'),
            qtyMinus: q('#crqQtyMinus'),
            qtyPlus: q('#crqQtyPlus'),
            qtyVal: q('#crqQtyVal'),
            inpAddress: q('#crqAddress'),
            photoInput: q('#crqPhotoInput'),
            photoGrid: q('#crqPhotoGrid'),
            photoZone: q('#crqPhotoZone'),
            photoCount: q('#crqPhotoCount'),
            btnSubmit: q('#crqBtnSubmit'),
            formAlert: q('#crqFormAlert'),
            // Success
            successScreen: q('#crqSuccess'),
            btnNewAfterSuccess: q('#crqBtnNewAfterSuccess'),
            btnViewAfterSuccess: q('#crqBtnViewAfterSuccess'),
            // Requests list
            requestsList: q('#crqRequestsList'),
            // App nudge
            appNudge: q('#crqAppNudge'),
            btnDismissNudge: q('#crqBtnDismissNudge'),
        };
    }

    // ─── helpers ───────────────────────────────────────────────────────────────
    function q(sel) { return document.querySelector(sel); }

    function setLoading(btn, loading, label) {
        if (!btn) return;
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="crq-spin-icon"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Please wait…'
            : label;
    }

    function showAlert(el, type, msg) {
        if (!el) return;
        el.className = 'crq-alert ' + type;
        el.textContent = msg;
        el.style.display = 'block';
    }

    function hideAlert(el) {
        if (!el) return;
        el.style.display = 'none';
        el.textContent = '';
    }

    function toast(type, msg) {
        const wrap = q('#crqToastWrap');
        if (!wrap) return;
        const t = document.createElement('div');
        t.className = 'crq-toast ' + type;
        t.textContent = msg;
        wrap.appendChild(t);
        setTimeout(() => t.remove(), 4500);
    }

    function saveSession() {
        localStorage.setItem('crq_auth', JSON.stringify({
            token: state.token,
            userId: state.userId,
            userName: state.userName,
            userEmail: state.userEmail,
            userPhone: state.userPhone,
        }));
    }

    function clearSession() {
        localStorage.removeItem('crq_auth');
        state.token = null;
        state.userId = null;
        state.userName = null;
        state.userEmail = null;
        state.userPhone = null;
    }

    async function apiFetch(path, opts = {}) {
        const headers = { ...(opts.headers || {}) };
        if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
        const isFormData = opts.body instanceof FormData;
        if (!isFormData) headers['Content-Type'] = 'application/json';

        const res = await fetch(API + path, {
            ...opts,
            headers,
            body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
        return data;
    }

    // ─── Render auth vs app ────────────────────────────────────────────────────
    function renderAuthOrApp() {
        if (state.token && state.userId) {
            dom.authWrap.style.display = 'none';
            dom.appWrap.classList.add('visible');
            if (dom.userChipName) dom.userChipName.textContent = state.userName || 'Customer';
            bindAppEvents();
            // Show nudge once
            if (!localStorage.getItem('crq_nudge_dismissed') && dom.appNudge) {
                dom.appNudge.style.display = 'flex';
            }
        } else {
            dom.authWrap.style.display = 'flex';
            dom.appWrap.classList.remove('visible');
            bindAuthEvents();
            switchAuthTab('login');
        }
    }

    // ─── Auth events ───────────────────────────────────────────────────────────
    function bindAuthEvents() {
        if (dom.tabLogin) dom.tabLogin.addEventListener('click', () => switchAuthTab('login'));
        if (dom.tabRegister) dom.tabRegister.addEventListener('click', () => switchAuthTab('register'));

        if (dom.btnLogin) dom.btnLogin.addEventListener('click', handleLogin);
        if (dom.btnRegister) dom.btnRegister.addEventListener('click', handleRegister);
        if (dom.btnVerifyOtp) dom.btnVerifyOtp.addEventListener('click', handleVerifyOtp);
        if (dom.btnResendOtp) dom.btnResendOtp.addEventListener('click', handleResendOtp);
    }

    function switchAuthTab(tab) {
        state.authTab = tab;
        const isLogin = tab === 'login';
        if (dom.tabLogin) dom.tabLogin.classList.toggle('active', isLogin);
        if (dom.tabRegister) dom.tabRegister.classList.toggle('active', !isLogin && tab !== 'otp');
        if (dom.formLogin) dom.formLogin.style.display = tab === 'login' ? 'block' : 'none';
        if (dom.formRegister) dom.formRegister.style.display = tab === 'register' ? 'block' : 'none';
        if (dom.formOtp) dom.formOtp.style.display = tab === 'otp' ? 'block' : 'none';
        hideAlert(dom.alertLogin);
        hideAlert(dom.alertRegister);
        hideAlert(dom.alertOtp);
    }

    async function handleLogin() {
        hideAlert(dom.alertLogin);
        const phone = dom.inpLoginPhone?.value.trim();
        const pwd = dom.inpLoginPwd?.value;
        if (!phone || !pwd) {
            showAlert(dom.alertLogin, 'error', 'Phone number and password are required.');
            return;
        }
        setLoading(dom.btnLogin, true, '');
        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: { phone_number: phone, password: pwd }
            });
            if (data.userType && data.userType !== 'customer') {
                showAlert(dom.alertLogin, 'error', 'This portal is for customers only. Garages use the garage dashboard.');
                return;
            }
            state.token = data.token;
            state.userId = data.userId;
            state.userName = data.full_name || data.name || '';
            state.userPhone = phone;
            saveSession();
            renderAuthOrApp();
        } catch (err) {
            showAlert(dom.alertLogin, 'error', err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(dom.btnLogin, false, 'Sign In →');
        }
    }

    async function handleRegister() {
        hideAlert(dom.alertRegister);
        const full_name = dom.inpRegName?.value.trim();
        const email = dom.inpRegEmail?.value.trim().toLowerCase();
        const phone_number = dom.inpRegPhone?.value.trim();
        const password = dom.inpRegPwd?.value;

        if (!full_name || !email || !phone_number || !password) {
            showAlert(dom.alertRegister, 'error', 'All fields are required.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert(dom.alertRegister, 'error', 'Please enter a valid email address.');
            return;
        }
        if (password.length < 6) {
            showAlert(dom.alertRegister, 'error', 'Password must be at least 6 characters.');
            return;
        }

        setLoading(dom.btnRegister, true, '');
        try {
            await apiFetch('/auth/register-with-email', {
                method: 'POST',
                body: { full_name, email, phone_number, password }
            });
            // Store for OTP step
            state.regTemp = { full_name, email, phone_number, password };
            if (dom.otpEmailDisplay) dom.otpEmailDisplay.textContent = email;
            switchAuthTab('otp');
            startOtpTimer(120);
        } catch (err) {
            showAlert(dom.alertRegister, 'error', err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(dom.btnRegister, false, 'Create Account →');
        }
    }

    async function handleVerifyOtp() {
        hideAlert(dom.alertOtp);
        const otp = dom.inpOtp?.value.trim();
        if (!otp || otp.length < 4) {
            showAlert(dom.alertOtp, 'error', 'Please enter the 6-digit verification code.');
            return;
        }
        const { full_name, email, phone_number, password } = state.regTemp;
        setLoading(dom.btnVerifyOtp, true, '');
        try {
            const data = await apiFetch('/auth/verify-email-otp', {
                method: 'POST',
                body: { full_name, email, phone_number, password, otp }
            });
            clearOtpTimer();
            state.token = data.token;
            state.userId = data.userId;
            state.userName = full_name;
            state.userEmail = email;
            state.userPhone = phone_number;
            state.regTemp = {};
            saveSession();
            renderAuthOrApp();
        } catch (err) {
            showAlert(dom.alertOtp, 'error', err.message || 'Invalid code. Please try again.');
        } finally {
            setLoading(dom.btnVerifyOtp, false, 'Verify & Create Account →');
        }
    }

    async function handleResendOtp() {
        const { email, full_name } = state.regTemp;
        if (!email) return;
        hideAlert(dom.alertOtp);
        dom.btnResendOtp.disabled = true;
        try {
            await apiFetch('/auth/resend-otp', { method: 'POST', body: { email, full_name } });
            showAlert(dom.alertOtp, 'success', 'Verification code resent. Check your email.');
            startOtpTimer(120);
        } catch (err) {
            showAlert(dom.alertOtp, 'error', err.message || 'Could not resend. Please wait and try again.');
            dom.btnResendOtp.disabled = false;
        }
    }

    function startOtpTimer(seconds) {
        clearOtpTimer();
        state.otpCountdown = seconds;
        dom.btnResendOtp.disabled = true;
        if (dom.otpTimerDisplay) dom.otpTimerDisplay.textContent = `(${seconds}s)`;
        state.otpTimer = setInterval(() => {
            state.otpCountdown--;
            if (dom.otpTimerDisplay) dom.otpTimerDisplay.textContent = state.otpCountdown > 0 ? `(${state.otpCountdown}s)` : '';
            if (state.otpCountdown <= 0) {
                clearOtpTimer();
                if (dom.btnResendOtp) dom.btnResendOtp.disabled = false;
            }
        }, 1000);
    }

    function clearOtpTimer() {
        if (state.otpTimer) { clearInterval(state.otpTimer); state.otpTimer = null; }
    }

    // ─── App events ────────────────────────────────────────────────────────────
    function bindAppEvents() {
        // Logout
        if (dom.btnLogout) dom.btnLogout.addEventListener('click', () => {
            clearSession();
            location.reload();
        });

        // View tabs
        if (dom.viewTabNew) dom.viewTabNew.addEventListener('click', () => switchView('new'));
        if (dom.viewTabRequests) dom.viewTabRequests.addEventListener('click', () => switchView('requests'));

        // Category → subcategory cascade
        if (dom.selCategory) dom.selCategory.addEventListener('change', onCategoryChange);

        // Condition pills
        [dom.condAny, dom.condNew, dom.condUsed].forEach(el => {
            if (el) el.addEventListener('click', () => setCondition(el.dataset.value));
        });

        // Quantity stepper
        if (dom.qtyMinus) dom.qtyMinus.addEventListener('click', () => setQty(state.quantity - 1));
        if (dom.qtyPlus) dom.qtyPlus.addEventListener('click', () => setQty(state.quantity + 1));

        // Char counter
        if (dom.inpDesc) dom.inpDesc.addEventListener('input', () => {
            const len = dom.inpDesc.value.length;
            if (dom.descCount) dom.descCount.textContent = len + '/1000';
            if (len > 1000) dom.inpDesc.value = dom.inpDesc.value.slice(0, 1000);
        });

        // Photo upload
        if (dom.photoInput) dom.photoInput.addEventListener('change', onPhotoSelect);
        if (dom.photoZone) {
            dom.photoZone.addEventListener('dragover', e => { e.preventDefault(); dom.photoZone.classList.add('drag-over'); });
            dom.photoZone.addEventListener('dragleave', () => dom.photoZone.classList.remove('drag-over'));
            dom.photoZone.addEventListener('drop', e => {
                e.preventDefault();
                dom.photoZone.classList.remove('drag-over');
                addPhotos([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
            });
        }

        // Submit
        if (dom.btnSubmit) dom.btnSubmit.addEventListener('click', handleSubmit);

        // Success actions
        if (dom.btnNewAfterSuccess) dom.btnNewAfterSuccess.addEventListener('click', resetForm);
        if (dom.btnViewAfterSuccess) dom.btnViewAfterSuccess.addEventListener('click', () => { resetForm(); switchView('requests'); });

        // App nudge dismiss
        if (dom.btnDismissNudge) dom.btnDismissNudge.addEventListener('click', () => {
            if (dom.appNudge) dom.appNudge.style.display = 'none';
            localStorage.setItem('crq_nudge_dismissed', '1');
        });
    }

    function switchView(view) {
        state.activeView = view;
        const isNew = view === 'new';
        if (dom.viewTabNew) dom.viewTabNew.classList.toggle('active', isNew);
        if (dom.viewTabRequests) dom.viewTabRequests.classList.toggle('active', !isNew);
        if (dom.viewNew) dom.viewNew.style.display = isNew ? 'block' : 'none';
        if (dom.viewRequests) dom.viewRequests.style.display = isNew ? 'none' : 'block';
        if (!isNew && !state.requestsLoading) loadMyRequests();
    }

    // ─── Form logic ────────────────────────────────────────────────────────────
    function populateCategories() {
        if (!dom.selCategory) return;
        dom.selCategory.innerHTML = '<option value="">— Select category (optional) —</option>';
        PART_CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = cat;
            dom.selCategory.appendChild(opt);
        });
    }

    function onCategoryChange() {
        const cat = dom.selCategory.value;
        const subs = PART_SUBCATEGORIES[cat] || [];
        if (subs.length && dom.selSubcategory && dom.subGroup) {
            dom.selSubcategory.innerHTML = '<option value="">— Select subcategory (optional) —</option>';
            subs.forEach(s => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = s;
                dom.selSubcategory.appendChild(opt);
            });
            dom.subGroup.style.display = 'block';
        } else if (dom.subGroup) {
            dom.subGroup.style.display = 'none';
        }
    }

    function setCondition(val) {
        state.condition = val;
        [dom.condAny, dom.condNew, dom.condUsed].forEach(el => {
            if (el) el.classList.toggle('active', el.dataset.value === val);
        });
    }

    function setQty(n) {
        state.quantity = Math.max(1, Math.min(99, n));
        if (dom.qtyVal) dom.qtyVal.textContent = state.quantity;
        if (dom.qtyMinus) dom.qtyMinus.disabled = state.quantity <= 1;
    }

    function onPhotoSelect(e) {
        addPhotos([...e.target.files]);
        e.target.value = ''; // allow re-select same file
    }

    function addPhotos(files) {
        const remaining = 5 - state.images.length;
        const toAdd = files.slice(0, remaining);
        toAdd.forEach(f => state.images.push(f));
        renderPhotoGrid();
        if (dom.photoCount) dom.photoCount.textContent = `${state.images.length}/5 photos`;
    }

    function renderPhotoGrid() {
        if (!dom.photoGrid) return;
        dom.photoGrid.innerHTML = '';
        state.images.forEach((file, i) => {
            const url = URL.createObjectURL(file);
            const thumb = document.createElement('div');
            thumb.className = 'crq-photo-thumb';
            thumb.innerHTML = `<img src="${url}" alt="Photo ${i + 1}">
                <button class="crq-photo-remove" data-idx="${i}" aria-label="Remove photo">×</button>`;
            dom.photoGrid.appendChild(thumb);
        });
        dom.photoGrid.querySelectorAll('.crq-photo-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.images.splice(parseInt(btn.dataset.idx), 1);
                renderPhotoGrid();
                if (dom.photoCount) dom.photoCount.textContent = `${state.images.length}/5 photos`;
            });
        });
    }

    // ─── Submit ────────────────────────────────────────────────────────────────
    async function handleSubmit() {
        hideAlert(dom.formAlert);

        const car_make = dom.inpCarMake?.value.trim();
        const car_model = dom.inpCarModel?.value.trim();
        const car_year = dom.inpCarYear?.value.trim();
        const part_description = dom.inpDesc?.value.trim();

        // Required field validation
        if (!car_make) return showErr('Car make is required (e.g. Toyota).');
        if (!car_model) return showErr('Car model is required (e.g. Camry).');
        if (!car_year) return showErr('Car year is required.');
        const yearNum = parseInt(car_year, 10);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) {
            return showErr('Please enter a valid car year.');
        }
        if (!part_description || part_description.length < 10) {
            return showErr('Part description must be at least 10 characters.');
        }

        const vin_number = dom.inpVin?.value.trim();
        if (vin_number && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin_number)) {
            return showErr('VIN must be exactly 17 alphanumeric characters (no I, O, Q).');
        }

        setLoading(dom.btnSubmit, true, '');

        try {
            const fd = new FormData();
            fd.append('car_make', car_make);
            fd.append('car_model', car_model);
            fd.append('car_year', String(yearNum));
            if (vin_number) fd.append('vin_number', vin_number.toUpperCase());

            // Part details
            let finalDesc = part_description;
            if (state.quantity > 1) finalDesc += `\n\nQuantity: ${state.quantity} pcs`;
            fd.append('part_description', finalDesc);
            const cat = dom.selCategory?.value;
            const sub = dom.selSubcategory?.value;
            if (cat) fd.append('part_category', cat);
            if (sub) fd.append('part_subcategory', sub);
            const partNum = dom.inpPartNum?.value.trim();
            if (partNum) fd.append('part_number', partNum);
            fd.append('condition_required', state.condition);

            const addr = dom.inpAddress?.value.trim();
            if (addr) fd.append('delivery_address_text', addr);

            // Photos (field name: images[])
            state.images.forEach(f => fd.append('images', f));

            const result = await apiFetch('/requests', {
                method: 'POST',
                body: fd
            });

            showSuccessScreen();
        } catch (err) {
            showErr(err.message || 'Failed to submit request. Please try again.');
        } finally {
            setLoading(dom.btnSubmit, false, '');
        }
    }

    function showErr(msg) {
        showAlert(dom.formAlert, 'error', msg);
        dom.formAlert?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function showSuccessScreen() {
        if (dom.viewNew) dom.viewNew.querySelector('.crq-form-areas').style.display = 'none';
        if (dom.successScreen) {
            dom.successScreen.classList.add('visible');
            dom.successScreen.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        toast('success', '🎉 Request submitted! Garages are reviewing it now.');
    }

    function resetForm() {
        // Reset state
        state.condition = 'any';
        state.quantity = 1;
        state.images = [];
        // Reset DOM
        if (dom.inpCarMake) dom.inpCarMake.value = '';
        if (dom.inpCarModel) dom.inpCarModel.value = '';
        if (dom.inpCarYear) dom.inpCarYear.value = '';
        if (dom.inpVin) dom.inpVin.value = '';
        if (dom.selCategory) { dom.selCategory.value = ''; onCategoryChange(); }
        if (dom.inpDesc) dom.inpDesc.value = '';
        if (dom.descCount) dom.descCount.textContent = '0/1000';
        if (dom.inpPartNum) dom.inpPartNum.value = '';
        if (dom.inpAddress) dom.inpAddress.value = '';
        if (dom.photoGrid) dom.photoGrid.innerHTML = '';
        if (dom.photoCount) dom.photoCount.textContent = '0/5 photos';
        if (dom.qtyVal) dom.qtyVal.textContent = '1';
        setCondition('any');
        hideAlert(dom.formAlert);
        if (dom.successScreen) dom.successScreen.classList.remove('visible');
        if (dom.viewNew) {
            const areas = dom.viewNew.querySelector('.crq-form-areas');
            if (areas) areas.style.display = 'block';
        }
    }

    // ─── My Requests ───────────────────────────────────────────────────────────
    async function loadMyRequests() {
        if (!dom.requestsList) return;
        state.requestsLoading = true;
        dom.requestsList.innerHTML = '<div class="crq-spinner"></div>';
        try {
            const data = await apiFetch('/requests/my?page=1&limit=20');
            const requests = data.requests || data.data || [];
            state.myRequests = requests;
            renderRequestsList(requests);
        } catch (err) {
            dom.requestsList.innerHTML = `<div class="crq-empty">
                <div class="crq-empty-icon">⚠️</div>
                <div class="crq-empty-title">Could not load requests</div>
                <div class="crq-empty-text">${err.message}</div>
            </div>`;
        } finally {
            state.requestsLoading = false;
        }
    }

    function renderRequestsList(requests) {
        if (!dom.requestsList) return;
        if (!requests.length) {
            dom.requestsList.innerHTML = `<div class="crq-empty">
                <div class="crq-empty-icon">📋</div>
                <div class="crq-empty-title">No requests yet</div>
                <div class="crq-empty-text">Submit your first parts request and get bids from verified garages.</div>
                <button class="crq-btn-primary" style="max-width:220px;margin:0 auto" onclick="document.getElementById('crqViewTabNew').click()">
                    Request a Part →
                </button>
            </div>`;
            return;
        }
        dom.requestsList.innerHTML = requests.map(r => {
            const statusClass = { active: 'active', pending: 'active', completed: 'completed', cancelled: 'cancelled', expired: 'expired' }[r.status] || 'expired';
            const statusLabel = { active: 'Active', pending: 'Active', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' }[r.status] || r.status;
            const bids = r.bid_count || r.bids_count || 0;
            const date = new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const car = `${r.car_year} ${r.car_make} ${r.car_model}`;
            const desc = r.part_description ? r.part_description.substring(0, 120) : '';
            return `<div class="crq-request-card" id="rcrd-${r.request_id}">
                <div class="crq-request-card-top">
                    <div>
                        <div class="crq-request-car">${escHtml(car)}</div>
                        <div class="crq-request-desc">${escHtml(desc)}</div>
                    </div>
                    <span class="crq-status-pill ${statusClass}">${statusLabel}</span>
                </div>
                <div class="crq-request-meta">
                    <span class="crq-request-meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${date}
                    </span>
                    ${r.part_category ? `<span class="crq-request-meta-item">${escHtml(r.part_category)}</span>` : ''}
                    ${bids > 0 ? `<span class="crq-bid-badge">🏷️ ${bids} bid${bids !== 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── Boot ──────────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for inline handlers
    window.crqSwitchAuthTab = switchAuthTab;

})();
