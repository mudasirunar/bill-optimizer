firebase.auth().onAuthStateChanged(user => {
            // Public Page (No breadcrumb initialization)
        });

        function logout() { logDetailedEvent('logout'); firebase.auth().signOut().then(() => window.location.href = 'login.html'); }

        // Scroll to top logic
        const scrollBtn = document.getElementById('scrollTopBtn');
        window.addEventListener('scroll', () => {
            scrollBtn.classList.toggle('visible', window.scrollY > 500);
        }, { passive: true });
        scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
