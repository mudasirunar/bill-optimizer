class NepraInfoPage {
    constructor() {
        this.tariffData = null;
        this.loadTariffData();
    }

    async loadTariffData() {
        try {
            const response = await fetch('http://localhost:5000/api/nepra-info');
            this.tariffData = await response.json();
        } catch (error) {
            // Fallback data
            this.tariffData = {
                tariff_slabs: {
                    'lifeline': {
                        'description': 'Up to 100 units - Subsidized Rates',
                        'slabs': [
                            {'range': '1-100 units', 'rate': 3.95, 'savings_tip': 'Ideal for small families, try to stay below 100 units'},
                            {'range': 'Above 100 units', 'rate': 7.74, 'savings_tip': 'You lose lifeline benefits above 100 units'}
                        ],
                        'eligibility': 'Limited to specific consumption levels',
                        'example': '100 units = Rs. 395, 150 units = Rs. 1,069'
                    },
                    'protected': {
                        'description': 'Up to 200 units - Government Protected Rates',
                        'slabs': [
                            {'range': '1-100 units', 'rate': 7.74, 'savings_tip': 'Good for medium consumption households'},
                            {'range': '101-200 units', 'rate': 10.06, 'savings_tip': 'Stay below 200 units for optimal rates'},
                            {'range': 'Above 200 units', 'rate': 12.15, 'savings_tip': 'Crossing 200 units increases cost significantly'}
                        ],
                        'eligibility': 'Residential consumers up to 200 units',
                        'example': '200 units = Rs. 1,780, 250 units = Rs. 2,395'
                    },
                    'general': {
                        'description': 'Above 200 units - General Commercial Rates',
                        'slabs': [
                            {'range': '1-100 units', 'rate': 16.48, 'savings_tip': 'High base rate - optimize usage patterns'},
                            {'range': '101-200 units', 'rate': 22.95, 'savings_tip': 'Focus on energy efficiency measures'},
                            {'range': '201-300 units', 'rate': 26.66, 'savings_tip': 'AC usage is major contributor at this level'},
                            {'range': '301-700 units', 'rate': 32.03, 'savings_tip': 'Time to audit and optimize all appliances'},
                            {'range': 'Above 700 units', 'rate': 35.53, 'savings_tip': 'High consumption - professional audit recommended'}
                        ],
                        'eligibility': 'All consumers above 200 units',
                        'example': '300 units = Rs. 6,414, 500 units = Rs. 13,454'
                    }
                },
                ai_insights: {
                    'average_consumption': 'Based on 41 houses: 200-400 units/month',
                    'major_consumers': 'AC units contribute 40-60% of total bill in summer',
                    'peak_usage': '6 PM - 10 PM is typical peak consumption time',
                    'savings_tip': 'Reducing AC usage by 2 hours daily can save 20-30% in summer',
                    'optimal_range': '150-250 units monthly is most cost-effective for average households'
                }
            };
        }
    }

    async render() {
        await this.loadTariffData();
        
        return `
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold mb-2">NEPRA Tariff Information</h1>
                <p class="text-gray-600 mb-8">Official electricity rates with AI-powered insights</p>
                
                <!-- Current Tariff Slabs -->
                <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-bolt mr-3 text-green-600"></i>
                        Current Electricity Tariff Slabs
                    </h2>
                    <div class="grid md:grid-cols-3 gap-6">
                        ${this.renderTariffCards()}
                    </div>
                </div>

                <div class="grid lg:grid-cols-2 gap-8 mb-8">
                    <!-- Detailed Tariff Table -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-table mr-3 text-green-600"></i>
                            Detailed Tariff Rates
                        </h2>
                        <div class="overflow-x-auto">
                            ${this.renderTariffTable()}
                        </div>
                    </div>

                    <!-- AI Insights -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-semibold mb-6 flex items-center">
                            <i class="fas fa-robot mr-3 text-green-600"></i>
                            AI Insights from 41 Houses
                        </h2>
                        <div class="space-y-4">
                            ${this.renderAIInsights()}
                        </div>
                    </div>
                </div>

                <!-- Calculation Examples -->
                <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
                    <h2 class="text-xl font-semibold mb-6 flex items-center">
                        <i class="fas fa-calculator mr-3 text-green-600"></i>
                        Bill Calculation Examples
                    </h2>
                    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${this.renderCalculationExamples()}
                    </div>
                </div>

                <!-- Important Notices -->
                <div class="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                    <h2 class="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
                        <i class="fas fa-exclamation-triangle mr-2"></i>Important Notices
                    </h2>
                    <div class="space-y-2 text-yellow-700">
                        <p>• Tariff rates are subject to change by NEPRA and government policies</p>
                        <p>• Additional taxes and duties may apply to your final bill</p>
                        <p>• Protected consumer category applies to usage up to 200 units</p>
                        <p>• Lifeline consumers must not exceed 100 units monthly to maintain eligibility</p>
                        <p>• Time-of-Use (TOU) tariffs may apply in certain regions</p>
                        <p class="font-semibold mt-4">Last Updated: 2024 | Source: NEPRA Official Tariffs</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderTariffCards() {
        const categories = [
            {
                type: 'lifeline',
                title: 'Lifeline Consumers',
                description: 'Up to 100 units monthly',
                color: 'green',
                icon: 'fas fa-shield-heart'
            },
            {
                type: 'protected',
                title: 'Protected Consumers',
                description: 'Up to 200 units monthly',
                color: 'blue',
                icon: 'fas fa-user-shield'
            },
            {
                type: 'general',
                title: 'General Consumers',
                description: 'Above 200 units monthly',
                color: 'purple',
                icon: 'fas fa-users'
            }
        ];

        return categories.map(cat => {
            const data = this.tariffData.tariff_slabs[cat.type];
            return `
                <div class="border border-${cat.color}-200 rounded-xl p-4 bg-${cat.color}-50 card-hover">
                    <div class="flex items-center mb-3">
                        <i class="${cat.icon} text-${cat.color}-600 text-xl mr-3"></i>
                        <div>
                            <h3 class="font-semibold text-${cat.color}-800">${cat.title}</h3>
                            <p class="text-sm text-${cat.color}-600">${cat.description}</p>
                        </div>
                    </div>
                    <div class="space-y-2">
                        ${data.slabs.map(slab => `
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">${slab.range}</span>
                                <span class="font-semibold">Rs. ${slab.rate}/unit</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mt-3 pt-3 border-t border-${cat.color}-200">
                        <p class="text-xs text-${cat.color}-700">${data.eligibility}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTariffTable() {
        const allSlabs = [];
        
        Object.entries(this.tariffData.tariff_slabs).forEach(([type, data]) => {
            data.slabs.forEach(slab => {
                allSlabs.push({
                    consumerType: this.formatConsumerType(type),
                    range: slab.range,
                    rate: slab.rate,
                    savingsTip: slab.savings_tip
                });
            });
        });

        return `
            <table class="w-full">
                <thead>
                    <tr class="bg-gray-50">
                        <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Consumer Type</th>
                        <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Unit Range</th>
                        <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Rate (Rs./unit)</th>
                        <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Savings Tip</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${allSlabs.map((slab, index) => `
                        <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100">
                            <td class="px-4 py-3 text-sm font-medium">${slab.consumerType}</td>
                            <td class="px-4 py-3 text-sm">${slab.range}</td>
                            <td class="px-4 py-3 text-sm font-semibold text-green-600">${slab.rate}</td>
                            <td class="px-4 py-3 text-sm text-gray-600">${slab.savingsTip}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderAIInsights() {
        const insights = this.tariffData.ai_insights;
        
        return Object.entries(insights).map(([key, value]) => `
            <div class="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                <i class="fas fa-lightbulb text-green-600 text-lg mt-1"></i>
                <div>
                    <h3 class="font-semibold text-green-800 capitalize">${key.replace(/_/g, ' ')}</h3>
                    <p class="text-sm text-green-700 mt-1">${value}</p>
                </div>
            </div>
        `).join('');
    }

    renderCalculationExamples() {
        const examples = [
            { units: 100, protected: 774, general: 1648, type: 'Low' },
            { units: 200, protected: 1780, general: 3943, type: 'Medium' },
            { units: 300, protected: 2995, general: 6414, type: 'High' },
            { units: 500, protected: 'N/A', general: 13454, type: 'Very High' }
        ];

        return examples.map(example => `
            <div class="text-center p-4 border border-gray-200 rounded-lg">
                <div class="text-lg font-bold text-gray-800">${example.units} Units</div>
                <div class="text-sm text-gray-600 mb-2">${example.type} Consumption</div>
                ${example.protected !== 'N/A' ? `
                    <div class="text-green-600 font-semibold">Protected: Rs. ${example.protected}</div>
                ` : ''}
                <div class="text-blue-600 font-semibold">General: Rs. ${example.general}</div>
            </div>
        `).join('');
    }

    formatConsumerType(type) {
        const types = {
            'lifeline': 'Lifeline Consumer',
            'protected': 'Protected Consumer',
            'general': 'General Consumer'
        };
        return types[type] || type;
    }

    attachEventListeners() {
        // Add any additional event listeners if needed
    }
}