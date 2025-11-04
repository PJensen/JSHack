// @ts-nocheck
// Simple dev service worker to bust cache for ES modules on mobile browsers
// Appends a version query param to same-origin JS module requests under /src and /app

self.addEventListener('install', (event) => {
    // Activate immediately
    // @ts-ignore
    self.skipWaiting && self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Take control of uncontrolled clients ASAP
    // @ts-ignore
    self.clients && self.clients.claim && self.clients.claim();
});

function getVersionParam() {
    try {
        const url = new URL(self.registration?.active?.scriptURL || self.location.href);
        return url.searchParams.get('v') || Date.now().toString(16);
    } catch (_) {
        return Date.now().toString(16);
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const isJs = req.destination === 'script' || url.pathname.endsWith('.js');
    const inScope = url.pathname.startsWith('/src/') || url.pathname.startsWith('/app/');
    const hasVersion = url.searchParams.has('v');

    if (sameOrigin && isJs && inScope && !hasVersion) {
        const v = getVersionParam();
        url.searchParams.set('v', v);
        const alt = new Request(url.toString(), {
            method: req.method,
            headers: req.headers,
            // scripts use GET; avoid cloning body to keep it simple
            mode: req.mode,
            credentials: req.credentials,
            cache: 'no-store',
            redirect: req.redirect,
            referrer: req.referrer,
            referrerPolicy: req.referrerPolicy,
            integrity: req.integrity,
            keepalive: req.keepalive,
        });
        event.respondWith(fetch(alt));
    }
});
