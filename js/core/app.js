window.App = {
    isBootstrapped: false,

    async bootstrap() {
        if (this.isBootstrapped) return;

        window.AppUI.init();
        window.AppEvents.init();

        if (window.AppSupabase && window.AppSupabase.isReady) {
            await window.AppSupabase.isReady();
        }

        this.isBootstrapped = true;

        const session = await window.AuthService.checkSession();

        if (session && session.user) {
            await this.hydrateAuthenticatedApp(session.user);
        }

        if (window.AppSupabase && window.AppSupabase.client) {
            window.AppSupabase.client.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    this.hydrateAuthenticatedApp(session.user);
                } else if (event === 'SIGNED_OUT') {
                    this.clearAuthenticatedApp();
                }
            });
        }
    },

    async hydrateAuthenticatedApp(user) {
        window.AppState.setUser(user);
        window.AppState.set('currentMode', 'chat');

        await window.AppConfigLoader.loadUserSettings();
        window.AppConfigLoader.applyModeSettings();

        await window.AppFeaturesPersonas.loadCharacters();
        await window.AppFeaturesChat.loadConversationList();
        await window.AppFeaturesChat.startNewChat();

        window.AppVoiceManager.init(
            (text) => this._handleTranscriptionSubmit(text),
            (status) => window.AppChatView.renderSystemMessage(`Voice: ${status}`)
        );
    },

    clearAuthenticatedApp() {
        window.AppState.setUser(null);
        if (window.AppState.clear) {
            window.AppState.clear();
        }
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

document.addEventListener('DOMContentLoaded', () => {
    window.App.bootstrap();
});
