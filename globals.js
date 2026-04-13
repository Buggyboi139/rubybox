window.App = {
    UI: {},
    state: {
        history: [],
        characters: [],
        activeCharacter: null,
        settings: { temperature: 0.7, contextLimit: 10, defaultModel: "deepseek/deepseek-chat", voiceMode: "local" }
    },
    user: null,
    currentConversationId: null,
    attachedImageBase64: null,
    newCharAvatarBase64: null,
    controller: null,
    isAutoScrolling: true,
    DEFAULT_USER_AVATAR: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffb6c1"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    DEFAULT_AI_AVATAR: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f8fafc"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a3 3 0 0 1 3 3v2h2v4h-2v2a3 3 0 0 1-3 3h-1v1.27a2 2 0 1 1-2 0V19h-1a3 3 0 0 1-3-3v-2H5v-4h2V10a3 3 0 0 1 3-3h1V5.73A2 2 0 0 1 12 2z"/></svg>'
};

marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-'
});

window.App.initUI = function() {
    window.App.UI = {
        chatLog: document.getElementById('chat-log'),
        prompt: document.getElementById('prompt'),
        sendBtn: document.getElementById('send-btn'),
        stopBtn: document.getElementById('stop-btn'),
        micBtn: document.getElementById('mic-btn'),
        cancelEditCharBtn: document.getElementById('cancelEditCharBtn'),
        attachImgBtn: document.getElementById('attach-img-btn'),
        imageUpload: document.getElementById('image-upload'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        clearImgBtn: document.getElementById('clear-img-btn'),
        model: document.getElementById('model-select'),
        voiceMode: document.getElementById('voice-mode'),
        apiKey: document.getElementById('api-key'),
        sysPrompt: document.getElementById('system-prompt'),
        narrativePrompt: document.getElementById('narrative-prompt'),
        persistMem: document.getElementById('persistent-memory'),
        tempSlider: document.getElementById('temp-slider'),
        tempVal: document.getElementById('temp-val'),
        ctxSlider: document.getElementById('ctx-slider'),
        ctxVal: document.getElementById('ctx-val'),
        sidebar: document.getElementById('sidebar'),
        menuBtn: document.getElementById('menu-toggle'),
        overlay: document.getElementById('sidebar-overlay'),
        mobileSidebarClose: document.getElementById('mobile-sidebar-close'),
        newChatBtn: document.getElementById('new-chat-btn'),
        chatSearch: document.getElementById('chat-search'),
        conversationsList: document.getElementById('conversations-list'),
        charsBtn: document.getElementById('chars-btn'),
        charModal: document.getElementById('charModal'),
        closeCharModal: document.getElementById('closeCharModal'),
        charList: document.getElementById('char-list'),
        newCharName: document.getElementById('newCharName'),
        newCharAvatarBtn: document.getElementById('newCharAvatarBtn'),
        newCharAvatarFile: document.getElementById('newCharAvatarFile'),
        newCharAvatarPreview: document.getElementById('newCharAvatarPreview'),
        newCharPrompt: document.getElementById('newCharPrompt'),
        saveCharBtn: document.getElementById('saveCharBtn'),
        profileBtn: document.getElementById('profile-btn'),
        profileModal: document.getElementById('profileModal'),
        closeProfileModal: document.getElementById('closeProfileModal'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        voiceSheet: document.getElementById('voice-bottom-sheet'),
        voiceCancelBtn: document.getElementById('voice-cancel-btn'),
        activeCharDisplay: document.getElementById('active-char-display'),
        activeCharImg: document.getElementById('active-char-img'),
        activeCharName: document.getElementById('active-char-name'),
        clearCharBtn: document.getElementById('clear-char-btn'),
        exportBtn: document.getElementById('export-chat-btn'),
        tokenCounter: document.getElementById('token-counter')
    };
};
