/**
 * QScrap Cookie Consent Handler
 * 
 * Manages the display and persistence of the cookie consent banner.
 */

(function () {
    const CONSENT_KEY = 'qscrap_cookie_consent';

    function initCookieConsent() {
        const banner = document.getElementById('cookieConsent');
        const acceptBtn = document.getElementById('acceptCookies');
        const declineBtn = document.getElementById('declineCookies');

        if (!banner || !acceptBtn || !declineBtn) return;

        const consent = localStorage.getItem(CONSENT_KEY);

        // Show banner only if no consent recorded
        if (!consent) {
            banner.style.display = 'flex';
        } else if (consent === 'declined') {
            disableAnalytics();
        }

        // Accept cookies
        acceptBtn.addEventListener('click', function () {
            localStorage.setItem(CONSENT_KEY, 'accepted');
            banner.style.display = 'none';
            if (typeof window.loadAnalytics === 'function') {
                window.loadAnalytics();
            }
        });

        // Decline cookies
        declineBtn.addEventListener('click', function () {
            localStorage.setItem(CONSENT_KEY, 'declined');
            banner.style.display = 'none';
            disableAnalytics();
        });
    }

    function disableAnalytics() {
        window.ga = window.ga || function () { (window.ga.q = window.ga.q || []).push(arguments); };
        window.ga.l = +new Date;
    }

    // Initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCookieConsent);
    } else {
        initCookieConsent();
    }
})();
