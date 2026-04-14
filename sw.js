const CACHE_NAME = 'rubybox-v2';
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

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
