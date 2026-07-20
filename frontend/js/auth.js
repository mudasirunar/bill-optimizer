// 1. Unified Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyB1KDRJv0pR8RcgrHhmZBOlzRNVeQEp8K0",
    authDomain: "bill-optimizer-34de9.firebaseapp.com",
    projectId: "bill-optimizer-34de9",
    storageBucket: "bill-optimizer-34de9.firebasestorage.app",
    messagingSenderId: "205204930353",
    appId: "1:205204930353:web:55d44cab9645e5127a7a10",
    measurementId: "G-BG5ETT4MHD"
};

// 2. Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// 2b. Initialize Analytics safely
const analytics = (typeof firebase.analytics === 'function') ? firebase.analytics() : null;

// Helper to log event safely
function logDetailedEvent(eventName, params = {}) {
    if (analytics) {
        try {
            // Automatically inject current user info if available
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                params.user_uid = currentUser.uid;
                params.user_email = currentUser.email;
            }
            // Inject current page
            params.page_path = window.location.pathname;
            
            analytics.logEvent(eventName, params);
            console.log(`📊 [Analytics] Logged: ${eventName}`, params);
        } catch (e) {
            console.error(`📊 [Analytics] Error logging event ${eventName}:`, e);
        }
    } else {
        console.warn(`📊 [Analytics Page Missing Script] Event not logged: ${eventName}`, params);
    }
}

// 3. UI Error Message with Shake
function showErrorMessage(msg) {
    const errorDiv = document.getElementById('error-message');
    const errorSpan = document.getElementById('error-text');
    if (errorDiv && errorSpan) {
        errorSpan.innerText = msg;
        errorDiv.style.display = 'flex';
        errorDiv.style.animation = 'none';
        errorDiv.offsetHeight; // trigger reflow
        errorDiv.style.animation = 'shake 0.4s ease-in-out';

        setTimeout(() => { errorDiv.style.display = 'none'; }, 6000);
    }
}

// 3b. Authenticating Loader Overlay Controls
function showAuthLoading(message = "Connecting to Secure Auth") {
    const overlay = document.getElementById('auth-loading-overlay');
    if (overlay) {
        const textSpan = document.getElementById('auth-loading-msg');
        if (textSpan) textSpan.innerText = message;
        document.body.style.overflow = 'hidden'; // Disable scroll
        overlay.style.display = 'flex';
        overlay.offsetHeight; // trigger reflow
        overlay.style.opacity = '1';
        const card = overlay.querySelector('.auth-loading-card');
        if (card) card.style.transform = 'scale(1)';
    }
}

function hideAuthLoading() {
    const overlay = document.getElementById('auth-loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        const card = overlay.querySelector('.auth-loading-card');
        if (card) card.style.transform = 'scale(0.9)';
        document.body.style.overflow = ''; // Restore scroll
        setTimeout(() => {
            if (overlay.style.opacity === '0') {
                overlay.style.display = 'none';
            }
        }, 300);
    }
}

// 4. Handle Redirect Logic
function handleAuthRedirect(userCredential) {
    const redirectPage = sessionStorage.getItem('redirectAfterLogin');
    if (redirectPage) {
        sessionStorage.removeItem('redirectAfterLogin');
        window.location.href = redirectPage;
    } else {
        const isNewUser = userCredential.additionalUserInfo?.isNewUser;
        if (isNewUser) {
            window.location.href = "setup-profile.html";
        } else {
            window.location.href = "dashboard.html";
        }
    }
}

// 5. Google Login (Works for both Sign In & Sign Up)
async function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    showAuthLoading("Authenticating with Google");
    logDetailedEvent('login_started', { method: 'google' });
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const result = await auth.signInWithPopup(provider);
        localStorage.setItem('userLoggedIn', 'true');
        logDetailedEvent('login_success', { method: 'google', is_new_user: result.additionalUserInfo?.isNewUser || false });
        handleAuthRedirect(result);
    } catch (error) {
        hideAuthLoading();
        logDetailedEvent('login_failed', { method: 'google', error_message: error.message, error_code: error.code });
        showErrorMessage(error.message);
    }
}

