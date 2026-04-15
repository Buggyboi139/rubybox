const CACHE_NAME = 'rubybox-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/globals.js',
    '/supabase-client.js',
    '/db.js',
    '/voice.js',
    '/chat.js',
    '/app.js',
    '/site.webmanifest',
    '/icons/favicon.svg',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
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
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request).then((response) => {
                const fetchPromise = fetch(e.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {});
                
                return response || fetchPromise;
            });
        })
    );
});
