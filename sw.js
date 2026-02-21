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

/** Cache-bust stamp: generated once per SW lifecycle (install). */
let _versionStamp = Date.now().toString(16);

/** Try to read the ?v= from the page's main module (passed via message). */
self.addEventListener('message', (event) => {
    if (event.data?.type === 'set-version' && event.data.v) {
        _versionStamp = String(event.data.v);
    }
});

function getVersionParam() {
    return _versionStamp;
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
