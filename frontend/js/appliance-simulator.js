// ─── AUTH ───
        firebase.auth().onAuthStateChanged(user => {
            initDynamicBreadcrumb("Appliance Simulator");
            if (!user) { window.location.href = 'login.html'; return; }
            document.getElementById('user-name-display').innerText = user.displayName || user.email.split('@')[0];
            if (user.photoURL) document.getElementById('user-pfp').src = user.photoURL;
        });

        // ═══════════════════════════════════════
        //  SECTION 1: QUICK BILL CALCULATOR
        // ═══════════════════════════════════════
        const TARIFF_RATES = {
            'lifeline': 7.74,        // Avg total cost for Lifeline
            'protected': 12.34,       // Avg total cost for Protected
            'non_protected': 33.10,   // Avg total cost for Standard/Unprotected
            'default': 22.00          // Fallback avg
        };

        let currentEffectiveRate = TARIFF_RATES.default;
        let calcTimer = null;

        function onCalcChange() {
            clearTimeout(calcTimer);
            const units = document.getElementById('calc-units').value;
            const load = document.getElementById('calc-load').value;
            const cat = document.getElementById('calc-cat').value;
            const days = parseInt(document.getElementById('calc-days').value) || 30;

            currentEffectiveRate = TARIFF_RATES[cat] || TARIFF_RATES.default;
            updateBasketLive();

            const missing = [];
            if (!units || parseFloat(units) <= 0) missing.push('Units');
            if (!load) missing.push('Sanctioned Load');
            if (!cat) missing.push('Tariff Category');

            setCalcState('idle');

            if (missing.length === 3) { setCalcState('idle'); return; }
            if (missing.length > 0) { setCalcState('missing', missing); return; }

            setCalcState('loading');
            calcTimer = setTimeout(() => fetchCalcResult(parseFloat(units), parseFloat(load), cat, days), 500);

            if (Object.keys(basket).length > 0) updateBasketLive();
        }

        function setCalcState(state, data) {
            document.getElementById('calc-idle').style.display = 'none';
            document.getElementById('calc-missing').style.display = 'none';
            document.getElementById('calc-loader').style.display = 'none';
            document.getElementById('calc-data').style.display = 'none';
            document.getElementById('calc-result-panel').classList.remove('has-result');

            if (state === 'idle') {
                document.getElementById('calc-idle').style.display = 'block';
            } else if (state === 'missing') {
                const el = document.getElementById('calc-missing');
                el.style.display = 'block';
                el.innerHTML = '<p style="font-size:0.72rem;color:var(--text-dim);margin-bottom:10px;">Still needed:</p>' +
                    data.map(f => `<span class="missing-chip"><i class="fa fa-circle-dot" style="font-size:0.5rem"></i>${f}</span>`).join('');
            } else if (state === 'loading') {
                document.getElementById('calc-loader').style.display = 'flex';
            } else if (state === 'result') {
                document.getElementById('calc-data').style.display = 'grid';
                document.getElementById('calc-result-panel').classList.add('has-result');
            }
        }

        async function fetchCalcResult(units, load, cat, days) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/simulate_bill`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ units, load_kw: load, category: cat, is_eligible: true })
                });
                const data = await res.json();
                if (data.status !== 'success') throw new Error();

                const sim = data.simulation;
                const pf = days / 30;
                const total = Math.round(sim.total_bill * pf);
                const energy = Math.round(sim.energy_cost * pf);
                const fixed = Math.round(sim.fixed_charges * pf);
                const taxes = Math.round(sim.taxes_and_fca * pf);

                const CAT_COLORS = { lifeline: '#059669', protected: '#0284c7', non_protected: '#dc2626' };
                const CAT_LABELS = { lifeline: 'Lifeline', protected: 'Protected', non_protected: 'Unprotected' };
                const catColor = CAT_COLORS[sim.applied_category] || '#dc2626';
                const catLabel = CAT_LABELS[sim.applied_category] || sim.applied_category;

                document.getElementById('calc-data').innerHTML = `
                <div class="result-stat">
                    <div class="result-stat-label">Total Bill (${days}d)</div>
                    <div class="result-stat-val big">Rs. ${total.toLocaleString()}</div>
                    <span class="result-category-badge" style="background:${catColor}22;color:${catColor};border:1px solid ${catColor}44">${catLabel}</span>
                </div>
                <div class="result-stat">
                    <div class="result-stat-label">Energy Charges</div>
                    <div class="result-stat-val">Rs. ${energy.toLocaleString()}</div>
                    <div style="font-size:0.65rem;color:var(--text-dim);margin-top:4px;">${Math.round(units * pf / days * 30)} units equiv.</div>
                </div>
                <div class="result-stat" style="border-right:none">
                    <div class="result-stat-label">Fixed + Taxes</div>
                    <div class="result-stat-val">Rs. ${(fixed + taxes).toLocaleString()}</div>
                    <div style="font-size:0.65rem;color:var(--text-dim);margin-top:4px;">Fixed: Rs.${fixed.toLocaleString()} · Tax: Rs.${taxes.toLocaleString()}</div>
                </div>
            `;
                setCalcState('result');
            } catch {
                setCalcState('missing', ['Backend connection failed — is Flask running?']);
            }
        }

        async function updateEffectiveRateFromBackend(load, cat) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/simulate_bill`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ units: 250, load_kw: load, category: cat, is_eligible: true })
                });
                const data = await res.json();

                if (data.status === 'success') {
                    const sim = data.simulation;
                    currentEffectiveRate = sim.energy_cost / 250;
                    updateBasketLive();
                }
            } catch (e) {
                console.error("Link Sync Error:", e);
                currentEffectiveRate = 22.44; // Fallback
            }
        }

        // ─── TABS SCROLLER ───
        function scrollTabs(dir) {
            const container = document.getElementById('cat-tabs');
            const scrollAmount = 150;
            container.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
        }

        const CATALOG = {
            'Cooling': [
                { id: 'ac_std_1.5', name: 'Standard AC 1.5T', icon: 'fa-snowflake', watts: 1800, desc: 'Fixed speed, high peak load' },
                { id: 'ac_inv_1.5', name: 'Inverter AC 1.5T', icon: 'fa-bolt-lightning', watts: 900, desc: 'DC inverter energy saver' },
                { id: 'ac_std_1.0', name: 'Standard AC 1.0T', icon: 'fa-snowflake', watts: 1200, desc: 'Fixed speed, smaller room' },
                { id: 'ac_inv_1.0', name: 'Inverter AC 1.0T', icon: 'fa-bolt-lightning', watts: 600, desc: 'DC inverter, 1 Ton model' },
                { id: 'fan_ac', name: 'Ceiling Fan (AC)', icon: 'fa-fan', watts: 80, desc: 'Standard induction motor' },
                { id: 'fan_bldc', name: 'Ceiling Fan (BLDC)', icon: 'fa-fan', watts: 35, desc: 'Inverter energy saver fan' },
                { id: 'fan_ped', name: 'Pedestal Fan', icon: 'fa-fan', watts: 100, desc: 'Standard portable fan' },
                { id: 'cooler_lahori', name: 'Lahori Room Cooler', icon: 'fa-water', watts: 200, desc: 'Evaporative fan & pump' }
            ],
            'Kitchen': [
                { id: 'fridge_old', name: 'Fridge (Standard)', icon: 'fa-box', watts: 250, desc: 'Conventional compressor' },
                { id: 'fridge_inv', name: 'Fridge (Inverter)', icon: 'fa-box-open', watts: 120, desc: 'Low continuous cooling draw' },
                { id: 'freezer', name: 'Chest Deep Freezer', icon: 'fa-icicles', watts: 200, desc: 'Standard Pakistani home size' },
                { id: 'microwave', name: 'Microwave Oven', icon: 'fa-circle-radiation', watts: 1200, desc: 'Standard heating load' },
                { id: 'kettle', name: 'Electric Kettle', icon: 'fa-mug-hot', watts: 1800, desc: 'High load during boils' },
                { id: 'dispenser', name: 'Water Dispenser', icon: 'fa-droplet', watts: 400, desc: 'Hot & cold compressor load' },
                { id: 'air_fryer', name: 'Air Fryer', icon: 'fa-wind', watts: 1500, desc: 'High-heat convection oven' },
                { id: 'blender_grinder', name: 'Juicer & Blender', icon: 'fa-blender', watts: 450, desc: 'Kitchen processor motor' }
            ],
            'Utilities': [
                { id: 'pump_donkey', name: 'Water Pump (Donkey)', icon: 'fa-water', watts: 746, desc: '1 HP municipal suction pump' },
                { id: 'pump_sub', name: 'Water Pump (Sub)', icon: 'fa-water', watts: 1120, desc: '1.5 HP deep bore pump' },
                { id: 'geyser_storage', name: 'Geyser (Storage)', icon: 'fa-hot-tub-person', watts: 2000, desc: 'Storage geyser heating element' },
                { id: 'geyser_instant', name: 'Geyser (Instant)', icon: 'fa-fire', watts: 3000, desc: 'High speed instant heating' },
                { id: 'ups_charging', name: 'UPS Charging Load', icon: 'fa-car-battery', watts: 300, desc: 'Avg battery restoration draw' },
                { id: 'iron_dry', name: 'Clothes Iron (Stri)', icon: 'fa-shirt', watts: 1000, desc: 'Standard dry iron heating' },
                { id: 'wash_single', name: 'Washing Machine', icon: 'fa-soap', watts: 350, desc: 'Standard single tub motor' },
                { id: 'wash_auto', name: 'Washing (Automatic)', icon: 'fa-soap', watts: 600, desc: 'Twin-tub/Top load automatic' },
                { id: 'vacuum_cleaner', name: 'Vacuum Cleaner', icon: 'fa-wind', watts: 1400, desc: 'Suction motor load' },
                { id: 'hair_dryer', name: 'Hair Dryer', icon: 'fa-wind', watts: 1500, desc: 'High heating blower load' }
            ],
            'Entertainment': [
                { id: 'tv_led', name: 'LED TV 43"', icon: 'fa-tv', watts: 60, desc: 'Energy-efficient LED panel' },
                { id: 'tv_old', name: 'LCD TV 40"', icon: 'fa-tv', watts: 120, desc: 'Older LCD display panel' },
                { id: 'desktop', name: 'Desktop PC', icon: 'fa-desktop', watts: 250, desc: 'Standard tower with monitor' },
                { id: 'laptop', name: 'Laptop Computer', icon: 'fa-laptop', watts: 65, desc: 'Average active charging draw' },
                { id: 'gaming_console', name: 'Gaming Console', icon: 'fa-gamepad', watts: 200, desc: 'Active play (PS5/Xbox)' },
                { id: 'audio_soundbar', name: 'Soundbar / Speakers', icon: 'fa-volume-high', watts: 100, desc: 'Home theater sound system' }
            ],
            'Lighting & Smart': [
                { id: 'bulb_cfl', name: 'Energy Saver (CFL)', icon: 'fa-lightbulb', watts: 24, desc: 'Older compact fluorescent' },
                { id: 'bulb_led', name: 'LED Bulb 12W', icon: 'fa-lightbulb', watts: 12, desc: 'Modern high efficiency bulb' },
                { id: 'tube_led', name: 'LED Tube Light 18W', icon: 'fa-lightbulb', watts: 18, desc: 'Modern slim tube light' },
                { id: 'bulb_filament', name: 'Incandescent Bulb', icon: 'fa-lightbulb', watts: 60, desc: 'Legacy glass filament bulb' },
                { id: 'cctv_system', name: 'CCTV Security System', icon: 'fa-video', watts: 40, desc: 'DVR + 4 cameras 24/7' },
                { id: 'router_wifi', name: 'WiFi Router & ONT', icon: 'fa-wifi', watts: 12, desc: 'Internet connection 24/7' },
                { id: 'charger_phone', name: 'Smart Phone Charger', icon: 'fa-mobile', watts: 18, desc: 'Fast charging average' }
            ],
            'Heavy & Solar': [
                { id: 'ev_charger', name: 'EV Charger Level 2', icon: 'fa-charging-station', watts: 7200, desc: 'Level 2 home charger load' },
                { id: 'dishwasher', name: 'Dishwasher', icon: 'fa-sink', watts: 1500, desc: 'Water heating wash cycle' },
                { id: 'treadmill', name: 'Fitness Treadmill', icon: 'fa-person-running', watts: 1000, desc: 'DC motor running load' },
                { id: 'solar_charging', name: 'Solar Grid Charging', icon: 'fa-solar-panel', watts: 200, desc: 'Idle inverter bypass draw' }
            ]
        };

        const basket = {};
        const catalogScrollState = {};
        let activeCat = 'Cooling';

        function buildTabs() {
            const tabsEl = document.getElementById('cat-tabs');
            tabsEl.innerHTML = Object.keys(CATALOG).map(cat => `
            <button class="cat-tab ${cat === activeCat ? 'active' : ''}" onclick="switchCat('${cat}')">
                <i class="fa ${getCatIcon(cat)}"></i> ${cat}
            </button>
        `).join('');
        }

        function getCatIcon(cat) {
            return { 
                Cooling: 'fa-snowflake', 
                Kitchen: 'fa-utensils', 
                Utilities: 'fa-plug', 
                Entertainment: 'fa-tv',
                'Lighting & Smart': 'fa-lightbulb',
                'Heavy & Solar': 'fa-solar-panel'
            }[cat] || 'fa-box';
        }

        function switchCat(cat) {
            const container = document.querySelector('.catalog-scroll-container');
            if (container) {
                catalogScrollState[activeCat] = container.scrollTop;
            }

            activeCat = cat;
            buildTabs();
            buildCatalog();

            if (container) {
                setTimeout(() => {
                    container.scrollTop = catalogScrollState[activeCat] || 0;
                }, 0);
            }

            // Smoothly scroll the selected chip just enough to make it fully visible if cut off
            setTimeout(() => {
                const activeBtn = document.querySelector('.cat-tab.active');
                if (activeBtn) {
                    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }, 50);
        }

        function buildCatalog() {
            const grid = document.getElementById('catalog-grid');
            const apps = CATALOG[activeCat] || [];
            grid.innerHTML = apps.map(app => `
            <div class="catalog-tile ${basket[app.id] ? 'in-basket' : ''}" onclick="toggleAppliance('${app.id}')">
                <i class="fa ${app.icon} tile-icon"></i>
                <div class="tile-name">${app.name}</div>
                <div class="tile-watt">${app.watts >= 1000 ? (app.watts / 1000).toFixed(1) + ' kW' : app.watts + 'W'} · ${app.desc}</div>
                <div class="tile-add-hint">${basket[app.id] ? '✓ In basket' : '+ Add to simulation'}</div>
            </div>
        `).join('');
        }

        function findApp(id) {
            for (const cat of Object.values(CATALOG)) {
                const found = cat.find(a => a.id === id);
                if (found) return found;
            }
            return null;
        }

        function toggleAppliance(id) {
            if (basket[id]) {
                logDetailedEvent('simulator_item_toggled', { id: id, active: false });
                removeFromBasket(id);
            } else {
                basket[id] = { qty: 1, hours: 8 };
                logDetailedEvent('simulator_item_toggled', { id: id, active: true });
                renderBasket();
                buildCatalog();
            }
        }

        function removeFromBasket(id) {
            const itemEl = document.getElementById('bitem-' + id);
            const ids = Object.keys(basket);
            if (itemEl) {
                itemEl.classList.add('removing');
                if (ids.length === 1) {
                    document.getElementById('basket-footer').classList.add('footer-fade-out');
                }
                setTimeout(() => {
                    delete basket[id];
                    document.getElementById('basket-footer').classList.remove('footer-fade-out');
                    renderBasket();
                    buildCatalog();
                }, 400);
            } else {
                delete basket[id];
                renderBasket();
                buildCatalog();
            }
        }

        function clearBasket() {
            const items = document.querySelectorAll('.basket-item');
            const footer = document.getElementById('basket-footer');

            if (items.length === 0) return;

            logDetailedEvent('simulator_basket_cleared');
            footer.classList.add('footer-fade-out');
            items.forEach(item => item.classList.add('removing'));

            setTimeout(() => {
                Object.keys(basket).forEach(k => delete basket[k]);
                footer.classList.remove('footer-fade-out');
                renderBasket();
                buildCatalog();
            }, 400);
        }

        function renderBasket() {
            const list = document.getElementById('basket-list');
            const empty = document.getElementById('basket-empty');
            const footer = document.getElementById('basket-footer');
            const countEl = document.getElementById('basket-count');
            const clearBtn = document.getElementById('clear-basket-btn');
            const ids = Object.keys(basket);

            countEl.innerText = ids.length === 0 ? '0 appliances added' : `${ids.length} appliance${ids.length > 1 ? 's' : ''} added`;

            if (ids.length === 0) {
                clearBtn.disabled = true; // Greys out and locks Clear button
                empty.classList.add('show');
                empty.style.display = 'flex';
                footer.style.display = 'none';
                list.querySelectorAll('.basket-item').forEach(el => el.remove());
                document.getElementById('compare-strip').classList.remove('visible');
                return;
            }

            clearBtn.disabled = false; // Enables clear button when items exist
            empty.classList.remove('show');
            empty.style.display = 'none';
            footer.style.display = 'block';

            ids.forEach(id => {
                if (!document.getElementById('bitem-' + id)) {
                    const app = findApp(id);
                    if (!app) return;
                    const item = document.createElement('div');
                    item.className = 'basket-item';
                    item.id = 'bitem-' + id;
                    item.innerHTML = `
                    <div class="basket-item-top">
                        <div class="basket-item-icon"><i class="fa ${app.icon}"></i></div>
                        <div class="basket-item-name">${app.name}</div>
                        <button class="basket-remove" onclick="removeFromBasket('${id}')"><i class="fa fa-xmark"></i></button>
                    </div>
                    <div class="basket-controls">
                        <div>
                            <div class="basket-ctrl-label">Quantity</div>
                            <div class="qty-row">
                                <button class="qty-btn" onclick="adjQty('${id}',-1)">−</button>
                                <span class="qty-num" id="qty-${id}">${basket[id].qty}</span>
                                <button class="qty-btn" onclick="adjQty('${id}',1)">+</button>
                            </div>
                        </div>
                        <div>
                            <div class="basket-ctrl-label">Hours/day: <span id="hval-${id}">${basket[id].hours}h</span></div>
                            <input type="range" class="hours-slider" min="0.5" max="24" step="0.5"
                                value="${basket[id].hours}" oninput="adjHours('${id}',this.value)">
                        </div>
                    </div>
                `;
                    list.prepend(item);
                }
            });

            list.querySelectorAll('.basket-item').forEach(el => {
                const id = el.id.replace('bitem-', '');
                if (!basket[id]) el.remove();
            });

            updateBasketLive();
        }

        function adjQty(id, delta) {
            basket[id].qty = Math.max(1, basket[id].qty + delta);
            document.getElementById('qty-' + id).innerText = basket[id].qty;
            updateBasketLive();
        }

        function adjHours(id, val) {
            basket[id].hours = parseFloat(val);
            document.getElementById('hval-' + id).innerText = parseFloat(val) + 'h';
            updateBasketLive();
        }

        function updateBasketLive() {
            let totalKwh = 0;
            Object.entries(basket).forEach(([id, cfg]) => {
                const app = findApp(id);
                if (!app) return;
                totalKwh += (app.watts / 1000) * cfg.hours * cfg.qty * 30;
            });

            const baselineVal = document.getElementById('basket-baseline').value;
            const simBtn = document.getElementById('basket-sim-btn');

            const calculatedImpact = Math.round(totalKwh * currentEffectiveRate);
            const topCat = document.getElementById('calc-cat').value;
            const rateSource = topCat ? `${topCat.toUpperCase().replace('_', ' ')} RATE` : "DEFAULT RATE";

            const totalEl = document.getElementById('basket-total-display');
            totalEl.innerHTML = `
            <div style="margin-bottom: 12px; padding: 6px 10px; background: rgba(52,211,153,0.05); border-radius: 8px; border: 1px solid rgba(52,211,153,0.1); display: flex; align-items: center; gap: 8px;">
                <i class="fa fa-link" style="font-size: 0.65rem; color: var(--g3); animation: pulse 2s infinite;"></i>
                <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">
                    Calculator Linked: Using ${topCat ? topCat.replace('_', ' ') : 'Default'} Profile
                </span>
            </div>
            <div class="basket-total-row">
                <span style="color:var(--text-dim)">Monthly Load Addition</span>
                <b>${totalKwh.toFixed(1)} kWh</b>
            </div>
            <div class="basket-total-row">
                <span style="color:var(--text-dim)">Current Unit Rate</span>
                <b style="color:var(--g3)">Rs. ${currentEffectiveRate.toFixed(2)} <small style="font-size:0.5rem; color:var(--text-dim)">(${rateSource})</small></b>
            </div>
            <div class="basket-total-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
                <span style="font-weight:700;color:var(--text)">Incremental Bill Cost</span>
                <b style="font-size:1.1rem; color:var(--g3)">Rs. ${calculatedImpact.toLocaleString()}</b>
            </div>
        `;

            const isReady = (baselineVal && parseFloat(baselineVal) >= 0);
            simBtn.disabled = !isReady;
            simBtn.style.opacity = isReady ? "1" : "0.3";
            simBtn.style.cursor = isReady ? "pointer" : "not-allowed";
        }

        async function runBasketSim() {
            logDetailedEvent('simulator_run_started');
            const btn = document.getElementById('basket-sim-btn');
            const baseline = parseFloat(document.getElementById('basket-baseline').value) || 0;
            const load = parseFloat(document.getElementById('calc-load').value) || 5;
            const cat = document.getElementById('calc-cat').value || 'non_protected';

            let addedKwh = 0;
            Object.entries(basket).forEach(([id, cfg]) => {
                const app = findApp(id);
                if (!app) return;
                addedKwh += (app.watts / 1000) * cfg.hours * cfg.qty * 30;
            });

            btn.disabled = true;
            btn.innerHTML = '<div class="spinner-sm" style="border:2px solid rgba(255,255,255,0.2);border-top-color:#fff;"></div> Calculating...';

            try {
                const [baseRes, newRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/simulate_bill`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ units: baseline, load_kw: load, category: cat, is_eligible: true })
                    }).then(r => r.json()),
                    fetch(`${API_BASE_URL}/api/simulate_bill`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ units: baseline + addedKwh, load_kw: load, category: cat, is_eligible: true })
                    }).then(r => r.json())
                ]);

                if (baseRes.status !== 'success' || newRes.status !== 'success') throw new Error();

                const baseBill = Math.round(baseRes.simulation.total_bill);
                const newBill = Math.round(newRes.simulation.total_bill);
                const diff = newBill - baseBill;
                logDetailedEvent('simulator_run_success', {
                    basket_items_count: Object.keys(basket).length,
                    total_units: Math.round(baseline + addedKwh),
                    base_cost: baseBill,
                    new_cost: newBill,
                    cost_difference: diff
                });
                const diffSign = diff >= 0 ? '+' : '';
                const diffColor = diff > 0 ? 'var(--error)' : 'var(--g3)';

                const strip = document.getElementById('compare-strip');
                strip.innerHTML = `
                <p style="font-size:0.65rem;text-transform:uppercase;font-weight:700;color:var(--text-dim);margin-bottom:12px;letter-spacing:0.07em;">Bill Comparison</p>
                <div class="compare-row">
                    <div>
                        <div class="compare-label">Without additions</div>
                        <div class="compare-val" style="color:var(--text-muted)">Rs. ${baseBill.toLocaleString()}</div>
                        <div style="font-size:0.65rem;color:var(--text-dim);">${baseline} kWh</div>
                    </div>
                    <div class="compare-arrow"><i class="fa fa-arrow-right-long"></i></div>
                    <div>
                        <div class="compare-label">With additions</div>
                        <div class="compare-val" style="color:var(--g3)">Rs. ${newBill.toLocaleString()}</div>
                        <div style="font-size:0.65rem;color:var(--text-dim);">${Math.round(baseline + addedKwh)} kWh</div>
                    </div>
                </div>
                <div style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
                    <span style="font-size:0.8rem;color:var(--text-dim);">Monthly difference: </span>
                    <span style="font-family:'Syne';font-size:1rem;font-weight:800;color:${diffColor}">${diffSign}Rs. ${Math.abs(diff).toLocaleString()}</span>
                </div>
                <div style="text-align:center;margin-top:6px;font-size:0.7rem;color:var(--text-dim);">Annual impact: 
                    <strong style="color:${diffColor}">${diffSign}Rs. ${Math.abs(diff * 12).toLocaleString()}/year</strong>
                </div>
            `;
                strip.classList.add('visible');
            } catch {
                logDetailedEvent('simulator_run_failed', { error_message: 'Backend offline or API failed' });
                document.getElementById('compare-strip').innerHTML = `<p style="color:var(--error);font-size:0.8rem;text-align:center"><i class="fa fa-triangle-exclamation"></i> Backend offline — is Flask running?</p>`;
                document.getElementById('compare-strip').classList.add('visible');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-bolt"></i> Calculate PKR Impact';
            }
        }

        buildTabs();
        buildCatalog();
        renderBasket();
        updateBasketLive();

        function logout() { logDetailedEvent('logout'); firebase.auth().signOut().then(() => window.location.href = 'login.html'); }
