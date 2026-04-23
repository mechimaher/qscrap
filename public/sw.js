/**
 * QScrap Service Worker - GOLD VERSION
 * Fixed ReferenceError & Optimized Caching
 */

const CACHE_VERSION = 'v2026.01.05';
const STATIC_CACHE = `qscrap-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `qscrap-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `qscrap-images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/shared.css',
    '/assets/images/qscrap-logo.png',
    '/favicon.ico'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
                .map(key => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

    if (isHTMLRequest(url, request)) {
        event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    } else if (isImageRequest(url)) {
        event.respondWith(cacheFirst(request, IMAGE_CACHE));
    } else {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
});

function isHTMLRequest(url, request) {
    return url.pathname.endsWith('.html') || 
           url.pathname === '/' || 
           request.headers.get('accept')?.includes('text/html');
}

function isImageRequest(url) {
    return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.status === 200) cache.put(request, response.clone());
    return response;
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const network = fetch(request).then((res) => {
        if (res.status === 200) cache.put(request, res.clone());
        return res;
    });
    return cached || network;
}
