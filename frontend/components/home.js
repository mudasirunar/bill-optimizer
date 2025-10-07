class HomePage {
    constructor() {
        this.modelInfo = null;
        this.loadModelInfo();
    }

    async loadModelInfo() {
        try {
            const response = await fetch('http://localhost:5000/api/model-info');
            this.modelInfo = await response.json();
        } catch (error) {
            console.log('Could not load model info');
        }
    }

    render() {
        // Check if user is logged in
        const isLoggedIn = window.app && window.app.currentUser !== null;
        
        if (!isLoggedIn) {
            return this.renderLoginPrompt();
        }

        return this.renderHomeContent();
    }

    renderLoginPrompt() {
        return `
            <div class="container mx-auto px-4 py-8">
                <div class="text-center py-16">
                    <div class="max-w-2xl mx-auto">
                        <i class="fas fa-lock text-green-600 text-6xl mb-6"></i>
                        <h1 class="text-4xl font-bold text-gray-800 mb-4">Access Restricted</h1>
                        <p class="text-xl text-gray-600 mb-8">Please login to access Pak Bill Optimizer features</p>
                        <div class="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onclick="app.loadPage('login')" 
                                    class="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                                Login to Continue
                            </button>
                            <button onclick="app.loadPage('register')" 
                                    class="border-2 border-green-600 text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-colors">
                                Create Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderHomeContent() {
        return `
            <div class="container mx-auto px-4 py-8">
                <!-- Enhanced Hero Section -->
                <section class="text-center py-16 gradient-bg text-white rounded-2xl shadow-xl mb-12">
                    <div class="max-w-4xl mx-auto">
                        <h1 class="text-5xl font-bold mb-6">Welcome to Pak Bill Optimizer</h1>
                        <p class="text-xl mb-4">Hello, ${window.app.currentUser.name || window.app.currentUser.full_name}!</p>
                        <p class="text-lg opacity-90 mb-8">AI-Powered Electricity Bill Forecasting</p>
                        
                        ${this.renderModelBadge()}
                        
                        <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                            <button onclick="app.loadPage('simulator')" 
                                    class="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center">
                                <i class="fas fa-bolt mr-2"></i>Smart Prediction
                            </button>
                            <button onclick="app.loadPage('planner')" 
                                    class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors flex items-center justify-center">
                                <i class="fas fa-chart-line mr-2"></i>Savings Planner
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Quick Access Cards -->
                <div class="grid md:grid-cols-3 gap-6 mb-12">
                    <div class="bg-white rounded-xl shadow-lg p-6 card-hover text-center cursor-pointer" onclick="app.loadPage('simulator')">
                        <i class="fas fa-sliders-h text-green-600 text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Usage Simulator</h3>
                        <p class="text-gray-600">Calculate electricity consumption based on your appliances</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-lg p-6 card-hover text-center cursor-pointer" onclick="app.loadPage('planner')">
                        <i class="fas fa-bullseye text-green-600 text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Savings Planner</h3>
                        <p class="text-gray-600">Set goals and get AI-powered optimization tips</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-lg p-6 card-hover text-center cursor-pointer" onclick="app.loadPage('dashboard')">
                        <i class="fas fa-chart-bar text-green-600 text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Analytics Dashboard</h3>
                        <p class="text-gray-600">View your consumption patterns and savings progress</p>
                    </div>
                </div>

                <!-- AI Model Info -->
                <section class="bg-white rounded-2xl shadow-lg p-6 mb-8">
                    <h2 class="text-2xl font-bold mb-4 flex items-center">
                        <i class="fas fa-brain mr-3 text-green-600"></i>
                        AI Model Insights
                    </h2>
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${this.renderAICard('fas fa-home', '41 Houses Analyzed', 'Trained on real Pakistani household data with appliance-level monitoring')}
                        ${this.renderAICard('fas fa-bolt', '21M+ Data Points', '1-minute interval data for precise pattern recognition')}
                        ${this.renderAICard('fas fa-chart-bar', 'Enhanced Accuracy', 'Realistic predictions with proper validation and fallbacks')}
                        ${this.renderAICard('fas fa-snowflake', 'AC Usage Focus', 'Air conditioners contribute 40-60% of total costs')}
                        ${this.renderAICard('fas fa-clock', 'Peak Hour Analysis', '6 PM - 10 PM shows 30-50% higher consumption')}
                        ${this.renderAICard('fas fa-calendar', 'Seasonal Patterns', 'Summer consumption 25-40% higher than winter')}
                    </div>
                </section>

                <!-- Enhanced Quick Prediction -->
                <section class="bg-white rounded-2xl shadow-lg p-8 mb-12">
                    <h2 class="text-2xl font-bold mb-6 flex items-center">
                        <i class="fas fa-calculator mr-3 text-green-600"></i>
                        Enhanced AI Prediction
                    </h2>
                    <form id="enhanced-prediction-form" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- Basic Information -->
                        <div class="lg:col-span-3">
                            <h3 class="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Basic Information</h3>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Household Size</label>
                            <input type="number" name="household_size" min="1" max="15" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="4" required>
                            <p class="text-xs text-gray-500 mt-1">Number of people in household</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Total Appliances</label>
                            <input type="number" name="num_appliances" min="1" max="50" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="12" required>
                            <p class="text-xs text-gray-500 mt-1">Total electrical appliances</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Previous Month Units</label>
                            <input type="number" name="previous_units" min="0" max="5000" step="1"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="250" required>
                            <p class="text-xs text-gray-500 mt-1">Your last month's consumption</p>
                        </div>

                        <!-- Appliance Details -->
                        <div class="lg:col-span-3 mt-4">
                            <h3 class="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Appliance Details</h3>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">AC Units</label>
                            <input type="number" name="ac_units" min="0" max="5" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="1" required>
                            <p class="text-xs text-gray-500 mt-1">Number of air conditioners</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Refrigerators</label>
                            <input type="number" name="fridge_count" min="0" max="3" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="1" required>
                            <p class="text-xs text-gray-500 mt-1">Number of refrigerators</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Fans</label>
                            <input type="number" name="fan_count" min="0" max="10" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="3" required>
                            <p class="text-xs text-gray-500 mt-1">Number of ceiling fans</p>
                        </div>

                        <!-- Usage Patterns -->
                        <div class="lg:col-span-3 mt-4">
                            <h3 class="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Usage Patterns</h3>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Daily Usage Hours</label>
                            <input type="number" name="usage_hours" min="1" max="24" step="0.5"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                                   value="8" required>
                            <p class="text-xs text-gray-500 mt-1">Average hours of usage per day</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Region</label>
                            <select name="region" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required>
                                <option value="Urban">Urban</option>
                                <option value="Rural">Rural</option>
                                <option value="Commercial">Commercial</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Consumer Type</label>
                            <select name="consumer_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required>
                                <option value="Protected">Protected</option>
                                <option value="Lifeline">Lifeline</option>
                                <option value="General" selected>General</option>
                                <option value="Commercial">Commercial</option>
                            </select>
                        </div>

                        <div class="md:col-span-2 lg:col-span-3">
                            <button type="submit" class="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center w-full">
                                <i class="fas fa-brain mr-2"></i>Get AI Prediction
                            </button>
                        </div>
                    </form>
                    <div id="enhanced-prediction-result" class="mt-6"></div>
                </section>

                <!-- Features Grid -->
                <section class="mb-16">
                    <h2 class="text-3xl font-bold text-center mb-12">Advanced Features</h2>
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        ${this.renderFeatureCard('fas fa-brain', 'AI Bill Forecasting', 'Advanced machine learning trained on 41 real households with appliance-level data for accurate predictions.')}
                        ${this.renderFeatureCard('fas fa-snowflake', 'Appliance Analysis', 'Understand which appliances (AC, fridge, kitchen) are driving your electricity costs.')}
                        ${this.renderFeatureCard('fas fa-chart-pie', 'Consumption Breakdown', 'Detailed analysis of your usage patterns and comparison with similar households.')}
                        ${this.renderFeatureCard('fas fa-bullseye', 'Smart Savings Planner', 'AI-powered recommendations to reduce bills based on actual consumption patterns.')}
                        ${this.renderFeatureCard('fas fa-clock', 'Peak Hour Analysis', 'Identify and optimize usage during high-cost peak hours (6 PM - 10 PM).')}
                        ${this.renderFeatureCard('fas fa-home', 'Household Comparison', 'Compare your consumption with similar houses from our 41-house dataset.')}
                    </div>
                </section>
            </div>
        `;
    }

    renderModelBadge() {
        if (this.modelInfo && this.modelInfo.performance) {
            return `
                <div class="inline-flex items-center bg-green-700 bg-opacity-20 px-4 py-2 rounded-full mb-4">
                    <i class="fas fa-robot mr-2"></i>
                    <span class="font-semibold">AI Model: ${this.modelInfo.model_name}</span>
                    <span class="mx-2">•</span>
                    <span>Enhanced Accuracy</span>
                </div>
            `;
        }
        return `
            <div class="inline-flex items-center bg-green-700 bg-opacity-20 px-4 py-2 rounded-full mb-4">
                <i class="fas fa-robot mr-2"></i>
                <span class="font-semibold">AI Trained on 41 Pakistani Households</span>
            </div>
        `;
    }

    renderAICard(icon, title, description) {
        return `
            <div class="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-4 border border-green-200 card-hover">
                <div class="flex items-start space-x-3">
                    <i class="${icon} text-green-600 text-xl mt-1"></i>
                    <div>
                        <h3 class="font-semibold text-green-800">${title}</h3>
                        <p class="text-sm text-green-700 mt-1">${description}</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderFeatureCard(icon, title, description) {
        return `
            <div class="bg-white rounded-xl shadow-lg p-6 card-hover border border-gray-100">
                <div class="text-green-600 text-3xl mb-4">
                    <i class="${icon}"></i>
                </div>
                <h3 class="text-xl font-semibold mb-3">${title}</h3>
                <p class="text-gray-600">${description}</p>
            </div>
        `;
    }

    attachEventListeners() {
        const form = document.getElementById('enhanced-prediction-form');
        if (form) {
            form.addEventListener('submit', this.handleEnhancedPrediction.bind(this));
        }
    }

    async handleEnhancedPrediction(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);
        
        // Convert numeric fields
        data.household_size = parseInt(data.household_size);
        data.num_appliances = parseInt(data.num_appliances);
        data.ac_units = parseInt(data.ac_units);
        data.fridge_count = parseInt(data.fridge_count);
        data.fan_count = parseInt(data.fan_count);
        data.usage_hours = parseFloat(data.usage_hours);
        data.previous_units = parseFloat(data.previous_units);

        const resultDiv = document.getElementById('enhanced-prediction-result');
        resultDiv.innerHTML = `
            <div class="flex justify-center items-center py-8">
                <div class="loading-spinner"></div>
                <span class="ml-3 text-gray-600">AI is analyzing your consumption patterns...</span>
            </div>
        `;

        try {
            const response = await fetch('http://localhost:5000/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.displayEnhancedResult(result, data);
            } else {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-triangle text-red-500 text-xl mr-3"></i>
                            <div>
                                <h3 class="text-lg font-semibold text-red-800">Prediction Error</h3>
                                <p class="text-red-700 mt-1">${result.error || 'Please try again'}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            resultDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div class="flex items-center">
                        <i class="fas fa-unplug text-red-500 text-xl mr-3"></i>
                        <div>
                            <h3 class="text-lg font-semibold text-red-800">Connection Error</h3>
                            <p class="text-red-700 mt-1">Make sure the backend server is running on port 5000</p>
                            <button onclick="app.loadPage('home')" class="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors">
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    displayEnhancedResult(result, inputData) {
        const resultDiv = document.getElementById('enhanced-prediction-result');
        
        resultDiv.innerHTML = `
            <div class="grid lg:grid-cols-2 gap-6 fade-in">
                <!-- Prediction Results -->
                <div class="space-y-6">
                    <div class="bg-green-50 border border-green-200 rounded-xl p-6">
                        <h3 class="text-xl font-semibold text-green-800 mb-4 flex items-center">
                            <i class="fas fa-bolt mr-2"></i>
                            AI Prediction Results
                        </h3>
                        
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="text-center p-4 bg-white rounded-lg">
                                <div class="text-2xl font-bold text-green-600">${result.predicted_bill}</div>
                                <div class="text-sm text-green-700">Predicted Bill</div>
                                <div class="text-xs text-gray-500 mt-1">Rs.</div>
                            </div>
                            <div class="text-center p-4 bg-white rounded-lg">
                                <div class="text-2xl font-bold text-blue-600">${result.estimated_units}</div>
                                <div class="text-sm text-blue-700">Estimated Units</div>
                                <div class="text-xs text-gray-500 mt-1">kWh/month</div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-lg p-4 mb-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm font-medium text-gray-700">Tariff Slab:</span>
                                <span class="font-semibold ${this.getTariffColor(result.tariff_slab.type)}">${result.tariff_slab.slab}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium text-gray-700">Model Confidence:</span>
                                <span class="font-semibold text-green-600">${(result.model_confidence * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Input Summary -->
                    <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                        <h4 class="font-semibold text-blue-800 mb-3">Input Summary</h4>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div class="text-blue-700">Household Size:</div>
                            <div class="font-semibold">${inputData.household_size} people</div>
                            
                            <div class="text-blue-700">Appliances:</div>
                            <div class="font-semibold">${inputData.num_appliances} total</div>
                            
                            <div class="text-blue-700">AC Units:</div>
                            <div class="font-semibold">${inputData.ac_units}</div>
                            
                            <div class="text-blue-700">Previous Usage:</div>
                            <div class="font-semibold">${inputData.previous_units} units</div>
                        </div>
                    </div>
                </div>

                <!-- Optimization Tips -->
                <div class="space-y-6">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                        <h4 class="font-semibold text-yellow-800 mb-3 flex items-center">
                            <i class="fas fa-lightbulb mr-2"></i>
                            Optimization Tips
                        </h4>
                        <div class="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                            ${result.optimization_tips.map(tip => `
                                <div class="flex items-start space-x-3">
                                    <i class="fas fa-check text-green-500 mt-1 flex-shrink-0"></i>
                                    <span class="text-sm text-yellow-700">${tip}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Savings Opportunities -->
                    ${result.savings_opportunities && result.savings_opportunities.length > 0 ? `
                    <div class="bg-purple-50 border border-purple-200 rounded-xl p-6">
                        <h4 class="font-semibold text-purple-800 mb-3 flex items-center">
                            <i class="fas fa-piggy-bank mr-2"></i>
                            Savings Opportunities
                        </h4>
                        <div class="space-y-2">
                            ${result.savings_opportunities.map(opportunity => `
                                <div class="text-sm text-purple-700">• ${opportunity}</div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Model Info -->
                    <div class="bg-gray-50 border border-gray-200 rounded-xl p-6">
                        <h4 class="font-semibold text-gray-800 mb-3">AI Model Information</h4>
                        <div class="text-sm space-y-1 text-gray-600">
                            <div>Model: ${result.model_info.model_name}</div>
                            <div>Accuracy: ${(result.model_info.r2_score * 100).toFixed(1)}%</div>
                            <div>Features Used: ${result.model_info.features_used}</div>
                            <div>MAE: Rs. ${result.model_info.mae}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTariffColor(type) {
        const colors = {
            'Protected': 'text-green-600',
            'General': 'text-yellow-600',
            'Fallback': 'text-gray-600'
        };
        return colors[type] || 'text-gray-600';
    }
}