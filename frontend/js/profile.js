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
        
        // Cache profile data for export
        window.userProfileData = d;
        
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

        // Populate Diagnostics
        const diagAppliances = document.getElementById('diag-appliances');
        if (diagAppliances) {
            const appQty = (d.ac_qty || 0) + (d.f_qty || 0) + (d.wm_qty || 0) + (d.wp_qty || 0) + (d.k_qty || 0) + (d.u_qty || 0) + (d.iron_qty || 0) + (d.fan_qty || 0);
            diagAppliances.innerText = appQty > 0 ? `${appQty} Active` : "0 Devices";
        }

        const diagLoad = document.getElementById('diag-load');
        if (diagLoad) {
            diagLoad.innerText = d.sanctioned_load ? `${parseFloat(d.sanctioned_load).toFixed(2)} kW` : "Not Setup";
        }

        const diagBaseload = document.getElementById('diag-baseload');
        if (diagBaseload) {
            const baseloadWatts = d.mean_hourly ? Math.round(d.mean_hourly * 1000) : null;
            diagBaseload.innerText = baseloadWatts ? `${baseloadWatts} W` : "--";
        }

        const diagAvgUnits = document.getElementById('diag-avg-units');
        if (diagAvgUnits) {
            diagAvgUnits.innerText = d.historical_avg_units ? `${Math.round(d.historical_avg_units)} kWh` : "0 kWh";
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

// Logout utility matching other app pages
function logout() {
    if (typeof logDetailedEvent === 'function') {
        logDetailedEvent('logout');
    }
    firebase.auth().signOut().then(() => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
}

// ─── 7. EXPORT BILLING DATA (CSV) ───
function exportBillingData() {
    if (!currentUser || !window.userProfileData) {
        showToast("No profile data loaded yet.", "fa-circle-xmark", "#ef4444");
        return;
    }

    const d = window.userProfileData;
    const history = d.bill_history || [];

    // 1. Build CSV content string
    let csv = [];
    
    // Metadata Header
    csv.push(`"Smart Energy Management System - Billing & Configuration Export"`);
    csv.push(`"Generated On:","${new Date().toLocaleString()}"`);
    csv.push(`"User Name:","${currentUser.displayName || "N/A"}"`);
    csv.push(`"User Email:","${currentUser.email || "N/A"}"`);
    csv.push(`"Distribution Provider (DISCO):","${d.disco || "N/A"}"`);
    const catMap = { 'lifeline': 'Lifeline', 'protected': 'Protected', 'non_protected': 'Unprotected' };
    csv.push(`"Tariff Category:","${catMap[d.user_category] || d.user_category || "N/A"}"`);
    csv.push(`"Sanctioned Load:","${d.sanctioned_load ? d.sanctioned_load + ' kW' : 'N/A'}"`);
    csv.push(`"Property Area:","${d.property_area ? d.property_area + ' Sq Ft' : 'N/A'}"`);
    csv.push(`"Occupants:","${d.person_count || 'N/A'}"`);
    csv.push(`"Floors Count:","${d.floors || 'N/A'}"`);
    csv.push(`"User Routine:","${d.user_routine || 'N/A'}"`);
    csv.push(""); // Empty line separator
    
    // SECTION A: APPLIANCE INVENTORY
    csv.push(`"SECTION A: HOUSEHOLD APPLIANCE INVENTORY"`);
    csv.push(`"Appliance Type","Quantity (Units)","Avg. Daily Usage (Hours)","Weekly Frequency (Days)"`);
    
    const appliances = [
        { name: "Standard AC (Non-Inverter)", qty: d.ac_std_qty, hours: d.ac_std_val, freq: d.ac_std_freq },
        { name: "Inverter AC", qty: d.ac_inv_qty, hours: d.ac_inv_val, freq: d.ac_inv_freq },
        { name: "Refrigerator", qty: d.f_qty, hours: d.f_val, freq: d.f_freq },
        { name: "Washing Machine", qty: d.wm_qty, hours: d.wm_val, freq: d.wm_freq },
        { name: "Water Pump", qty: d.wp_qty, hours: d.wp_val, freq: d.wp_freq },
        { name: "Kitchen Appliances", qty: d.k_qty, hours: d.k_val, freq: d.k_freq },
        { name: "UPS Backup Unit", qty: d.u_qty, hours: d.u_val, freq: d.u_freq },
        { name: "Electric Iron", qty: d.iron_qty, hours: d.iron_val, freq: d.iron_freq },
        { name: "AC Fans", qty: d.fan_ac_qty, hours: 12, freq: 7 },
        { name: "DC Fans", qty: d.fan_dc_qty, hours: 12, freq: 7 }
    ];

    appliances.forEach(app => {
        const qty = app.qty !== undefined && app.qty !== null ? app.qty : 0;
        if (qty > 0) {
            csv.push(`"${app.name}","${qty}","${app.hours || 0}","${app.freq || 0}"`);
        }
    });

    csv.push(""); // Separator
    
    // SECTION B: HISTORICAL BILLING SUMMARY
    csv.push(`"SECTION B: HISTORICAL BILLING SUMMARY"`);
    csv.push(`"Month","Units Consumed (kWh)","Bill Amount (PKR)","Avg Unit Cost (PKR/kWh)"`);
    
    if (history.length > 0) {
        history.forEach(row => {
            const month = row.month || "";
            const units = row.units !== undefined ? row.units : "";
            const amount = row.amount !== undefined ? row.amount : "";
            const avgCost = (units > 0 && amount > 0) ? (amount / units).toFixed(2) : "0.00";
            csv.push(`"${month}","${units}","${amount}","${avgCost}"`);
        });
    } else {
        csv.push(`"No historical billing records loaded."`);
    }

    const csvContent = csv.join("\n");
    
    // 2. Trigger native browser file download
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Energy_Profile_Report_${currentUser.uid.substring(0, 8)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Billing & configuration exported successfully!", "fa-circle-check", "var(--g3)");
    } catch (err) {
        console.error("CSV Export error:", err);
        showToast("Export failed: " + err.message, "fa-circle-xmark", "#ef4444");
    }
}
