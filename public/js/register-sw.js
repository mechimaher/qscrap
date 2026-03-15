/**
 * QScrap Service Worker Registration
 * Registers the service worker with update checking
 * 
 * Usage: Include in HTML pages
 * <script src="/js/register-sw.js" defer></script>
 */

(function() {
    'use strict';
    
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        console.log('[SW] Service Workers not supported');
        return;
    }
    
    // Configuration
    const SW_PATH = '/sw.js';
    const SCOPE = '/';
    const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    /**
     * Register service worker
     */
    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register(SW_PATH, {
                scope: SCOPE,
                type: 'module'
            });
            
            console.log('[SW] Registered:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                if (!newWorker) return;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New content available
                        console.log('[SW] New content available, refresh to update');
                        
                        // Dispatch custom event
                        document.dispatchEvent(new CustomEvent('sw:update', {
                            detail: { registration }
                        }));
                        
                        // Optional: Show update notification
                        showUpdateNotification(registration);
                    }
                });
            });
            
            // Handle controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[SW] Controller changed, page will reload on next navigation');
            });
            
            return registration;
        } catch (error) {
            console.error('[SW] Registration failed:', error);
            return null;
        }
    }
    
    /**
     * Show update notification (optional UI)
     */
    function showUpdateNotification(registration) {
        // Check if user wants to be notified
        const notifyUser = localStorage.getItem('sw-notify-updates') !== 'false';
        
        if (!notifyUser) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'sw-update-notification';
        notification.className = 'sw-update-notification';
        notification.innerHTML = `
            <div class="sw-notification-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>New version available! <button id="sw-refresh-btn">Refresh</button></span>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .sw-update-notification {
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: #8D1B3D;
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                z-index: 9999;
                animation: sw-slide-up 0.3s ease;
            }
            @keyframes sw-slide-up {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .sw-notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            #sw-refresh-btn {
                background: white;
                color: #8D1B3D;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                margin-left: 8px;
            }
            #sw-refresh-btn:hover {
                background: #f0f0f0;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Handle refresh button
        document.getElementById('sw-refresh-btn').addEventListener('click', () => {
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            window.location.reload();
        });
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            notification.style.animation = 'sw-slide-up 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 10000);
    }
    
    /**
     * Check for updates periodically
     */
    function checkForUpdates() {
        navigator.serviceWorker.ready.then((registration) => {
            registration.update();
        });
    }
    
    /**
     * Unregister service worker (for development)
     */
    async function unregisterServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.unregister();
            console.log('[SW] Unregistered');
            
            // Clear all caches
            await caches.keys().then((names) => {
                return Promise.all(names.map((name) => caches.delete(name)));
            });
            console.log('[SW] Cleared all caches');
        } catch (error) {
            console.error('[SW] Unregister failed:', error);
        }
    }
    
    // Expose API for manual control
    window.QScrapSW = {
        register: registerServiceWorker,
        unregister: unregisterServiceWorker,
        checkForUpdates
    };
    
    // Register on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerServiceWorker);
    } else {
        registerServiceWorker();
    }
    
    // Periodic update check
    setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
    
    console.log('[SW] Service Worker registration module loaded');
})();
