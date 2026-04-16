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
                // FIX: also handle PGRST126 (multiple rows) gracefully
                console.error('loadUserSettings error:', error.code, error.message);
                return null;
            }
            window.AppState.set('settings', data);
            window.AppState.set('encryptionSalt', data.encryption_salt || null);
            return data;
        } catch (e) {
            console.error('loadUserSettings exception:', e);
            return null;
        }
    },
    async saveUserSettings(settings) {
        const user = window.AppState.get('user');
        if (!user) return { error: new Error('No authenticated user') };
        const currentSettings = window.AppState.get('settings') || {};
        const { id, created_at, updated_at, ...cleanSettings } = currentSettings;

        // FIX: ensure encrypted fields are NEVER accidentally nullified
        // by stripping undefined values from the final payload
        const payload = {
            ...cleanSettings,
            user_id: user.id,
            ...settings
        };

        // FIX: remove any keys whose value is undefined — Supabase would
        // interpret those as explicit NULLs and overwrite real data
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

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
        if (!settings) {
            console.error('unlockSecrets: no settings in state');
            return false;
        }

        // FIX: use the canonical encryptionSalt from state as primary,
        // fall back to settings object — they should be identical but
        // this eliminates the divergence window
        const salt = window.AppState.get('encryptionSalt') || settings.encryption_salt;
        if (!salt) {
            console.error('unlockSecrets: no encryption salt found');
            return false;
        }

        // FIX: check that we actually have encrypted data to decrypt
        const hasApiKey = !!(settings.encrypted_api_key && settings.encrypted_api_key_iv);
        const hasTtsKey = !!(settings.encrypted_google_tts_key && settings.encrypted_google_tts_key_iv);

        if (!hasApiKey && !hasTtsKey) {
            console.error('unlockSecrets: no encrypted secrets found in settings');
            return false;
        }

        try {
            if (hasApiKey) {
                const apiKey = await window.AppCrypto.decrypt(
                    settings.encrypted_api_key,
                    settings.encrypted_api_key_iv,
                    passphrase,
                    salt
                );
                window.AppState.set('decryptedApiKey', apiKey);
            }
            if (hasTtsKey) {
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
            console.error('Decryption failed:', e.name, e.message);
            return false;
        }
    },
    async encryptAndSaveApiKey(apiKey) {
        const user = window.AppState.get('user');
        if (!user) return { error: new Error('No user') };
        const passphrase = window.AppState.get('sessionPassphrase');
        if (!passphrase) return { error: new Error('No passphrase') };

        // FIX: ensure salt exists before encrypting
        const salt = await this.ensureEncryptionSalt();
        if (!salt) return { error: new Error('Failed to create encryption salt') };

        try {
            const { cipher, iv } = await window.AppCrypto.encrypt(apiKey, passphrase, salt);
            const result = await this.saveUserSettings({
                encrypted_api_key: cipher,
                encrypted_api_key_iv: iv
            });
            if (result.error) return result; // FIX: propagate save errors
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

        // FIX: ensure salt exists before encrypting
        const salt = await this.ensureEncryptionSalt();
        if (!salt) return { error: new Error('Failed to create encryption salt') };

        try {
            const { cipher, iv } = await window.AppCrypto.encrypt(ttsKey, passphrase, salt);
            const result = await this.saveUserSettings({
                encrypted_google_tts_key: cipher,
                encrypted_google_tts_key_iv: iv
            });
            if (result.error) return result; // FIX: propagate save errors
            window.AppState.set('decryptedTtsKey', ttsKey);
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    }
};
