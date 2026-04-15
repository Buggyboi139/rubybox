window.AppUI = {
    elements: {},

    init() {
        this.elements = {
            chatLog: document.getElementById('chat-log'),
            prompt: document.getElementById('prompt'),
            sendBtn: document.getElementById('send-btn'),
            stopBtn: document.getElementById('stop-btn'),
            newChatBtn: document.getElementById('new-chat-btn'),
            charsBtn: document.getElementById('chars-btn'),
            sidebar: document.getElementById('sidebar'),
            overlay: document.getElementById('sidebar-overlay'),
            menuBtn: document.getElementById('menu-toggle'),
            conversationsList: document.getElementById('conversations-list'),
            chatSearch: document.getElementById('chat-search'),
            profileBtn: document.getElementById('profile-btn'),
            profileModal: document.getElementById('profileModal'),
            closeProfileModal: document.getElementById('closeProfileModal'),
            saveProfileBtn: document.getElementById('saveProfileBtn'),
            apiKey: document.getElementById('api-key'),
            sysPrompt: document.getElementById('system-prompt'),
            narrativePrompt: document.getElementById('narrative-prompt'),
            tempSlider: document.getElementById('temp-slider'),
            tempVal: document.getElementById('temp-val'),
            ctxSlider: document.getElementById('ctx-slider'),
            ctxVal: document.getElementById('ctx-val'),
            maxTokensSlider: document.getElementById('max-tokens-slider'),
            maxTokensVal: document.getElementById('max-tokens-val'),
            model: document.getElementById('model-select'),
            charModal: document.getElementById('charModal'),
            closeCharModal: document.getElementById('closeCharModal'),
            charList: document.getElementById('char-list'),
            newCharName: document.getElementById('newCharName'),
            newCharAvatarBtn: document.getElementById('newCharAvatarBtn'),
            newCharAvatarFile: document.getElementById('newCharAvatarFile'),
            newCharAvatarPreview: document.getElementById('newCharAvatarPreview'),
            newCharPrompt: document.getElementById('newCharPrompt'),
            saveCharBtn: document.getElementById('saveCharBtn'),
            cancelEditCharBtn: document.getElementById('cancelEditCharBtn'),
            clearCharBtn: document.getElementById('clear-char-btn'),
            activeCharDisplay: document.getElementById('active-char-display'),
            activeCharImg: document.getElementById('active-char-img'),
            activeCharName: document.getElementById('active-char-name'),
            attachImgBtn: document.getElementById('attach-img-btn'),
            generateImgBtn: document.getElementById('generate-img-btn'),
            imageUpload: document.getElementById('image-upload'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
            imagePreview: document.getElementById('image-preview'),
            clearImgBtn: document.getElementById('clear-img-btn'),
            scenarioImgBtn: document.getElementById('scenario-img-btn'),
            tokenCounter: document.getElementById('token-counter'),
            persistMem: document.getElementById('persistent-memory'),
            micBtn: document.getElementById('mic-btn'),
            voiceSheet: document.getElementById('voice-bottom-sheet'),
            voiceCancelBtn: document.getElementById('voice-cancel-btn'),
            voiceMode: document.getElementById('voice-mode'),
            googleTtsKey: document.getElementById('google-tts-key'),
            googleVoiceSelect: document.getElementById('google-voice-select'),
            exportBtn: document.getElementById('export-btn'),
            mobileSidebarClose: document.getElementById('mobile-sidebar-close'),
            architectBtn: document.getElementById('architect-btn'),
            architectModal: document.getElementById('architectModal'),
            closeArchitectModal: document.getElementById('closeArchitectModal'),
            architectPrompt: document.getElementById('architectPrompt'),
            architectBuildBtn: document.getElementById('architectBuildBtn'),
            architectLoading: document.getElementById('architectLoading'),
            loginBtn: document.getElementById('login-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            userInfo: document.getElementById('user-info'),
            emailDisplay: document.getElementById('user-email-display'),
            authModal: document.getElementById('authModal'),
            closeAuthModal: document.getElementById('closeAuthModal'),
            authLoginBtn: document.getElementById('authLoginBtn'),
            authSignupBtn: document.getElementById('authSignupBtn'),
            authEmail: document.getElementById('authEmail'),
            authPassword: document.getElementById('authPassword'),
            modeButtons: document.querySelectorAll('.mode-btn'),
            mobileExportBtn: document.getElementById('mobile-export-btn'),
            voiceStatusText: document.getElementById('voice-status-text'),
            voiceProgressContainer: document.getElementById('voice-progress-container'),
            voiceProgressBar: document.getElementById('voice-progress-bar'),
            voiceVisualizer: document.getElementById('voice-visualizer')
        };
    },

    get() {
        return this.elements;
    },

    show(el) {
        if (typeof el === 'string') el = this.elements[el];
        el?.classList.remove('hidden');
    },

    hide(el) {
        if (typeof el === 'string') el = this.elements[el];
        el?.classList.add('hidden');
    },

    toggle(el, force) {
        if (typeof el === 'string') el = this.elements[el];
        if (force === undefined) {
            el?.classList.toggle('hidden');
        } else if (force) {
            el?.classList.remove('hidden');
        } else {
            el?.classList.add('hidden');
        }
    },

    setVisible(el, visible) {
        if (typeof el === 'string') el = this.elements[el];
        if (visible) {
            el?.classList.remove('hidden');
        } else {
            el?.classList.add('hidden');
        }
    },

    addClass(el, className) {
        if (typeof el === 'string') el = this.elements[el];
        el?.classList.add(className);
    },

    removeClass(el, className) {
        if (typeof el === 'string') el = this.elements[el];
        el?.classList.remove(className);
    },

    query(selector) {
        return document.querySelector(selector);
    },

    queryAll(selector) {
        return Array.from(document.querySelectorAll(selector));
    }
};
