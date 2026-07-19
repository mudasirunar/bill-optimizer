function formatMonth(monthStr) {
            if (!monthStr || !monthStr.includes('-')) return monthStr || '—';
            const [year, month] = monthStr.split('-');
            const date = new Date(year, parseInt(month) - 1, 1);
            return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
        }

        /* ════════════════════════════════════════
           GREETING
        ════════════════════════════════════════ */
        function getGreeting() {
            const h = new Date().getHours();
            if (h < 5) return 'Good Night';
            if (h < 12) return 'Good Morning';
            if (h < 17) return 'Good Afternoon';
            if (h < 21) return 'Good Evening';
            return 'Good Night';
        }

        /* ════════════════════════════════════════
           PROFILE COMPLETION CALCULATOR
        ════════════════════════════════════════ */
        function calcProfileCompletion(d) {
            let score = 0; const total = 16;
            const has = (v) => v !== undefined && v !== null && v !== "";
            if (has(d.disco)) score++;
            if (has(d.sanctioned_load)) score++;
            if (has(d.user_category)) score++;
            if (has(d.person_count)) score++;
            if (has(d.user_routine)) score++;
            if (has(d.property_area)) score++;
            if (has(d.floors)) score++;
            if (has(d.fan_ac_qty) || has(d.fan_dc_qty)) score++;
            if (has(d.ac_std_qty) || has(d.ac_inv_qty)) score++;
            if (has(d.f_qty)) score++;
            if (has(d.wm_qty)) score++;
            if (has(d.wp_qty)) score++;
            if (has(d.u_qty)) score++;
            if (has(d.k_qty)) score++;
            if (has(d.iron_qty)) score++;
            if ((d.bill_history || []).length > 0) score++;
            return Math.round((score / total) * 100);
        }

        function renderProfileBanner(pct) {
            const banner = document.getElementById('profileBanner');
            const ringFill = document.getElementById('bannerRingFill');
            const pctLabel = document.getElementById('bannerPct');
            const bar = document.getElementById('bannerBar');
            const title = document.getElementById('bannerTitle');
            const desc = document.getElementById('bannerDesc');
            const action = document.getElementById('bannerActionBtn');

            // circumference = 2π × 20 = ~125.66
            const circumference = 125.66;
            const offset = circumference - (pct / 100) * circumference;

            setTimeout(() => {
                ringFill.style.strokeDashoffset = offset;
                bar.style.width = pct + '%';
            }, 300);
            pctLabel.textContent = pct + '%';

            if (pct >= 100) {
                title.textContent = 'AI Memory Complete — All Systems Active';
                desc.textContent = 'Your profile is fully configured. Predictions are at maximum accuracy.';
                action.style.display = 'none';
                banner.classList.add('complete');
            } else if (pct >= 70) {
                title.textContent = 'Almost There — ' + pct + '% of profile complete';
                desc.textContent = 'Add a few more details to unlock full prediction accuracy.';
            } else if (pct >= 40) {
                title.textContent = 'Profile ' + pct + '% Complete — Accuracy Improving';
                desc.textContent = 'Add appliances and bill history for smarter predictions.';
            } else {
                title.textContent = 'New Profile — Setup Required for AI Predictions';
                desc.textContent = 'Complete your household profile to activate the prediction engine.';
            }
        }

        function handleBannerClick() {
            const pct = parseInt(document.getElementById('bannerPct').textContent) || 0;
            if (pct < 100) window.location.href = 'setup-profile.html';
        }

        function formatCategory(cat) {
            if (!cat) return "Category Not Set";
            // Convert un_protected to NON-PROTECTED, protected to PROTECTED, etc.
            let clean = cat.replace('_', '-').toUpperCase();
            if (clean === "UN-PROTECTED") return "NON-PROTECTED";
            return clean;
        }

        /* ════════════════════════════════════════
           STATS ROW RENDERER
        ════════════════════════════════════════ */
        function renderStats(d) {
            const history = (d.bill_history || []).filter(b => b.units > 5);
            const sorted = history.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

            // Last bill
            const lastBillEl = document.getElementById('stat-lastbill');
            const lastMonthEl = document.getElementById('stat-lastbill-month');
            if (sorted.length > 0) {
                const last = sorted[sorted.length - 1];
                const amt = last.amount > 0 ? 'Rs. ' + Math.round(last.amount).toLocaleString() : Math.round(last.units) + ' units';
                lastBillEl.textContent = amt;
                lastMonthEl.textContent = last.month || '—';
            } else {
                lastBillEl.textContent = '—';
                lastMonthEl.textContent = 'No history yet';
            }

            // Avg monthly units
            const avgEl = document.getElementById('stat-avg');
            const trendEl = document.getElementById('stat-trend');
            if (sorted.length >= 1) {
                const avg = Math.round(sorted.reduce((s, b) => s + b.units, 0) / sorted.length);
                avgEl.textContent = avg;
                if (sorted.length >= 2) {
                    const cur = sorted[sorted.length - 1].units;
                    const prev = sorted[sorted.length - 2].units;
                    const pct = ((cur - prev) / prev * 100).toFixed(1);
                    trendEl.style.display = 'inline-flex';
                    if (pct > 7) {
                        trendEl.className = 'stat-trend trend-up';
                        trendEl.innerHTML = '<i class="fa fa-arrow-up"></i> +' + pct + '% vs last';
                    } else if (pct < -7) {
                        trendEl.className = 'stat-trend trend-down';
                        trendEl.innerHTML = '<i class="fa fa-arrow-down"></i> ' + pct + '% vs last';
                    } else {
                        trendEl.className = 'stat-trend trend-flat';
                        trendEl.innerHTML = '<i class="fa fa-minus"></i> Stable';
                    }
                }
            } else {
                avgEl.textContent = '—';
            }

            // ---  Disco & Category ---
            const discoValEl = document.getElementById('stat-disco-val');
            const categoryValEl = document.getElementById('stat-category-val');

            if (d.disco) {
                discoValEl.textContent = d.disco;
                categoryValEl.innerHTML = `<i class="fa fa-shield-halved"></i> ${formatCategory(d.user_category)}`;
            } else {
                discoValEl.textContent = 'Not Set';
                categoryValEl.innerHTML = `<a href="setup-profile.html" style="color:var(--warn); text-decoration:none;">Setup Required</a>`;
            }

            // 4. Household & Area Card (NEW LOGIC)
            const peopleValEl = document.getElementById('stat-people-val');
            const areaValEl = document.getElementById('stat-area-val');

            peopleValEl.textContent = (d.person_count > 0) ? `${d.person_count} People` : '—';

            // Show property area only if it exists in DB
            if (d.property_area && d.property_area > 0) {
                areaValEl.textContent = `${d.property_area} Sq. Yards`;
            } else {
                areaValEl.textContent = '';
            }
        }

        /* ════════════════════════════════════════
           SEASONAL ALERT ENGINE
        ════════════════════════════════════════ */
        const SEASONAL_ALERTS = {
            // month (0-indexed): { type, icon, title, text }
            3: {
                type: 'summer', icon: 'fa-temperature-high', title: '⚡ Summer Surge Incoming — April',
                text: 'Regional temperatures are rising. AC usage typically spikes 40% this month. Use the <a href="load-forecaster.html">Load Forecaster</a> to monitor your cooling curve.'
            },
            4: {
                type: 'summer', icon: 'fa-sun', title: 'Peak Season — May',
                text: 'May is consistently Pakistan\'s 2nd highest consumption month. Inverter ACs running at peak draw. <a href="appliance-simulator.html">Simulate AC savings</a> now.'
            },
            5: {
                type: 'summer', icon: 'fa-fire', title: 'Peak Season — June',
                text: 'NEPRA bills are highest in June. Your AC is likely running 8–10 hrs/day. <a href="prediction-hub.html">View your full prediction</a> to prepare.'
            },
            6: {
                type: 'summer', icon: 'fa-cloud-sun', title: 'Monsoon + Heat — July',
                text: 'Humidity keeps ACs on even at night. Load rarely dips below 60% of peak. Track your daily curve in <a href="load-forecaster.html">Load Forecaster</a>.'
            },
            7: {
                type: 'summer', icon: 'fa-cloud-sun-rain', title: 'Late Peak — August',
                text: 'Bills from Aug are billed in September. Start reducing now to avoid a surprise. <a href="appliance-simulator.html">Try the Simulator</a>.'
            },
            8: {
                type: 'mild', icon: 'fa-wind', title: 'Transition Month — September',
                text: 'AC usage drops ~35% this month. An ideal time to <a href="setup-profile.html">update your profile</a> before winter billing.'
            },
            9: {
                type: 'mild', icon: 'fa-leaf', title: 'Comfortable Season — October',
                text: 'Lowest bills of the year begin now. Fans and lights are your main load. Consider <a href="nepra-info.html">reviewing your tariff category</a>.'
            },
            10: {
                type: 'mild', icon: 'fa-leaf', title: 'Low Season — November',
                text: 'Your base load is now just fans, fridge, and lighting. Ideal to audit if you\'re on the correct NEPRA slab.'
            },
            11: {
                type: 'winter', icon: 'fa-snowflake', title: 'Winter Mode — December',
                text: 'Geysers and room heaters add to your load. If you use electric heating, <a href="setup-profile.html">add it to your profile</a>.'
            },
            0: {
                type: 'winter', icon: 'fa-snowflake', title: 'Cold Month — January',
                text: 'Lowest AC load of the year. Good time to review last year\'s bills and plan appliance upgrades before summer.'
            },
            1: {
                type: 'mild', icon: 'fa-sun', title: 'Pre-Summer — February',
                text: 'Days are warming in southern Pakistan. A good time to service your AC before the rush.'
            },
            2: {
                type: 'mild', icon: 'fa-temperature-half', title: 'Early Heat — March',
                text: 'AC usage begins in March. <a href="prediction-hub.html">Check your April prediction</a> to see how your summer shapes up.'
            },
        };

        function renderSeasonalAlert(dismissed) {
            if (dismissed) return;
            const m = new Date().getMonth();
            const data = SEASONAL_ALERTS[m];
            if (!data) return;
            const el = document.getElementById('seasonalAlert');
            el.className = 'seasonal-alert ' + data.type;
            el.style.display = 'flex';
            document.getElementById('alertIcon').className = 'fa ' + data.icon;
            document.getElementById('alertTitle').textContent = data.title;
            document.getElementById('alertText').innerHTML = data.text;
        }

        /* ════════════════════════════════════════
           RECENT BILLS TIMELINE
        ════════════════════════════════════════ */
        const BILL_COLORS = ['#34d399', '#10b981', '#059669', '#6ee7b7', '#a7f3d0'];

        function renderBillTimeline(history) {
            const container = document.getElementById('billTimelineContainer');
            const valid = history.filter(b => b.units > 0).sort((a, b) => (a.month || '').localeCompare(b.month || '')).slice(-6).reverse();
            if (valid.length === 0) return;
            const maxUnits = Math.max(...valid.map(b => b.units));
            let html = '<div class="bill-timeline">';
            valid.forEach((b, i) => {
                const barWidth = maxUnits > 0 ? Math.round((b.units / maxUnits) * 100) : 0;
                const amt = b.amount > 0 ? 'Rs. ' + Math.round(b.amount).toLocaleString() : '—';
                html += `
              <div class="bill-row-item">
                <div class="bill-month-dot" style="background:${BILL_COLORS[i % BILL_COLORS.length]}"></div>
                <div class="bill-month-label">${formatMonth(b.month)}</div>
                <div class="bill-bar-wrap"><div class="bill-bar" style="width:0%" data-w="${barWidth}%"></div></div>
                <div class="bill-units">${Math.round(b.units)} kWh</div>
                <div class="bill-amount">${amt}</div>
              </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
            setTimeout(() => {
                container.querySelectorAll('.bill-bar').forEach(bar => {
                    bar.style.width = bar.dataset.w;
                });
            }, 400);
        }

        /* ════════════════════════════════════════
           AI INSIGHTS PANEL
        ════════════════════════════════════════ */
        function buildInsights(d) {
            const history = (d.bill_history || []).filter(b => b.units > 5);
            const insights = [];
            const avg = history.length > 0 ? history.reduce((s, b) => s + b.units, 0) / history.length : 0;
            const m = new Date().getMonth();

            if (d.ac_type === 'standard' && (d.ac_std_qty || 0) > 0) {
                insights.push({ icon: '⚡', text: `<strong>Inverter Upgrade ROI:</strong> Replacing ${d.ac_std_qty} fixed-speed AC${d.ac_std_qty > 1 ? 's' : ''} with inverter models saves ~40% in cooling costs. Payback period: under 2 years at current NEPRA rates.` });
            }
            if (avg > 350 && d.user_category !== 'protected') {
                insights.push({ icon: '📊', text: `<strong>High Usage Alert:</strong> Your average of ${Math.round(avg)} units/month places you in the Rs. 39–47/kWh slab. Shifting peak-hour appliances could save 12–18%.` });
            }
            if (avg > 80 && avg <= 100) {
                insights.push({ icon: '⚠️', text: `<strong>Lifeline Boundary:</strong> You're averaging ${Math.round(avg)} units — close to the 100-unit ceiling. Crossing it will nearly triple your effective per-unit rate.` });
            }
            if (d.f_type === 'old' && (d.f_qty || 0) > 0) {
                insights.push({ icon: '🧊', text: `<strong>Old Fridge Detected:</strong> Standard compressor fridges consume 2× more than inverter series. Replacing the oldest unit first gives fastest ROI.` });
            }
            if ((m >= 3 && m <= 7) && (d.ac_std_qty || 0) + (d.ac_inv_qty || 0) === 0) {
                insights.push({ icon: '🌡️', text: `<strong>Summer Without AC:</strong> Your profile shows no AC. Fans will be working overtime. Consider checking your <a href="load-forecaster.html" style="color:var(--g3)">24h load curve</a> to identify heat-load devices.` });
            }
            if (history.length < 2) {
                insights.push({ icon: '📅', text: `<strong>Add More History:</strong> You have ${history.length} bill${history.length === 1 ? '' : 's'} saved. Adding 3+ months lets the AI calibrate to your real usage pattern.` });
            }
            if ((d.mean_hourly || 0) > 1.0) {
                insights.push({ icon: '🔌', text: `<strong>High Base Load:</strong> Your average draw is ${(d.mean_hourly || 0).toFixed(2)} kW/hr. Check for ageing compressors or UPS trickle-charging during daytime.` });
            }
            if (insights.length === 0) {
                insights.push({ icon: '✅', text: `<strong>Looking Good:</strong> Your profile is well configured. Check the prediction hub for your latest monthly forecast.` });
                insights.push({ icon: '💡', text: `<strong>NEPRA Tip:</strong> Peak hours (6–10 PM) carry a 25% surcharge. Scheduling washing machines and ironing to mornings reduces your effective rate.` });
            }

            const list = document.getElementById('insightList');
            list.innerHTML = insights.slice(0, 3).map(ins =>
                `<div class="insight-item"><div class="insight-icon">${ins.icon}</div><div class="insight-text">${ins.text}</div></div>`
            ).join('');
        }

        /* ════════════════════════════════════════
           TIP ENGINE (existing, enhanced)
        ════════════════════════════════════════ */
        const GENERAL_TIPS = [
            { ai: false, h: "Peak Hour Alert", t: "NEPRA peak hours are 6 PM–10 PM. Unit rates are up to 25% higher. Shift laundry and heavy appliances to mornings." },
            { ai: false, h: "Fridge Maintenance", t: "Cleaning refrigerator coils every 6 months improves efficiency by up to 15% — that's 5–8 free units per month." },
            { ai: false, h: "Vampire Power", t: "Electronics on standby still draw current. Turning off your router and TV box at night can save ~2 units per month." },
            { ai: false, h: "AC Temperature Tip", t: "Every 1°C above 24°C on your AC saves 3–5% of its energy. 26°C feels comfortable and meaningfully cuts costs." },
            { ai: false, h: "Ironing Strategy", t: "Iron all clothes in one session — the highest draw is during the cold-start heat-up phase, not continuous running." },
            { ai: false, h: "Natural Light Hours", t: "Pakistan averages 8–10 hours of sunlight daily. Open curtains during the day to eliminate daytime lighting load entirely." },
            { ai: false, h: "Motor Scheduling", t: "Run water pumps before 7 AM or after 10 PM to stay outside NEPRA's peak-hour window and avoid surcharges." },
            { ai: false, h: "NEPRA Fixed Charges", t: "Fixed charges apply regardless of usage. For Non-Protected consumers over 200 units, this alone adds Rs. 500+ before any unit rate." },
            { ai: false, h: "Inverter Fan Upgrade", t: "Switching from standard 80W fans to DC inverter fans (35W each) saves ~45 units/month per fan — significant for joint families." },
        ];

        function buildPersonalisedPool(d) {
            const pool = [];
            const histMonths = (d.bill_history || []).length;
            const avgUnits = histMonths >= 2 ? (d.historical_avg_units || 0) : 0;
            const hasHistory = histMonths >= 2 && avgUnits > 0;

            if (hasHistory && d.is_protected && avgUnits > 170 && avgUnits <= 200) {
                pool.push({
                    ai: true, h: "Slab Protection Alert",
                    t: `Your average is ${Math.round(avgUnits)} units — just ${Math.round(200 - avgUnits)} away from losing Protected status. A small reduction this month keeps your subsidised rate.`
                });
            }
            if (hasHistory && avgUnits > 80 && avgUnits <= 100) {
                pool.push({
                    ai: true, h: "Lifeline Boundary",
                    t: `You're averaging ${Math.round(avgUnits)} units — close to the 100-unit Lifeline ceiling. Crossing it will nearly triple your effective per-unit rate.`
                });
            }
            if (hasHistory && !d.is_protected && avgUnits > 350) {
                pool.push({
                    ai: true, h: "High Usage Pattern",
                    t: `Averaging ${Math.round(avgUnits)} units puts you in the Rs. 39–47/kWh slab. Shifting peak-hour appliances could reduce your bill by 12–18%.`
                });
            }
            if ((d.ac_qty || 0) > 0 && d.ac_type === 'standard') {
                pool.push({
                    ai: true, h: "Inverter Upgrade ROI",
                    t: `Your ${d.ac_qty} fixed-speed AC${d.ac_qty > 1 ? 's' : ''} cost ~40% more to run than DC-Inverter models. At current NEPRA rates the upgrade pays back in under 2 years.`
                });
            }
            if ((d.mean_hourly || 0) > 1.0) {
                pool.push({
                    ai: true, h: "High Base Load",
                    t: `Your average draw is ${d.mean_hourly.toFixed(2)} kW/hr. Check for ageing compressors or UPS trickle-charging during daytime hours.`
                });
            }
            if ((d.f_qty || 0) > 0 && d.f_type === 'old') {
                pool.push({
                    ai: true, h: "Fridge Efficiency Gap",
                    t: "Old-model refrigerators consume up to 2× the units of inverter-series models. Consider replacing the oldest unit first for the fastest return."
                });
            }
            if (d.user_routine && d.user_routine !== 'standard') {
                const names = { morning_active: 'Morning Heavy', evening_active: 'Evening Heavy', all_day: 'Always Active' };
                pool.push({
                    ai: true, h: "Pattern Recognition",
                    t: `Your '${names[d.user_routine]}' routine is being used by the LSTM model to forecast today's 24-hour load curve.`
                });
            }
            return pool;
        }

        let tipPool = [], tipIndex = 0, tipTimer = null;
        const DURATION = 6200;

        function startTipEngine(userData) {
            if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
            const personalised = userData ? buildPersonalisedPool(userData) : [];
            tipPool = personalised.length > 0
                ? [...personalised, ...GENERAL_TIPS.slice(0, 4)]
                : [...GENERAL_TIPS];
            tipIndex = 0;
            applyTip(tipPool[0], true);
            buildDots();
            tipTimer = setInterval(advanceTip, DURATION);
        }

        function advanceTip() {
            tipIndex = (tipIndex + 1) % tipPool.length;
            const inner = document.getElementById('tip-inner');
            inner.classList.add('fading');
            setTimeout(() => { applyTip(tipPool[tipIndex], false); inner.classList.remove('fading'); updateDots(); }, 420);
        }

        function applyTip(tip, immediate) {
            const card = document.getElementById('tip-card');
            const icon = document.getElementById('tip-icon');
            const badge = document.getElementById('tip-badge');
            const heading = document.getElementById('tip-heading');
            const text = document.getElementById('tip-text');
            heading.textContent = tip.h;
            text.textContent = tip.t;
            if (tip.ai) {
                badge.innerHTML = `<div class="tip-ai-badge"><i class="fa fa-circle-nodes"></i> AI Insight</div>`;
                card.style.borderColor = 'rgba(52,211,153,0.4)';
                card.style.background = 'rgba(16,185,129,0.1)';
                card.style.boxShadow = '0 0 30px rgba(16,185,129,0.06)';
                icon.style.background = 'rgba(52,211,153,0.18)';
                icon.style.boxShadow = '0 0 14px rgba(16,185,129,0.25)';
            } else {
                badge.innerHTML = '';
                card.style.borderColor = 'rgba(52,211,153,0.2)';
                card.style.background = 'rgba(5,150,105,0.07)';
                card.style.boxShadow = 'none';
                icon.style.background = 'rgba(52,211,153,0.12)';
                icon.style.boxShadow = 'none';
            }
        }

        function buildDots() {
            const c = document.getElementById('tip-dots'); c.innerHTML = '';
            if (tipPool.length <= 1) return;
            for (let i = 0; i < Math.min(tipPool.length, 8); i++) {
                const d = document.createElement('div');
                d.className = 'tip-dot' + (i === 0 ? ' active' : '');
                c.appendChild(d);
            }
        }
        function updateDots() {
            document.querySelectorAll('.tip-dot').forEach((d, i) => d.classList.toggle('active', i === tipIndex % document.querySelectorAll('.tip-dot').length));
        }

        /* ════════════════════════════════════════
           AUTH + MAIN DATA LOAD
        ════════════════════════════════════════ */
        firebase.auth().onAuthStateChanged(user => {
            if (!user) { window.location.href = "login.html"; return; }

            document.body.classList.add('auth-verified');
            const greeting = getGreeting();
            const firstName = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
            document.getElementById('user-name-display').innerText = user.displayName || user.email.split('@')[0];
            document.getElementById('greeting-display').innerText = `${greeting}, ${firstName}`;
            if (user.photoURL) document.getElementById('user-pfp').src = user.photoURL;

            // Start general tips immediately
            startTipEngine(null);
            renderSeasonalAlert(false);

            // Load Firestore data
            const db = firebase.firestore();
            db.collection('users').doc(user.uid).get().then(doc => {
                const d = doc.exists ? doc.data() : {};

                // Update greeting with Firestore name
                const fn = d.firstName || (user.displayName ? user.displayName.split(' ')[0] : firstName);
                document.getElementById('greeting-display').innerText = `${greeting}, ${fn}`;
                document.getElementById('user-name-display').innerText = d.displayName || user.displayName || user.email.split('@')[0];

                // Render all sections
                const pct = calcProfileCompletion(d);
                renderProfileBanner(pct);
                renderStats(d);
                renderBillTimeline(d.bill_history || []);
                buildInsights(d);

                // Dynamic hero subtext
                const heroSub = document.getElementById('hero-sub');
                if (pct >= 80) {
                    // HIGH CONFIDENCE: Emphasis on Synchronization and Precision
                    heroSub.innerHTML = `Neural Engine fully synchronized, <strong>${fn}</strong>. Your data is optimized for high-precision future billing projections and 12-month trends.`;
                } else if (pct >= 40) {
                    // MEDIUM CONFIDENCE: Emphasis on Growth and Refinement
                    heroSub.innerHTML = `Intelligence engine at ${pct}% capacity. Supplement your appliance profile and history to refine your long-term energy forecasts.`;
                }

                if (Object.keys(d).length > 2) startTipEngine(d);

                // Remove the locks from the Banner
                const banner = document.getElementById('profileBanner');
                banner.classList.remove('is-loading-lock', 'banner-waiting');

                // Remove the locks from the Bill History
                const historyCont = document.getElementById('billTimelineContainer');
                historyCont.classList.remove('history-loading', 'is-loading-lock');

                // Fade out the dashboard page loader
                const pageLoader = document.getElementById('dashboard-page-loader');
                if (pageLoader) {
                    pageLoader.style.opacity = '0';
                    pageLoader.style.pointerEvents = 'none';
                    document.body.style.overflow = ''; // Restore scroll
                    setTimeout(() => { pageLoader.style.display = 'none'; }, 500);
                }

            }).catch(err => {
                console.warn("Firestore load error:", err);
                renderProfileBanner(0);
                document.getElementById('stat-lastbill').textContent = '—';
                document.getElementById('stat-avg').textContent = '—';
                document.getElementById('stat-people').textContent = '—';

                // Fade out page loader even on error
                const pageLoader = document.getElementById('dashboard-page-loader');
                if (pageLoader) {
                    pageLoader.style.opacity = '0';
                    pageLoader.style.pointerEvents = 'none';
                    document.body.style.overflow = ''; // Restore scroll
                    setTimeout(() => { pageLoader.style.display = 'none'; }, 500);
                }
            });
        });

        function logout() {
            logDetailedEvent('logout');
            firebase.auth().signOut().then(() => { window.location.href = "login.html"; });
        }
