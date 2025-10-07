class PlannerPage {
    constructor() {
        this.targetUnits = 200;
        this.currentUnits = 300;
        this.savingsTips = [];
    }

    render() {
        return `
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold mb-2">Savings Planner</h1>
                <p class="text-gray-600 mb-8">AI-powered optimization based on 41 household patterns</p>
                
                <div class="grid lg:grid-cols-2 gap-8">
                    <!-- Goal Setting -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-bullseye mr-3 text-green-600"></i>
                            Set Your Consumption Goal
                        </h2>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Target Monthly Units (Recommended: below 200 for optimal rates)
                            </label>
                            <input type="range" id="target-slider" min="50" max="500" value="${this.targetUnits}" 
                                   class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                            <div class="flex justify-between mt-2">
                                <span class="text-sm text-gray-600">50 units</span>
                                <span id="target-display" class="font-semibold text-green-600">${this.targetUnits} units</span>
                                <span class="text-sm text-gray-600">500 units</span>
                            </div>
                        </div>

                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Your Current Monthly Consumption
                            </label>
                            <input type="number" id="current-units" value="${this.currentUnits}" min="50" max="2000" step="10"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                            <p class="text-xs text-gray-500 mt-1">Enter your current monthly units consumption</p>
                        </div>

                        <button onclick="app.planner.generatePlan()" 
                                class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center">
                            <i class="fas fa-magic mr-2"></i>Generate Optimization Plan
                        </button>
                    </div>

                    <!-- Results & Tips -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-chart-line mr-3 text-green-600"></i>
                            Your Optimization Plan
                        </h2>
                        
                        <div id="plan-results">
                            <div class="text-center text-gray-500 py-12">
                                <i class="fas fa-target text-4xl mb-4 text-gray-400"></i>
                                <p>Set your target and current consumption to generate a personalized plan</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Progress Tracking -->
                <div class="mt-8 bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-tachometer-alt mr-3 text-green-600"></i>
                        Progress Tracking
                    </h2>
                    <div class="grid md:grid-cols-3 gap-6">
                        <div class="text-center p-4 bg-blue-50 rounded-lg">
                            <div class="text-2xl font-bold text-blue-600" id="units-difference">0</div>
                            <div class="text-sm text-blue-700">Units to Save</div>
                        </div>
                        <div class="text-center p-4 bg-green-50 rounded-lg">
                            <div class="text-2xl font-bold text-green-600" id="potential-savings">Rs. 0</div>
                            <div class="text-sm text-green-700">Potential Monthly Savings</div>
                        </div>
                        <div class="text-center p-4 bg-purple-50 rounded-lg">
                            <div class="text-2xl font-bold text-purple-600" id="progress-percentage">0%</div>
                            <div class="text-sm text-purple-700">Goal Progress</div>
                        </div>
                    </div>
                </div>

                <!-- Savings Calculator -->
                <div class="mt-8 bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-calculator mr-3 text-green-600"></i>
                        Savings Calculator
                    </h2>
                    <div class="grid md:grid-cols-2 gap-6">
                        <div>
                            <h3 class="font-semibold mb-4">Select Optimization Measures</h3>
                            <div class="space-y-3" id="savings-measures">
                                ${this.renderSavingsMeasures()}
                            </div>
                            <button onclick="app.planner.calculateSavings()" class="w-full bg-green-600 text-white py-2 rounded-lg mt-4 hover:bg-green-700 transition-colors">
                                Calculate Savings
                            </button>
                        </div>
                        <div>
                            <h3 class="font-semibold mb-4">Savings Breakdown</h3>
                            <div id="savings-breakdown" class="space-y-3">
                                <p class="text-gray-500 text-center py-8">Select measures to see savings breakdown</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSavingsMeasures() {
        const measures = [
            { id: 'led_lights', name: 'LED Lights Upgrade', description: 'Replace all bulbs with LED lights' },
            { id: 'ac_temperature', name: 'AC Temperature Optimization', description: 'Set AC to 24°C instead of lower' },
            { id: 'phantom_load', name: 'Reduce Phantom Load', description: 'Unplug devices when not in use' },
            { id: 'peak_shifting', name: 'Peak Hour Shifting', description: 'Shift usage to off-peak hours' },
            { id: 'efficient_appliances', name: 'Energy Efficient Appliances', description: 'Upgrade to 5-star rated appliances' },
            { id: 'water_heater_timer', name: 'Water Heater Timer', description: 'Use timer for water heater' }
        ];

        return measures.map(measure => `
            <label class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" value="${measure.id}" class="mt-1 text-green-600 focus:ring-green-500">
                <div>
                    <div class="font-medium">${measure.name}</div>
                    <div class="text-sm text-gray-600">${measure.description}</div>
                </div>
            </label>
        `).join('');
    }

    attachEventListeners() {
        const slider = document.getElementById('target-slider');
        const display = document.getElementById('target-display');
        
        slider.addEventListener('input', (e) => {
            this.targetUnits = parseInt(e.target.value);
            display.textContent = `${this.targetUnits} units`;
            this.updateProgressTracking();
        });

        document.getElementById('current-units').addEventListener('input', (e) => {
            this.currentUnits = parseInt(e.target.value) || 0;
            this.updateProgressTracking();
        });
    }

    async generatePlan() {
        const resultsDiv = document.getElementById('plan-results');
        resultsDiv.innerHTML = '<div class="flex justify-center py-8"><div class="loading-spinner"></div><span class="ml-3 text-gray-600">AI is generating your plan...</span></div>';

        try {
            const response = await fetch('http://localhost:5000/api/optimization-tips', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    predicted_units: this.currentUnits,
                    current_units: this.currentUnits
                })
            });

            const result = await response.json();
            this.savingsTips = result.tips || this.getDefaultTips();

            this.updateProgressTracking();
            this.displayPlan();

        } catch (error) {
            this.savingsTips = this.getDefaultTips();
            this.updateProgressTracking();
            this.displayPlan();
        }
    }

    getDefaultTips() {
        const tips = [];
        const difference = this.currentUnits - this.targetUnits;

        if (difference > 200) {
            tips.push("🔴 MAJOR REDUCTION NEEDED: Focus on high-consumption appliances like AC and water heaters");
            tips.push("💡 URGENT: Replace all incandescent bulbs with LED lights - can save up to 80% on lighting");
            tips.push("❄️ CRITICAL: Optimize AC usage - set to 24°C, use timers, maintain filters");
        } else if (difference > 100) {
            tips.push("🟡 SIGNIFICANT REDUCTION: Focus on behavioral changes and appliance optimization");
            tips.push("🌬️ Use fans instead of AC during moderate weather conditions");
            tips.push("🔌 Eliminate phantom load by unplugging electronic devices when not in use");
        } else if (difference > 50) {
            tips.push("🟢 MODERATE REDUCTION: Small adjustments can help you reach your goal");
            tips.push("🌞 Make the most of natural light during daytime hours");
            tips.push("🧺 Use washing machine with full loads and cold water settings");
        } else if (difference > 0) {
            tips.push("🎉 ALMOST THERE: You're close to your goal! Minor optimizations needed");
            tips.push("📊 Continue monitoring your usage to maintain efficient patterns");
        } else {
            tips.push("🏆 GOAL ACHIEVED: Congratulations! You're meeting your consumption goal");
            tips.push("📈 Maintain these efficient usage patterns for continued savings");
        }

        // AI insights from 41 houses
        tips.push("🏠 PATTERN: Similar households save 15-25% with systematic optimization");
        tips.push("⏰ TIMING: Use timers for water heaters and AC to optimize operation hours");
        tips.push("🏠 INSULATION: Ensure proper insulation to reduce cooling/heating needs");

        return tips;
    }

    updateProgressTracking() {
        const difference = Math.max(0, this.currentUnits - this.targetUnits);
        const savings = this.calculatePotentialSavings(difference);
        const progress = this.targetUnits > 0 ? 
            Math.min(100, Math.round((this.targetUnits / this.currentUnits) * 100)) : 0;

        document.getElementById('units-difference').textContent = difference;
        document.getElementById('potential-savings').textContent = `Rs. ${savings}`;
        document.getElementById('progress-percentage').textContent = `${progress}%`;
    }

    calculatePotentialSavings(unitsReduction) {
        if (unitsReduction <= 0) return 0;
        
        // Calculate savings based on current tariff slab
        if (this.currentUnits <= 100) {
            return unitsReduction * 7.74;
        } else if (this.currentUnits <= 200) {
            return unitsReduction * 10.06;
        } else if (this.currentUnits <= 300) {
            return unitsReduction * 26.66;
        } else {
            return unitsReduction * 32.03;
        }
    }

    displayPlan() {
        const resultsDiv = document.getElementById('plan-results');
        const difference = this.currentUnits - this.targetUnits;
        
        resultsDiv.innerHTML = `
            <div class="space-y-6 fade-in">
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 class="font-semibold text-green-800 mb-2 flex items-center">
                        <i class="fas fa-bullseye mr-2"></i>Your Target Analysis
                    </h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-green-700">Target:</span>
                            <div class="font-semibold">${this.targetUnits} units/month</div>
                        </div>
                        <div>
                            <span class="text-green-700">Current:</span>
                            <div class="font-semibold">${this.currentUnits} units/month</div>
                        </div>
                    </div>
                    <p class="text-green-700 mt-2 text-sm">You need to save <strong>${difference} units</strong> to reach your goal.</p>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 class="font-semibold text-blue-800 mb-3 flex items-center">
                        <i class="fas fa-tips mr-2"></i>Personalized Optimization Tips
                    </h3>
                    <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        ${this.savingsTips.map(tip => `
                            <div class="flex items-start space-x-3">
                                <i class="fas fa-check text-green-500 mt-1 flex-shrink-0"></i>
                                <span class="text-sm text-blue-700">${tip}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 class="font-semibold text-yellow-800 mb-2 flex items-center">
                        <i class="fas fa-chart-line mr-2"></i>Expected Outcomes
                    </h3>
                    <div class="space-y-2 text-sm text-yellow-700">
                        <p>• Potential monthly savings: <strong>Rs. ${this.calculatePotentialSavings(difference)}</strong></p>
                        <p>• Annual savings potential: <strong>Rs. ${this.calculatePotentialSavings(difference) * 12}</strong></p>
                        <p>• Environmental impact: Reduced carbon footprint</p>
                        <p>• Tariff optimization: Better rate slab achievement</p>
                    </div>
                </div>
            </div>
        `;
    }

    async calculateSavings() {
        const selectedMeasures = Array.from(document.querySelectorAll('#savings-measures input:checked'))
            .map(input => input.value);

        if (selectedMeasures.length === 0) {
            utils.showNotification('Please select at least one optimization measure', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/savings-calculator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_units: this.currentUnits,
                    measures: selectedMeasures
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.displaySavingsBreakdown(result);
            }
        } catch (error) {
            this.displayManualSavings(selectedMeasures);
        }
    }

    displaySavingsBreakdown(result) {
        const breakdownDiv = document.getElementById('savings-breakdown');
        
        breakdownDiv.innerHTML = `
            <div class="space-y-4">
                ${result.savings_breakdown.map(item => `
                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                            <div class="font-medium">${this.getMeasureName(item.measure)}</div>
                            <div class="text-sm text-gray-600">Saves ${item.units_saved} units</div>
                        </div>
                        <div class="text-right">
                            <div class="font-semibold text-green-600">Rs. ${item.monthly_savings}</div>
                            <div class="text-xs text-gray-500">${item.reduction_percentage}% reduction</div>
                        </div>
                    </div>
                `).join('')}
                
                <div class="border-t pt-4 mt-4">
                    <div class="flex justify-between items-center font-semibold">
                        <span>Total Monthly Savings:</span>
                        <span class="text-green-600">Rs. ${result.total_monthly_savings}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm text-gray-600 mt-1">
                        <span>Annual Savings:</span>
                        <span>Rs. ${result.annual_savings}</span>
                    </div>
                </div>
            </div>
        `;
    }

    displayManualSavings(measures) {
        const breakdownDiv = document.getElementById('savings-breakdown');
        let totalSavings = 0;
        
        const impactRates = {
            'led_lights': { units: this.currentUnits * 0.08, rate: 20 },
            'ac_temperature': { units: this.currentUnits * 0.15, rate: 25 },
            'phantom_load': { units: this.currentUnits * 0.05, rate: 20 },
            'peak_shifting': { units: this.currentUnits * 0.10, rate: 22 },
            'efficient_appliances': { units: this.currentUnits * 0.12, rate: 25 },
            'water_heater_timer': { units: this.currentUnits * 0.07, rate: 20 }
        };

        const breakdown = measures.map(measure => {
            const impact = impactRates[measure];
            const savings = impact.units * impact.rate;
            totalSavings += savings;
            
            return {
                measure: measure,
                units_saved: Math.round(impact.units),
                monthly_savings: Math.round(savings),
                reduction_percentage: measure === 'led_lights' ? 8 : 
                                   measure === 'ac_temperature' ? 15 :
                                   measure === 'phantom_load' ? 5 :
                                   measure === 'peak_shifting' ? 10 :
                                   measure === 'efficient_appliances' ? 12 : 7
            };
        });

        this.displaySavingsBreakdown({
            savings_breakdown: breakdown,
            total_monthly_savings: Math.round(totalSavings),
            annual_savings: Math.round(totalSavings * 12)
        });
    }

    getMeasureName(measureId) {
        const names = {
            'led_lights': 'LED Lights Upgrade',
            'ac_temperature': 'AC Temperature Optimization',
            'phantom_load': 'Reduce Phantom Load',
            'peak_shifting': 'Peak Hour Shifting',
            'efficient_appliances': 'Energy Efficient Appliances',
            'water_heater_timer': 'Water Heater Timer'
        };
        return names[measureId] || measureId;
    }
}