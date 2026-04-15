window.App = {
    initialized: false,

    async initialize(authenticatedUser) {
        if (this.initialized) return;
        this.initialized = true;

        window.AppUI.init();

        if (!window.AppSupabase.isReady()) {
            window.AppSupabase.init(
                window.AppConfig.SUPABASE_URL,
                window.AppConfig.SUPABASE_ANON_KEY
            );
        }

        window.AppState.setUser(authenticatedUser);
        window.AppState.set('currentMode', 'chat');

        if (!authenticatedUser) return;

        await window.AppConfigLoader.loadUserSettings();
        window.AppConfigLoader.applyModeSettings();

        await window.AppFeaturesPersonas.loadCharacters();
        await window.AppFeaturesChat.loadConversationList();
        await window.AppFeaturesChat.startNewChat();

        window.AppEvents.init();

        window.AppVoiceManager.init(
            (text) => this._handleTranscriptionSubmit(text),
            (status) => window.AppChatView.renderSystemMessage(`Voice: ${status}`)
        );
    },

    _handleTranscriptionSubmit(text) {
        const ui = window.AppUI.get();
        const currentText = ui.prompt.value;
        ui.prompt.value = currentText ? currentText + ' ' + text : text;
        ui.prompt.style.height = 'auto';
        ui.prompt.style.height = ui.prompt.scrollHeight + 'px';
        this.execute(true);
    },

    async execute(fromVoice = false) {
        await window.AppFeaturesChat.execute(fromVoice);
    },

    showToast(msg, type) {
        window.AppToasts.show(msg, type);
    }
};