// 6. Email Sign In
async function handleSignIn(email, password) {
    if (!email || !password) return showErrorMessage("Please enter both email and password.");
    showAuthLoading("Signing in");
    logDetailedEvent('login_started', { method: 'email' });
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const result = await auth.signInWithEmailAndPassword(email, password);
        localStorage.setItem('userLoggedIn', 'true');
        logDetailedEvent('login_success', { method: 'email', is_new_user: result.additionalUserInfo?.isNewUser || false });
        handleAuthRedirect(result);
    } catch (error) {
        hideAuthLoading();
        logDetailedEvent('login_failed', { method: 'email', error_message: error.message, error_code: error.code });
        showErrorMessage("Invalid email or password.");
    }
}

// 7. Enhanced Sign Up
// Enhanced Sign Up with Granular Error Messages
async function handleSignUp(firstName, lastName, email, password, confirmPassword) {
    // 1. Basic Field Checks
    if (!firstName.trim()) return showErrorMessage("Please enter your first name.");
    if (!lastName.trim()) return showErrorMessage("Please enter your last name.");
    if (!email.trim()) return showErrorMessage("Email address is required.");

    // 2. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return showErrorMessage("Please enter a valid email address.");
    }

    // 3. Password Criteria (8+ chars, 1 Capital, 1 Digit)
    if (password.length < 8) {
        return showErrorMessage("Password must be at least 8 characters long.");
    }
    if (!/[A-Z]/.test(password)) {
        return showErrorMessage("Password needs at least one capital letter.");
    }
    if (!/[0-9]/.test(password)) {
        return showErrorMessage("Password needs at least one digit (0-9).");
    }

    // 4. Password Match Check
    if (password !== confirmPassword) {
        return showErrorMessage("Passwords do not match. Please re-type.");
    }

    showAuthLoading("Creating your account");
    logDetailedEvent('signup_started');
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        localStorage.setItem('userLoggedIn', 'true');

        // Update Profile with Full Name for Dashboard Greeting
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        await result.user.updateProfile({ displayName: fullName });

        // Assign random avatar color for initials-based profile icon
        const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        const db = firebase.firestore();
        await db.collection('users').doc(result.user.uid).set({ avatarColor }, { merge: true });
        localStorage.setItem('avatarColor', avatarColor);

        logDetailedEvent('signup_success');

        // One-time Setup Redirect for New Users
        const redirectPage = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPage) {
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectPage;
        } else {
            if (result.additionalUserInfo?.isNewUser) {
                window.location.href = "setup-profile.html";
            } else {
                window.location.href = "dashboard.html";
            }
        }
    } catch (error) {
        hideAuthLoading();
        logDetailedEvent('signup_failed', { error_message: error.message, error_code: error.code });
        // Handle Firebase-specific errors (e.g., Email already exists)
        if (error.code === 'auth/email-already-in-use') {
            showErrorMessage("This email is already registered. Try logging in.");
        } else if (error.code === 'auth/invalid-email') {
            showErrorMessage("The email format is incorrect.");
        } else {
            showErrorMessage(error.message);
        }
    }
}

const titleCase = (str) => str ? str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "";

// ─── AVATAR SYSTEM (WhatsApp-Style Initials) ───

const AVATAR_COLORS = [
    '#E17076', '#ED8F5A', '#FAB84D', '#7BC862', '#6EC9CB',
    '#65AADD', '#A695E7', '#EE7AAE', '#E57373', '#F0A04B',
    '#81C784', '#4DB6AC', '#4FC3F7', '#7986CB', '#BA68C8',
    '#F48FB1', '#FF8A65', '#FFD54F', '#AED581', '#4DD0E1',
    '#9575CD', '#F06292', '#FFB74D', '#A1887F', '#90A4AE',
    '#DCE775', '#26A69A', '#42A5F5', '#EC407A', '#AB47BC'
];

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

function generateInitialsAvatar(name, bgColor, size = 200) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background circle
    ctx.fillStyle = bgColor || '#65AADD';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Text initials
    const initials = getInitials(name);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.42}px 'Syne', 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size / 2 + (size * 0.02));

    return canvas.toDataURL('image/png');
}

