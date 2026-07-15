// session-check.js
// Runs synchronously in <head> to prevent page flashing / layout shift
(function () {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);

    // Determine if the current page is an authentication page (login or signup)
    const isAuthPage = filename === "login.html" || filename === "signup.html" || filename === "" || path.endsWith("/");
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';

    if (isLoggedIn) {
        if (isAuthPage) {
            window.location.href = "dashboard.html";
        }
    } else {
        if (!isAuthPage) {
            window.location.href = "login.html";
        }
    }
})();
