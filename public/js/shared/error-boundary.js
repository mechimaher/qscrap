/**
 * QScrap Shared Error Boundary
 * Provides a "Soft Crash" recovery UI to prevent single API failures from breaking the dashboard experience.
 * 
 * Usage: Include this script in your HTML and call initErrorBoundary() on page load.
 */

(function() {
    'use strict';

    let errorOverlay = null;
    let errorCount = 0;
    const MAX_ERRORS_BEFORE_SHOW = 3; // Show overlay after 3 errors in 60 seconds
    const ERROR_WINDOW_MS = 60000;
    let errorTimestamps = [];

    /**
     * Show error overlay with recovery option
     * @param {string} message - Error message to display
     * @param {Error} error - Original error object
     */
    function showErrorOverlay(message, error) {
        // Don't show multiple overlays
        if (errorOverlay) return;

        errorOverlay = document.createElement('div');
        errorOverlay.className = 'error-boundary-overlay';
        errorOverlay.innerHTML = `
            <div class="error-boundary-content">
                <div class="error-boundary-icon">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                </div>
                <h2 class="error-boundary-title">Something went wrong</h2>
                <p class="error-boundary-message">${escapeHtml(message)}</p>
                <div class="error-boundary-actions">
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise"></i> Reload Dashboard
                    </button>
                    <button class="btn btn-outline" onclick="QScrapErrorBoundary.hideError()">
                        <i class="bi bi-x-circle"></i> Dismiss
                    </button>
                </div>
                <div class="error-boundary-details">
                    <details>
                        <summary>Error Details (for debugging)</summary>
                        <pre class="error-stack">${escapeHtml(error?.stack || 'No stack trace available')}</pre>
                    </details>
                </div>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('error-boundary-styles')) {
            const styles = document.createElement('style');
            styles.id = 'error-boundary-styles';
            styles.textContent = `
                .error-boundary-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999;
                    backdrop-filter: blur(4px);
                }
                .error-boundary-content {
                    background: var(--bg-card, #ffffff);
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 480px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    text-align: center;
                }
                .error-boundary-icon {
                    font-size: 48px;
                    color: #dc2626;
                    margin-bottom: 16px;
                }
                .error-boundary-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: var(--text-primary, #1a1a1a);
                    margin: 0 0 8px 0;
                }
                .error-boundary-message {
                    font-size: 14px;
                    color: var(--text-secondary, #666666);
                    margin: 0 0 24px 0;
                    line-height: 1.5;
                }
                .error-boundary-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    margin-bottom: 24px;
                }
                .error-boundary-details {
                    border-top: 1px solid var(--border, #e5e5e5);
                    padding-top: 16px;
                    text-align: left;
                }
                .error-boundary-details summary {
                    cursor: pointer;
                    font-size: 12px;
                    color: var(--text-muted, #999999);
                    margin-bottom: 8px;
                }
                .error-stack {
                    background: var(--bg-secondary, #f5f5f5);
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    overflow-x: auto;
                    max-height: 200px;
                    overflow-y: auto;
                    color: var(--danger, #dc2626);
                }
                .btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #A82050, #8D1B3D);
                    color: white;
                }
                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(168, 32, 80, 0.4);
                }
                .btn-outline {
                    background: transparent;
                    color: var(--text-primary, #1a1a1a);
                    border: 1px solid var(--border, #e5e5e5);
                }
                .btn-outline:hover {
                    background: var(--bg-hover, #f5f5f5);
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(errorOverlay);

        // Log to Sentry if configured
        if (window.Sentry && error) {
            Sentry.captureException(error);
        }
    }

    /**
     * Hide error overlay
     */
    function hideError() {
        if (errorOverlay) {
            errorOverlay.remove();
            errorOverlay = null;
        }
    }

    /**
     * Escape HTML to prevent XSS in error messages
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Track error and show overlay if threshold exceeded
     * @param {Event} event - Error event
     */
    function handleError(event) {
        const error = event.error;
        const message = error?.message || event.message || 'An unexpected error occurred';

        // Skip CDN script errors (not our code)
        if (event.filename?.includes('cdn')) {
            console.warn('[ErrorBoundary] CDN error skipped:', message);
            return;
        }

        // Track error timestamp
        const now = Date.now();
        errorTimestamps.push(now);

        // Remove old errors outside the window
        errorTimestamps = errorTimestamps.filter(ts => now - ts < ERROR_WINDOW_MS);
        errorCount = errorTimestamps.length;

        // Log error
        console.error('[ErrorBoundary] Caught error:', error);

        // Show overlay if threshold exceeded or if it's a critical error
        const shouldShow = errorCount >= MAX_ERRORS_BEFORE_SHOW ||
            message.includes('NetworkError') ||
            message.includes('Failed to fetch') ||
            message.includes('Unauthorized');

        if (shouldShow && !errorOverlay) {
            showErrorOverlay(message, error);
        }
    }

    /**
     * Initialize error boundary
     */
    function initErrorBoundary() {
        // Remove any existing listeners to avoid duplicates
        window.removeEventListener('error', handleError);

        // Add global error listener
        window.addEventListener('error', handleError);

        // Also handle unhandled promise rejections
        window.removeEventListener('unhandledrejection', handlePromiseRejection);
        window.addEventListener('unhandledrejection', handlePromiseRejection);

        console.log('[ErrorBoundary] Initialized');
    }

    /**
     * Handle unhandled promise rejections
     * @param {PromiseRejectionEvent} event - Rejection event
     */
    function handlePromiseRejection(event) {
        const error = event.reason;
        console.error('[ErrorBoundary] Unhandled promise rejection:', error);

        // Convert to error event format
        handleError({
            error: error,
            message: error?.message || 'Unhandled promise rejection',
            filename: null
        });
    }

    // Expose public API
    window.QScrapErrorBoundary = {
        init: initErrorBoundary,
        hideError: hideError,
        showError: showErrorOverlay,
        handleError: handleError
    };

    // Auto-initialize if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initErrorBoundary);
    } else {
        initErrorBoundary();
    }
})();
