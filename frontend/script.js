class PakBillOptimizerApp {
    constructor() {
        this.currentPage = 'login'; // Start with login
        this.currentUser = null;
        this.sessionToken = null;
        this.pages = {
            home: new HomePage(),
            simulator: new SimulatorPage(),
            planner: new PlannerPage(),
            dashboard: new DashboardPage(),
            'nepra-info': new NepraInfoPage(),
            'login': new LoginPage(),
            'register': new RegisterPage(),
            'forgot-password': new ForgotPasswordPage()
        };
        
        this.navbar = new Navbar();
        this.checkAuthStatus();
    }

    async checkAuthStatus() {
        try {
            const userData = localStorage.getItem('currentUser');
            const sessionToken = localStorage.getItem('sessionToken');
            
            if (userData && sessionToken) {
                this.currentUser = JSON.parse(userData);
                this.sessionToken = sessionToken;
                console.log('User logged in:', this.currentUser);
            } else {
                this.currentUser = null;
                this.sessionToken = null;
            }
        } catch (error) {
            console.log('Auth check error:', error);
            this.currentUser = null;
        }
    }

    async init() {
        try {
            this.navbar.render();
            
            // Always check authentication first
            if (!this.currentUser) {
                this.loadPage('login');
            } else {
                this.loadPage('home');
            }
            
            window.app = this;
        } catch (error) {
            console.error('App initialization error:', error);
            this.showErrorPage();
        }
    }

    requiresAuth(page) {
        // Pages that require authentication
        const protectedPages = ['home', 'simulator', 'planner', 'dashboard'];
        return protectedPages.includes(page);
    }

    async loadPage(pageId) {
        try {
            // Check authentication for protected pages
            if (this.requiresAuth(pageId) && !this.currentUser) {
                utils.showNotification('Please login to access this page', 'error');
                this.currentPage = 'login';
                this.renderPage('login');
                return;
            }

            this.currentPage = pageId;
            this.renderPage(pageId);
            
        } catch (error) {
            console.error('Error loading page:', error);
            this.showErrorPage();
        }
    }

    async renderPage(pageId) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        mainContent.innerHTML = '<div class="flex justify-center items-center py-16"><div class="loading-spinner"></div><span class="ml-3 text-gray-600">Loading...</span></div>';

        const page = this.pages[pageId];
        if (!page) {
            mainContent.innerHTML = '<div class="container mx-auto px-4 py-8"><h1>Page not found</h1></div>';
            return;
        }

        let content;
        
        if (pageId === 'nepra-info' && page.render instanceof Function) {
            content = await page.render();
        } else if (page.render instanceof Function) {
            content = page.render();
        } else {
            content = '<div class="container mx-auto px-4 py-8"><h1>Page not found</h1></div>';
        }
        
        mainContent.innerHTML = content;
        mainContent.classList.add('fade-in');
        
        // Update navbar
        this.navbar.render();
        
        // Attach event listeners
        if (page.attachEventListeners instanceof Function) {
            setTimeout(() => page.attachEventListeners(), 100);
        }

        this.updateActiveNavItem(pageId);
    }

    // New method: Check auth before loading page
    checkAuthThenLoad(pageId) {
        if (this.requiresAuth(pageId) && !this.currentUser) {
            utils.showNotification('Please login first', 'error');
            this.loadPage('login');
        } else {
            this.loadPage(pageId);
        }
    }

    updateActiveNavItem(activePageId) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('bg-green-700', 'text-white');
            item.classList.add('text-green-100');
        });

        const activeItems = document.querySelectorAll(`[onclick="app.loadPage('${activePageId}')"]`);
        activeItems.forEach(item => {
            item.classList.add('bg-green-700', 'text-white');
            item.classList.remove('text-green-100');
        });
    }

    showErrorPage() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="container mx-auto px-4 py-8">
                    <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                        <h2 class="text-xl font-semibold text-red-800 mb-2">Application Error</h2>
                        <p class="text-red-600">Please check the browser console for details.</p>
                        <button onclick="location.reload()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                            Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Authentication methods
    async login(email, password) {
        try {
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentUser = result.user;
                this.sessionToken = result.session_token;
                
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                localStorage.setItem('sessionToken', this.sessionToken);
                
                utils.showNotification('Login successful!', 'success');
                this.navbar.render();
                this.loadPage('home');
                
                return true;
            } else {
                utils.showNotification(result.message, 'error');
                return false;
            }
        } catch (error) {
            utils.showNotification('Login failed. Please try again.', 'error');
            return false;
        }
    }

    async register(userData) {
        try {
            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            
            if (result.success) {
                utils.showNotification('Registration successful! Please login.', 'success');
                return true;
            } else {
                utils.showNotification(result.message, 'error');
                return false;
            }
        } catch (error) {
            utils.showNotification('Registration failed. Please try again.', 'error');
            return false;
        }
    }

    async logout() {
        try {
            if (this.sessionToken) {
                await fetch('http://localhost:5000/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.sessionToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.currentUser = null;
            this.sessionToken = null;
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionToken');
            
            utils.showNotification('Logged out successfully', 'success');
            this.navbar.render();
            this.loadPage('login');
        }
    }

    getAuthHeaders() {
        if (this.sessionToken) {
            return {
                'Authorization': `Bearer ${this.sessionToken}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    get simulator() {
        return this.pages.simulator;
    }

    get planner() {
        return this.pages.planner;
    }

    get dashboard() {
        return this.pages.dashboard;
    }
}

// Utility functions
const utils = {
    formatCurrency(amount) {
        return 'Rs. ' + amount.toLocaleString('en-PK');
    },
    
    formatUnits(units) {
        return units.toLocaleString('en-PK') + ' units';
    },
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-500' : 
            type === 'success' ? 'bg-green-500' : 'bg-blue-500'
        } text-white max-w-sm`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    },
    
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    validatePassword(password) {
        return password.length >= 6;
    }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new PakBillOptimizerApp();
    window.app = app;
    app.init();
});