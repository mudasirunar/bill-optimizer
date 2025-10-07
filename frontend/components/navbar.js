class Navbar {
    render() {
        const navbarElement = document.getElementById('navbar');
        if (!navbarElement) {
            console.error('Navbar element not found');
            return;
        }

        const isLoggedIn = window.app && window.app.currentUser !== null;
        
        navbarElement.innerHTML = `
            <div class="container mx-auto px-4">
                <div class="flex justify-between items-center py-4">
                    <!-- Logo -->
                    <div class="flex items-center space-x-3 cursor-pointer" onclick="app.checkAuthThenLoad('home')">
                        <i class="fas fa-bolt text-2xl text-white"></i>
                        <span class="text-xl font-bold">Pak Bill Optimizer</span>
                    </div>

                    <!-- Navigation Links - Only show when logged in -->
                    ${isLoggedIn ? `
                    <div class="hidden md:flex items-center space-x-6">
                        <button onclick="app.loadPage('home')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">Home</button>
                        <button onclick="app.loadPage('simulator')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">Simulator</button>
                        <button onclick="app.loadPage('planner')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">Planner</button>
                        <button onclick="app.loadPage('dashboard')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">Dashboard</button>
                        <button onclick="app.loadPage('nepra-info')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">NEPRA Info</button>
                    </div>
                    ` : `
                    <div class="hidden md:flex items-center space-x-6">
                        <button onclick="app.loadPage('login')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">Home</button>
                        <button onclick="app.loadPage('login')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">Features</button>
                        <button onclick="app.loadPage('nepra-info')" class="nav-item text-green-100 hover:text-white px-3 py-2 rounded-lg transition-colors">NEPRA Info</button>
                    </div>
                    `}

                    <!-- Auth Buttons -->
                    <div class="flex items-center space-x-4">
                        ${isLoggedIn ? `
                            <div class="flex items-center space-x-3">
                                <span class="text-green-100">Welcome, ${window.app.currentUser.name || window.app.currentUser.full_name || 'User'}</span>
                                <button onclick="app.logout()" class="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors">
                                    <i class="fas fa-sign-out-alt mr-2"></i>Logout
                                </button>
                            </div>
                        ` : `
                            <button onclick="app.loadPage('login')" class="text-green-100 hover:text-white px-3 py-2 transition-colors">Login</button>
                            <button onclick="app.loadPage('register')" class="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors">Sign Up</button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
}