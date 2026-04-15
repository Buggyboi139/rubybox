const CACHE_NAME = 'rubybox-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/lib/utils.js',
    '/js/lib/crypto.js',
    '/js/lib/markdown.js',
    '/js/lib/config.js',
    '/js/lib/supabase-client.js',
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
    '/js/features/settings/settings-controller.js',
    '/site.webmanifest',
    '/icons/favicon.svg',
    '/icons/apple-touch-icon.png'
];

const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.js',
    'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled([
                ...STATIC_ASSETS.map(url => cache.add(url).catch(() => {})),
                ...EXTERNAL_ASSETS.map(url => cache.add(url).catch(() => {}))
            ]);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    if (url.hostname === 'openrouter.ai' || url.hostname === 'api.openai.com') {
        return;
    }

    if (url.hostname === 'texttospeech.googleapis.com') {
        return;
    }

    if (url.hostname === 'image.pollinations.ai') {
        return;
    }

    if (url.hostname === 'anpdzypxekvqprtaneol.supabase.co') {
        const path = url.pathname;
        if (path.includes('/storage/')) {
            return;
        }
    }

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        e.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(e.request).then((response) => {
                    if (response) return response;
                    return fetch(e.request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            cache.put(e.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdnjs.cloudflare.com') {
        e.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(e.request).then((response) => {
                    if (response) return response;
                    return fetch(e.request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            cache.put(e.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    if (url.origin === location.origin) {
        e.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(e.request).then((response) => {
                    const fetchPromise = fetch(e.request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(e.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch(() => response);

                    return response || fetchPromise;
                });
            })
        );
        return;
    }
});
