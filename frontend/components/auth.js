// Use your EXACT original auth.js code from your previous message
// I'll include the complete version to ensure nothing is missing

class LoginPage {
    render() {
        return `
            <div class="container mx-auto px-4 py-8 max-w-md">
                <div class="bg-white rounded-2xl shadow-lg p-8">
                    <div class="text-center mb-8">
                        <i class="fas fa-bolt text-green-600 text-4xl mb-4"></i>
                        <h1 class="text-2xl font-bold text-gray-800">Welcome Back</h1>
                        <p class="text-gray-600 mt-2">Sign in to your account</p>
                    </div>
                    
                    <form id="login-form" class="space-y-6">
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <input type="email" id="email" name="email" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Enter your email">
                        </div>
                        
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <input type="password" id="password" name="password" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Enter your password">
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <label class="flex items-center">
                                <input type="checkbox" class="rounded border-gray-300 text-green-600 focus:ring-green-500">
                                <span class="ml-2 text-sm text-gray-600">Remember me</span>
                            </label>
                            <button type="button" onclick="app.loadPage('forgot-password')" class="text-sm text-green-600 hover:text-green-700">
                                Forgot password?
                            </button>
                        </div>
                        
                        <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                            Sign In
                        </button>
                    </form>
                    
                    <div class="mt-6 text-center">
                        <p class="text-gray-600">
                            Don't have an account? 
                            <button onclick="app.loadPage('register')" class="text-green-600 hover:text-green-700 font-semibold ml-1">
                                Sign up
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', this.handleLogin.bind(this));
    }

    async handleLogin(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);
        
        const success = await app.login(data.email, data.password);
        if (success) {
            // Login successful, will redirect automatically
        }
    }
}

class RegisterPage {
    render() {
        return `
            <div class="container mx-auto px-4 py-8 max-w-md">
                <div class="bg-white rounded-2xl shadow-lg p-8">
                    <div class="text-center mb-8">
                        <i class="fas fa-user-plus text-green-600 text-4xl mb-4"></i>
                        <h1 class="text-2xl font-bold text-gray-800">Create Account</h1>
                        <p class="text-gray-600 mt-2">Join Pak Bill Optimizer today</p>
                    </div>
                    
                    <form id="register-form" class="space-y-6">
                        <div>
                            <label for="full_name" class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                            <input type="text" id="full_name" name="full_name" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Enter your full name">
                        </div>
                        
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <input type="email" id="email" name="email" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Enter your email">
                        </div>
                        
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <input type="password" id="password" name="password" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Create a password (min. 6 characters)">
                            <p class="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
                        </div>
                        
                        <div>
                            <label for="confirm_password" class="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                            <input type="password" id="confirm_password" name="confirm_password" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Confirm your password">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="household_size" class="block text-sm font-medium text-gray-700 mb-2">Household Size</label>
                                <select id="household_size" name="household_size" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    ${[1,2,3,4,5,6,7,8].map(num => 
                                        `<option value="${num}" ${num === 4 ? 'selected' : ''}>${num} people</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div>
                                <label for="region" class="block text-sm font-medium text-gray-700 mb-2">Region</label>
                                <select id="region" name="region" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="Urban">Urban</option>
                                    <option value="Rural">Rural</option>
                                </select>
                            </div>
                        </div>
                        
                        <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                            Create Account
                        </button>
                    </form>
                    
                    <div class="mt-6 text-center">
                        <p class="text-gray-600">
                            Already have an account? 
                            <button onclick="app.loadPage('login')" class="text-green-600 hover:text-green-700 font-semibold ml-1">
                                Sign in
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const form = document.getElementById('register-form');
        form.addEventListener('submit', this.handleRegister.bind(this));
    }

    async handleRegister(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);
        
        // Validate passwords match
        if (data.password !== data.confirm_password) {
            utils.showNotification('Passwords do not match', 'error');
            return;
        }
        
        // Validate password length
        if (!utils.validatePassword(data.password)) {
            utils.showNotification('Password must be at least 6 characters long', 'error');
            return;
        }
        
        // Validate email
        if (!utils.validateEmail(data.email)) {
            utils.showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        const success = await app.register(data);
        if (success) {
            // Redirect to login page
            setTimeout(() => app.loadPage('login'), 2000);
        }
    }
}

class ForgotPasswordPage {
    render() {
        return `
            <div class="container mx-auto px-4 py-8 max-w-md">
                <div class="bg-white rounded-2xl shadow-lg p-8">
                    <div class="text-center mb-8">
                        <i class="fas fa-key text-green-600 text-4xl mb-4"></i>
                        <h1 class="text-2xl font-bold text-gray-800">Reset Password</h1>
                        <p class="text-gray-600 mt-2">Enter your email to receive reset instructions</p>
                    </div>
                    
                    <form id="forgot-password-form" class="space-y-6">
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <input type="email" id="email" name="email" required
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                   placeholder="Enter your email">
                        </div>
                        
                        <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                            Send Reset Instructions
                        </button>
                    </form>
                    
                    <div class="mt-6 text-center">
                        <button onclick="app.loadPage('login')" class="text-green-600 hover:text-green-700 font-semibold">
                            ← Back to Login
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const form = document.getElementById('forgot-password-form');
        form.addEventListener('submit', this.handleForgotPassword.bind(this));
    }

    async handleForgotPassword(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const email = formData.get('email');
        
        try {
            const response = await fetch('http://localhost:5000/api/auth/request-password-reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            
            if (result.success) {
                utils.showNotification('Password reset instructions sent to your email', 'success');
                // In development, show the reset token
                if (result.reset_token) {
                    utils.showNotification(`Development: Reset token - ${result.reset_token}`, 'info');
                }
                setTimeout(() => app.loadPage('login'), 3000);
            } else {
                utils.showNotification(result.message, 'error');
            }
        } catch (error) {
            utils.showNotification('Failed to send reset instructions', 'error');
        }
    }
}