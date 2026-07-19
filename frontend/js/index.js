// Mobile menu toggle
        const burger = document.getElementById('burgerBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        burger.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
            burger.innerHTML = mobileMenu.classList.contains('open') ? '<i class="fa fa-xmark"></i>' : '<i class="fa fa-bars"></i>';
        });
        mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
            burger.innerHTML = '<i class="fa fa-bars"></i>';
        }));

        // Scroll reveal
        const revealEls = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('in');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.12 });
        revealEls.forEach(el => io.observe(el));

        // Tutorial bar fill animation (trigger once visible)
        const barWrap = document.querySelector('.tutorial-panel');
        if (barWrap) {
            const barIo = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        document.querySelectorAll('.tut-bar-fill').forEach(bar => {
                            bar.style.width = bar.dataset.w;
                        });
                        barIo.unobserve(e.target);
                    }
                });
            }, { threshold: 0.3 });
            barIo.observe(barWrap);
        }

        // Scroll-to-top button
        const scrollBtn = document.getElementById('scrollTopBtn');
        window.addEventListener('scroll', () => {
            scrollBtn.classList.toggle('visible', window.scrollY > 500);
        }, { passive: true });
        scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

        // Navbar CTA reveal — IntersectionObserver on a hero sentinel avoids the
        // rapid on/off flicker that a raw scroll-position check produces near the boundary.
        const navbarEl = document.querySelector('.navbar');
        const heroSentinel = document.getElementById('heroSentinel');
        if (navbarEl && heroSentinel) {
            const navIo = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    navbarEl.classList.toggle('scrolled', !entry.isIntersecting);
                });
            }, { root: null, rootMargin: '-68px 0px 0px 0px', threshold: 0 });
            navIo.observe(heroSentinel);
        }
    


        const firebaseConfig = {
            apiKey: "AIzaSyB1KDRJv0pR8RcgrHhmZBOlzRNVeQEp8K0",
            authDomain: "bill-optimizer-34de9.firebaseapp.com",
            projectId: "bill-optimizer-34de9",
            storageBucket: "bill-optimizer-34de9.firebasestorage.app",
            messagingSenderId: "205204930353",
            appId: "1:205204930353:web:55d44cab9645e5127a7a10",
            measurementId: "G-BG5ETT4MHD"
        };
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        firebase.analytics();

        // Redirect logged-in users to dashboard only when they click login/signup links
        let isUserLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
        firebase.auth().onAuthStateChanged((user) => {
            isUserLoggedIn = !!user;
            if (user) {
                localStorage.setItem('userLoggedIn', 'true');
            } else {
                localStorage.removeItem('userLoggedIn');
            }
        });

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const href = link.getAttribute('href');
                if (href && (href.includes('login') || href.includes('signup'))) {
                    if (isUserLoggedIn) {
                        e.preventDefault();
                        window.location.href = "dashboard.html";
                    }
                }
            }
        });

        // ─── PLAYGROUND INTERACTIVE WIDGET LOGIC ───
        // Tab 1: NEPRA Tariff Calculator
        const unitsSlider = document.getElementById('playUnitsSlider');
        const unitsVal = document.getElementById('playUnitsVal');
        const billVal = document.getElementById('playBillVal');
        const billSub = document.getElementById('playBillSub');
        const slabRateVal = document.getElementById('playSlabRate').querySelector('b');
        const slabFcaVal = document.getElementById('playSlabFca').querySelector('b');
        const slabStatusVal = document.getElementById('playSlabStatus').querySelector('b');

        // NEPRA Engine Rates (matched with nepra_engine.py & config.py)
        const NEPRA_FCA = 0.3364;
        const NEPRA_QTA = -1.9857;

        function calculateNepraBill(units) {
            let energyCost = 0;
            let category = "non_protected";
            let fixedCharges = 0;
            
            const gstRate = 0.18;
            const edRate = 0.015;
            const tvFee = 35.0;
            const loadKw = 1.0; // Standard domestic connection base

            if (units <= 200) {
                category = "protected";
                if (units <= 100) {
                    energyCost = units * 10.54;
                    fixedCharges = loadKw * 200.0;
                } else {
                    energyCost = (100 * 10.54) + ((units - 100) * 13.01);
                    fixedCharges = loadKw * 300.0;
                }
            } else {
                category = "non_protected";
                let tempUnits = units;
                
                const slabs = [
                    [1, 100, 22.44], [101, 200, 28.91], [201, 300, 33.10],
                    [301, 400, 36.46], [401, 500, 38.97], [501, 600, 40.22],
                    [601, 700, 41.85], [701, Infinity, 47.20]
                ];
                
                let prevLimit = 0;
                for (const [low, high, rate] of slabs) {
                    if (tempUnits <= 0) break;
                    const chunk = Math.min(tempUnits, high - prevLimit);
                    energyCost += chunk * rate;
                    tempUnits -= chunk;
                    prevLimit = high;
                }
                
                const fixedRates = [
                    [100, 275.0], [200, 300.0], [300, 350.0],
                    [400, 400.0], [500, 500.0], [700, 675.0], [Infinity, 675.0]
                ];
                
                let ratePerKw = 675.0;
                for (const [limit, rate] of fixedRates) {
                    if (units <= limit) {
                        ratePerKw = rate;
                        break;
                    }
                }
                fixedCharges = loadKw * ratePerKw;
            }
            
            const fca = units * NEPRA_FCA;
            const qta = units * NEPRA_QTA;
            
            const taxableAmount = energyCost + fixedCharges + fca + qta;
            const gst = taxableAmount * gstRate;
            const ed = energyCost * edRate;
            
            const total = energyCost + fixedCharges + fca + qta + gst + ed + tvFee;
            
            let rateDisplay = 47.20;
            if (units <= 100) rateDisplay = category === "protected" ? 10.54 : 22.44;
            else if (units <= 200) rateDisplay = category === "protected" ? 13.01 : 28.91;
            else if (units <= 300) rateDisplay = 33.10;
            else if (units <= 400) rateDisplay = 36.46;
            else if (units <= 500) rateDisplay = 38.97;
            else if (units <= 600) rateDisplay = 40.22;
            else if (units <= 700) rateDisplay = 41.85;
            
            return {
                totalBill: Math.round(total),
                slabRate: rateDisplay,
                category: category === "protected" ? "Protected" : "Non-Prot"
            };
        }

        function updatePlaygroundTariff() {
            const units = parseInt(unitsSlider.value);
            unitsVal.innerText = `${units} kWh`;
            
            const calc = calculateNepraBill(units);
            
            billVal.innerHTML = `Rs. ${calc.totalBill.toLocaleString()} <span>/ month</span>`;
            slabRateVal.innerText = `Rs ${calc.slabRate.toFixed(1)}`;
            slabFcaVal.innerText = `Rs ${NEPRA_FCA.toFixed(2)}`;
            slabStatusVal.innerText = calc.category;

            const limitAlert = document.getElementById('playLimitAlert');
            if (limitAlert) {
                if (units <= 100) {
                    billSub.innerText = "Subsidized lifeline tariff applied.";
                    limitAlert.className = "predict-alert alert-lifeline";
                    limitAlert.style.opacity = "1";
                    limitAlert.innerHTML = `
                        <i class="fa fa-shield-halved"></i>
                        <span><strong>Lifeline Pricing Active!</strong> Heavily subsidized lifeline pricing enabled at Rs 10.54/unit for low energy consumers.</span>
                    `;
                } else if (units <= 200) {
                    billSub.innerText = "Subsidized tariff applied (Protected Status).";
                    limitAlert.className = "predict-alert alert-protected";
                    limitAlert.style.opacity = "1";
                    limitAlert.innerHTML = `
                        <i class="fa fa-circle-check"></i>
                        <span><strong>Protected Status Active!</strong> Subsidized billing applies. Base rates are locked at a maximum of Rs 13.01/unit.</span>
                    `;
                } else {
                    billSub.innerText = "Projected from standard NEPRA rates.";
                    limitAlert.className = "predict-alert alert-unprotected";
                    limitAlert.style.opacity = "1";
                    limitAlert.innerHTML = `
                        <i class="fa fa-triangle-exclamation"></i>
                        <span><strong>Protected Status Lost!</strong> Exceeding 200 units triggers a cumulative slab pricing increase of ~80% across all units.</span>
                    `;
                }
            }
        }

        if (unitsSlider) {
            unitsSlider.addEventListener('input', updatePlaygroundTariff);
            updatePlaygroundTariff();
        }

        // CTA Click Handlers with Auth Checks & Redirection Cache
        function handlePlaygroundCTA(targetPage) {
            if (isUserLoggedIn) {
                window.location.href = targetPage;
            } else {
                sessionStorage.setItem('redirectAfterLogin', targetPage);
                window.location.href = 'login.html';
            }
        }

        const playForecastBtn = document.getElementById('playForecastBtn');
        if (playForecastBtn) {
            playForecastBtn.addEventListener('click', () => {
                handlePlaygroundCTA('prediction-hub.html');
            });
        }

        // ─── INTERACTIVE APPLIANCE SANDBOX LOGIC ───
        const sandAcToggle = document.getElementById('sandAcToggle');
        const sandAcQty = document.getElementById('sandAcQty');
        const sandAcHours = document.getElementById('sandAcHours');
        const sandAcHoursVal = document.getElementById('sandAcHoursVal');

        const sandFanToggle = document.getElementById('sandFanToggle');
        const sandFanQty = document.getElementById('sandFanQty');
        const sandFanHours = document.getElementById('sandFanHours');
        const sandFanHoursVal = document.getElementById('sandFanHoursVal');

        const sandFridgeToggle = document.getElementById('sandFridgeToggle');
        const sandFridgeQty = document.getElementById('sandFridgeQty');

        const sandStandardUnits = document.getElementById('sandStandardUnits');
        const sandOptUnits = document.getElementById('sandOptUnits');
        const sandSavingsVal = document.getElementById('sandSavingsVal');
        const sandSavingsSub = document.getElementById('sandSavingsSub');
        const sandSimulateBtn = document.getElementById('sandSimulateBtn');

        function updateSandboxSavings() {
            if (!sandAcToggle || !sandFanToggle || !sandFridgeToggle) return;

            // Runtime values
            const acHours = parseInt(sandAcHours.value);
            const fanHours = parseInt(sandFanHours.value);
            
            if (sandAcHoursVal) sandAcHoursVal.innerText = `${acHours} hrs`;
            if (sandFanHoursVal) sandFanHoursVal.innerText = `${fanHours} hrs`;

            const acQty = parseInt(sandAcQty.value);
            const fanQty = parseInt(sandFanQty.value);
            const fridgeQty = parseInt(sandFridgeQty.value);

            // Calculations in kWh / Month
            // AC: kW * hrs * 30 days
            const acStdKwh = acQty * 1.5 * acHours * 30;
            const acOptKwh = acQty * (sandAcToggle.checked ? 0.75 : 1.5) * acHours * 30;

            // Fan: kW * hrs * 30 days
            const fanStdKwh = fanQty * 0.08 * fanHours * 30;
            const fanOptKwh = fanQty * (sandFanToggle.checked ? 0.035 : 0.08) * fanHours * 30;

            // Fridge: base kWh/month
            const fridgeStdKwh = fridgeQty * 48;
            const fridgeOptKwh = fridgeQty * (sandFridgeToggle.checked ? 27 : 48);

            const totalStdKwh = acStdKwh + fanStdKwh + fridgeStdKwh;
            const totalOptKwh = acOptKwh + fanOptKwh + fridgeOptKwh;
            const unitsSaved = totalStdKwh - totalOptKwh;

            if (sandStandardUnits) sandStandardUnits.innerText = `${Math.round(totalStdKwh)} kWh`;
            if (sandOptUnits) sandOptUnits.innerText = `${Math.round(totalOptKwh)} kWh`;

            // Rupee impact under NEPRA progressive billing
            const billBase = calculateNepraBill(totalStdKwh).totalBill;
            const billOpt = calculateNepraBill(totalOptKwh).totalBill;
            const savingsRupees = Math.max(0, billBase - billOpt);

            if (sandSavingsVal) {
                sandSavingsVal.innerText = `Rs. ${savingsRupees.toLocaleString()}`;
            }

            if (sandSavingsSub) {
                if (savingsRupees > 0) {
                    let descriptions = [];
                    if (acQty > 0 && sandAcToggle.checked) descriptions.push(`${acQty} Inverter AC`);
                    if (fanQty > 0 && sandFanToggle.checked) descriptions.push(`${fanQty} BLDC Fan(s)`);
                    if (fridgeQty > 0 && sandFridgeToggle.checked) descriptions.push(`${fridgeQty} Inverter Fridge`);

                    if (descriptions.length > 0) {
                        sandSavingsSub.innerHTML = `Upgrading to ${descriptions.join(", ")} reduces demand by ${Math.round(unitsSaved)} units, saving Rs. ${savingsRupees.toLocaleString()} per month.`;
                    } else {
                        sandSavingsSub.innerText = "Toggle switches to upgrade to energy-saving inverter alternatives.";
                    }
                } else {
                    sandSavingsSub.innerText = "All appliances running on standard baseline mode. Upgrade toggles above to estimate savings.";
                }
            }
        }

        // Add listeners
        const elementsToBind = [
            sandAcToggle, sandAcQty, sandAcHours,
            sandFanToggle, sandFanQty, sandFanHours,
            sandFridgeToggle, sandFridgeQty
        ];

        elementsToBind.forEach(el => {
            if (el) {
                const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
                el.addEventListener(eventType, updateSandboxSavings);
            }
        });

        if (sandSimulateBtn) {
            sandSimulateBtn.addEventListener('click', () => {
                handlePlaygroundCTA('appliance-simulator.html');
            });
        }

        // Initial run
        updateSandboxSavings();

        // ─── TERMS AND CONDITIONS MODAL LOGIC ───
        const termsModal = document.getElementById('terms-modal');
        
        window.openTermsModal = function(e) {
            if (e) e.preventDefault();
            if (termsModal) {
                termsModal.style.display = 'flex';
                document.body.style.overflow = 'hidden'; // Disable scroll
            }
        };

        window.closeTermsModal = function() {
            if (termsModal) {
                termsModal.style.display = 'none';
                document.body.style.overflow = 'auto'; // Enable scroll
            }
        };

        // Close on click outside modal content
        if (termsModal) {
            termsModal.addEventListener('click', (e) => {
                if (e.target === termsModal) {
                    closeTermsModal();
                }
            });
        }

        // ─── TUTORIAL PREVIEW TABS & FORECAST SIMULATION ───
        const tutTabMonthly = document.getElementById('tutTabMonthly');
        const tutTabHourly = document.getElementById('tutTabHourly');
        const tutBodyMonthly = document.getElementById('tutBodyMonthly');
        const tutBodyHourly = document.getElementById('tutBodyHourly');

        let previewChart = null;

        function initPreviewChart() {
            const ctx = document.getElementById('tutForecastChart');
            if (!ctx) return;

            const normalData = [1.4, 1.1, 0.9, 1.2, 1.8, 2.4, 2.7, 2.9, 2.8, 4.9, 5.3, 3.6];
            const hoursLabels = ["12 AM", "2 AM", "4 AM", "6 AM", "8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM", "10 PM"];

            previewChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: hoursLabels,
                    datasets: [{
                        label: 'Estimated Demand (kW)',
                        data: normalData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.03)' },
                            ticks: { color: '#64748b', font: { size: 9 } }
                        },
                        y: {
                            min: 0,
                            max: 6,
                            grid: { color: 'rgba(255, 255, 255, 0.03)' },
                            ticks: { color: '#64748b', font: { size: 9 }, stepSize: 2 }
                        }
                    }
                }
            });
        }

        const tutTopbarUrl = document.getElementById('tutTopbarUrl');

        function togglePreviewTabs(activeTab) {
            if (activeTab === 'monthly') {
                tutTabMonthly.classList.add('active-tab');
                tutTabMonthly.style.background = 'rgba(16, 185, 129, 0.1)';
                tutTabMonthly.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                tutTabMonthly.style.color = 'var(--g3)';

                tutTabHourly.classList.remove('active-tab');
                tutTabHourly.style.background = 'none';
                tutTabHourly.style.borderColor = 'transparent';
                tutTabHourly.style.color = 'var(--text-dim)';

                tutBodyMonthly.style.display = 'grid';
                tutBodyHourly.style.display = 'none';

                if (tutTopbarUrl) {
                    tutTopbarUrl.textContent = 'bill-optimizer.vercel.app/dashboard';
                    tutTopbarUrl.href = 'dashboard.html';
                }

                // Smoothly trigger bar chart animations
                document.querySelectorAll('.tut-bar-fill').forEach(bar => {
                    bar.style.width = '0';
                    setTimeout(() => {
                        bar.style.width = bar.dataset.w;
                    }, 50);
                });
            } else {
                tutTabHourly.classList.add('active-tab');
                tutTabHourly.style.background = 'rgba(16, 185, 129, 0.1)';
                tutTabHourly.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                tutTabHourly.style.color = 'var(--g3)';

                tutTabMonthly.classList.remove('active-tab');
                tutTabMonthly.style.background = 'none';
                tutTabMonthly.style.borderColor = 'transparent';
                tutTabMonthly.style.color = 'var(--text-dim)';

                tutBodyMonthly.style.display = 'none';
                tutBodyHourly.style.display = 'flex';

                if (tutTopbarUrl) {
                    tutTopbarUrl.textContent = 'bill-optimizer.vercel.app/load-forecaster';
                    tutTopbarUrl.href = 'load-forecaster.html';
                }

                if (!previewChart) {
                    initPreviewChart();
                }
            }
        }

        if (tutTabMonthly && tutTabHourly) {
            tutTabMonthly.addEventListener('click', () => togglePreviewTabs('monthly'));
            tutTabHourly.addEventListener('click', () => togglePreviewTabs('hourly'));
        }

        const tutBtnNormal = document.getElementById('tutBtnNormal');
        const tutBtnEco = document.getElementById('tutBtnEco');
        const tutShiftChip = document.getElementById('tutShiftChip');

        if (tutBtnNormal && tutBtnEco) {
            tutBtnNormal.addEventListener('click', () => {
                if (!previewChart) return;
                
                previewChart.data.datasets[0].data = [1.4, 1.1, 0.9, 1.2, 1.8, 2.4, 2.7, 2.9, 2.8, 4.9, 5.3, 3.6];
                previewChart.data.datasets[0].borderColor = '#10b981';
                previewChart.data.datasets[0].pointBackgroundColor = '#10b981';
                previewChart.update();

                tutBtnNormal.style.background = 'rgba(16, 185, 129, 0.15)';
                tutBtnNormal.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                tutBtnNormal.style.color = 'var(--g3)';

                tutBtnEco.style.background = 'rgba(255, 255, 255, 0.02)';
                tutBtnEco.style.borderColor = 'var(--border)';
                tutBtnEco.style.color = 'var(--text-dim)';

                if (tutShiftChip) {
                    tutShiftChip.innerHTML = '<i class="fa fa-triangle-exclamation"></i> <span>Peak load detected between 6 PM and 10 PM. Peak rates are up to 25% higher.</span>';
                    tutShiftChip.style.color = '#f87171';
                    tutShiftChip.style.background = 'rgba(239, 68, 68, 0.05)';
                    tutShiftChip.style.borderColor = 'rgba(239, 68, 68, 0.15)';
                }
            });

            tutBtnEco.addEventListener('click', () => {
                if (!previewChart) return;
                
                previewChart.data.datasets[0].data = [1.4, 1.1, 0.9, 1.2, 1.8, 2.4, 2.7, 2.9, 2.8, 2.3, 2.5, 2.2];
                previewChart.data.datasets[0].borderColor = '#06b6d4';
                previewChart.data.datasets[0].pointBackgroundColor = '#06b6d4';
                previewChart.update();

                tutBtnEco.style.background = 'rgba(6, 182, 212, 0.15)';
                tutBtnEco.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                tutBtnEco.style.color = '#22d3ee';

                tutBtnNormal.style.background = 'rgba(255, 255, 255, 0.02)';
                tutBtnNormal.style.borderColor = 'var(--border)';
                tutBtnNormal.style.color = 'var(--text-dim)';

                if (tutShiftChip) {
                    tutShiftChip.innerHTML = '<i class="fa fa-circle-check"></i> <span>Shifted 4.2 kWh during peak hours (6 PM - 10 PM). Bill impact: -18%</span>';
                    tutShiftChip.style.color = 'var(--g3)';
                    tutShiftChip.style.background = 'rgba(52, 211, 153, 0.06)';
                    tutShiftChip.style.borderColor = 'rgba(52, 211, 153, 0.15)';
                }
            });
        }