function getAvatarColorFromUID(uid) {
    // Deterministic hash for legacy users without stored color
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32-bit int
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function isGoogleProvider(user) {
    return user.providerData && user.providerData.some(p => p.providerId === 'google.com');
}

function applyAvatarToElements(dataURI, elementIds) {
    elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = dataURI;
    });
}

// 8. Global Session Watcher (Stays intact for refresh)
auth.onAuthStateChanged((user) => {
    if (user) {
        localStorage.setItem('userLoggedIn', 'true');

        const nameDisplay = document.getElementById('user-name-display');
        const pfpDisplay = document.getElementById('user-pfp');
        const greetingDisplay = document.getElementById('greeting-display');

        // --- 1. NAME LOGIC (Capitalized & Safe) ---
        const rawName = user.displayName || user.email.split('@')[0] || "User";
        const cleanName = titleCase(rawName);

        // Cache profile information in localStorage
        localStorage.setItem('userDisplayName', cleanName);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userPhotoURL', user.photoURL || '');
        localStorage.setItem('userUid', user.uid);

        if (nameDisplay) nameDisplay.innerText = cleanName;

        if (greetingDisplay) {
            const firstName = cleanName.split(' ')[0];
            greetingDisplay.innerText = `Welcome back, ${firstName}`;
        }

        // --- 2. PFP LOGIC (Avatar System) ---
        const dropdownName = document.getElementById('dropdown-user-name');
        const dropdownEmail = document.getElementById('dropdown-user-email');
        const dropdownPfp = document.getElementById('dropdown-user-pfp');

        if (dropdownName) dropdownName.innerText = cleanName;
        if (dropdownEmail) dropdownEmail.innerText = user.email;

        if (isGoogleProvider(user)) {
            // Google users: use their Google profile photo
            const photo = user.photoURL;
            if (photo && (photo.startsWith('http') || photo.startsWith('https'))) {
                if (pfpDisplay) pfpDisplay.src = photo;
                if (dropdownPfp) dropdownPfp.src = photo;
            }
            localStorage.setItem('userPhotoURL', photo || '');
            localStorage.removeItem('avatarColor');
        } else {
            // Email/Password users: generate initials avatar
            localStorage.setItem('userPhotoURL', '');
            const db = firebase.firestore();
            db.collection('users').doc(user.uid).get().then(doc => {
                let avatarColor = doc.exists && doc.data().avatarColor ? doc.data().avatarColor : null;

                if (!avatarColor) {
                    // Legacy user fallback: deterministic color from UID
                    avatarColor = getAvatarColorFromUID(user.uid);
                    db.collection('users').doc(user.uid).set({ avatarColor }, { merge: true }).catch(() => {});
                }

                localStorage.setItem('avatarColor', avatarColor);
                const avatarURI = generateInitialsAvatar(cleanName, avatarColor);
                applyAvatarToElements(avatarURI, ['user-pfp', 'dropdown-user-pfp', 'profile-card-pfp']);
            }).catch(() => {
                // Final fallback: use UID-based color even if Firestore fails
                const fallbackColor = getAvatarColorFromUID(user.uid);
                const avatarURI = generateInitialsAvatar(cleanName, fallbackColor);
                applyAvatarToElements(avatarURI, ['user-pfp', 'dropdown-user-pfp', 'profile-card-pfp']);
            });
        }

        // --- GLOBAL REDIRECT LOGIC ---
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        const isAuthPage = filename === "login.html" || filename === "signup.html" || filename === "login" || filename === "signup" || filename === "" || path.endsWith("/");

        if (isAuthPage) {
            // Check if account was JUST created (within the last 10 seconds)
            const created = new Date(user.metadata.creationTime).getTime();
            const lastLogin = new Date(user.metadata.lastSignInTime).getTime();
            const isBrandNew = Math.abs(created - lastLogin) < 10000; // 10s window

            if (isBrandNew) {
                window.location.href = "setup-profile.html";
            } else {
                window.location.href = "dashboard.html";
            }
        }
    } else {
        // Clear cached session info
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userDisplayName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userPhotoURL');
        localStorage.removeItem('userUid');

        // Redirect to login.html if we are currently on a protected page
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        const isAuthPage = filename === "login.html" || filename === "signup.html" || filename === "login" || filename === "signup" || filename === "" || path.endsWith("/");
        const isPublicPage = filename === "about-us.html" || filename === "nepra-info.html" || filename === "about-us" || filename === "nepra-info";
        if (!isAuthPage && !isPublicPage) {
            window.location.href = "login.html";
        }
    }
});

