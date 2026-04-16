const CACHE_NAME = 'rubybox-v5';
const assets = [
    '/',
    '/index.html',
    '/styles.css',
    '/site.webmanifest',
    '/icons/favicon.svg',
    '/icons/apple-touch-icon.png',
    '/js/lib/utils.js',
    '/js/lib/crypto.js',
    '/js/lib/markdown.js',
    '/js/lib/constants.js',
    '/js/lib/supabase-client.js',
    '/js/core/state.js',
    '/js/core/config.js',
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
    '/js/core/events.js',
    '/js/core/app.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(assets))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
