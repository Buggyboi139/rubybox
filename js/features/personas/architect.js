window.AppArchitect = {
    async build() {
        const user = window.AppState.get('user');
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();

        if (!user || !apiKey) {
            window.AppToasts.show('Requires authentication and OpenRouter API key.', 'error');
            return;
        }

        const ui = window.AppUI.get();
        const input = ui.architectPrompt?.value?.trim();
        if (!input) return;

        ui.architectBuildBtn?.classList.add('hidden');
        ui.architectLoading?.classList.remove('hidden');

        try {
            window.AppToasts.show('Constructing persona...');

            const result = await window.AppLLMService.buildArchitectProfile(input);
            if (result.error) throw result.error;

            const profile = result.data;

            window.AppToasts.show('Generating avatar...');
            const imageResult = await window.AppImageService.generateAvatar(profile.avatar_prompt);
            const finalAvatarUrl = imageResult.data || '';

            const currentMode = window.AppState.get('currentMode') || 'chat';
            const { error } = await window.AppCharactersService.create({
                name: profile.name,
                system_prompt: profile.system_prompt,
                avatar: finalAvatarUrl,
                mode: currentMode
            });

            if (error) throw error;

            ui.architectPrompt.value = '';
            window.AppModals.close('architectModal');
            window.AppToasts.show(`Constructed: ${profile.name}`);

            await window.AppFeaturesPersonas.loadCharacters();
        } catch (e) {
            window.AppToasts.show(`Build failed: ${e.message}`, 'error');
        } finally {
            ui.architectBuildBtn?.classList.remove('hidden');
            ui.architectLoading?.classList.add('hidden');
        }
    }
};
