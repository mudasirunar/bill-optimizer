/* ── State ── */
        const db = firebase.firestore();
        let selectedCategory = 'lifeline';

        /* ── Auth & Loading Logic ── */
        firebase.auth().onAuthStateChanged(user => {
            initDynamicBreadcrumb("Setup Profile");
            if (!user) { window.location.href = "login.html"; return; }

            setFormState(true);

            document.getElementById('user-name-display').innerText = user.displayName || user.email.split('@')[0];
            if (user.photoURL) document.getElementById('user-pfp').src = user.photoURL;

            db.collection('users').doc(user.uid).get().then(doc => {
                const d = doc.exists ? doc.data() : {};

                // 1. System & Household Context
                setValue('disco', d.disco, '');
                setValue('load', d.sanctioned_load, '');
                setValue('person_count', d.person_count, '');
                setValue('user_routine', d.user_routine, 'standard');
                setValue('property_area', d.property_area, '');
                setValue('floors', d.floors, '1');

                // 2. Load New Fan Inputs
                setValue('fan_ac_qty', d.fan_ac_qty, '');
                setValue('fan_dc_qty', d.fan_dc_qty, '');

                // 3. Handle NEPRA Category
                if (d.user_category) setCategory(d.user_category);
                else setCategory('lifeline');

                // 4. Load Appliance Details (Synchronized with UI changes)
                const appliances = ['ac_std', 'ac_inv', 'f', 'wp', 'k', 'u', 'wm', 'iron'];
                appliances.forEach(prefix => {
                    setValue(prefix + '_qty', d[prefix + '_qty'], '');
                    setValue(prefix + '_val', d[prefix + '_val'], '');

                    // Set Frequencies (Defaults: WM is 4.3, others are 30)
                    const defaultFreq = (prefix === 'wm' ? '4.3' : '30');
                    setValue(prefix + '_freq', d[prefix + '_freq'], defaultFreq);

                    // Set Types (Dropdowns)
                    if (d[prefix + '_type']) {
                        let fallback = 'standard';
                        if (prefix === 'wp') fallback = '1.0';
                        if (prefix === 'wm') fallback = 'manual';
                        if (prefix === 'u') fallback = 'modified';
                        setValue(prefix + '_type', d[prefix + '_type'], fallback);
                    }

                    // SPECIAL FIX: Load UPS Battery specifically
                    if (prefix === 'u' && d.u_battery) {
                        setValue('u_battery', d.u_battery, 'lead_acid');
                    }

                    toggleApplianceRow(prefix);
                });

                // 5. Load Bill History (Sorted - Newest First)
                const logContainer = document.getElementById('bill-log-container');
                logContainer.innerHTML = "";
                if (d.bill_history && d.bill_history.length > 0) {
                    [...d.bill_history]
                        .sort((a, b) => b.month.localeCompare(a.month))
                        .forEach(b => addBillRow(b.month, b.units, b.amount));
                } else {
                    refreshRowActions();
                }

                setFormState(false);
                updateCompleteness();

            }).catch(err => {
                console.error("Firebase Fetch Error:", err);
                setFormState(false);
            });
        });

        function setFormState(loading, isSyncing = false) {
            const container = document.querySelector('.main-container');
            const syncBtn = document.getElementById('syncBtn');
            const addBtn = document.getElementById('addMonthBtn');
            const allInputs = document.querySelectorAll('input, select, .category-option');
            const loadingLine = document.getElementById('top-loading-line');

            if (loading) {
                // Trigger the grey-out effect
                container.classList.add('is-loading');
                syncBtn.disabled = true;
                if (addBtn) addBtn.disabled = true;

                if (loadingLine) loadingLine.style.display = 'block';

                if (!isSyncing) {
                    syncBtn.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> Initializing Memory...';
                }
            } else {
                // Remove grey-out and restore text
                container.classList.remove('is-loading');
                syncBtn.disabled = false;
                if (addBtn) addBtn.disabled = false;
                syncBtn.innerHTML = '<i class="fa fa-brain"></i> Sync AI Memory';

                if (loadingLine) loadingLine.style.display = 'none';
            }

            // Disable all fields so they are unclickable
            allInputs.forEach(el => {
                if (el.tagName === "INPUT" || el.tagName === "SELECT") {
                    el.disabled = loading;
                } else {
                    // For category divs
                    el.style.pointerEvents = loading ? "none" : "auto";
                }
            });
        }

        function updateCompleteness() {
            let score = 0;
            // Total Points: 3 (Tariff) + 4 (Lifestyle) + 8 (Inventory) + 1 (History) = 16
            const totalPoints = 16;

            const hasVal = (id) => {
                const el = document.getElementById(id);
                return el && el.value !== "";
            };

            // --- 1. Location & Tariff (3 pts) ---
            if (hasVal('disco')) score++;
            if (hasVal('load')) score++;
            if (selectedCategory) score++;

            // --- 2. Household Dynamics (4 pts) ---
            if (hasVal('person_count')) score++;
            if (hasVal('user_routine')) score++;
            if (hasVal('property_area')) score++;
            if (hasVal('floors')) score++;

            // --- 3. Household Inventory (8 pts) ---
            // Fans (AC or DC)
            if (hasVal('fan_ac_qty') || hasVal('fan_dc_qty')) score++;

            // Air Conditioners (Standard or Inverter)
            if (hasVal('ac_std_qty') || hasVal('ac_inv_qty')) score++;

            // Refrigerator
            if (hasVal('f_qty')) score++;

            // Washing Machine
            if (hasVal('wm_qty')) score++;

            // Water Pump
            if (hasVal('wp_qty')) score++;

            // UPS System
            if (hasVal('u_qty')) score++;

            // Kitchen Appliances
            if (hasVal('k_qty')) score++;

            // Clothes Iron
            if (hasVal('iron_qty')) score++;

            // --- 4. Historical Record (1 pt) ---
            const histRow = document.querySelector('.bill-history-row');
            if (histRow) {
                const m = histRow.querySelector('.hist-month').value;
                const u = histRow.querySelector('.hist-units').value;
                if (m !== "" && u !== "") score++;
            }

            // --- Calculate & Update Ring ---
            const pct = Math.round((score / totalPoints) * 100);
            const ring = document.getElementById('ringFill');
            if (ring) {
                // 163 is the dash-offset for your SVG circle
                ring.style.strokeDashoffset = 163 - (pct / 100) * 163;
            }
            document.getElementById('pctLabel').textContent = pct + '%';
        }

        async function saveProfile() {
            const user = firebase.auth().currentUser;
            if (!user) return;

            logDetailedEvent('profile_save_started');
            setFormState(true, true);
            const btn = document.getElementById('syncBtn');
            btn.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> Syncing...';

            try {
                // ─── 1. DATA EXTRACTION HELPERS ───
                const v = (id) => parseFloat(document.getElementById(id)?.value) || 0;
                const gv = (id) => document.getElementById(id)?.value || '';
                const getSafeVal = (id_prefix) => (v(id_prefix + '_qty') > 0 ? v(id_prefix + '_val') : 0);

                // Database-specific values (save empty string if user left it blank)
                const dbVal = (id) => {
                    const el = document.getElementById(id);
                    return (el && el.value !== "") ? parseFloat(el.value) : "";
                };
                const dbSafeVal = (id_prefix) => {
                    const qtyEl = document.getElementById(id_prefix + '_qty');
                    const valEl = document.getElementById(id_prefix + '_val');
                    if (!qtyEl || qtyEl.value === "") return "";
                    if (parseFloat(qtyEl.value) === 0) return 0;
                    return valEl && valEl.value !== "" ? parseFloat(valEl.value) : "";
                };

                // ─── 2. APPLIANCE CALCULATIONS (As per your Logic) ───

                // AC: Hours-based scaling
                const ac_std_monthly = v('ac_std_qty') * 1.50 * getSafeVal('ac_std') * v('ac_std_freq');
                const ac_inv_monthly = v('ac_inv_qty') * 0.75 * getSafeVal('ac_inv') * v('ac_inv_freq');
                const total_ac_monthly = ac_std_monthly + ac_inv_monthly;

                // Refrigerator (Explicit Duty Cycle Model)
                const f_type = gv('f_type');
                const f_peak = f_type === 'inverter' ? 0.12 : 0.25; // Peak compressor draw
                const f_duty = f_type === 'inverter' ? 0.40 : 0.60; // 40% for Inverter, 60% for Standard

                // Formula: Qty * Peak Power * Usage Hours * Frequency * Duty Cycle
                const f_monthly = v('f_qty') * f_peak * getSafeVal('f') * v('f_freq') * f_duty;

                // Water Pump: Convert HP to kW, then scale by usage
                const wp_kw = (parseFloat(gv('wp_type')) || 1.0) * 0.746;
                const wp_monthly = v('wp_qty') * wp_kw * getSafeVal('wp') * v('wp_freq');

                // Kitchen Appliances: Flat scaling (Oven/Kettle)
                const k_monthly = v('k_qty') * 1.20 * getSafeVal('k') * v('k_freq');

                // Clothes Iron: Flat scaling (1.0kW)
                const iron_monthly = v('iron_qty') * 1.00 * getSafeVal('iron') * v('iron_freq');

                // UPS Math: 400W Base * Loss Factors
                const ups_efficiency = gv('u_type') === 'pure' ? 1.05 : 1.25;
                const battery_loss = gv('u_battery') === 'lithium' ? 1.02 : 1.20;
                const u_monthly = v('u_qty') * 0.40 * ups_efficiency * battery_loss * getSafeVal('u') * v('u_freq');

                // Washing Machine Logic (Manual ~0.35kW, Automatic ~0.8kW)
                const wm_load = gv('wm_type') === 'automatic' ? 0.8 : 0.35;
                const wm_monthly = v('wm_qty') * wm_load * getSafeVal('wm') * v('wm_freq');

                // ── FAN MATH (Standard ~80W, Inverter ~35W) ──
                const fan_ac_monthly = v('fan_ac_qty') * 0.080 * 12 * 30; // 12h avg
                const fan_dc_monthly = v('fan_dc_qty') * 0.035 * 12 * 30;
                const total_fan_monthly = fan_ac_monthly + fan_dc_monthly;

                // ─── 3. DYNAMIC BASELOAD & MEAN HOURLY ───
                const person_baseload = Math.max(v('person_count'), 1) * 14.0;
                const area_baseload = Math.min((v('property_area') || 500) * 0.006, 15.0);

                const mean_hourly = (total_ac_monthly + f_monthly + wp_monthly + k_monthly +
                    u_monthly + wm_monthly + total_fan_monthly + iron_monthly +
                    person_baseload + area_baseload) / 720;

                // ─── 4. BILLING HISTORY CALIBRATION (Strict Validation) ───
                const allHistoryRows = Array.from(document.querySelectorAll('.bill-history-row'));
                const bill_history = allHistoryRows.map(row => {
                    const mInput = row.querySelector('.hist-month').value;
                    const uInput = row.querySelector('.hist-units').value;
                    const aInput = row.querySelector('.hist-amount').value;

                    return {
                        month: mInput,
                        units: uInput !== "" ? parseFloat(uInput) : "",
                        amount: aInput !== "" ? parseFloat(aInput) : ""
                    };
                }).filter(b => {
                    // All three values must be fully filled to be saved
                    const isComplete = (b.month !== "" && b.units !== "" && b.amount !== "");

                    // If any field is partially filled or missing, drop it completely
                    return isComplete && !isNaN(b.units) && !isNaN(b.amount);
                }).sort((a, b) => b.month.localeCompare(a.month));

                const validHistory = bill_history.filter(b => b.units > 5);
                const historical_avg_units = validHistory.length > 0
                    ? validHistory.reduce((s, b) => s + b.units, 0) / validHistory.length
                    : 0;

                // ─── 5. THE AI MEMORY DATA PACKET ───
                const data = {
                    disco: gv('disco'),
                    sanctioned_load: dbVal('load'),
                    user_category: selectedCategory,
                    property_area: dbVal('property_area'),
                    person_count: dbVal('person_count'),
                    floors: gv('floors'),
                    user_routine: gv('user_routine'),
                    fan_qty: dbVal('fan_qty'),

                    // Raw inputs sanitized for AI (No Contradictions)
                    ac_std_qty: dbVal('ac_std_qty'), ac_std_val: dbSafeVal('ac_std'), ac_std_freq: dbVal('ac_std_freq'),
                    ac_inv_qty: dbVal('ac_inv_qty'), ac_inv_val: dbSafeVal('ac_inv'), ac_inv_freq: dbVal('ac_inv_freq'),
                    ac_qty: v('ac_std_qty') + v('ac_inv_qty'),
                    f_qty: dbVal('f_qty'), f_type: gv('f_type'), f_val: dbSafeVal('f'), f_freq: dbVal('f_freq'),
                    wm_qty: dbVal('wm_qty'), wm_type: gv('wm_type'), wm_val: dbSafeVal('wm'), wm_freq: dbVal('wm_freq'),
                    wp_qty: dbVal('wp_qty'), wp_type: gv('wp_type'), wp_val: dbSafeVal('wp'), wp_freq: dbVal('wp_freq'),
                    k_qty: dbVal('k_qty'), k_val: dbSafeVal('k'), k_freq: dbVal('k_freq'),
                    u_qty: dbVal('u_qty'), u_type: gv('u_type'), u_battery: gv('u_battery'), u_val: dbSafeVal('u'), u_freq: dbVal('u_freq'),
                    iron_qty: dbVal('iron_qty'), iron_val: dbSafeVal('iron'), iron_freq: dbVal('iron_freq'),
                    fan_ac_qty: dbVal('fan_ac_qty'), fan_dc_qty: dbVal('fan_dc_qty'), fan_qty: v('fan_ac_qty') + v('fan_dc_qty'),

                    // Computed Monthly kWh for RF Features
                    ac_monthly: total_ac_monthly,
                    refrigerator_monthly: f_monthly,
                    kitchen_monthly: k_monthly,
                    ups_monthly: u_monthly,
                    wp_monthly: wp_monthly,
                    wm_monthly: wm_monthly,
                    fan_monthly: total_fan_monthly,
                    iron_monthly: iron_monthly,

                    // Derived Anchors
                    mean_hourly,
                    historical_avg_units,
                    bill_history,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };

                // ─── 6. CLOUD SYNC & REDIRECT ───

                // Save to Firestore first (Primary Truth)
                try {
                    await fetch(`${API_BASE_URL}/api/setup_profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: user.uid, data }),
                        signal: AbortSignal.timeout(3000) // Don't hang if Flask is off
                    });
                } catch (apiErr) {
                    console.warn("Flask API offline, but profile saved to Cloud.");
                }

                logDetailedEvent('profile_save_success', {
                    disco: data.disco,
                    sanctioned_load: data.sanctioned_load,
                    user_category: data.user_category,
                    property_area: data.property_area,
                    person_count: data.person_count,
                    floors: data.floors,
                    user_routine: data.user_routine,
                    ac_qty: data.ac_qty,
                    fan_qty: data.fan_qty,
                    f_qty: data.f_qty,
                    f_type: data.f_type,
                    wm_qty: data.wm_qty,
                    wm_type: data.wm_type,
                    wp_qty: data.wp_qty,
                    wp_type: data.wp_type,
                    u_qty: data.u_qty,
                    u_type: data.u_type,
                    u_battery: data.u_battery,
                    iron_qty: data.iron_qty,
                    history_months_count: data.bill_history ? data.bill_history.length : 0
                });

                showToast('AI Memory Updated!');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

            } catch (e) {
                console.error("Sync Error:", e);
                logDetailedEvent('profile_save_failed', { error_message: e.message || String(e) });
                setFormState(false);
                showToast('Sync failed!', 'error'); // This will now show the X icon
            }
        }

        /* ── Helper Functions ── */
        function setValue(id, val, fallback) {
            const el = document.getElementById(id);
            if (!el) return;
            let finalVal = (val !== undefined && val !== null) ? val : fallback;
            el.value = finalVal;
        }

        function setCategory(cat) {
            selectedCategory = cat;
            document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('active'));
            const target = document.getElementById('opt-' + cat);
            if (target) target.classList.add('active');
            updateCompleteness();
        }

        function toggleApplianceRow(prefix) {
            const qtyEl = document.getElementById(prefix + '_qty');
            const qtyValue = qtyEl.value;
            const qty = parseFloat(qtyValue) || 0;

            // Dependent elements
            const dependents = [
                document.getElementById(prefix + '_val'),
                document.getElementById(prefix + '_freq'),
                document.getElementById(prefix + '_type'),
                document.getElementById(prefix + '_battery') // Specific for UPS
            ];

            // If Qty is empty, 0, or negative -> Lock and Reset
            const shouldDisable = (qtyValue === "" || qty <= 0);

            dependents.forEach(el => {
                if (el) {
                    el.disabled = shouldDisable;
                    el.style.opacity = shouldDisable ? "0.4" : "1";
                    if (shouldDisable) {
                        // Reset value to avoid sending "Ghost Data" to AI
                        if (el.tagName === "SELECT") {
                            // Reset selects to their first option (usually the default)
                            el.selectedIndex = 0;
                        } else {
                            el.value = "";
                        }
                    }
                }
            });
            updateCompleteness();
        }

        function refreshRowActions() {
            const container = document.getElementById('bill-log-container');
            const rows = container.querySelectorAll('.bill-history-row');

            // Handle Empty State Placeholder Text
            let emptyState = document.getElementById('history-empty-state');
            if (rows.length === 0) {
                if (!emptyState) {
                    emptyState = document.createElement('div');
                    emptyState.id = 'history-empty-state';
                    emptyState.style.cssText = "text-align:center; padding:30px 20px; color:var(--text-dim); font-size:0.85rem; font-weight:500; display:flex; flex-direction:column; align-items:center; gap:10px;";
                    emptyState.innerHTML = `<i class="fa fa-folder-open" style="font-size:1.8rem; opacity:0.3; color:var(--g3)"></i><p>No billing logs added. Click below to add your ground-truth records.</p>`;
                    container.appendChild(emptyState);
                }
            } else if (emptyState) {
                emptyState.remove();
            }

            // If there are rows left, ensure the delete icon is visible on all of them
            rows.forEach((r) => {
                r.querySelector('.action-holder').style.display = 'flex';
            });
        }

        function addBillRow(m = "", u = "", a = "") {
            const container = document.getElementById('bill-log-container');
            const rowId = `row-${Math.random().toString(36).substring(2, 11)}`;

            const div = document.createElement('div');
            div.className = 'bill-history-row';
            div.id = rowId;
            div.innerHTML = `
            <div class="history-inputs-group">
                <div class="input-wrap" style="flex: 1.4;"><input type="month" class="hist-month" value="${m}" oninput="updateCompleteness()"></div>
                <div class="input-wrap"><input type="number" class="hist-units" value="${u}" oninput="updateCompleteness()"><span class="input-unit">kWh</span></div>
                <div class="input-wrap"><input type="number" class="hist-amount" value="${a}" oninput="updateCompleteness()"><span class="input-unit">Rs.</span></div>
            </div>
            <div class="action-holder"><button type="button" onclick="removeBillRow('${rowId}')" class="btn-delete-row"><i class="fa fa-trash-can"></i></button></div>`;
            container.appendChild(div);
            refreshRowActions();
        }

        function removeBillRow(id) {
            const el = document.getElementById(id);
            if (el) el.remove();
            refreshRowActions();
            updateCompleteness();
        }

        function showToast(m, t = 'success') {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toast-msg');
            const icon = document.getElementById('toast-icon');

            // Set Message
            msg.innerText = m;

            // Reset and Set Classes/Icons
            toast.className = 'toast ' + t + ' show';

            if (t === 'error') {
                icon.className = 'fa fa-circle-xmark'; // The X icon
            } else {
                icon.className = 'fa fa-check-circle'; // The Tick icon
            }

            // Hide after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        function openLoadHelp() { document.getElementById('loadHelpModal').style.display = 'flex'; }
        function closeLoadHelp() { document.getElementById('loadHelpModal').style.display = 'none'; }
        function openUnitHelp() { document.getElementById('unitHelpModal').style.display = 'flex'; }
        function closeUnitHelp() { document.getElementById('unitHelpModal').style.display = 'none'; }

        // ─── FLOATING PROGRESS TRACKER LOGIC ───
        const progressWrap = document.querySelector('.completeness-wrap');
        const headerRow = document.querySelector('.header-row');
        const pageHeader = document.querySelector('.page-header');

        window.addEventListener('scroll', () => {
            // Determine when the header has scrolled out of view
            // Navbar height (68) + extra padding
            const triggerThreshold = pageHeader.offsetTop + pageHeader.offsetHeight - 80;

            if (window.scrollY > triggerThreshold) {
                if (!progressWrap.classList.contains('floating')) {
                    // MOVE TO BODY: This escapes the CSS Transform Trap of the header
                    document.body.appendChild(progressWrap);
                    progressWrap.classList.add('floating');
                }
            } else {
                if (progressWrap.classList.contains('floating')) {
                    // SNAP BACK: Returns to its original place in the header
                    headerRow.appendChild(progressWrap);
                    progressWrap.classList.remove('floating');
                }
            }
        });

        function logout() { logDetailedEvent('logout'); firebase.auth().signOut().then(() => window.location.href = "login.html"); }
