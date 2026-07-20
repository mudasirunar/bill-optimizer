// ════════════════════════════════════════
// PROFILE SETTINGS LOGIC
// ════════════════════════════════════════

const db = firebase.firestore();
let currentUser = null;

// Profile Completion Calculator (copied from dashboard for consistency)
function calcProfileCompletion(d) {
    let score = 0; const total = 16;
    const has = (v) => v !== undefined && v !== null && v !== "";
    if (has(d.disco)) score++;
    if (has(d.sanctioned_load)) score++;
    if (has(d.user_category)) score++;
    if (has(d.person_count)) score++;
    if (has(d.user_routine)) score++;
    if (has(d.property_area)) score++;
    if (has(d.floors)) score++;
    if (has(d.fan_ac_qty) || has(d.fan_dc_qty)) score++;
    if (has(d.ac_std_qty) || has(d.ac_inv_qty)) score++;
    if (has(d.f_qty)) score++;
    if (has(d.wm_qty)) score++;
    if (has(d.wp_qty)) score++;
    if (has(d.u_qty)) score++;
    if (has(d.k_qty)) score++;
    if (has(d.iron_qty)) score++;
    if ((d.bill_history || []).length > 0) score++;
    return Math.round((score / total) * 100);
}

// ─── 1. SESSION INITIALIZER ───
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    initDynamicBreadcrumb("Profile Settings");
    
    // Set static auth info
    const displayNameInput = document.getElementById('displayNameInput');
    const emailDisplayOnly = document.getElementById('emailDisplayOnly');
    const profileCardEmail = document.getElementById('profile-card-email');

    if (displayNameInput) displayNameInput.value = user.displayName || "";
    if (emailDisplayOnly) emailDisplayOnly.value = user.email || "";
    if (profileCardEmail) profileCardEmail.innerText = user.email || "";

    // Set user avatar
    const pfpCard = document.getElementById('profile-card-pfp');
    if (pfpCard) {
        const photo = user.photoURL;
        if (photo && (photo.startsWith('http') || photo.startsWith('https'))) {
            pfpCard.src = photo;
        } else {
            pfpCard.src = `https://cdn-icons-png.flaticon.com/512/3135/3135715.png`;
        }
    }

    // Set details card name
    const profileCardName = document.getElementById('profile-card-name');
    if (profileCardName) {
        profileCardName.innerText = user.displayName || user.email.split('@')[0];
    }

    // Load dynamic DB status indicators
    db.collection('users').doc(user.uid).get().then(doc => {
        const d = doc.exists ? doc.data() : {};
        
        // Completion Pct
        const pct = calcProfileCompletion(d);
        const metaPct = document.getElementById('meta-profile-pct');
        if (metaPct) {
            metaPct.innerText = `${pct}% Complete`;
            metaPct.style.color = pct >= 80 ? 'var(--g3)' : (pct >= 50 ? 'var(--warn)' : '#ef4444');
        }

        // Distribution Provider
        const metaDisco = document.getElementById('meta-disco');
        if (metaDisco) {
            metaDisco.innerText = d.disco || "Not Setup";
        }

        // Category Slab
        const metaCategory = document.getElementById('meta-category');
        if (metaCategory) {
            const catMap = { 'lifeline': 'Lifeline', 'protected': 'Protected', 'non_protected': 'Unprotected' };
            metaCategory.innerText = catMap[d.user_category] || d.user_category || "Not Setup";
        }
    }).catch(err => {
        console.error("Error loading user profile indicators:", err);
    });
});

