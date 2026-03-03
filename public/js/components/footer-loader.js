/**
 * QScrap Footer Component Loader v2026.2
 * Dynamically loads the footer component with retry logic and error handling
 * 
 * Usage: <script src="/js/components/footer-loader.js" defer></script>
 * 
 * Features:
 * - Async/await with 3 retry attempts
 * - Loading state indicator
 * - Versioned caching (v=2026.2)
 * - Automatic i18n translation re-application
 * - Custom event dispatch (footer:loaded)
 * - Semantic HTML5 footer element
 */

(function() {
    'use strict';

    // Configuration
    const FOOTER_VERSION = '2026.2';
    const FOOTER_PATH = `/components/footer.html?v=${FOOTER_VERSION}`;
    const FOOTER_CONTAINER_ID = 'footer-container';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // ms

    /**
     * Sleep utility for retry delays
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Load footer component with retry logic
     */
    async function loadFooter(retries = MAX_RETRIES) {
        try {
            // Find or create footer container
            let container = document.getElementById(FOOTER_CONTAINER_ID);
            
            if (!container) {
                // Create semantic footer element if it doesn't exist
                container = document.createElement('footer');
                container.id = FOOTER_CONTAINER_ID;
                container.setAttribute('aria-label', 'Site footer');
                document.body.appendChild(container);
            }

            // Show loading state
            container.innerHTML = '<div class="footer-loading" aria-label="Loading footer">Loading...</div>';

            // Fetch footer HTML
            const response = await fetch(FOOTER_PATH);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const footerHTML = await response.text();
            container.innerHTML = footerHTML;

            // Dispatch custom event when footer is loaded
            document.dispatchEvent(new CustomEvent('footer:loaded', {
                detail: { version: FOOTER_VERSION }
            }));

            // If i18n is already initialized, re-apply translations
            if (window.translations) {
                const currentLang = localStorage.getItem('qscrap-lang') || 'en';
                // Small delay to ensure DOM is updated
                setTimeout(() => {
                    applyTranslations(currentLang);
                }, 50);
            }

            console.log(`[Footer Loader] Successfully loaded footer v${FOOTER_VERSION}`);

        } catch (error) {
            console.error(`[Footer Loader] Error loading footer (retries left: ${retries}):`, error.message);
            
            // Retry logic
            if (retries > 0) {
                await sleep(RETRY_DELAY);
                return loadFooter(retries - 1);
            }

            // Fallback footer after all retries failed
            handleFooterLoadFailure();
        }
    }

    /**
     * Apply translations to footer elements
     */
    function applyTranslations(lang) {
        if (!window.translations || !window.translations[lang]) {
            return;
        }

        const container = document.getElementById(FOOTER_CONTAINER_ID);
        if (!container) {
            return;
        }

        const translations = window.translations[lang];

        // Scope updates to the footer only, so page-level i18n remains the source of truth.
        container.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (!Object.prototype.hasOwnProperty.call(translations, key)) {
                return;
            }

            const translation = translations[key];
            if (translation === null || translation === undefined) {
                return;
            }

            // Footer translations are text-only; icons are part of the component template.
            el.textContent = String(translation);
        });

        // Note: Language visibility is handled by CSS based on html[dir] attribute
        // The page's i18n system is responsible for setting dir="rtl" or dir="ltr"
    }

    /**
     * Handle footer load failure with graceful fallback
     */
    function handleFooterLoadFailure() {
        const container = document.getElementById(FOOTER_CONTAINER_ID);
        if (!container) return;

        // Minimal fallback footer
        container.innerHTML = `
            <div class="container" style="text-align:center;padding:40px 20px;">
                <p style="color:var(--slate-light);font-size:14px;">
                    © 2026 QScrap Services & Trading L.L.C. All rights reserved.
                </p>
                <p style="color:var(--slate);font-size:13px;margin-top:8px;">
                    Doha, Qatar
                </p>
            </div>
        `;

        console.error('[Footer Loader] Using fallback footer after failed load attempts');
    }

    /**
     * Initialize footer loader when DOM is ready
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => loadFooter());
        } else {
            loadFooter();
        }
    }

    // Start initialization
    init();

    // Expose API for manual control
    window.QScrapFooter = {
        load: loadFooter,
        version: FOOTER_VERSION,
        reload: () => loadFooter(MAX_RETRIES)
    };

})();
