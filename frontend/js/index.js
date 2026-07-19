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
