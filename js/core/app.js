window.App = {
    isBootstrapped: false,
    _isHydrated: false, // FIX: guard against double hydration

    async bootstrap() {
        if (this.isBootstrapped) return;

        window.AppUI.init();

        if (window.AppSupabase && !window.AppSupabase.isReady()) {
            window.AppSupabase.init(
                window.AppConfig.SUPABASE_URL,
                window.AppConfig.SUPABASE_ANON_KEY
            );
        }

        window.AppEvents.init();
        this.isBootstrapped = true;

        const user = await window.AppAuthService.checkSession();
        if (user) {
            await this.hydrateAuthenticatedApp(user);
        }

        if (window.AppSupabase && window.AppSupabase.client) {
            window.AppSupabase.client.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    // FIX: only hydrate if not already hydrated for this user
                    if (!this._isHydrated) {
                        this.hydrateAuthenticatedApp(session.user);
                    }
                } else if (event === 'SIGNED_OUT') {
                    this.clearAuthenticatedApp();
                }
            });
        }
    },

    async hydrateAuthenticatedApp(user) {
        // FIX: prevent double hydration race condition
        if (this._isHydrated) return;
        this._isHydrated = true;

        window.AppState.setUser(user);
        window.AppState.set('currentMode', 'chat');

        await window.AppConfigLoader.loadUserSettings();
        window.AppConfigLoader.applyModeSettings();

        const settings = window.AppState.get('settings');
        if (settings && (settings.encrypted_api_key || settings.encrypted_google_tts_key) && !window.AppState.get('sessionPassphrase')) {
            window.AppFeaturesSettings._showPassphraseModal('unlock');
        }

        await window.AppFeaturesPersonas.loadCharacters();
        await window.AppFeaturesChat.loadConversationList();
        await window.AppFeaturesChat.startNewChat();

        window.AppVoiceManager.init(
            (text) => this._handleTranscriptionSubmit(text),
            (status) => console.debug('[Voice] State changed:', status)
        );
    },

    clearAuthenticatedApp() {
        this._isHydrated = false; // FIX: allow re-hydration after sign-out
        window.AppState.setUser(null);
        if (window.AppState.reset) {
            window.AppState.reset();
        }
        const ui = window.AppUI.get();
        if (ui.apiKey) ui.apiKey.value = '';
        if (ui.googleTtsKey) ui.googleTtsKey.value = '';
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
