window.App = window.App || {};
window.App.state = {
    history: [],
    characters: [],
    activeCharacter: null
};
window.App.DEFAULT_USER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2360a5fa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
window.App.DEFAULT_AI_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f472b6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='11' width='18' height='10' rx='2'/%3E%3Ccircle cx='12' cy='5' r='2'/%3E%3Cpath d='M12 7v4'/%3E%3Cline x1='8' y1='16' x2='8' y2='16'/%3E%3Cline x1='16' y1='16' x2='16' y2='16'/%3E%3C/svg%3E";
window.App.currentConversationId = null;
window.App.user = null;
window.App.editingCharId = null;
window.App.attachedImageBase64 = null;
window.App.newCharAvatarBase64 = null;
window.App.isAutoScrolling = true;
window.App.controller = null;

document.addEventListener('DOMContentLoaded', () => {
    window.App.UI = {
        chatLog: document.getElementById('chat-log'),
        prompt: document.getElementById('prompt'),
        sendBtn: document.getElementById('send-btn'),
        stopBtn: document.getElementById('stop-btn'),
        menuBtn: document.getElementById('menu-toggle'),
        sidebar: document.getElementById('sidebar'),
        overlay: document.getElementById('sidebar-overlay'),
        mobileSidebarClose: document.getElementById('mobile-sidebar-close'),
        profileBtn: document.getElementById('profile-btn'),
        profileModal: document.getElementById('profileModal'),
        closeProfileModal: document.getElementById('closeProfileModal'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        sysPrompt: document.getElementById('system-prompt'),
        narrativePrompt: document.getElementById('narrative-prompt'),
        persistMem: document.getElementById('persistent-memory'),
        apiKey: document.getElementById('api-key'),
        googleTtsKey: document.getElementById('google-tts-key'),
        googleVoiceSelect: document.getElementById('google-voice-select'),
        model: document.getElementById('model-select'),
        tempSlider: document.getElementById('temp-slider'),
        tempVal: document.getElementById('temp-val'),
        ctxSlider: document.getElementById('ctx-slider'),
        ctxVal: document.getElementById('ctx-val'),
        maxTokensSlider: document.getElementById('max-tokens-slider'),
        maxTokensVal: document.getElementById('max-tokens-val'),
        voiceMode: document.getElementById('voice-mode'),
        chatSearch: document.getElementById('chat-search'),
        conversationsList: document.getElementById('conversations-list'),
        newChatBtn: document.getElementById('new-chat-btn'),
        charsBtn: document.getElementById('chars-btn'),
        architectBtn: document.getElementById('architect-btn'),
        architectModal: document.getElementById('architectModal'),
        closeArchitectModal: document.getElementById('closeArchitectModal'),
        architectPrompt: document.getElementById('architectPrompt'),
        architectBuildBtn: document.getElementById('architectBuildBtn'),
        architectLoading: document.getElementById('architectLoading'),
        charModal: document.getElementById('charModal'),
        closeCharModal: document.getElementById('closeCharModal'),
        charList: document.getElementById('char-list'),
        newCharName: document.getElementById('newCharName'),
        newCharPrompt: document.getElementById('newCharPrompt'),
        newCharAvatarBtn: document.getElementById('newCharAvatarBtn'),
        newCharAvatarFile: document.getElementById('newCharAvatarFile'),
        newCharAvatarPreview: document.getElementById('newCharAvatarPreview'),
        saveCharBtn: document.getElementById('saveCharBtn'),
        cancelEditCharBtn: document.getElementById('cancelEditCharBtn'),
        activeCharDisplay: document.getElementById('active-char-display'),
        activeCharImg: document.getElementById('active-char-img'),
        activeCharName: document.getElementById('active-char-name'),
        clearCharBtn: document.getElementById('clear-char-btn'),
        tokenCounter: document.getElementById('token-counter'),
        attachImgBtn: document.getElementById('attach-img-btn'),
        imageUpload: document.getElementById('image-upload'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        clearImgBtn: document.getElementById('clear-img-btn'),
        micBtn: document.getElementById('mic-btn'),
        voiceSheet: document.getElementById('voice-bottom-sheet'),
        voiceCancelBtn: document.getElementById('voice-cancel-btn'),
        exportBtn: document.getElementById('export-btn')
    };
});
