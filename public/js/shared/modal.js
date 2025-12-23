/**
 * Modal Utility - Accessible Modal Component
 * 
 * Features:
 * - ARIA roles and attributes (role="dialog", aria-modal="true")
 * - Focus trapping within modal
 * - ESC key to close
 * - Click outside to close
 * - Returns focus to trigger element on close
 */

const QScrapModal = {
    activeModals: [],
    previousActiveElement: null,

    /**
     * Create and show a modal dialog
     * @param {Object} options - Modal configuration
     * @param {string} options.id - Unique modal ID
     * @param {string} options.title - Modal title
     * @param {string} options.content - Modal body HTML (must be trusted/sanitized)
     * @param {string} options.headerClass - Optional header gradient class
     * @param {string} options.headerIcon - Optional Bootstrap icon class
     * @param {Array} options.actions - Array of action buttons [{text, class, onclick, id}]
     * @param {string} options.size - Modal size: 'sm' (400px), 'md' (500px), 'lg' (600px), 'xl' (800px)
     * @param {Function} options.onClose - Optional callback when modal closes
     * @returns {HTMLElement} - The modal element
     */
    create(options) {
        const {
            id,
            title,
            content,
            headerClass = '',
            headerIcon = '',
            actions = [],
            size = 'md',
            onClose = null
        } = options;

        // Store the currently focused element
        this.previousActiveElement = document.activeElement;

        // Remove existing modal with same ID
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        // Size mapping
        const sizeMap = {
            sm: '400px',
            md: '500px',
            lg: '600px',
            xl: '800px'
        };

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal-overlay active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', `${id}-title`);

        // Build actions HTML
        const actionsHtml = actions.map(action => `
            <button 
                class="${action.class || 'btn btn-ghost'}" 
                id="${action.id || ''}"
                ${action.disabled ? 'disabled' : ''}
                aria-label="${action.ariaLabel || action.text}"
            >${action.icon ? `<i class="bi ${action.icon}"></i> ` : ''}${action.text}</button>
        `).join('');

        // Header style
        const headerStyle = headerClass
            ? `background: ${headerClass}; color: white;`
            : '';

        modal.innerHTML = `
            <div class="modal-container" style="max-width: ${sizeMap[size] || sizeMap.md};">
                <div class="modal-header" style="${headerStyle}">
                    <h3 id="${id}-title">
                        ${headerIcon ? `<i class="bi ${headerIcon}" aria-hidden="true"></i> ` : ''}${title}
                    </h3>
                    <button 
                        class="modal-close" 
                        aria-label="Close modal"
                        ${headerClass.includes('gradient') || headerClass.includes('#') ? 'style="color: white; background: rgba(255,255,255,0.2);"' : ''}
                    >&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                ${actionsHtml ? `<div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid var(--border-color);">${actionsHtml}</div>` : ''}
            </div>
        `;

        document.body.appendChild(modal);

        // Attach event listeners for actions
        actions.forEach(action => {
            if (action.id && action.onclick) {
                const btn = modal.querySelector(`#${action.id}`);
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        action.onclick(e, modal);
                    });
                }
            }
        });

        // Close button handler
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.close(id, onClose));

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close(id, onClose);
            }
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape' && this.activeModals[this.activeModals.length - 1] === id) {
                this.close(id, onClose);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        modal._escHandler = escHandler;

        // Focus trap
        this.setupFocusTrap(modal);

        // Track active modals
        this.activeModals.push(id);

        // Focus the close button initially
        setTimeout(() => closeBtn.focus(), 50);

        return modal;
    },

    /**
     * Setup focus trapping within modal
     * @param {HTMLElement} modal 
     */
    setupFocusTrap(modal) {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            const focusableElements = modal.querySelectorAll(focusableSelectors);
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    },

    /**
     * Close a modal by ID
     * @param {string} id - Modal ID
     * @param {Function} onClose - Optional callback
     */
    close(id, onClose = null) {
        const modal = document.getElementById(id);
        if (modal) {
            // Remove ESC handler
            if (modal._escHandler) {
                document.removeEventListener('keydown', modal._escHandler);
            }

            // Remove from DOM
            modal.remove();

            // Remove from active modals
            const index = this.activeModals.indexOf(id);
            if (index > -1) {
                this.activeModals.splice(index, 1);
            }

            // Return focus to trigger element
            if (this.previousActiveElement && this.activeModals.length === 0) {
                this.previousActiveElement.focus();
                this.previousActiveElement = null;
            }

            // Call onClose callback if provided
            if (typeof onClose === 'function') {
                onClose();
            }
        }
    },

    /**
     * Close all open modals
     */
    closeAll() {
        [...this.activeModals].forEach(id => this.close(id));
    },

    /**
     * Quick confirm dialog
     * @param {Object} options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Confirmation message
     * @param {string} options.confirmText - Confirm button text
     * @param {string} options.cancelText - Cancel button text
     * @param {string} options.confirmClass - Confirm button CSS class
     * @param {Function} options.onConfirm - Confirm callback
     * @param {Function} options.onCancel - Cancel callback
     */
    confirm(options) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmClass = 'btn btn-primary',
            onConfirm = () => { },
            onCancel = () => { }
        } = options;

        const modalId = 'qscrap-confirm-modal';

        this.create({
            id: modalId,
            title: title,
            headerIcon: 'bi-question-circle',
            content: `<p style="margin: 0; color: var(--text-secondary);">${message}</p>`,
            size: 'sm',
            actions: [
                {
                    id: 'confirm-cancel-btn',
                    text: cancelText,
                    class: 'btn btn-ghost',
                    onclick: () => {
                        this.close(modalId);
                        onCancel();
                    }
                },
                {
                    id: 'confirm-confirm-btn',
                    text: confirmText,
                    class: confirmClass,
                    onclick: () => {
                        this.close(modalId);
                        onConfirm();
                    }
                }
            ]
        });
    },

    /**
     * Quick alert dialog
     * @param {Object} options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Alert message
     * @param {string} options.buttonText - OK button text
     * @param {string} options.type - 'info', 'success', 'warning', 'error'
     */
    alert(options) {
        const {
            title = 'Alert',
            message = '',
            buttonText = 'OK',
            type = 'info'
        } = options;

        const iconMap = {
            info: 'bi-info-circle',
            success: 'bi-check-circle',
            warning: 'bi-exclamation-triangle',
            error: 'bi-x-circle'
        };

        const colorMap = {
            info: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            success: 'linear-gradient(135deg, #10b981, #059669)',
            warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
            error: 'linear-gradient(135deg, #ef4444, #dc2626)'
        };

        const modalId = 'qscrap-alert-modal';

        this.create({
            id: modalId,
            title: title,
            headerIcon: iconMap[type] || iconMap.info,
            headerClass: colorMap[type] || colorMap.info,
            content: `<p style="margin: 0; color: var(--text-secondary);">${message}</p>`,
            size: 'sm',
            actions: [
                {
                    id: 'alert-ok-btn',
                    text: buttonText,
                    class: 'btn btn-primary',
                    onclick: () => this.close(modalId)
                }
            ]
        });
    }
};

// Export for use in other scripts
window.QScrapModal = QScrapModal;
