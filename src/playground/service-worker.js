// These will be replaced at build-time by generate-service-worker-plugin.js
const HTML_ASSETS = __HTML_ASSETS__;
const LAZY_ASSETS = __LAZY_ASSETS__;
const LAZY_ASSETS_NAME = __LAZY_ASSETS_NAME__;

const knownCaches = [
    LAZY_ASSETS_NAME
];
// Robust base calculation: guard against indexOf returning -1
const base = location.pathname.includes('sw.js') ? location.pathname.substr(0, location.pathname.indexOf('sw.js')) : '/';

// Helper: fetch with timeout so a hanging network request doesn't block forever
const fetchWithTimeout = (request, ms = 3000) => {
    const controller = new AbortController();
    const signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), ms);
    return fetch(request, {signal}).finally(() => clearTimeout(timeoutId));
};

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(LAZY_ASSETS_NAME).then(cache => cache.addAll(HTML_ASSETS)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(i => !knownCaches.includes(i)).map(i => caches.delete(i))))
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;
    if (event.request.method !== 'GET') return;

    let relativePathname = url.pathname.substr(base.length);
    if (/^(\d+\/?)?$/.test(relativePathname)) {
        relativePathname = 'index.html';
    } else if (/^(\d+\/)?editor\/?$/i.test(relativePathname)) {
        relativePathname = 'editor.html';
    } else if (/^(\d+\/)?playground\/?$/i.test(relativePathname)) {
        relativePathname = 'playground.html';
    } else if (/^(\d+\/)?fullscreen\/?$/i.test(relativePathname)) {
        relativePathname = 'fullscreen.html';
    } else if (/^addons\/?$/i.test(relativePathname)) {
        relativePathname = 'addons.html';
    }

    if (HTML_ASSETS.includes(relativePathname)) {
        // Network-first but with a short timeout; fallback to cache if network is slow or unavailable
        event.respondWith(
            fetchWithTimeout(event.request, 3000)
                .catch(() => caches.match(new Request(relativePathname)))
        );
    } else if (LAZY_ASSETS.includes(relativePathname)) {
        event.respondWith(
            caches.open(LAZY_ASSETS_NAME).then(cache => cache.match(new Request(relativePathname)).then(response => (
                response || fetch(event.request).then(networkResponse => {
                    // put a clone into cache for future
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                })
            )))
        );
    }
});
