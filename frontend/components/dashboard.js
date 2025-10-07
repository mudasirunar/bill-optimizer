class DashboardPage {
    constructor() {
        this.consumptionData = this.generateSampleData();
        this.houseComparison = null;
    }

    render() {
        return `
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold mb-2">Analytics Dashboard</h1>
                <p class="text-gray-600 mb-8">Insights from 41-house AI analysis</p>
                
                <!-- Summary Cards -->
                <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    ${this.renderSummaryCard('fas fa-bolt', 'Average Consumption', '285 units', 'text-yellow-600', 'Based on 41 houses')}
                    ${this.renderSummaryCard('fas fa-money-bill', 'Average Bill', 'Rs. 6,845', 'text-green-600', 'Monthly average')}
                    ${this.renderSummaryCard('fas fa-snowflake', 'AC Impact', '42%', 'text-blue-600', 'Of total consumption')}
                    ${this.renderSummaryCard('fas fa-chart-line', 'Savings Potential', 'Rs. 1,200', 'text-purple-600', 'Per household')}
                </div>

                <div class="grid lg:grid-cols-2 gap-8 mb-8">
                    <!-- Consumption Trend Chart -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-chart-line mr-3 text-green-600"></i>
                            Monthly Consumption Trend
                        </h2>
                        <div class="h-64">
                            ${this.renderConsumptionChart()}
                        </div>
                    </div>

                    <!-- Appliance Breakdown -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-chart-pie mr-3 text-green-600"></i>
                            Appliance Consumption
                        </h2>
                        <div class="space-y-4">
                            ${this.renderApplianceBreakdown()}
                        </div>
                    </div>
                </div>

                <!-- AI Insights -->
                <div class="grid lg:grid-cols-2 gap-8">
                    <!-- Peak Usage Analysis -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-clock mr-3 text-green-600"></i>
                            Peak Usage Patterns
                        </h2>
                        <div class="h-48">
                            ${this.renderPeakUsageChart()}
                        </div>
                        <div class="mt-4 text-sm text-gray-600">
                            <p>• Peak hours: 6 PM - 10 PM (30-50% higher consumption)</p>
                            <p>• Off-peak: 12 AM - 6 AM (lowest consumption)</p>
                        </div>
                    </div>

                    <!-- Seasonal Analysis -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-calendar-alt mr-3 text-green-600"></i>
                            Seasonal Consumption
                        </h2>
                        <div class="h-48">
                            ${this.renderSeasonalChart()}
                        </div>
                        <div class="mt-4 text-sm text-gray-600">
                            <p>• Summer (Jun-Aug): 25-40% higher than winter</p>
                            <p>• AC usage drives seasonal variation</p>
                        </div>
                    </div>
                </div>

                <!-- House Comparison -->
                <div class="mt-8 bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-home mr-3 text-green-600"></i>
                        Compare Your Consumption
                    </h2>
                    <div class="grid md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Your Monthly Units</label>
                            <input type="number" id="compare-units" min="50" max="2000" value="300" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                        </div>
                        <div class="flex items-end">
                            <button onclick="app.dashboard.compareConsumption()" 
                                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors w-full">
                                Compare with Dataset
                            </button>
                        </div>
                    </div>
                    <div id="comparison-result" class="mt-6"></div>
                </div>

                <!-- Recommendations -->
                <div class="mt-8 bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-robot mr-3 text-green-600"></i>
                        AI Recommendations
                    </h2>
                    <div class="grid md:grid-cols-2 gap-6">
                        ${this.renderRecommendations()}
                    </div>
                </div>
            </div>
        `;
    }

    renderSummaryCard(icon, title, value, color, description) {
        return `
            <div class="bg-white rounded-xl shadow-lg p-6 card-hover">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm">${title}</p>
                        <p class="text-2xl font-bold ${color} mt-2">${value}</p>
                        <p class="text-xs text-gray-500 mt-1">${description}</p>
                    </div>
                    <i class="${icon} text-3xl text-gray-400"></i>
                </div>
            </div>
        `;
    }

    renderConsumptionChart() {
        // Simplified SVG chart
        return `
            <div class="w-full h-full flex items-end justify-between px-4 border-b border-l border-gray-200">
                ${this.consumptionData.map((month, index) => `
                    <div class="flex flex-col items-center" style="height: 100%">
                        <div class="text-xs text-gray-600 mb-1">${month.month}</div>
                        <div class="bg-green-500 rounded-t w-6 transition-all duration-500 hover:bg-green-600" 
                             style="height: ${(month.units / 500) * 100}%" 
                             title="${month.month}: ${month.units} units"></div>
                        <div class="text-xs font-semibold mt-1">${month.units}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderApplianceBreakdown() {
        const appliances = [
            { name: 'Air Conditioner', units: 120, percentage: 42, color: 'bg-blue-500' },
            { name: 'Water Heater', units: 45, percentage: 16, color: 'bg-red-500' },
            { name: 'Refrigerator', units: 35, percentage: 12, color: 'bg-green-500' },
            { name: 'Kitchen Appliances', units: 40, percentage: 14, color: 'bg-pink-500' },
            { name: 'Lighting', units: 25, percentage: 9, color: 'bg-yellow-500' },
            { name: 'Other Appliances', units: 20, percentage: 7, color: 'bg-purple-500' }
        ];

        return appliances.map(appliance => `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-4 h-4 rounded ${appliance.color}"></div>
                    <span class="text-sm">${appliance.name}</span>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="w-24 bg-gray-200 rounded-full h-2">
                        <div class="${appliance.color} h-2 rounded-full" style="width: ${appliance.percentage}%"></div>
                    </div>
                    <span class="text-sm font-semibold w-12 text-right">${appliance.units}u</span>
                </div>
            </div>
        `).join('');
    }

    renderPeakUsageChart() {
        const hours = [0, 6, 12, 18, 24];
        const usage = [0.3, 0.5, 0.8, 1.4, 0.9]; // Relative usage
        
        return `
            <div class="w-full h-full flex items-end justify-between px-4 border-b border-l border-gray-200">
                ${hours.map((hour, index) => `
                    <div class="flex flex-col items-center" style="height: 100%">
                        <div class="text-xs text-gray-600 mb-1">${hour === 24 ? '12AM' : hour + 'h'}</div>
                        <div class="bg-orange-500 rounded-t w-4 transition-all duration-500" 
                             style="height: ${usage[index] * 70}%" 
                             title="${hour}h: ${(usage[index] * 100).toFixed(0)}% usage"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSeasonalChart() {
        const seasons = ['Winter', 'Spring', 'Summer', 'Autumn'];
        const consumption = [0.8, 1.0, 1.4, 1.1]; // Relative consumption
        
        return `
            <div class="w-full h-full flex items-end justify-between px-4 border-b border-l border-gray-200">
                ${seasons.map((season, index) => `
                    <div class="flex flex-col items-center" style="height: 100%">
                        <div class="text-xs text-gray-600 mb-1">${season}</div>
                        <div class="bg-blue-500 rounded-t w-6 transition-all duration-500" 
                             style="height: ${consumption[index] * 50}%" 
                             title="${season}: ${(consumption[index] * 100).toFixed(0)}%"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRecommendations() {
        const recommendations = [
            {
                icon: 'fas fa-snowflake',
                title: 'AC Optimization',
                description: 'Reduce AC usage by 2 hours daily and set temperature to 24°C',
                impact: 'Save 60 units monthly (Rs. 1,500)',
                priority: 'High'
            },
            {
                icon: 'fas fa-lightbulb',
                title: 'LED Upgrade',
                description: 'Replace incandescent bulbs with LED lights in high-usage areas',
                impact: 'Save 24 units monthly (Rs. 600)',
                priority: 'Medium'
            },
            {
                icon: 'fas fa-plug',
                title: 'Standby Power',
                description: 'Use smart plugs to eliminate phantom load from entertainment devices',
                impact: 'Save 12 units monthly (Rs. 300)',
                priority: 'Medium'
            },
            {
                icon: 'fas fa-clock',
                title: 'Time Management',
                description: 'Shift laundry and dishwasher usage to off-peak hours',
                impact: 'Save 18 units monthly (Rs. 450)',
                priority: 'Low'
            }
        ];

        return recommendations.map(rec => `
            <div class="bg-gray-50 rounded-lg p-4 card-hover">
                <div class="flex items-start space-x-3">
                    <i class="${rec.icon} text-green-600 text-xl mt-1"></i>
                    <div class="flex-1">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-semibold">${rec.title}</h3>
                            <span class="text-xs px-2 py-1 rounded-full ${
                                rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                                rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                            }">${rec.priority}</span>
                        </div>
                        <p class="text-sm text-gray-600 mb-2">${rec.description}</p>
                        <p class="text-sm font-semibold text-green-700">${rec.impact}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    generateSampleData() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((month, index) => ({
            month,
            units: Math.round(200 + Math.random() * 200), // 200-400 units
            actual: Math.round(2000 + Math.random() * 3000),
            predicted: Math.round(2000 + Math.random() * 3000)
        }));
    }

    async compareConsumption() {
        const userUnits = parseInt(document.getElementById('compare-units').value) || 300;
        const resultDiv = document.getElementById('comparison-result');
        
        resultDiv.innerHTML = '<div class="flex justify-center py-4"><div class="loading-spinner"></div></div>';

        try {
            const response = await fetch('http://localhost:5000/api/compare-houses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    monthly_units: userUnits
                })
            });

            const result = await response.json();
            this.displayComparisonResult(result, userUnits);
            
        } catch (error) {
            this.displayFallbackComparison(userUnits);
        }
    }

    displayComparisonResult(result, userUnits) {
        const resultDiv = document.getElementById('comparison-result');
        const comparison = result.comparison;

        if (comparison.similar_houses_count > 0) {
            resultDiv.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-xl p-6">
                    <h3 class="font-semibold text-green-800 mb-4">Comparison Results</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold text-green-600">${comparison.similar_houses_count}</div>
                            <div class="text-green-700 text-sm">Similar Houses</div>
                        </div>
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold text-blue-600">${comparison.average_consumption}</div>
                            <div class="text-blue-700 text-sm">Avg Consumption</div>
                        </div>
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold text-purple-600">${comparison.average_bill}</div>
                            <div class="text-purple-700 text-sm">Avg Bill</div>
                        </div>
                        <div class="text-center p-3 bg-white rounded">
                            <div class="text-lg font-bold ${
                                comparison.user_position === 'Above average' ? 'text-red-600' : 'text-green-600'
                            }">${comparison.user_position}</div>
                            <div class="text-gray-700 text-sm">Your Position</div>
                        </div>
                    </div>
                    <p class="text-green-700 text-sm text-center">${comparison.comparison}</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p class="text-yellow-700">${comparison.message}</p>
                </div>
            `;
        }
    }

    displayFallbackComparison(userUnits) {
        const resultDiv = document.getElementById('comparison-result');
        const avgConsumption = 285;
        const position = userUnits > avgConsumption ? 'Above average' : 'Below average';
        
        resultDiv.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 class="font-semibold text-blue-800 mb-4">Comparison Results</h3>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="text-center p-3 bg-white rounded">
                        <div class="text-lg font-bold text-blue-600">41</div>
                        <div class="text-blue-700 text-sm">Total Houses</div>
                    </div>
                    <div class="text-center p-3 bg-white rounded">
                        <div class="text-lg font-bold text-green-600">${avgConsumption}</div>
                        <div class="text-green-700 text-sm">Average Consumption</div>
                    </div>
                </div>
                <p class="text-blue-700 text-sm text-center">
                    Your consumption: <strong>${userUnits} units</strong> | 
                    Average: <strong>${avgConsumption} units</strong> | 
                    Position: <strong class="${
                        position === 'Above average' ? 'text-red-600' : 'text-green-600'
                    }">${position}</strong>
                </p>
            </div>
        `;
    }
}