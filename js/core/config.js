window.AppConfigLoader = {
    async loadUserSettings() {
        const user = window.AppState.get('user');
        if (!user) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    window.AppState.set('settings', {});
                    return {};
                }
                return null;
            }
            window.AppState.set('settings', data);
            window.AppState.set('encryptionSalt', data.encryption_salt);
            return data;
        } catch (e) {
            return null;
        }
    },
    async saveUserSettings(settings) {
        const user = window.AppState.get('user');
        if (!user) return { error: new Error('No authenticated user') };
        const currentSettings = window.AppState.get('settings') || {};
        const { id, created_at, updated_at, ...cleanSettings } = currentSettings;
        const payload = {
            ...cleanSettings,
            user_id: user.id,
            ...settings
        };
        try {
            const { error } = await window.supabaseClient
                .from('user_settings')
                .upsert(payload, { onConflict: 'user_id' });
            if (error) {
                console.error('Supabase Upsert Error:', error);
                window.AppToasts.show('Database rejected save: ' + error.message, 'error');
                return { error };
            }
            window.AppState.set('settings', payload);
            return { error: null };
        } catch (e) {
            console.error('Critical Config Error:', e);
            return { error: e };
        }
    },
    async ensureEncryptionSalt() {
        let salt = window.AppState.get('encryptionSalt');
        if (!salt) {
            salt = await window.AppCrypto.generateSalt();
            const result = await this.saveUserSettings({ encryption_salt: salt });
            if (result.error) return null;
            window.AppState.set('encryptionSalt', salt);
        }
        return salt;
    },
    applyModeSettings() {
        const settings = window.AppState.get('settings');
        const mode = window.AppState.get('currentMode');
        if (!settings) return;
        const ui = window.AppUI.get();
        if (mode === 'code') {
            if (settings.system_prompt_code) ui.sysPrompt.value = settings.system_prompt_code;
            if (settings.narrative_prompt_code) ui.narrativePrompt.value = settings.narrative_prompt_code;
        } else if (mode === 'nsfw') {
            if (settings.system_prompt_nsfw) ui.sysPrompt.value = settings.system_prompt_nsfw;
            if (settings.narrative_prompt_nsfw) ui.narrativePrompt.value = settings.narrative_prompt_nsfw;
        } else {
            if (settings.system_prompt) ui.sysPrompt.value = settings.system_prompt;
            if (settings.narrative_prompt) ui.narrativePrompt.value = settings.narrative_prompt;
        }
        if (settings.temperature) {
            ui.tempSlider.value = settings.temperature;
            ui.tempVal.textContent = settings.temperature;
        }
        if (settings.context_limit) {
            ui.ctxSlider.value = settings.context_limit;
            ui.ctxVal.textContent = settings.context_limit;
        }
        if (settings.max_tokens) {
            ui.maxTokensSlider.value = settings.max_tokens;
            ui.maxTokensVal.textContent = settings.max_tokens;
        }
        if (settings.default_model) ui.model.value = settings.default_model;
        if (settings.voice_mode) ui.voiceMode.value = settings.voice_mode;
    },
    getDecryptedApiKey() {
        return window.AppState.get('decryptedApiKey');
    },
    async unlockSecrets(passphrase) {
        const settings = window.AppState.get('settings');
        if (!settings) return false;
        const salt = settings.encryption_salt;
        if (!salt) return false;
        try {
            if (settings.encrypted_api_key) {
                const apiKey = await window.AppCrypto.decrypt(
                    settings.encrypted_api_key,
                    settings.encrypted_api_key_iv,
                    passphrase,
                    salt
                );
                window.AppState.set('decryptedApiKey', apiKey);
            }
            if (settings.encrypted_google_tts_key) {
                const ttsKey = await window.AppCrypto.decrypt(
                    settings.encrypted_google_tts_key,
                    settings.encrypted_google_tts_key_iv,
                    passphrase,
                    salt
                );
                window.AppState.set('decryptedTtsKey', ttsKey);
            }
            window.AppState.set('encryptionUnlocked', true);
            window.AppState.set('sessionPassphrase', passphrase);
            const ui = window.AppUI.get();
            if (ui.apiKey) {
                ui.apiKey.value = window.AppState.get('decryptedApiKey') || '';
                ui.apiKey.type = 'text';
                setTimeout(() => { if(ui.apiKey) ui.apiKey.type = 'password'; }, 3000);
            }
            if (ui.googleTtsKey) {
                ui.googleTtsKey.value = window.AppState.get('decryptedTtsKey') || '';
                ui.googleTtsKey.type = 'text';
                setTimeout(() => { if(ui.googleTtsKey) ui.googleTtsKey.type = 'password'; }, 3000);
            }
            return true;
        } catch (e) {
            console.error('Decryption failed:', e);
            return false;
        }
    },
    async encryptAndSaveApiKey(apiKey) {
        const user = window.AppState.get('user');
        if (!user) return { error: new Error('No user') };
        const passphrase = window.AppState.get('sessionPassphrase');
        if (!passphrase) return { error: new Error('No passphrase') };
        const salt = window.AppState.get('encryptionSalt');
        if (!salt) return { error: new Error('No salt') };
        try {
            const { cipher, iv } = await window.AppCrypto.encrypt(apiKey, passphrase, salt);
            await this.saveUserSettings({
                encrypted_api_key: cipher,
                encrypted_api_key_iv: iv
            });
            window.AppState.set('decryptedApiKey', apiKey);
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    },
    async encryptAndSaveTtsKey(ttsKey) {
        const user = window.AppState.get('user');
        if (!user) return { error: new Error('No user') };
        const passphrase = window.AppState.get('sessionPassphrase');
        if (!passphrase) return { error: new Error('No passphrase') };
        const salt = window.AppState.get('encryptionSalt');
        if (!salt) return { error: new Error('No salt') };
        try {
            const { cipher, iv } = await window.AppCrypto.encrypt(ttsKey, passphrase, salt);
            await this.saveUserSettings({
                encrypted_google_tts_key: cipher,
                encrypted_google_tts_key_iv: iv
            });
            window.AppState.set('decryptedTtsKey', ttsKey);
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    }
};
