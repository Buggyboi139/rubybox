const SERVICE_WORKER_VERSION = 'rubybox-v6';
const CACHE_NAME = SERVICE_WORKER_VERSION;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/site.webmanifest',
    '/icons/favicon.svg',
    '/icons/apple-touch-icon.png',
    '/icons/favicon-96x96.png',
    '/icons/web-app-manifest-192x192.png',
    '/icons/web-app-manifest-512x512.png',
    '/js/lib/utils.js',
    '/js/lib/crypto.js',
    '/js/lib/markdown.js',
    '/js/lib/constants.js',
    '/js/lib/supabase-client.js',
    '/js/lib/errors.js',
    '/js/lib/validation.js',
    '/js/core/state.js',
    '/js/core/config.js',
    '/js/core/events.js',
    '/js/core/app.js',
    '/js/services/auth-service.js',
    '/js/services/conversations-service.js',
    '/js/services/messages-service.js',
    '/js/services/characters-service.js',
    '/js/services/storage-service.js',
    '/js/services/llm-service.js',
    '/js/services/image-service.js',
    '/js/services/tts-service.js',
    '/js/ui/dom.js',
    '/js/ui/toasts.js',
    '/js/ui/modals.js',
    '/js/ui/chat-view.js',
    '/js/ui/message-actions.js',
    '/js/ui/sidebar.js',
    '/js/ui/character-view.js',
    '/js/ui/voice-view.js',
    '/js/features/chat/message-content.js',
    '/js/features/chat/execute-chat.js',
    '/js/features/chat/branch-chat.js',
    '/js/features/chat/export-chat.js',
    '/js/features/personas/persona-editor.js',
    '/js/features/personas/architect.js',
    '/js/features/images/image-controller.js',
    '/js/features/voice/voice-controller.js',
    '/js/features/settings/settings-controller.js'
];

const API_PATTERNS = [
    '/api/',
    'supabase',
    'openrouter',
    'texttospeech.googleapis',
    'pollinations'
];

function shouldBypassCache(request) {
    const url = new URL(request.url);
    return API_PATTERNS.some(pattern => url.href.includes(pattern));
}

self.addEventListener('install', event => {
    console.log('[ServiceWorker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Skip waiting');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[ServiceWorker] Install failed:', error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[ServiceWorker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Claiming clients');
                return self.clients.claim();
            })
            .catch(error => {
                console.error('[ServiceWorker] Activation failed:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;

    if (shouldBypassCache(request)) {
        event.respondWith(fetch(request));
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        if (request.method !== 'GET') {
                            return networkResponse;
                        }

                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseToCache);
                            })
                            .catch(error => {
                                console.error('[ServiceWorker] Cache put failed:', error);
                            });

                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[ServiceWorker] Fetch failed:', error);
                        
                        if (request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

self.addEventListener('sync', event => {
    console.log('[ServiceWorker] Background sync:', event.tag);
    
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncMessages() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_MESSAGES',
                timestamp: Date.now()
            });
        });
    } catch (error) {
        console.error('[ServiceWorker] Message sync failed:', error);
    }
}

self.addEventListener('push', event => {
    if (!event.data) {
        console.log('[ServiceWorker] Push event with no data');
        return;
    }

    try {
        const data = event.data.json();
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'RubyBox', {
                body: data.body || 'You have a new message',
                icon: '/icons/favicon-96x96.png',
                badge: '/icons/favicon-96x96.png',
                tag: data.tag || 'default',
                data: data.data || {}
            })
        );
    } catch (error) {
        console.error('[ServiceWorker] Push notification error:', error);
    }
});

self.addEventListener('notificationclick', event => {
    console.log('[ServiceWorker] Notification click:', event.notification.tag);
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                if (clients.length > 0) {
                    return clients[0].focus();
                }
                return self.clients.openWindow('/');
            })
            .catch(error => {
                console.error('[ServiceWorker] Notification click failed:', error);
            })
    );
});
