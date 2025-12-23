/**
 * Toast Notification Utility
 * 
 * Provides consistent toast notifications across all QScrap modules
 * - Success, error, warning, info variants
 * - Auto-dismiss with configurable duration
 * - Accessible with ARIA live regions
 */

const QScrapToast = {
    container: null,
    toastCount: 0,

    /**
     * Initialize toast container
     */
    init() {
        if (this.container) return;

        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(this.container);
        }
    },

    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - Auto-dismiss duration in ms (default 4000, 0 = no auto-dismiss)
     * @returns {HTMLElement} - Toast element
     */
    show(message, type = 'info', duration = 4000) {
        this.init();

        const toastId = `toast-${++this.toastCount}`;

        const iconMap = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <i class="bi ${iconMap[type] || iconMap.info}" aria-hidden="true"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Dismiss notification">&times;</button>
        `;

        // Prepend to show newest on top
        this.container.prepend(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toastId));

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(toastId), duration);
        }

        return toast;
    },

    /**
     * Dismiss a toast by ID
     * @param {string} toastId 
     */
    dismiss(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }
    },

    /**
     * Dismiss all toasts
     */
    dismissAll() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    },

    // Convenience methods
    success(message, duration) { return this.show(message, 'success', duration); },
    error(message, duration) { return this.show(message, 'error', duration); },
    warning(message, duration) { return this.show(message, 'warning', duration); },
    info(message, duration) { return this.show(message, 'info', duration); }
};

// Global showToast function for backward compatibility
function showToast(message, type = 'info', duration = 4000) {
    return QScrapToast.show(message, type, duration);
}

// Export for use in other scripts
window.QScrapToast = QScrapToast;
window.showToast = showToast;
