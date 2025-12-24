// QScrap Driver App - Service Worker
const CACHE_NAME = 'qscrap-driver-v3';
const ASSETS_TO_CACHE = [
    '/driver-app/',
    '/driver-app/index.html',
    '/driver-app/css/driver.css',
    '/driver-app/js/driver.js',
    '/driver-app/manifest.json',
    '/assets/bootstrap-icons/bootstrap-icons.css',
    '/assets/bootstrap-icons/fonts/bootstrap-icons.woff2'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls (always go to network)
    if (event.request.url.includes('/api/')) return;

    // Skip external URLs (map tiles, CDNs, etc.) - let browser handle directly
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone response and cache it
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(async () => {
                // Network failed, try cache
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Return a fallback response if not in cache
                return new Response('Offline - content not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});

// Background sync for location updates (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'location-sync') {
        event.waitUntil(syncLocationUpdates());
    }
});

async function syncLocationUpdates() {
    // Get pending location updates from IndexedDB
    // This would be implemented with actual IndexedDB storage
    console.log('[SW] Syncing queued location updates');
}

// Push notification handling
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'New assignment available',
        icon: '/driver-app/icons/icon-192.png',
        badge: '/driver-app/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/driver-app/'
        },
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'QScrap Driver', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});