// ─── 2. SAVE DETAILS ───
async function saveProfileSettings() {
    if (!currentUser) return;
    
    const newName = document.getElementById('displayNameInput').value.trim();
    if (!newName) {
        showToast("Please enter a valid display name.", "fa-circle-xmark", "#ef4444");
        return;
    }

    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Saving...`;

    try {
        // 1. Update Firebase Auth Profile
        await currentUser.updateProfile({
            displayName: newName
        });

        // 2. Update Firestore Record (so details persist in queries)
        await db.collection('users').doc(currentUser.uid).set({
            displayName: newName
        }, { merge: true });

        // 3. Update localStorage session caches
        localStorage.setItem('userDisplayName', newName);

        // 4. Reflect instantly in DOM
        const nameDisplay = document.getElementById('user-name-display');
        const greetingDisplay = document.getElementById('greeting-display');
        const cardName = document.getElementById('profile-card-name');
        const dropdownName = document.getElementById('dropdown-user-name');

        if (nameDisplay) nameDisplay.innerText = newName;
        if (cardName) cardName.innerText = newName;
        if (dropdownName) dropdownName.innerText = newName;
        
        if (greetingDisplay) {
            greetingDisplay.innerText = `Welcome back, ${newName.split(' ')[0]}`;
        }

        showToast("Profile details updated successfully!", "fa-circle-check", "var(--g3)");
    } catch (err) {
        console.error("Save profile error:", err);
        showToast("Failed to update profile: " + err.message, "fa-circle-xmark", "#ef4444");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-regular fa-floppy-disk"></i> Save Details`;
    }
}

// ─── 3. CLEAR PROFILE DATA ───
async function executeClearProfileData() {
    if (!currentUser) return;

    try {
        // Delete Firestore document (this resets their setup profile status entirely)
        await db.collection('users').doc(currentUser.uid).delete();

        // Clear local prediction and forecast caches
        localStorage.removeItem('lastPredictionRun');
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k.startsWith('forecast_') || k.startsWith('predict_') || k.startsWith('split_') || k.startsWith('seasonal_')) {
                localStorage.removeItem(k);
            }
        }

        closeConfirmModal('clear');
        showToast("Profile data cleared successfully.", "fa-circle-check", "var(--g3)");
        
        setTimeout(() => {
            window.location.href = "setup-profile.html";
        }, 1500);

    } catch (err) {
        console.error("Error clearing data:", err);
        showToast("Error clearing profile: " + err.message, "fa-circle-xmark", "#ef4444");
    }
}

// ─── 4. DELETE ACCOUNT (DANGER ZONE) ───
async function executeDeleteAccount() {
    if (!currentUser) return;

    try {
        // 1. Delete user doc from Firestore
        await db.collection('users').doc(currentUser.uid).delete();

        // 2. Delete user Auth details from Firebase
        await currentUser.delete();

        // 3. Clear all localStorage keys
        localStorage.clear();

        closeConfirmModal('delete');
        window.location.href = "signup.html";

    } catch (err) {
        console.error("Account deletion error:", err);
        if (err.code === 'auth/requires-recent-login') {
            closeConfirmModal('delete');
            openConfirmModal('reauth');
        } else {
            showToast("Failed to delete account: " + err.message, "fa-circle-xmark", "#ef4444");
        }
    }
}

// ─── 5. REAUTH REDIRECT FLOW ───
function executeReauthRedirect() {
    firebase.auth().signOut().then(() => {
        localStorage.clear();
        window.location.href = "login.html?reauth=true";
    });
}

// ─── 6. INTERACTIVE DIALOG MODALS ───
function openConfirmModal(type) {
    const modalId = type === 'clear' ? 'clearDataModal' : (type === 'delete' ? 'deleteAccountModal' : 'reauthModal');
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scroll
    }
}

function closeConfirmModal(type) {
    const modalId = type === 'clear' ? 'clearDataModal' : (type === 'delete' ? 'deleteAccountModal' : 'reauthModal');
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Unlock background scroll
    }
}

// ─── 7. FLOATING TOAST NOTIFICATION ───
function showToast(message, iconClass, color) {
    const toast = document.getElementById('toastNotification');
    const icon = document.getElementById('toastIcon');
    const text = document.getElementById('toastText');

    if (toast && text) {
        text.innerText = message;
        if (icon) {
            icon.className = `fa ${iconClass}`;
            if (color) icon.style.color = color;
        }
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Close modals on clicking overlay background
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});
