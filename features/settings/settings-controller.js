window.AppFeaturesSettings = {
    async saveProfile() {
        const user = window.AppState.get('user');
        if (!user) return;

        const ui = window.AppUI.get();
        const currentMode = window.AppState.get('currentMode') || 'chat';

        const settings = {
            temperature: parseFloat(ui.tempSlider.value),
            context_limit: parseInt(ui.ctxSlider.value),
            max_tokens: parseInt(ui.maxTokensSlider.value),
            default_model: ui.model.value,
            voice_mode: ui.voiceMode.value
        };

        if (currentMode === 'code') {
            settings.system_prompt_code = ui.sysPrompt.value;
            settings.narrative_prompt_code = ui.narrativePrompt.value;
        } else if (currentMode === 'nsfw') {
            settings.system_prompt_nsfw = ui.sysPrompt.value;
            settings.narrative_prompt_nsfw = ui.narrativePrompt.value;
        } else {
            settings.system_prompt = ui.sysPrompt.value;
            settings.narrative_prompt = ui.narrativePrompt.value;
        }

        await window.AppConfigLoader.saveUserSettings(settings);
    },

    async loadSettings() {
        await window.AppConfigLoader.loadUserSettings();
        window.AppConfigLoader.applyModeSettings();
    }
};
