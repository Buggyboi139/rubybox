const CACHE_NAME = 'rubybox-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/globals.js',
    '/supabase-client.js',
    '/db.js',
    '/ui.js',
    '/voice.js',
    '/chat.js',
    '/app.js',
    '/site.webmanifest',
    '/icons/favicon.svg',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
