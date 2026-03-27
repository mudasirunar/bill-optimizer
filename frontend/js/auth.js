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

// 2. Initialize Firebase (Ensure it ONLY happens once)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// 3. UI Error Message (Fixed display logic)
function showErrorMessage(msg) {
    const errorDiv = document.getElementById('error-message');
    const errorSpan = document.getElementById('error-text') || errorDiv; // fallback if span missing
    
    if(errorDiv) {
        errorSpan.innerText = msg;
        errorDiv.style.display = 'flex'; 
        errorDiv.style.animation = 'shake 0.4s ease-in-out';
        
        setTimeout(() => { 
            errorDiv.style.display = 'none'; 
        }, 6000);
    }
}

// 4. Fixed Google Login
async function handleGoogleLogin() {
    console.log("Google Login Triggered"); // Debug check
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        await auth.signInWithPopup(provider);
        // Redirect is handled by onAuthStateChanged below
    } catch (error) {
        console.error("Google Error:", error);
        showErrorMessage(error.message);
    }
}

// 5. Fixed Email Sign In
async function handleSignIn(email, password) {
    if (!email || !password) return showErrorMessage("Enter both email and password.");

    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showErrorMessage(error.message);
    }
}

// 6. Fixed Sign Up (Added missing handleSignUp function)
async function handleSignUp(name, email, password, confirmPassword) {
    if (!name || !email || !password) return showErrorMessage("All fields are required.");
    if (password !== confirmPassword) return showErrorMessage("Passwords do not match.");
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        // Redirect handled by onAuthStateChanged
    } catch (error) {
        showErrorMessage(error.message);
    }
}

// 7. Global Redirect Logic (The only place window.location.href should be)
auth.onAuthStateChanged((user) => {
    const path = window.location.pathname;
    const isAuthPage = path.includes("index.html") || path.includes("signup.html") || path.endsWith("/");
    
    if (user && isAuthPage) {
        window.location.href = "dashboard.html";
    }
});