// 9. Pre-populate UI from LocalStorage Cache to eliminate loading lag
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    if (isLoggedIn) {
        const cachedName = localStorage.getItem('userDisplayName');
        const cachedPhoto = localStorage.getItem('userPhotoURL');

        const nameDisplay = document.getElementById('user-name-display');
        const pfpDisplay = document.getElementById('user-pfp');
        const greetingDisplay = document.getElementById('greeting-display');

        if (nameDisplay && cachedName) {
            nameDisplay.innerText = cachedName;
        }
        if (greetingDisplay && cachedName) {
            const firstName = cachedName.split(' ')[0];
            const getGreeting = () => {
                const h = new Date().getHours();
                if (h < 5) return 'Good Night';
                if (h < 12) return 'Good Morning';
                if (h < 17) return 'Good Afternoon';
                if (h < 21) return 'Good Evening';
                return 'Good Night';
            };
            greetingDisplay.innerText = `${getGreeting()}, ${firstName}`;
        }
        if (pfpDisplay) {
            if (cachedPhoto && (cachedPhoto.startsWith('http') || cachedPhoto.startsWith('https'))) {
                pfpDisplay.src = cachedPhoto;
            } else {
                pfpDisplay.src = `https://cdn-icons-png.flaticon.com/512/3135/3135715.png`;
            }
        }

        // Immediately add auth-verified class to body to prevent layout fade-in delay
        document.body.classList.add('auth-verified');
    }

    // Check if redirecting for reauth
    if (window.location.search.includes('reauth=true')) {
        setTimeout(() => {
            showErrorMessage("Security check: Please log in again to delete your account.");
        }, 500);
    }
});


/**
 * Real-Time Path Engine
 * Logic: Dashboard > [The Actual Last Page You Visited] > [Current Page]
 */
function initDynamicBreadcrumb(currentPageTitle) {
    const breadcrumbEl = document.getElementById('dynamic-breadcrumb');
    if (!breadcrumbEl) return;

    const ref = document.referrer;
    const currentPath = window.location.pathname;

    // 1. Map of filenames to Readable Titles
    const pageMap = {
        'prediction-hub.html': 'Prediction Hub',
        'load-forecaster.html': 'Load Forecaster',
        'appliance-simulator.html': 'Appliance Simulator',
        'ai-memory.html': 'AI Memory',
        'setup-profile.html': 'Setup Profile',
        'profile.html': 'Profile Settings',
        'nepra-info.html': 'NEPRA Info',
        'about-us.html': 'About Us'
    };

    // Start with Dashboard or Home depending on session
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    let navHTML = isLoggedIn 
        ? `<a href="dashboard.html">Dashboard</a>`
        : `<a href="index.html">Home</a>`;

    // 2. Identify the Referrer (Where you just came from)
    let lastPageFile = null;
    let lastPageTitle = null;

    for (const [file, title] of Object.entries(pageMap)) {
        const cleanFile = file.replace('.html', '');
        if (ref.includes(file) || ref.endsWith('/' + cleanFile) || ref.includes('/' + cleanFile + '?') || ref.includes('/' + cleanFile + '#')) {
            lastPageFile = file;
            lastPageTitle = title;
            break;
        }
    }


    const currentFile = currentPath.split('/').pop();
    if (lastPageFile && !ref.includes('dashboard.html') && currentFile !== lastPageFile) {
        navHTML += ` <i class="fa fa-chevron-right" style="font-size:0.5rem; margin:0 8px"></i> 
                     <a href="${lastPageFile}">${lastPageTitle}</a>`;
    }

    // 4. Add Final Tail (Current Page)
    navHTML += ` <i class="fa fa-chevron-right" style="font-size:0.5rem; margin:0 8px"></i> 
                 <span>${currentPageTitle}</span>`;

    breadcrumbEl.innerHTML = navHTML;
}