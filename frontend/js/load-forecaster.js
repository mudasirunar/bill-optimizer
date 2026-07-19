const db = firebase.firestore();
        let loadChart;
        let userUid = null;
        let currentForecast = null;
        let currentUserDoc = null;
        let activeRoutine = 'standard';

        firebase.auth().onAuthStateChanged(user => {
            if (!user) {
                window.location.href = "login.html";
                return;
            }
            userUid = user.uid;

            // SAFE DEFERRED TRIGGER: Fires the line independently without locking the UI thread
            setTimeout(() => {
                const loadingLine = document.getElementById('top-loading-line');
                if (loadingLine) loadingLine.style.display = 'block';
            }, 0);

            if (typeof initDynamicBreadcrumb === "function") {
                initDynamicBreadcrumb("Load Forecaster");
            }
            document.getElementById('user-name-display').innerText = user.displayName || user.email.split('@')[0];
            if (user.photoURL) document.getElementById('user-pfp').src = user.photoURL;

            runForecaster();
        });

        // ── Routine toggle ──
        function selectRoutine(btn) {
            document.querySelectorAll('.routine-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeRoutine = btn.dataset.routine;
            logDetailedEvent('forecaster_routine_changed', { routine: activeRoutine });
            runForecaster(true);
        }

        function showLoadingError(message) {
            document.getElementById('loading-spinner').style.display = 'none';
            document.getElementById('loading-text').style.display = 'none';
            document.getElementById('error-container').style.display = 'block';
            document.getElementById('error-desc').innerText = message;
        }

        function updateRoutineUI(routine) {
            document.querySelectorAll('.routine-btn').forEach(btn => {
                if (btn.dataset.routine === routine) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        function formatCategory(cat) {
            const map = {
                'non_protected': 'Non-Protected',
                'protected': 'Protected',
                'lifeline': 'Lifeline'
            };
            return map[cat.toLowerCase()] || cat;
        }

        // ── Main forecaster ──
        async function runForecaster(isSimulation = false) {
            logDetailedEvent('forecaster_run_started', { is_simulation: isSimulation });
            const loadingOverlay = document.getElementById('loading');
            const spinner = document.getElementById('loading-spinner');
            const loadText = document.getElementById('loading-text');
            const errorCont = document.getElementById('error-container');

            // Reset UI to loading state
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.opacity = '1';
            spinner.style.display = 'block';
            loadText.style.display = 'block';
            errorCont.style.display = 'none';

            try {
                // 1. Check Network
                if (!navigator.onLine) throw new Error("No Internet connection detected.");

                // 2. Database Context
                const snap = await db.collection('users').doc(userUid).get();
                if (!snap.exists) throw new Error("User profile not found. Please complete Setup Profile.");
                currentUserDoc = snap.data();

                let targetMonth;
                let targetYear = new Date().getFullYear();
                const history = currentUserDoc.bill_history || [];

                if (history.length > 0) {
                    // Sort to find the most recent month in history
                    const sortedHistory = [...history].sort((a, b) => b.month.localeCompare(a.month));
                    const [lastYear, lastMonth] = sortedHistory[0].month.split('-').map(Number);

                    // Predict the month immediately following history
                    if (lastMonth === 12) {
                        targetMonth = 1;
                        targetYear = lastYear + 1;
                    } else {
                        targetMonth = lastMonth + 1;
                        targetYear = lastYear;
                    }
                } else {
                    // Default to current system month if no history
                    const now = new Date();
                    targetMonth = now.getMonth() + 1;
                    targetYear = now.getFullYear();
                }

                if (!currentForecast && currentUserDoc.user_routine) {
                    activeRoutine = currentUserDoc.user_routine;
                    updateRoutineUI(activeRoutine);
                }

                // 3. API Fetch
                const response = await fetch(`${API_BASE_URL}/api/forecast_24h`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: userUid, month: targetMonth })
                }).catch(() => { throw new Error("Neural Engine Offline: Flask backend is not running on Port 5001.") });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Server Error: ${response.status}`);
                }

                const data = await response.json();

                if (data.status === "success") {
                    const ROUTINE_FACTORS = {
                        standard: 1.00, morning_active: 1.04,
                        evening_active: 1.08, all_day: 1.15
                    };

                    const profileRoutine = currentUserDoc.user_routine || 'standard';

                    let rf = 1.0;
                    if (isSimulation) {
                        rf = ROUTINE_FACTORS[activeRoutine] / ROUTINE_FACTORS[profileRoutine];
                    }

                    const forecastArray = data.forecast.map(v => parseFloat((v * rf).toFixed(4)));

                    // 1. SAVE GLOBAL DATA FIRST
                    currentForecast = { ...data, forecast: forecastArray };

                    // 2. CALL RENDERS WITH CORRECT OBJECTS
                    renderChart(data.hours, forecastArray, data.ac_scale);
                    updateInsights(data.hours, forecastArray, data.ac_scale);
                    renderHourlyGrid(data.hours, forecastArray);
                    renderArchetypeCard(data.archetype, data.month);
                    renderDiscoCard(currentUserDoc.disco, data.month, data.ac_scale);
                    const simulatedFinance = {
                        ...data.finance,
                        daily_units: (data.finance.daily_units * rf),
                        monthly_units: (data.finance.monthly_units * rf),
                        daily_cost: (data.finance.daily_cost * rf),
                        monthly_cost: (data.finance.monthly_cost * rf)
                    };
                    renderDailyCost(simulatedFinance);

                    // Month label
                    const monthName = new Date(targetYear, data.month - 1, 1).toLocaleString('default', { month: 'long' });
                    const routineName = activeRoutine.replace('_', ' ').toUpperCase();

                    // Update the label to show the Target Month + Year
                    document.getElementById('chart-month-label').innerText =
                        `Target: ${monthName} ${targetYear} | Routine Simulation: ${routineName}`;

                    // Show all cards
                    ['cost-card', 'archetype-card', 'disco-card', 'hourly-section'].forEach(id => {
                        document.getElementById(id).style.display = '';
                    });

                    // Successfully finished loading structural resources and charts! Clean up loaders
                    const loadingLine = document.getElementById('top-loading-line');
                    if (loadingLine) loadingLine.style.display = 'none';

                    logDetailedEvent('forecaster_run_success', {
                        is_simulation: isSimulation,
                        routine: activeRoutine,
                        ac_scale: data.ac_scale,
                        total_cost: Math.round(simulatedFinance.monthly_cost)
                    });

                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => loadingOverlay.style.display = 'none', 300);
                } else {
                    throw new Error(data.error || "Neural synthesis failed.");
                }
            } catch (err) {
                console.error("Forecaster Error:", err);
                logDetailedEvent('forecaster_run_failed', { is_simulation: isSimulation, error_message: err.message || String(err) });
                // FIXED: Safety toggle prevents line from getting permanently stuck on error
                const loadingLine = document.getElementById('top-loading-line');
                if (loadingLine) loadingLine.style.display = 'none';

                // Fixed the undefined 'isLocal' reference that was crashing ChartJS script execution
                const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
                const errorMsg = isLocalHost
                    ? "Local Backend Offline: Is Flask running on Port 5001?"
                    : "Cloud Neural Engine is waking up. Please wait 30 seconds and retry.";

                showLoadingError(err.message || errorMsg);
            }
        }

        // ── Chart with zone shading ──
        function renderChart(labels, values, acScale) {
            const ctx = document.getElementById('loadChart').getContext('2d');

            const gradient = ctx.createLinearGradient(0, 0, 0, 380);
            gradient.addColorStop(0, 'rgba(16,185,129,0.35)');
            gradient.addColorStop(1, 'rgba(16,185,129,0)');

            if (loadChart) loadChart.destroy();

            // Zone background plugin
            const zonePlugin = {
                id: 'zones',
                beforeDraw(chart) {
                    const { ctx, chartArea: { left, right, top, bottom }, scales: { x } } = chart;
                    if (!x) return;

                    const getX = (h) => {
                        const pt = x.getPixelForValue(h);
                        return pt;
                    };

                    // Morning peak: 6–9
                    ctx.save();
                    ctx.fillStyle = 'rgba(99,102,241,0.07)';
                    ctx.fillRect(getX(6), top, getX(9) - getX(6), bottom - top);
                    ctx.restore();

                    // Evening peak: 18–22
                    ctx.save();
                    ctx.fillStyle = 'rgba(251,191,36,0.07)';
                    ctx.fillRect(getX(18), top, getX(22) - getX(18), bottom - top);
                    ctx.restore();

                    // Off-peak: 0–5
                    ctx.save();
                    ctx.fillStyle = 'rgba(52,211,153,0.04)';
                    ctx.fillRect(getX(0), top, getX(5) - getX(0), bottom - top);
                    ctx.restore();
                }
            };

            loadChart = new Chart(ctx, {
                type: 'line',
                plugins: [zonePlugin],
                data: {
                    labels: labels.map(h => `${h}:00`),
                    datasets: [{
                        label: 'Load (kW)',
                        data: values,
                        borderColor: '#10b981',
                        borderWidth: 2.5,
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        pointRadius: (ctx) => {
                            const h = ctx.dataIndex;
                            return (h >= 6 && h <= 9) || (h >= 18 && h <= 22) ? 4 : 2;
                        },
                        pointBackgroundColor: (ctx) => {
                            const h = ctx.dataIndex;
                            if (h >= 18 && h <= 22) return '#fbbf24';
                            if (h >= 6 && h <= 9) return '#818cf8';
                            return '#10b981';
                        },
                        pointHoverRadius: 7,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(13,26,18,0.98)',
                            titleFont: { family: 'Syne', size: 12, weight: 'bold' },
                            bodyFont: { family: 'DM Sans', size: 11 },
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                title: (items) => {
                                    const h = parseInt(items[0].label);
                                    const period = h >= 12 ? 'PM' : 'AM';
                                    const h12 = h % 12 || 12;
                                    let zone = '';
                                    if (h >= 6 && h <= 9) zone = ' · Morning Peak';
                                    if (h >= 18 && h <= 22) zone = ' · Evening Peak';
                                    if (h >= 0 && h <= 5) zone = ' · Off-Peak';
                                    return `${h12}:00 ${period}${zone}`;
                                },
                                label: (c) => {
                                    const cat = currentUserDoc?.user_category || 'non_protected';
                                    const rate = currentForecast.finance.effective_rate || 0;
                                    const cost = (c.raw * rate).toFixed(1);
                                    return [` Load: ${c.raw.toFixed(3)} kW`, ` Est. Cost: Rs. ${cost}/hr`];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(52,211,153,0.05)' },
                            ticks: {
                                color: '#4b7a5e',
                                // MOBILE TWEAK: Shrink text size and shorten side tags on small screens
                                font: {
                                    size: window.innerWidth < 640 ? 9 : 11
                                },
                                callback: function (v) {
                                    // Trim " kW" to just "k" or hide entirely on very small screens to maximize area
                                    return window.innerWidth < 480 ? v.toFixed(1) : v.toFixed(1) + ' kW';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#4b7a5e',
                                // MOBILE TWEAK: Adjust label densities dynamically so they don't overlap
                                maxTicksLimit: window.innerWidth < 640 ? 6 : 12,
                                font: {
                                    size: window.innerWidth < 640 ? 9 : 11
                                },
                                callback: function (val, i) {
                                    const h = i;
                                    // Desktop shows every 3 hours; mobile shows every 4 hours to avoid squeezing
                                    const interval = window.innerWidth < 640 ? 4 : 3;
                                    return h % interval === 0 ? `${h}:00` : '';
                                }
                            }
                        }
                    }
                }
            });
        }

        // ── Insight cards ──
        function updateInsights(hours, forecast, acScale) {
            const maxLoad = Math.max(...forecast);
            const minLoad = Math.min(...forecast);
            const peakHour = hours[forecast.indexOf(maxLoad)];
            const minHour = hours[forecast.indexOf(minLoad)];

            const totalDailyUnits = forecast.reduce((a, b) => a + b, 0);
            const fmt = h => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
            document.getElementById('peak-val').innerText = `${maxLoad.toFixed(3)} kW`;
            document.getElementById('peak-time').innerText = fmt(peakHour);
            document.getElementById('min-time').innerText = fmt(minHour);
            document.getElementById('min-val').innerText = `${minLoad.toFixed(3)} kW · Best window for heavy loads`;

            const carbonKg = totalDailyUnits * 0.45;
            document.getElementById('carbon-val').innerText = `${carbonKg.toFixed(2)} kg CO2`;

            // ── Load Stability Score ──
            const mean = forecast.reduce((a, b) => a + b, 0) / forecast.length;
            const stdDev = Math.sqrt(forecast.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / forecast.length);
            // Coefficient of Variation (CV): lower = more stable
            const cv = mean > 0 ? (stdDev / mean) : 1;
            const stabilityPct = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));

            document.getElementById('stability-score').innerText = `${stabilityPct}%`;

            // Dynamic icon and message based on score
            const iconBox = document.getElementById('stability-icon');
            const descEl = document.getElementById('stability-desc');

            if (stabilityPct >= 75) {
                iconBox.style.background = 'rgba(52,211,153,0.15)';
                iconBox.innerHTML = '<i class="fa fa-wave-square" style="color:#34d399"></i>';
                descEl.innerText = 'Flat, predictable load — baseload appliances dominate. Easy to budget.';
            } else if (stabilityPct >= 50) {
                iconBox.style.background = 'rgba(251,191,36,0.1)';
                iconBox.innerHTML = '<i class="fa fa-wave-square" style="color:#fbbf24"></i>';
                descEl.innerText = 'Moderate spikes detected. Heavy appliances are creating demand peaks.';
            } else {
                iconBox.style.background = 'rgba(248,113,113,0.1)';
                iconBox.innerHTML = '<i class="fa fa-wave-square" style="color:#f87171"></i>';
                descEl.innerText = 'High variance — erratic usage pattern. AC or pump switching is causing sharp spikes.';
            }

            const textEl = document.getElementById('strategy-text');

            // Logic for text only - removed border changes
            if (peakHour >= 18 && peakHour <= 22) {
                textEl.innerHTML = '<strong style="color:#fbbf24">Peak Hour Conflict:</strong> Your usage spikes during expensive evening hours (6–10 PM). Pre-cool rooms at 5 PM and run the water pump at noon to shift load away from peak.';
            } else if (peakHour >= 6 && peakHour <= 10) {
                textEl.innerHTML = '<strong style="color:#818cf8">Morning Load:</strong> Peak is in the morning prep window. Consider using the washing machine during midday off-peak hours (11 AM–3 PM) to reduce concurrent load.';
            } else {
                textEl.innerHTML = '<strong style="color:var(--g3)">Efficient Pattern:</strong> Your primary load is in off-peak hours. This routine minimises your per-unit cost under current NEPRA slabs.';
            }
        }

        // ── Daily cost estimate ──
        function renderDailyCost(finance) {
            const dailyCostEl = document.getElementById('daily-cost');
            const dailyUnitsEl = document.getElementById('daily-units');
            const monthlyProjEl = document.getElementById('monthly-projection');
            const costCard = document.getElementById('cost-card');

            if (!finance) return;

            dailyCostEl.innerText = `Rs. ${finance.daily_cost.toLocaleString()}`;

            // --- CLEAN CATEGORY TEXT & PROPER MESSAGE ---
            const readableCategory = formatCategory(finance.applied_category);

            dailyUnitsEl.innerHTML = `
                ${finance.daily_units} kWh draw today · 
                <span>As per our AI prediction, you fall in the <strong>${readableCategory}</strong> category.</span>`;

            monthlyProjEl.innerText = `Rs. ${finance.monthly_cost.toLocaleString()}`;
            costCard.style.display = 'flex';
        }

        // ── Hourly grid ──
        function renderHourlyGrid(hours, forecast) {
            const grid = document.getElementById('hourly-grid');
            const rate = currentForecast?.finance?.effective_rate || 0;
            const maxVal = Math.max(...forecast);

            grid.innerHTML = '';
            hours.forEach((h, i) => {
                const v = forecast[i];
                const cost = (v * rate).toFixed(1);
                const pct = maxVal > 0 ? (v / maxVal * 100).toFixed(0) : 0;
                const isPeak = h >= 18 && h <= 22;
                const isOff = h >= 0 && h <= 5;
                const period = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;

                const cell = document.createElement('div');
                // Added onclick and cursor style
                cell.className = `hour-cell ${isPeak ? 'is-peak' : isOff ? 'is-offpeak' : ''}`;
                cell.style.cursor = 'pointer';
                cell.onclick = () => openHourModal(h, v);

                cell.innerHTML = `
                    <div class="h-label">${h12}:00 ${period}</div>
                    <div class="h-val">${v.toFixed(3)} kW</div>
                    <div class="h-bar" style="width:${pct}%; background:${isPeak ? 'var(--warn)' : 'var(--g2)'}"></div>
                    <div class="h-cost">Rs. ${cost}/hr</div>
                `;
                grid.appendChild(cell);
            });

            document.getElementById('hourly-section').style.display = 'block';
        }

        // ---  MODAL LOGIC ---
        function openHourModal(hour, load) {
            logDetailedEvent('forecaster_hour_details_opened', { hour: hour, load: load });
            // 1. UI Safety: Lock Scroll & Reset Modal
            document.body.style.overflow = 'hidden';
            const auditContainer = document.getElementById('m-audit-list');
            const tipEl = document.getElementById('m-tip');
            auditContainer.innerHTML = '';

            const effRate = currentForecast.finance.effective_rate;
            const appliedCat = currentForecast.finance.applied_category;

            // 2. Context Variables
            const h12 = hour % 12 || 12;
            const period = hour >= 12 ? 'PM' : 'AM';
            const isPeak = hour >= 18 && hour <= 22;

            const readableCategory = formatCategory(appliedCat);
            const statusEl = document.getElementById('m-status');

            // Combine Category + Temporal Status (e.g., "Protected Peak")
            statusEl.innerText = `${readableCategory} ${isPeak ? 'Peak Window' : 'Off-Peak'}`;
            statusEl.style.color = isPeak ? 'var(--warn)' : 'var(--g3)';

            document.getElementById('m-time').innerText = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
            document.getElementById('m-load').innerText = `${load.toFixed(3)} kW`;
            document.getElementById('m-cost').innerText = `Rs. ${(load * effRate).toFixed(2)}`;

            statusEl.innerText = isPeak ? 'NEPRA Peak Hours (High Tax)' : 'Standard Off-Peak';
            statusEl.style.color = isPeak ? 'var(--warn)' : 'var(--g3)';

            // ─── 3. DYNAMIC INVENTORY SCAN ───
            // We only create demand scores for things the user actually owns
            const inv = {
                ac: (parseFloat(currentUserDoc.ac_std_qty) || 0) + (parseFloat(currentUserDoc.ac_inv_qty) || 0),
                fans: (parseFloat(currentUserDoc.fan_ac_qty) || 0) + (parseFloat(currentUserDoc.fan_dc_qty) || 0),
                fridge: parseFloat(currentUserDoc.f_qty) || 0,
                pump: parseFloat(currentUserDoc.wp_qty) || 0,
                wash: parseFloat(currentUserDoc.wm_qty) || 0,
                people: parseFloat(currentUserDoc.person_count || 1)
            };

            // ─── 4. TEMPORAL PROBABILITY MATRIX ───
            let weights = { ac: 0.05, fan: 0.3, pump: 0.0, wash: 0.0, light: 0.05, fridge: 0.6 };
            if (hour >= 13 && hour <= 17) { weights.ac = 0.95; weights.fan = 1.0; } // Afternoon
            if (hour >= 22 || hour <= 5) { weights.ac = 0.80; weights.fan = 0.7; } // Night
            if (hour >= 7 && hour <= 11) { weights.pump = 0.85; weights.wash = 0.6; } // Morning
            if (hour >= 18 && hour <= 23) { weights.light = 1.0; weights.ac = 0.4; } // Evening

            // ─── 5. CALCULATE RAW POTENTIAL ───
            let potential = [];

            // Add only if User has them
            if (inv.ac > 0) potential.push({ id: 'ac', label: 'Air Conditioning', score: inv.ac * 1.2 * weights.ac, icon: 'snowflake', color: '#6ee7b7', desc: `${inv.ac} Units` });
            if (inv.fans > 0) potential.push({ id: 'fan', label: 'Fans & Ventilation', score: inv.fans * 0.08 * weights.fan, icon: 'wind', color: '#34d399', desc: `${inv.fans} Active Fans` });
            if (inv.fridge > 0) potential.push({ id: 'fridge', label: 'Refrigeration', score: inv.fridge * 0.15 * weights.fridge, icon: 'box', color: '#10b981', desc: 'Always On' });
            if (inv.pump > 0 || inv.wash > 0) potential.push({ id: 'motor', label: 'Heavy Motors', score: (inv.pump * 0.75 + inv.wash * 0.4) * weights.pump, icon: 'gears', color: '#fbbf24', desc: 'Pump/Washing' });
            potential.push({ id: 'base', label: 'Neural Baseload', score: (inv.people * 0.04) + (0.1 * weights.light), icon: 'bolt', color: '#a5b4fc', desc: 'Always Active' });

            const totalScore = potential.reduce((s, p) => s + p.score, 0) || 0.1;

            // ─── 6. RENDER DYNAMIC LIST & FIND DOMINANT ───
            let dominantAppliance = { label: 'Baseload', id: 'base' };
            let maxPct = 0;

            potential.forEach(app => {
                const pct = Math.round((app.score / totalScore) * 100);
                if (pct > 3) {
                    if (pct > maxPct) { maxPct = pct; dominantAppliance = app; }
                    auditContainer.innerHTML += `
                        <div class="audit-item">
                            <i class="fa fa-${app.icon}" style="width:20px; color:${app.color}"></i>
                            <div style="flex:1; font-size:0.8rem; margin-left:12px;">
                                <span style="display:block; font-weight:600; color:var(--text)">${app.label}</span>
                                <small style="color:var(--text-dim); font-size:0.65rem">${app.desc}</small>
                            </div>
                            <div class="audit-bar-bg"><div class="audit-bar-fill" style="width:${pct}%; background:${app.color}"></div></div>
                            <div style="font-size:0.75rem; font-weight:700; color:var(--text); min-width:35px; text-align:right;">${pct}%</div>
                        </div>
                    `;
                }
            });

            // ─── 7. THE INTELLIGENT STRATEGY ENGINE (Tips) ───
            let tipContent = "";

            // A. NO MAJOR APPLIANCES CASE
            if (inv.ac === 0 && inv.pump === 0 && inv.fridge === 0) {
                tipContent = `<strong>Minimalist Profile:</strong> Your load is purely lights and fans. Since you are in the <strong>${readableCategory}</strong> category, ensuring your ${inv.fans} fans are DC Inverter type is the fastest way to drop into a lower tax slab.`;
            }
            // B. PEAK HOUR CASE (6 PM - 10 PM)
            else if (isPeak) {
                if (dominantAppliance.id === 'ac') {
                    tipContent = `<strong>Critical Peak Alert:</strong> Your AC is the #1 cost driver during this expensive window. For <strong>${readableCategory}</strong> users, raising the thermostat to 27°C right now can save approximately Rs. 1,800/month.`;
                } else {
                    tipContent = `<strong>Peak Management:</strong> You are in the high-tax window. Even without AC, your <strong>${dominantAppliance.label}</strong> usage is high. Dimming lights and reducing fan speeds now helps protect your slab eligibility.`;
                }
            }
            // C. MOTOR CASE (Pump or Washing Machine)
            else if (dominantAppliance.id === 'motor') {
                tipContent = `<strong>Neural Sync:</strong> Heavy motor activity detected. Running your Pump/Washer during this <strong>${readableCategory} Off-Peak</strong> hour (${h12}${period}) is a smart financial move—it avoids the 6 PM surcharges.`;
            }
            // D. AFTERNOON HEAT CASE (12 PM - 4 PM)
            else if (hour >= 12 && hour <= 16 && inv.ac > 0) {
                tipContent = `<strong>Thermal Efficiency:</strong> At this heat peak, your ACs are drawing maximum kW. As a <strong>${readableCategory}</strong> consumer, keeping windows sealed now is vital to prevent "creeping" into the next expensive slab.`;
            }
            // E. DEFAULT / EFFICIENT
            else {
                tipContent = `<strong>Standard Efficiency:</strong> Your current load is well-distributed. No specific waste detected for your profile at ${h12}:00. This routine keeps your <strong>${readableCategory}</strong> effective rate stable.`;
            }

            // Render the final tip with the Brain Icon
            tipEl.innerHTML = `<i class="fa fa-brain" style="color:var(--g3); margin-right:8px;"></i> ${tipContent}`;

            document.getElementById('hour-modal').style.display = 'flex';
        }
        // 5. Close Logic
        function closeModal() {
            document.getElementById('hour-modal').style.display = 'none';
            document.body.style.overflow = '';
        }
        // Close on background click
        window.onclick = function (event) {
            let modal = document.getElementById('hour-modal');
            if (event.target == modal) closeModal();
        }

        // ── Archetype card ──
        function renderArchetypeCard(archetype, month) {
            const card = document.getElementById('archetype-card');
            const num = archetype.replace('House', '');
            const mName = new Date(0, month - 1).toLocaleString('default', { month: 'long' });
            document.getElementById('archetype-title').innerText = `Matched Archetype: PRECON Model #${num}`;
            document.getElementById('archetype-desc').innerText =
                `Your appliance inventory was matched against all 41 PRECON dataset households using K-Nearest Neighbours. ` +
                `Model #${num} is the closest structural match. The LSTM used this house's real ${mName} consumption ` +
                `data as its 48-hour seed window — ensuring the forecast reflects an actual household's diurnal pattern rather than a generic estimate.`;
            card.style.display = 'flex';
        }

        // ── DISCO insight ──
        function renderDiscoCard(disco, month, acScale) {
            const card = document.getElementById('disco-card');
            const iconEl = document.getElementById('disco-icon');
            const titleEl = document.getElementById('disco-title');
            const textEl = document.getElementById('disco-insight');
            const isSummer = [5, 6, 7, 8, 9].includes(month);
            const intensity = Math.round(acScale * 100);

            const insights = {
                'K-Electric': {
                    icon: 'fa-droplet',
                    title: 'K-Electric — Load Shedding Impact',
                    text: `K-Electric's load management schedule adds 2–4 hours of outage during peak demand. Your UPS charging cycles are included in this forecast. In ${isSummer ? 'summer months, load-shedding peaks between 2–5 PM' : 'winter, load-shedding is minimal but UPS still charges nightly'}.`
                },
                'LESCO': {
                    icon: 'fa-city',
                    title: 'LESCO — Urban Heat Island',
                    text: `Lahore's dense urban construction retains heat past midnight, forcing AC to run 1–2 hours longer into the night than similar rural households. This is reflected in the evening plateau of your forecast.`
                },
                'IESCO': {
                    icon: 'fa-mountain-sun',
                    title: 'IESCO — Capital Microclimate',
                    text: `Islamabad's higher elevation (550m) gives your AC a slight efficiency advantage — roughly 5% better COP than sea-level equivalents. However, winter heating loads from geysers and heaters are captured in your base load.`
                },
                'MEPCO': {
                    icon: 'fa-sun-plant-wilt',
                    title: 'MEPCO — Extreme Heat Zone',
                    text: `Multan is one of the hottest urban zones on Earth during summer. At ${intensity}% thermal intensity, your appliances are working harder than their rated specs. AC efficiency drops ~8% per 5°C above 35°C ambient.`
                },
                'FESCO': {
                    icon: 'fa-industry',
                    title: 'FESCO — Industrial Grid',
                    text: `Faisalabad shares grid capacity with heavy industry. Voltage fluctuations during industrial shift changes (7–8 AM, 5–6 PM) can cause motors to draw 10–15% excess current. A digital stabilizer is recommended.`
                },
                'HESCO': {
                    icon: 'fa-bolt',
                    title: 'HESCO — Extended Load Shedding',
                    text: `HESCO regions experience some of Pakistan's longest load-shedding durations — up to 8 hours in rural areas during summer. Your UPS charging contribution is scaled up accordingly in the forecast.`
                },
                'PESCO': {
                    icon: 'fa-users',
                    title: 'PESCO — Evening Demand Spike',
                    text: `Peshawar shows sharp demand spikes between 7–11 PM as households return simultaneously. Your evening peak in this forecast reflects this regional behavioural pattern from the PRECON training data.`
                },
                'QESCO': {
                    icon: 'fa-mountain',
                    title: 'QESCO — High Altitude Efficiency',
                    text: `Quetta's altitude (1680m) reduces air density, which slightly lowers heat exchanger effectiveness. Your AC demand is 15–20% lower than an equivalent Lahore household — reflected in the flatter midday profile.`
                },
            };

            const d = insights[disco] || {
                icon: 'fa-bolt',
                title: 'Regional Grid Note',
                text: 'Standard national grid patterns applied. Select your Distribution Company in Setup Profile for region-specific insights.',
            };

            iconEl.className = `fa ${d.icon}`;
            iconEl.style.color = 'var(--g2)';
            titleEl.innerText = d.title;
            textEl.innerText = d.text;
            card.style.display = 'block';
        }
        function logout() { logDetailedEvent('logout'); firebase.auth().signOut().then(() => window.location.href = 'login.html'); }
