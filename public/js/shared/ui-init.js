/**
 * QScrap Shared UI Initialization
 * Centralizes common UI initialization logic (sidebar toggles, modals, etc.)
 * Uses event delegation to eliminate inline onclick handlers.
 * 
 * Usage: Include this script in your HTML after Bootstrap Icons CSS.
 * All dashboards should use data-action attributes instead of inline onclick.
 */

(function () {
    'use strict';

    // Action handlers registry
    const actionHandlers = {};

    /**
     * Register an action handler
     * @param {string} actionName - Name of the action (e.g., 'toggleSidebar')
     * @param {Function} handler - Handler function
     */
    function registerAction(actionName, handler) {
        actionHandlers[actionName] = handler;
    }

    /**
     * Global event delegation handler
     * @param {Event} event - Event
     */
    function handleAction(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        // Support both data-params and data-arg for compatibility
        const params = target.dataset.params || target.dataset.arg || '';
        const stopPropagation = target.dataset.stopPropagation === 'true';

        if (stopPropagation) {
            event.stopPropagation();
        }

        // Prevent default for links and buttons unless specified
        if ((target.tagName === 'A' || target.tagName === 'BUTTON') && target.dataset.preventDefault !== 'false') {
            event.preventDefault();
        }

        // Execute handler
        if (actionHandlers[action]) {
            try {
                // If params contains a comma, split into multiple arguments
                if (params && params.includes(',') && !params.includes('{')) {
                    const args = params.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
                    actionHandlers[action](target, ...args, event);
                } else {
                    actionHandlers[action](target, params, event);
                }
            } catch (error) {
                console.error(`[UI-Init] Action "${action}" failed:`, error);
                if (window.SharedErrorBoundary) {
                    window.SharedErrorBoundary.show(error, `Action: ${action}`);
                }
            }
        } else {
            // Fallback: check for global function
            if (typeof window[action] === 'function') {
                if (params && params.includes(',') && !params.includes('{')) {
                    const args = params.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
                    window[action](...args, event);
                } else {
                    window[action](params || target, event);
                }
            } else {
                console.warn(`[UI-Init] No handler registered for action: ${action}`);
            }
        }
    }

    /**
     * Initialize UI components
     */
    function initUI() {
        // Remove existing listener to avoid duplicates
        document.removeEventListener('click', handleAction);
        document.removeEventListener('change', handleAction);

        // Add global listeners for event delegation
        document.addEventListener('click', handleAction);
        document.addEventListener('change', handleAction);
        document.addEventListener('input', handleAction);

        // Register built-in actions
        registerBuiltInActions();

        console.log('[UI-Init] Initialized with modular event delegation');
    }

    /**
     * Register built-in action handlers
     */
    function registerBuiltInActions() {
        // Toggle Sidebar
        registerAction('toggleSidebar', function (target, params, event) {
            const sidebar = document.querySelector('.sidebar') || document.querySelector('.app-sidebar');
            const overlay = document.getElementById('appOverlay') || document.querySelector('.app-overlay');

            if (sidebar) sidebar.classList.toggle('active');
            if (overlay) overlay.classList.toggle('is-visible');
        });

        // Close Modal
        registerAction('closeModal', function (target, params, event) {
            const modalId = params || target.closest('.modal-overlay')?.id;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.remove('active');
                    setTimeout(() => {
                        modal.style.display = 'none';
                    }, 300);
                }
            }
        });

        // Open Modal
        registerAction('openModal', function (target, params, event) {
            const modalId = params;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'flex';
                    setTimeout(() => {
                        modal.classList.add('active');
                    }, 10);
                }
            }
        });

        // Toggle Class
        registerAction('toggleClass', function (target, params, event) {
            const [selector, className] = params.split(',');
            if (selector && className) {
                const el = document.querySelector(selector.trim());
                if (el) {
                    el.classList.toggle(className.trim());
                }
            }
        });

        // Remove Element
        registerAction('remove', function (target, params, event) {
            const selector = params || target;
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (el) {
                el.remove();
            }
        });

        // Show Element
        registerAction('show', function (target, params, event) {
            const selector = params || target;
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (el) {
                el.style.display = 'block';
            }
        });

        // Hide Element
        registerAction('hide', function (target, params, event) {
            const selector = params || target;
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (el) {
                el.style.display = 'none';
            }
        });

        // Navigate to Section
        registerAction('navigateSection', function (target, params, event) {
            const section = params;
            if (section && typeof switchSection === 'function') {
                switchSection(section);
            }
        });

        // Refresh Current Section
        registerAction('refresh', function (target, params, event) {
            if (typeof refreshCurrentSection === 'function') {
                refreshCurrentSection();
            }
        });

        // Logout
        registerAction('logout', function (target, params, event) {
            if (typeof logout === 'function') {
                logout();
            }
        });

        // Toggle Notifications
        registerAction('toggleNotifications', function (target, params, event) {
            if (typeof toggleNotifications === 'function') {
                toggleNotifications();
            }
        });

        // Mark All Read
        registerAction('markAllRead', function (target, params, event) {
            if (typeof markAllRead === 'function') {
                markAllRead();
            }
        });

        // Show Keyboard Shortcuts
        registerAction('showShortcuts', function (target, params, event) {
            if (typeof showKeyboardShortcuts === 'function') {
                showKeyboardShortcuts();
            }
        });

        // Toggle Theme
        registerAction('toggleTheme', function (target, params, event) {
            if (typeof toggleTheme === 'function') {
                toggleTheme();
            }
        });

        // Search Focus (Ctrl+K)
        registerAction('focusSearch', function (target, params, event) {
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        });

        // Operations Dashboard specific actions
        registerAction('refreshOrders', function (target, params, event) {
            if (typeof refreshOrders === 'function') {
                refreshOrders();
            }
        });

        registerAction('exportOrdersCSV', function (target, params, event) {
            if (typeof exportOrdersCSV === 'function') {
                exportOrdersCSV();
            }
        });

        registerAction('clearOrderFilters', function (target, params, event) {
            if (typeof clearOrderFilters === 'function') {
                clearOrderFilters();
            }
        });

        registerAction('loadEscalations', function (target, params, event) {
            if (typeof loadEscalations === 'function') {
                loadEscalations();
            }
        });

        // Lightbox actions
        registerAction('closeLightbox', function (target, params, event) {
            if (typeof closeLightbox === 'function') {
                closeLightbox();
            }
        });

        registerAction('changeSlide', function (target, params, event) {
            if (typeof changeSlide === 'function') {
                changeSlide(parseInt(params) || 1);
            }
        });

        registerAction('triggerClick', function (target, params, event) {
            const selector = params;
            if (selector) {
                const el = document.querySelector(selector);
                if (el) {
                    el.click();
                }
            }
        });
    }

    /**
     * Convert inline onclick to data-action
     * Utility for migrating legacy HTML
     * @param {string} selector - CSS selector for elements to convert
     */
    function migrateOnclickToDataAction(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const onclick = el.getAttribute('onclick');
            if (onclick) {
                // Parse common patterns
                if (onclick.includes('toggleSidebar()')) {
                    el.removeAttribute('onclick');
                    el.setAttribute('data-action', 'toggleSidebar');
                } else if (onclick.includes("closeModal('")) {
                    const match = onclick.match(/closeModal\('([^']+)'\)/);
                    if (match) {
                        el.removeAttribute('onclick');
                        el.setAttribute('data-action', 'closeModal');
                        el.setAttribute('data-params', match[1]);
                    }
                } else if (onclick.includes("openModal('")) {
                    const match = onclick.match(/openModal\('([^']+)'\)/);
                    if (match) {
                        el.removeAttribute('onclick');
                        el.setAttribute('data-action', 'openModal');
                        el.setAttribute('data-params', match[1]);
                    }
                } else if (onclick.includes('logout()')) {
                    el.removeAttribute('onclick');
                    el.setAttribute('data-action', 'logout');
                } else if (onclick.includes('refreshCurrentSection()')) {
                    el.removeAttribute('onclick');
                    el.setAttribute('data-action', 'refresh');
                }
                // Add more patterns as needed
            }
        });
    }

    // Expose public API
    window.QScrapUI = {
        init: initUI,
        registerAction: registerAction,
        handleAction: handleAction,
        migrateOnclickToDataAction: migrateOnclickToDataAction
    };

    // Auto-initialize if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
