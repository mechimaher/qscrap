/**
 * QScrap Service Worker
 * Advanced caching strategy for optimal performance
 * Version: 2026.1.0
 * 
 * Strategies:
 * - Static assets: Cache First, then Network
 * - HTML pages: Stale While Revalidate
 * - API requests: Network First, then Cache
 * - Images: Cache First, then Network
 */

const CACHE_VERSION = 'v2026.01';
const STATIC_CACHE = `qscrap-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `qscrap-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `qscrap-images-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/design-tokens.min.css',
    '/css/main.min.css',
    '/css/website.min.css',
    '/js/homepage.js',
    '/js/components/footer-loader.js',
    '/components/footer.html',
    '/css/components/footer.css',
    '/assets/images/qscrap-logo.png',
    '/favicon.ico'
];

// Image file extensions to cache
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

// API URL patterns
const API_PATTERNS = ['/api/', '/v1/'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Installation complete, skipping waiting');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Installation error:', error);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => !currentCaches.includes(cacheName))
                        .map((cacheName) => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete, claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Determine caching strategy based on request type
    if (isImageRequest(url)) {
        event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    } else if (isAPIRequest(url)) {
        event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
    } else if (isHTMLRequest(url)) {
        event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
    } else {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    }
});

/**
 * Check if request is for an image
 */
function isImageRequest(url) {
    return IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) ||
           url.pathname.includes('/assets/');
}

/**
 * Check if request is for API
 */
function isAPIRequest(url) {
    return API_PATTERNS.some(pattern => url.pathname.startsWith(pattern));
}

/**
 * Check if request is for HTML
 */
function isHTMLRequest(url) {
    return url.pathname.endsWith('.html') || 
           url.pathname === '/' ||
           request.headers.get('accept')?.includes('text/html');
}

/**
 * Cache First Strategy
 * Best for: Static assets, images
 */
async function cacheFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Cache hit:', request.url);
            
            // Update cache in background (stale-while-revalidate behavior)
            fetch(request).then((response) => {
                if (response && response.status === 200) {
                    cache.put(request, response.clone());
                }
            }).catch(() => {
                // Network error, ignore
            });
            
            return cachedResponse;
        }
    } catch (error) {
        console.error('[SW] Cache read error:', error);
    }
    
    // Cache miss, fetch from network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Network error:', error);
        
        // Return offline fallback if available
        if (request.destination === 'image') {
            return new Response('', { status: 404, statusText: 'Offline' });
        }
        
        throw error;
    }
}

/**
 * Network First Strategy
 * Best for: API requests, dynamic content
 */
async function networkFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', request.url);
            return cachedResponse;
        }
        
        // Return error response
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Stale While Revalidate Strategy
 * Best for: HTML pages, frequently updated content
 */
async function staleWhileRevalidateStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    const cachedResponse = await cache.match(request);
    
    // Start network request in background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch((error) => {
        console.error('[SW] Background fetch error:', error);
        return cachedResponse;
    });
    
    // Return cached response immediately, or wait for network
    if (cachedResponse) {
        console.log('[SW] Serving stale, revalidating:', request.url);
        return cachedResponse;
    }
    
    console.log('[SW] No cache, waiting for network:', request.url);
    return fetchPromise;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
                caches.delete(cacheName);
            });
        });
    }
});

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Implement offline data synchronization
    console.log('[SW] Syncing offline data...');
}

console.log('[SW] Service Worker loaded');
