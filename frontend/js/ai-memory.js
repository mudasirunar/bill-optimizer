const db = firebase.firestore();

        function formatMonth(monthStr) {
            if (!monthStr || !monthStr.includes('-')) return monthStr;
            const [year, month] = monthStr.split('-');
            const date = new Date(year, parseInt(month) - 1, 1);
            return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
        }

        firebase.auth().onAuthStateChanged(user => {
            initDynamicBreadcrumb("AI Memory");
            if (!user) { window.location.href = "login.html"; return; }

            // Trigger loading line as soon as auth resolves and loading begins
            const loadingLine = document.getElementById('top-loading-line');
            if (loadingLine) loadingLine.style.display = 'block';

            document.getElementById('user-name-display').innerText = user.displayName || user.email.split('@')[0];
            if (user.photoURL) document.getElementById('user-pfp').src = user.photoURL;

            db.collection('users').doc(user.uid).get().then(doc => {

                const historyLoader = document.getElementById('history-loader');
                const historyTable = document.getElementById('history-table');

                if (!doc.exists) {
                    console.warn("AI Memory: No profile found. Initializing empty view.");
                }

                const d = doc.exists ? doc.data() : {};
                document.getElementById('maturity-container').style.display = 'block';

                const has = (v) => v !== undefined && v !== null && v !== "";
                const hasData = (keys) => keys.some(k => has(d[k]));

                const emptyMsg = (text) => `
                <div class="card-empty-state">
                    <i class="fa fa-database"></i>
                    <p>${text}</p>
                    <a href="setup-profile.html" class="btn-outline" style="padding: 8px 16px; font-size: 0.7rem;">Initialize Context</a>
                </div>`;


                // 1. SCORING & GAP ANALYSIS
                let score = 0;
                let gaps = [];

                // Context (30pts)
                if (has(d.disco)) score += 10; else gaps.push("Regional Grid Context");
                if (has(d.sanctioned_load)) score += 10; else gaps.push("Load Capacity Data");
                if (has(d.property_area) && has(d.person_count)) score += 10; else gaps.push("Structural Dimensions");

                // Inventory (30pts)
                const hasAC = (has(d.ac_std_qty) || has(d.ac_inv_qty));
                const hasFans = (has(d.fan_ac_qty) || has(d.fan_dc_qty));
                const hasFridge = has(d.f_qty);
                const hasIron = has(d.iron_qty);
                if (hasAC) score += 7.5; else gaps.push("AC Consumption Profile");
                if (hasFans) score += 7.5; else gaps.push("Air-Flow Load Signature");
                if (hasFridge) score += 7.5; else gaps.push("Refrigeration Efficiency");
                if (hasIron) score += 7.5; else gaps.push("Clothes Iron Signature");

                // History (40pts)
                const validHistory = (d.bill_history || []).filter(b => parseFloat(b.units) > 5);
                const historyCount = validHistory.length;
                score += Math.min(historyCount * 4, 40);

                // Add the "Time Gap" if hardware is done but history is low
                if (historyCount < 10 && gaps.length === 0) {
                    gaps.push(`${10 - historyCount} Months of Seasonal Data`);
                }

                // 2. GET DYNAMIC BRIEFING FROM THE BRAIN
                const briefing = getNeuralBriefing(d, score, historyCount, gaps);

                // 3. UPDATE UI
                const pct = Math.round(score);
                document.getElementById('maturity-pct').innerText = pct + "%";
                document.getElementById('maturity-status').innerText = briefing.status;
                document.getElementById('maturity-status').style.color = briefing.color;
                document.getElementById('maturity-briefing').innerHTML = briefing.html;

                // Update Bar Segments
                const segments = document.querySelectorAll('.bar-segment');
                const activeCount = Math.floor(pct / 10);
                segments.forEach((s, i) => {
                    s.classList.remove('active', 'last');
                    if (i < activeCount) {
                        s.classList.add('active');
                        if (i === activeCount - 1) s.classList.add('last');
                    }
                });

                // Update Gaps
                if (gaps.length > 0) {
                    document.getElementById('maturity-gaps').innerHTML = `
                    <div style="margin-top:15px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05)">
                        <div style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px">
                            <i class="fa fa-microchip"></i> System Requirements for 100% Mastery:
                        </div>
                        ${gaps.map(g => `<span class="gap-tag" style="background:rgba(52,211,153,0.05); border:1px solid rgba(52,211,153,0.2); color:var(--g3)">${g}</span>`).join(" ")}
                    </div>`;
                }


                // ─── 1. CORE UTILITIES ───
                const formatValue = (val, suffix = "", contextName = "DATA") => {
                    if (val === undefined || val === null || val === "" || val === 0 || val === "0") {
                        return `<span class="missing-context">[MISSING ${contextName}]</span>`;
                    }
                    return `${val} <small>${suffix}</small>`;
                };

                const formatTechnicalLabel = (val) => {
                    const dictionary = {
                        'standard': 'Standard', 'inverter': 'Inverter', 'old': 'Standard',
                        'manual': 'Manual', 'automatic': 'Automatic', 'modified': 'Modified Sine',
                        'pure': 'Pure Sine', 'lead_acid': 'Lead-Acid', 'lithium': 'Lithium'
                    };
                    return dictionary[val] || val;
                };

                const formatFrequencyTag = (val) => {
                    const f = parseFloat(val);
                    if (f >= 28) return "Daily";
                    if (f >= 4 && f <= 5) return "Weekly";
                    if (f === 1) return "Monthly";
                    return "";
                };

                const createTypeChip = (val) => {
                    if (!val || val === "" || val === 0) return "";
                    return `<span class="data-type-tag">${formatTechnicalLabel(val)}</span>`;
                };

                const renderAppliance = (prefix, dataKey, labelText, icon, monthlyVal) => {
                    const qtyVal = d[dataKey + '_qty'];
                    const dispEl = document.getElementById('disp-' + prefix);
                    const labelEl = document.getElementById('label-' + prefix);

                    if (!dispEl || !labelEl) return;

                    if (qtyVal === undefined || qtyVal === null || qtyVal === "") {
                        dispEl.innerHTML = formatValue(null, "", labelText.toUpperCase());
                    } else if (parseFloat(qtyVal) === 0) {
                        dispEl.innerHTML = `<div style="text-align: right; width: 100%; color:var(--text-dim); font-size:0.75rem; font-style:italic; font-weight:600;"><i class="fa fa-circle-minus" style="margin-right:4px; opacity:0.6"></i>Not Owned</div>`;
                    } else {
                        const qty = parseFloat(qtyVal) || 0;
                        const hrs = d[dataKey + '_val'] || 0;
                        const freq = d[dataKey + '_freq'] || 0;

                        // 1. Label Chips (Type/Battery)
                        let chips = createTypeChip(d[dataKey + '_type']);
                        if (dataKey === 'u') chips += createTypeChip(d.u_battery);
                        if (dataKey === 'wp' && d.wp_type) chips = createTypeChip(d.wp_type + " HP");
                        labelEl.innerHTML = `<i class="${icon}"></i> ${labelText} ${chips}`;

                        // 2. Logic for Frequency Text
                        const freqText = formatFrequencyTag(freq);
                        const freqTag = (hrs > 0 && freqText) ? `<div style="font-size:0.55rem; color:var(--text-dim); margin-top:2px; text-transform:uppercase; letter-spacing:0.02em">${freqText}</div>` : "";

                        const kwhVal = Math.round(monthlyVal || 0);

                        // 3. Three-Column Layout: Qty | kWh | Usage + Frequency Text
                        dispEl.innerHTML = `
                        <div style="display: flex; align-items: center; width: 100%; justify-content: space-between;">
                            <div style="font-family:'Syne'; font-weight:800; color:var(--g3); min-width:30px">${qty}x</div>
                            <span style="color:var(--border); font-weight: 300;">|</span>
                            <div style="text-align: center; flex: 1;">
                                ${kwhVal > 0 ? kwhVal + ' <small>kWh</small>' : formatValue(null, "", "LOAD")}
                            </div>
                            <span style="color:var(--border); font-weight: 300;">|</span>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; min-width:60px;">
                                <div style="line-height:1; font-weight:600;">
                                    ${hrs > 0 ? hrs + ' <small style="font-size:0.6rem">Hrs</small>' : formatValue(null, "", "TIME")}
                                </div>
                                ${freqTag}
                            </div>
                        </div>`;
                    }
                };

                // 1. CHECK SYSTEM CONTEXT DATA
                const systemKeys = ['disco', 'sanctioned_load', 'user_category'];
                if (!hasData(systemKeys)) {
                    document.getElementById('body-system').innerHTML = emptyMsg("No regional utility context found in AI memory.");
                } else {
                    document.getElementById('disp-disco').innerHTML = formatValue(d.disco, "", "REGIONAL GRID");
                    document.getElementById('disp-load').innerHTML = formatValue(d.sanctioned_load, "kW", "CAPACITY");

                    // Consumer Class Fallback
                    const cat = d.user_category;
                    const catDisplay = cat === 'lifeline' ? 'Lifeline' : (cat === 'protected' ? 'Protected' : (cat ? 'Standard' : null));
                    document.getElementById('disp-protected').innerHTML = catDisplay
                        ? `<span class="status-badge">${catDisplay}</span>`
                        : formatValue(null, "", "CLASS");
                }

                // 2. CHECK LIFESTYLE DATA
                const lifestyleKeys = ['person_count', 'property_area', 'floors', 'user_routine'];
                if (!hasData(lifestyleKeys)) {
                    document.getElementById('body-lifestyle').innerHTML = emptyMsg("Lifestyle fingerprint is currently empty.");
                } else {
                    document.getElementById('disp-occupants').innerHTML = formatValue(d.person_count, "", "PEOPLE");
                    document.getElementById('disp-area').innerHTML = formatValue(d.property_area, "sq.ft", "AREA");
                    document.getElementById('disp-floors').innerHTML = formatValue(d.floors, "", "LEVELS");
                    const routineMap = { 'standard': 'Standard', 'morning_active': 'Morning Heavy', 'evening_active': 'Evening Heavy', 'all_day': 'Always Active' };
                    document.getElementById('disp-routine').innerHTML = d.user_routine ? routineMap[d.user_routine] : formatValue(null, "", "ROUTINE");
                }

                // 3. CHECK APPLIANCES DATA
                const appKeys = ['ac_std_qty', 'ac_inv_qty', 'fan_ac_qty', 'fan_dc_qty', 'f_qty', 'wm_qty', 'wp_qty', 'u_qty', 'k_qty', 'iron_qty'];
                if (!hasData(appKeys)) {
                    document.getElementById('body-appliances').innerHTML = emptyMsg("No appliance inventory signatures detected.");
                } else {
                    const acStdQty = d.ac_std_qty;
                    const acInvQty = d.ac_inv_qty;
                    const acDisp = document.getElementById('disp-ac');
                    const acLabel = document.getElementById('label-ac');

                    // Top Label remains clean
                    acLabel.innerHTML = `<i class="fa fa-snowflake"></i> Air Conditioning`;

                    if (acStdQty === undefined && acInvQty === undefined) {
                        acDisp.innerHTML = formatValue(null, "", "A/C UNITS");
                    } else if (parseFloat(acStdQty || 0) === 0 && parseFloat(acInvQty || 0) === 0) {
                        acDisp.innerHTML = `<div style="text-align: right; width: 100%; color:var(--text-dim); font-size:0.75rem; font-style:italic; font-weight:600;"><i class="fa fa-circle-minus" style="margin-right:4px; opacity:0.6"></i>Not Owned</div>`;
                    } else {
                        let rowsHtml = `<div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">`;

                        const renderAcRow = (qty, hrs, freq, typeLabel, powerKW) => {
                            // Calculate kWh for this specific type for display
                            const freqVal = parseFloat(freq) || 0;
                            const kwh = Math.round(qty * powerKW * hrs * freqVal);
                            const freqTag = hrs > 0 ? `<span style="font-size:0.5rem; color:var(--text-dim); text-transform:uppercase;">${formatFrequencyTag(freq)}</span>` : "";

                            return `
                            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 0.85rem;">
                                <div style="min-width:65px; line-height:1.1">
                                    <b style="color:var(--g3)">${qty}x</b> 
                                    <div style="font-size:0.6rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.02em">${typeLabel}</div>
                                </div>
                                <span style="color:var(--border); font-weight: 300;">|</span>
                                <div style="text-align: center; flex: 1; font-family:'Syne'; font-weight:600;">
                                    ${kwh > 0 ? kwh : '--'} <small style="font-size:0.6rem; font-weight:400; color:var(--text-dim)">kWh</small>
                                </div>
                                <span style="color:var(--border); font-weight: 300;">|</span>
                                <div style="text-align: right; min-width:60px; line-height:1.1">
                                    <div style="font-weight:600">${hrs > 0 ? hrs + ' <small>Hrs</small>' : '--'}</div>
                                    ${freqTag}
                                </div>
                            </div>
                        `;
                        };

                        if (parseFloat(acStdQty) > 0) rowsHtml += renderAcRow(acStdQty, d.ac_std_val, d.ac_std_freq, 'Standard', 1.5);
                        if (parseFloat(acInvQty) > 0) rowsHtml += renderAcRow(acInvQty, d.ac_inv_val, d.ac_inv_freq, 'Inverter', 0.75);

                        rowsHtml += `</div>`;
                        acDisp.innerHTML = rowsHtml;
                    }
                    renderAppliance('fridge', 'f', 'Fridge', 'fa fa-box', d.refrigerator_monthly);
                    renderAppliance('wm', 'wm', 'Washing Machine', 'fa fa-soap', d.wm_monthly);
                    renderAppliance('wp', 'wp', 'Pump', 'fa fa-water', d.wp_monthly);
                    renderAppliance('ups', 'u', 'UPS', 'fa fa-car-battery', d.ups_monthly);
                    renderAppliance('k', 'k', 'Kitchen', 'fa fa-utensils', d.kitchen_monthly);
                    renderAppliance('iron', 'iron', 'Clothes Iron', 'fa fa-shirt', d.iron_monthly);

                    // ─── 4. FANS (FIXED COLORS: GREEN QTY | GREEN KWH) ───
                    const fAc = d.fan_ac_qty;
                    const fDc = d.fan_dc_qty;
                    const fanDisp = document.getElementById('disp-fans');
                    const fanLabel = document.getElementById('label-fans');

                    fanLabel.innerHTML = `<i class="fa fa-fan"></i> Household Fans`;

                    if (fAc === undefined && fDc === undefined) {
                        fanDisp.innerHTML = formatValue(null, "", "FAN INVENTORY");
                    } else if (parseFloat(fAc || 0) === 0 && parseFloat(fDc || 0) === 0) {
                        fanDisp.innerHTML = `<div style="text-align: right; width: 100%; color:var(--text-dim); font-size:0.75rem; font-style:italic; font-weight:600;"><i class="fa fa-circle-minus" style="margin-right:4px; opacity:0.6"></i>Not Owned</div>`;
                    } else {
                        let fanHtml = `<div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">`;

                        const renderFanRow = (qty, typeLabel, powerKW) => {
                            const kwh = Math.round(qty * powerKW * 12 * 30);

                            return `
                            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 0.85rem;">
                                <div style="min-width:110px; line-height:1.1">
                                    <b style="color:var(--g3)">${qty}x</b> 
                                    <div style="font-size:0.6rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.02em">${typeLabel}</div>
                                </div>
                                
                                <span style="color:var(--border); font-weight: 300;">|</span>
                                
                                <div style="text-align: right; flex: 1; font-family:'Syne'; font-weight:800;">
                                    <span style="color:var(--g3); font-size: 1.1rem;">${kwh}</span> 
                                    <small style="font-size:0.65rem; font-weight:400; color:var(--text-dim); margin-left: 2px;">kWh</small>
                                </div>
                            </div>
                        `;
                        };

                        if (parseFloat(fAc) > 0) fanHtml += renderFanRow(fAc, 'Standard AC', 0.080);
                        if (parseFloat(fDc) > 0) fanHtml += renderFanRow(fDc, 'Inverter DC', 0.035);

                        fanHtml += `</div>`;
                        fanDisp.innerHTML = fanHtml;
                    }

                    document.getElementById('disp-mean').innerHTML = d.mean_hourly
                        ? `${d.mean_hourly.toFixed(4)} <small>kW</small>`
                        : formatValue(null, "", "LOAD_FACTOR");
                }

                // ─── 5. HISTORY ───
                historyLoader.style.display = 'none';
                historyTable.style.display = 'table';
                const tbody = document.getElementById('history-table-body');
                if (d.bill_history && d.bill_history.length > 0) {
                    tbody.innerHTML = [...d.bill_history]
                        .sort((a, b) => new Date(b.month) - new Date(a.month)) // Chronological sort (Newest first)
                        .map(row => `
                        <tr>
                            <td class="month-cell">${formatMonth(row.month)}</td>
                            <td>${row.units} kWh</td>
                            <td>Rs. ${row.amount.toLocaleString()}</td>
                            <td style="color:var(--g3)"><i class="fa fa-check-circle"></i> Stored</td>
                        </tr>
                    `).join('');
                    document.getElementById('disp-avg-hist').innerHTML = formatValue(Math.round(d.historical_avg_units || 0), "kWh/mo");
                } else {
                    historyTable.style.display = 'none';
                    historyLoader.style.display = 'block';
                    historyLoader.innerHTML = "<div class='empty-state'>No history found.</div>";
                }

                // Successfully loaded! Turn off top-loading line
                if (loadingLine) loadingLine.style.display = 'none';

                setTimeout(() => {
                    document.querySelector('.main-container').classList.add('data-ready');
                }, 400);

            }).catch(err => {
                console.error(err);
                // Turn off loader on crash
                if (loadingLine) loadingLine.style.display = 'none';
                document.getElementById('history-loader').innerHTML = "<div class='empty-state'>Error syncing data. Check Firestore connection.</div>";
            });
        });

        /**
         * THE NEURAL BRAIN: Logic Pool for Dynamic Messaging
         */
        function getNeuralBriefing(data, score, historyCount, gaps) {
            const has = (v) => v !== undefined && v !== null && v !== "";
            const acAnswered = has(data.ac_std_qty) || has(data.ac_inv_qty);
            const fridgeAnswered = has(data.f_qty);
            const hasAnsweredHighLoads = acAnswered && fridgeAnswered;

            const hasHighLoads = (parseFloat(data.ac_std_qty) > 0 || parseFloat(data.ac_inv_qty) > 0 || parseFloat(data.f_qty) > 0);
            const isInefficient = (parseFloat(data.ac_std_qty) > 0 || data.f_type === 'old');
            const isNew = historyCount < 2;

            // Case 1: Initial/Empty Profile
            if (score < 30) {
                return {
                    status: "Neural Vacuum", color: "#f87171",
                    html: "The AI memory bank is <b>Empty</b>. Without structural data, we are relying on blind national averages. Prediction accuracy is currently <b>Critically Low</b>."
                };
            }

            // Case 2: Missing High-Consumption Signatures (Unanswered)
            if (!hasAnsweredHighLoads) {
                return {
                    status: "Signature Deficit", color: "#fbbf24",
                    html: "Context synced, but we are missing <b>High-Load Signatures</b> (AC/Fridge). The AI can predict your base lighting, but it cannot model your peak summer slab risks."
                };
            }

            // Case 3: High Hardware, Low History
            if (score >= 60 && historyCount < 5) {
                return {
                    status: "Cognitive Alignment", color: "#34d399",
                    html: "Hardware inventory is <b>fully mapped</b>. The AI now understands your 'Theoretical Peak,' but it needs more history to calculate your <b>Behavioral Offset</b> (lifestyle habits)."
                };
            }

            // Case 4: Detects Inefficiency Bottlenecks
            if (isInefficient && score > 70) {
                return {
                    status: "Efficiency Latency", color: "#fbbf24",
                    html: "Neural mapping complete. Models show <b>Non-Inverter bottlenecks</b> in your memory. While the AI is confident, it expects high volatility in your summer transition months."
                };
            }

            // Case 5: Near Mastery
            if (score >= 85 && score < 100) {
                return {
                    status: "High-Fidelity", color: "#10b981",
                    html: "System is reaching <b>High-Fidelity</b>. We have enough data to predict slab breaches with 90%+ confidence. Adding the remaining months of history will finalize your digital twin."
                };
            }

            // Case 6: Full Mastery
            if (score >= 100) {
                return {
                    status: "Neural Mastery", color: "#10b981",
                    html: "<b>Full Environmental Awareness.</b> The AI has perfectly synthesized 12 months of behavior with your physical hardware. You are receiving the highest precision models possible."
                };
            }

            // Default Fallback
            return {
                status: "Memory Syncing", color: "#34d399",
                html: "The AI is processing your household footprint. Data quality is sufficient for <b>Standard Regression</b>, but higher temporal depth will improve accuracy."
            };
        }

        function logout() { logDetailedEvent('logout'); firebase.auth().signOut().then(() => window.location.href = 'login.html'); }
