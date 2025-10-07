class SimulatorPage {
    constructor() {
        this.appliances = [
            { id: 'ac', name: 'Air Conditioner', wattage: 1500, hours: 0, count: 0, category: 'cooling' },
            { id: 'fridge', name: 'Refrigerator', wattage: 150, hours: 24, count: 1, category: 'essential' },
            { id: 'fan', name: 'Ceiling Fan', wattage: 75, hours: 0, count: 0, category: 'cooling' },
            { id: 'light', name: 'LED Light', wattage: 20, hours: 0, count: 0, category: 'lighting' },
            { id: 'tv', name: 'Television', wattage: 100, hours: 0, count: 0, category: 'entertainment' },
            { id: 'computer', name: 'Computer', wattage: 200, hours: 0, count: 0, category: 'work' },
            { id: 'washing_machine', name: 'Washing Machine', wattage: 500, hours: 0, count: 0, category: 'laundry' },
            { id: 'iron', name: 'Electric Iron', wattage: 1000, hours: 0, count: 0, category: 'laundry' },
            { id: 'microwave', name: 'Microwave Oven', wattage: 1000, hours: 0, count: 0, category: 'kitchen' },
            { id: 'water_heater', name: 'Water Heater', wattage: 2000, hours: 0, count: 0, category: 'heating' }
        ];
        this.totalUnits = 0;
        this.estimatedBill = 0;
        this.consumerType = 'General';
    }

    render() {
        return `
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold mb-2">Enhanced Usage Simulator</h1>
                <p class="text-gray-600 mb-8">Based on AI analysis of 41 real Pakistani households</p>
                
                <div class="grid lg:grid-cols-2 gap-8">
                    <!-- Appliances Panel -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-sliders-h mr-3 text-green-600"></i>
                            Manage Your Appliances
                        </h2>
                        
                        <!-- Consumer Type Selection -->
                        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Consumer Type</label>
                            <select id="consumer-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="Protected">Protected (Up to 200 units)</option>
                                <option value="Lifeline">Lifeline (Up to 100 units)</option>
                                <option value="General" selected>General (Above 200 units)</option>
                                <option value="Commercial">Commercial</option>
                            </select>
                        </div>
                        
                        <div class="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            ${this.appliances.map(appliance => this.renderApplianceControl(appliance)).join('')}
                        </div>
                    </div>

                    <!-- Enhanced Results Panel -->
                    <div class="space-y-6">
                        <!-- Real-time Results -->
                        <div class="bg-white rounded-2xl shadow-lg p-6">
                            <h2 class="text-xl font-semibold mb-6 flex items-center">
                                <i class="fas fa-chart-line mr-3 text-green-600"></i>
                                Consumption Results
                            </h2>
                            
                            <!-- Consumption Summary -->
                            <div class="grid grid-cols-2 gap-4 mb-6">
                                <div class="text-center p-4 bg-green-50 rounded-xl">
                                    <p class="text-gray-600 text-sm mb-1">Monthly Consumption</p>
                                    <p class="text-3xl font-bold text-green-600" id="total-units">${this.totalUnits}</p>
                                    <p class="text-gray-500 text-xs">Units</p>
                                </div>
                                <div class="text-center p-4 bg-blue-50 rounded-xl">
                                    <p class="text-gray-600 text-sm mb-1">Estimated Bill</p>
                                    <p class="text-2xl font-bold text-blue-600" id="estimated-bill">Rs. ${this.estimatedBill}</p>
                                    <p class="text-gray-500 text-xs">Per Month</p>
                                </div>
                            </div>

                            <!-- Tariff Information -->
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-semibold text-yellow-800">Current Tariff Slab</h4>
                                        <p class="text-yellow-700 text-sm" id="tariff-slab">Calculating...</p>
                                    </div>
                                    <i class="fas fa-info-circle text-yellow-600 text-xl"></i>
                                </div>
                            </div>
                        </div>

                        <!-- Consumption Breakdown -->
                        <div class="bg-white rounded-2xl shadow-lg p-6">
                            <h3 class="font-semibold mb-4 flex items-center">
                                <i class="fas fa-chart-pie mr-2 text-green-600"></i>
                                Consumption Breakdown
                            </h3>
                            <div id="consumption-breakdown" class="space-y-3">
                                ${this.renderConsumptionBreakdown()}
                            </div>
                        </div>

                        <!-- AI Insights -->
                        <div class="bg-white rounded-2xl shadow-lg p-6">
                            <h3 class="font-semibold mb-4 flex items-center">
                                <i class="fas fa-robot mr-2 text-green-600"></i>
                                AI Insights
                            </h3>
                            <div id="ai-insights" class="text-sm text-gray-600 space-y-2">
                                ${this.renderAIInsights()}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Comparison Section -->
                <div class="mt-8 bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-home mr-3 text-green-600"></i>
                        Compare with Similar Households
                    </h2>
                    <div class="text-center py-4">
                        <button onclick="app.simulator.compareWithSimilar()" 
                                class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center mx-auto">
                            <i class="fas fa-chart-bar mr-2"></i>Compare with 41-House Dataset
                        </button>
                        <div id="comparison-result" class="mt-4"></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderApplianceControl(appliance) {
        const categoryColors = {
            'cooling': 'bg-blue-50 border-blue-200',
            'essential': 'bg-green-50 border-green-200', 
            'lighting': 'bg-yellow-50 border-yellow-200',
            'entertainment': 'bg-purple-50 border-purple-200',
            'work': 'bg-indigo-50 border-indigo-200',
            'laundry': 'bg-pink-50 border-pink-200',
            'kitchen': 'bg-orange-50 border-orange-200',
            'heating': 'bg-red-50 border-red-200'
        };

        return `
            <div class="appliance-card border rounded-lg p-4 ${categoryColors[appliance.category]} transition-all duration-200">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <h3 class="font-semibold">${appliance.name}</h3>
                        <p class="text-sm text-gray-600">${appliance.wattage} Watts • ${appliance.category}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="app.simulator.decreaseCount('${appliance.id}')" 
                                class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                            <i class="fas fa-minus text-sm"></i>
                        </button>
                        <span class="font-semibold w-8 text-center" id="${appliance.id}-count">${appliance.count}</span>
                        <button onclick="app.simulator.increaseCount('${appliance.id}')" 
                                class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                            <i class="fas fa-plus text-sm"></i>
                        </button>
                    </div>
                </div>
                
                <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">Hours per day:</span>
                    <input type="number" id="${appliance.id}-hours" 
                           value="${appliance.hours}" min="0" max="24" step="0.5"
                           class="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                           onchange="app.simulator.updateHours('${appliance.id}', this.value)">
                </div>
            </div>
        `;
    }

    renderConsumptionBreakdown() {
        const activeAppliances = this.appliances.filter(app => app.count > 0 && app.hours > 0);
        
        if (activeAppliances.length === 0) {
            return '<p class="text-gray-500 text-center py-4">No appliances active. Add appliances to see breakdown.</p>';
        }

        return activeAppliances.map(app => {
            const dailyUnits = (app.wattage * app.hours * app.count) / 1000;
            const monthlyUnits = dailyUnits * 30;
            const percentage = (monthlyUnits / this.totalUnits * 100) || 0;
            
            return `
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-3">
                        <span class="w-3 h-3 rounded-full ${this.getCategoryColor(app.category)}"></span>
                        <span class="text-sm">${app.name} (${app.count}x)</span>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold text-sm">${monthlyUnits.toFixed(1)} units</div>
                        <div class="text-xs text-gray-500">${percentage.toFixed(1)}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAIInsights() {
        if (this.totalUnits === 0) {
            return '<p class="text-gray-500">Add appliances and usage hours to get AI insights</p>';
        }

        const insights = [];
        
        if (this.totalUnits > 500) {
            insights.push('🔴 Very high consumption detected. Consider energy audit.');
        } else if (this.totalUnits > 300) {
            insights.push('🟡 High consumption. Focus on AC optimization.');
        } else if (this.totalUnits > 200) {
            insights.push('🟢 Medium consumption. Good optimization opportunities.');
        }
        
        const acUsage = this.appliances.find(a => a.id === 'ac');
        if (acUsage && acUsage.count > 0 && acUsage.hours > 0) {
            insights.push('❄️ AC is major contributor. Set to 24°C for savings.');
        }
        
        if (this.estimatedBill > 10000) {
            insights.push('💰 High bill potential. Consider tariff optimization.');
        }
        
        insights.push('💡 Based on patterns from 41 real households');
        insights.push('⏰ Peak hours (6-10 PM) increase costs significantly');
        
        return insights.map(insight => `<div>${insight}</div>`).join('');
    }

    getCategoryColor(category) {
        const colors = {
            'cooling': 'bg-blue-500',
            'essential': 'bg-green-500',
            'lighting': 'bg-yellow-500',
            'entertainment': 'bg-purple-500',
            'work': 'bg-indigo-500',
            'laundry': 'bg-pink-500',
            'kitchen': 'bg-orange-500',
            'heating': 'bg-red-500'
        };
        return colors[category] || 'bg-gray-500';
    }

    increaseCount(applianceId) {
        const appliance = this.appliances.find(a => a.id === applianceId);
        if (appliance) {
            appliance.count++;
            this.updateDisplay();
        }
    }

    decreaseCount(applianceId) {
        const appliance = this.appliances.find(a => a.id === applianceId);
        if (appliance && appliance.count > 0) {
            appliance.count--;
            this.updateDisplay();
        }
    }

    updateHours(applianceId, hours) {
        const appliance = this.appliances.find(a => a.id === applianceId);
        if (appliance) {
            appliance.hours = parseFloat(hours) || 0;
            this.updateDisplay();
        }
    }

    calculateConsumption() {
        this.totalUnits = this.appliances.reduce((total, app) => {
            if (app.count > 0 && app.hours > 0) {
                const dailyUnits = (app.wattage * app.hours * app.count) / 1000;
                return total + (dailyUnits * 30);
            }
            return total;
        }, 0);

        this.totalUnits = Math.round(this.totalUnits * 100) / 100;
        this.calculateBill();
    }

    calculateBill() {
        const consumerType = document.getElementById('consumer-type').value;
        const units = this.totalUnits;

        // Calculate bill based on Nepra slabs
        let bill = 0;
        
        switch(consumerType) {
            case 'Lifeline':
                if (units <= 100) bill = units * 3.95;
                else bill = 100 * 3.95 + (units - 100) * 7.74;
                break;
            case 'Protected':
                if (units <= 100) bill = units * 7.74;
                else if (units <= 200) bill = 100 * 7.74 + (units - 100) * 10.06;
                else bill = 100 * 7.74 + 100 * 10.06 + (units - 200) * 12.15;
                break;
            case 'General':
            case 'Commercial':
                if (units <= 100) bill = units * 16.48;
                else if (units <= 200) bill = 100 * 16.48 + (units - 100) * 22.95;
                else if (units <= 300) bill = 100 * 16.48 + 100 * 22.95 + (units - 200) * 26.66;
                else if (units <= 700) bill = 100 * 16.48 + 100 * 22.95 + 100 * 26.66 + (units - 300) * 32.03;
                else bill = 100 * 16.48 + 100 * 22.95 + 100 * 26.66 + 400 * 32.03 + (units - 700) * 35.53;
                break;
        }

        this.estimatedBill = Math.round(bill);
    }

    updateDisplay() {
        this.calculateConsumption();
        
        document.getElementById('total-units').textContent = this.totalUnits;
        document.getElementById('estimated-bill').textContent = `Rs. ${this.estimatedBill}`;
        document.getElementById('consumption-breakdown').innerHTML = this.renderConsumptionBreakdown();
        document.getElementById('ai-insights').innerHTML = this.renderAIInsights();

        // Update tariff slab
        const tariffSlab = this.getTariffSlab(this.totalUnits);
        document.getElementById('tariff-slab').textContent = `${tariffSlab.slab} (${tariffSlab.type})`;

        // Update appliance counts in UI
        this.appliances.forEach(appliance => {
            const countElement = document.getElementById(`${appliance.id}-count`);
            const hoursElement = document.getElementById(`${appliance.id}-hours`);
            if (countElement) countElement.textContent = appliance.count;
            if (hoursElement && hoursElement.value !== appliance.hours.toString()) {
                hoursElement.value = appliance.hours;
            }
        });
    }

    getTariffSlab(units) {
        if (units <= 100) {
            return { slab: '1-100 units', type: 'Lifeline/Protected' };
        } else if (units <= 200) {
            return { slab: '101-200 units', type: 'Protected' };
        } else if (units <= 300) {
            return { slab: '201-300 units', type: 'General' };
        } else if (units <= 700) {
            return { slab: '301-700 units', type: 'General' };
        } else {
            return { slab: '701+ units', type: 'General' };
        }
    }

    async compareWithSimilar() {
        const resultDiv = document.getElementById('comparison-result');
        resultDiv.innerHTML = '<div class="loading-spinner mx-auto"></div>';

        try {
            const response = await fetch('http://localhost:5000/api/compare-houses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    monthly_units: this.totalUnits
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.displayComparisonResult(result);
            } else {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-700">Comparison failed: ${result.error}</p>
                    </div>
                `;
            }
        } catch (error) {
            resultDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-700">Connection error. Make sure backend is running.</p>
                </div>
            `;
        }
    }

    displayComparisonResult(result) {
        const resultDiv = document.getElementById('comparison-result');
        const comparison = result.comparison;

        if (comparison.similar_houses_count > 0) {
            resultDiv.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h4 class="font-semibold text-green-800 mb-4">Comparison Results</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold text-green-600">${comparison.similar_houses_count}</div>
                            <div class="text-green-700">Similar Houses</div>
                        </div>
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold text-blue-600">${comparison.average_consumption}</div>
                            <div class="text-blue-700">Avg Consumption</div>
                        </div>
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold text-purple-600">Rs. ${comparison.average_bill}</div>
                            <div class="text-purple-700">Avg Bill</div>
                        </div>
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold ${comparison.user_position === 'Above average' ? 'text-red-600' : 'text-green-600'}">${comparison.user_position}</div>
                            <div class="text-gray-700">Your Position</div>
                        </div>
                    </div>
                    <p class="text-sm text-green-700 mt-4 text-center">${comparison.comparison}</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p class="text-yellow-700">${comparison.message}</p>
                </div>
            `;
        }
    }

    attachEventListeners() {
        document.getElementById('consumer-type').addEventListener('change', () => {
            this.updateDisplay();
        });
    }
}