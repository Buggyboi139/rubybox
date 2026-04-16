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
    },
    async saveApiKey(value) {
        const user = window.AppState.get('user');
        if (!user) {
            window.AppToasts.show('Please sign in to save API keys', 'error');
            const ui = window.AppUI.get();
            if (ui.apiKey) ui.apiKey.value = '';
            return;
        }
        if (!value || !value.trim()) return;
        const hasPassphrase = !!window.AppState.get('sessionPassphrase');
        if (!hasPassphrase) {
            window.AppToasts.show('Set an encryption passphrase first', 'error');
            this._showPassphraseModal('api');
            return;
        }
        const result = await window.AppConfigLoader.encryptAndSaveApiKey(value.trim());
        if (result.error) {
            window.AppToasts.show('Failed to save API key: ' + result.error.message, 'error');
        } else {
            window.AppToasts.show('API key encrypted and saved');
        }
    },
    async saveTtsKey(value) {
        const user = window.AppState.get('user');
        if (!user) {
            window.AppToasts.show('Please sign in to save TTS keys', 'error');
            const ui = window.AppUI.get();
            if (ui.googleTtsKey) ui.googleTtsKey.value = '';
            return;
        }
        if (!value || !value.trim()) return;
        const hasPassphrase = !!window.AppState.get('sessionPassphrase');
        if (!hasPassphrase) {
            window.AppToasts.show('Set an encryption passphrase first', 'error');
            this._showPassphraseModal('tts');
            return;
        }
        const result = await window.AppConfigLoader.encryptAndSaveTtsKey(value.trim());
        if (result.error) {
            window.AppToasts.show('Failed to save TTS key: ' + result.error.message, 'error');
        } else {
            window.AppToasts.show('TTS key encrypted and saved');
        }
    },
    async unlockSecrets(passphrase) {
        if (!passphrase) return false;
        return window.AppConfigLoader.unlockSecrets(passphrase);
    },
    _showPassphraseModal(target) {
        const existing = document.getElementById('passphraseModal');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'passphraseModal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="glass-panel">
                <button id="closePassphraseModal" class="close-btn">&times;</button>
                <h2 class="mb-20 text-1-5">Encryption Passphrase</h2>
                <p class="mb-15" style="color: var(--text-muted); font-size: 0.85rem;">
                    Your API keys are encrypted locally. Enter a passphrase to unlock them.
                </p>
                <input type="password" id="passphraseInput" class="glass-input mb-10" placeholder="Enter passphrase" autocomplete="new-password">
                <input type="password" id="passphraseConfirmInput" class="glass-input mb-15" placeholder="Confirm passphrase" autocomplete="new-password">
                <button id="savePassphraseBtn" class="primary-btn mt-0">Unlock / Set Passphrase</button>
                <div id="passphraseError" class="hidden mt-10" style="color: #fb7185; font-size: 0.85rem; text-align: center;"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        // FIX: capture isNew at modal creation time, not at click time,
        // to avoid race conditions if state changes between open and click
        const isNew = !window.AppState.get('encryptionSalt');
        const confirmInput = document.getElementById('passphraseConfirmInput');
        if (!isNew) {
            confirmInput.style.display = 'none'; // hide confirm field for unlock mode
        }

        const closeBtn = document.getElementById('closePassphraseModal');
        closeBtn.addEventListener('click', () => overlay.remove());

        const self = this; // FIX: capture reference explicitly for clarity

        const saveBtn = document.getElementById('savePassphraseBtn');
        saveBtn.addEventListener('click', async () => {
            const pass = document.getElementById('passphraseInput').value;
            const confirm = document.getElementById('passphraseConfirmInput').value;
            const errorEl = document.getElementById('passphraseError');

            if (!pass) {
                errorEl.textContent = 'Passphrase is required';
                errorEl.classList.remove('hidden');
                return;
            }
            if (isNew) {
                if (pass.length < 8) {
                    errorEl.textContent = 'Passphrase must be at least 8 characters';
                    errorEl.classList.remove('hidden');
                    return;
                }
                if (pass !== confirm) {
                    errorEl.textContent = 'Passphrases do not match';
                    errorEl.classList.remove('hidden');
                    return;
                }
                await window.AppConfigLoader.ensureEncryptionSalt();
                window.AppState.set('sessionPassphrase', pass);
                window.AppToasts.show('Passphrase set successfully');
                overlay.remove();
                const ui = window.AppUI.get();
                if (target === 'api' && ui.apiKey.value) self.saveApiKey(ui.apiKey.value);
                if (target === 'tts' && ui.googleTtsKey.value) self.saveTtsKey(ui.googleTtsKey.value);
            } else {
                // FIX: add granular diagnostics for unlock failures
                const settings = window.AppState.get('settings');
                const salt = window.AppState.get('encryptionSalt') || (settings && settings.encryption_salt);

                if (!settings) {
                    errorEl.textContent = 'Error: Settings not loaded from server. Try refreshing.';
                    errorEl.classList.remove('hidden');
                    return;
                }
                if (!salt) {
                    errorEl.textContent = 'Error: No encryption salt found. Your encrypted data may be corrupted.';
                    errorEl.classList.remove('hidden');
                    return;
                }
                if (!settings.encrypted_api_key && !settings.encrypted_google_tts_key) {
                    errorEl.textContent = 'Error: No encrypted secrets found in your settings.';
                    errorEl.classList.remove('hidden');
                    return;
                }
                if (settings.encrypted_api_key && !settings.encrypted_api_key_iv) {
                    errorEl.textContent = 'Error: API key IV is missing — data corrupted during save.';
                    errorEl.classList.remove('hidden');
                    return;
                }

                const success = await window.AppConfigLoader.unlockSecrets(pass);
                if (success) {
                    window.AppToasts.show('Secrets unlocked');
                    overlay.remove();
                } else {
                    errorEl.textContent = 'Decryption failed — wrong passphrase or data was corrupted.';
                    errorEl.classList.remove('hidden');
                }
            }
        });
    }
};
