window.AppEvents = {
    init() {
        this._bindScroll();
        this._bindSidebar();
        this._bindModeSwitching();
        this._bindProfile();
        this._bindCharacters();
        this._bindPrompt();
        this._bindImageControls();
        this._bindVoice();
        this._bindExport();
        this._bindArchitect();
        this._bindSendControls();
        this._bindConversationControls();
        this._bindSettings();
        this._bindAuth();
    },

    _bindScroll() {
        const ui = window.AppUI.get();
        ui.chatLog.addEventListener('scroll', () => {
            window.AppChatView.updateScrollState();
        });
    },

    _bindSidebar() {
        const ui = window.AppUI.get();

        ui.menuBtn.addEventListener('click', () => {
            if (window.innerWidth > 768) {
                ui.sidebar.classList.toggle('hidden-sidebar');
            } else {
                ui.sidebar.classList.toggle('show');
                ui.overlay.classList.toggle('show');
            }
        });

        ui.overlay.addEventListener('click', () => {
            window.AppModals.handleOverlayClick();
        });

        if (ui.mobileSidebarClose) {
            ui.mobileSidebarClose.addEventListener('click', () => {
                window.AppModals.toggleSidebar(false);
            });
            ui.mobileSidebarClose.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.AppModals.toggleSidebar(false);
            }, { passive: false });
        }
    },

    _bindModeSwitching() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const newMode = e.target.getAttribute('data-mode');
                window.AppState.set('currentMode', newMode);

                window.AppConfigLoader.applyModeSettings();
                await window.AppFeaturesPersonas.loadCharacters();
                await window.AppFeaturesChat.loadConversationList();
                await window.AppFeaturesChat.startNewChat();
            });
        });
    },

    _bindProfile() {
        const ui = window.AppUI.get();

        ui.profileBtn.addEventListener('click', () => {
            window.AppModals.open('profileModal');
        });

        ui.closeProfileModal.addEventListener('click', () => {
            window.AppModals.close('profileModal');
        });

        if (ui.saveProfileBtn) {
            ui.saveProfileBtn.addEventListener('click', () => {
                window.AppFeaturesSettings.saveProfile();
                window.AppModals.close('profileModal');
            });
        }
    },

    _bindCharacters() {
        const ui = window.AppUI.get();

        ui.charsBtn.addEventListener('click', () => {
            if (window.AppState.get('user')) {
                window.AppModals.toggleSidebar(false);
                window.AppModals.open('charModal');
            }
        });

        ui.closeCharModal.addEventListener('click', () => {
            window.AppModals.close('charModal');
        });

        ui.clearCharBtn.addEventListener('click', () => {
            window.AppFeaturesPersonas.clearCharacter();
        });

        ui.saveCharBtn.addEventListener('click', () => {
            window.AppFeaturesPersonas.saveCharacter();
        });

        if (ui.cancelEditCharBtn) {
            ui.cancelEditCharBtn.addEventListener('click', () => {
                window.AppFeaturesPersonas.cancelEdit();
            });
        }

        ui.persistMem.addEventListener('change', async (e) => {
            const convId = window.AppState.get('currentConversationId');
            if (convId) {
                await window.AppConversationsService.updateMemory(convId, e.target.value.trim());
            }
        });
    },

    _bindPrompt() {
        const ui = window.AppUI.get();
        const debouncedSave = window.AppUtils.debounce(() => {
            window.AppFeaturesSettings.saveProfile();
        }, 500);

        ui.prompt.addEventListener('input', function () {
            this.style.height = '50px';
            this.style.height = this.scrollHeight + 'px';
            const tokenEstimate = Math.ceil(this.value.length / 4);
            ui.tokenCounter.innerText = `~${tokenEstimate} tokens`;
        });

        ui.prompt.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.AppFeaturesChat.execute(false);
            }
        });

        ui.sysPrompt.addEventListener('change', debouncedSave);
        ui.narrativePrompt.addEventListener('change', debouncedSave);
        ui.tempSlider.addEventListener('input', (e) => {
            ui.tempVal.textContent = e.target.value;
        });
        ui.tempSlider.addEventListener('change', debouncedSave);
        ui.ctxSlider.addEventListener('input', (e) => {
            ui.ctxVal.textContent = e.target.value;
        });
        ui.ctxSlider.addEventListener('change', debouncedSave);
        ui.maxTokensSlider.addEventListener('input', (e) => {
            ui.maxTokensVal.textContent = e.target.value;
        });
        ui.maxTokensSlider.addEventListener('change', debouncedSave);
        ui.model.addEventListener('change', debouncedSave);
        ui.voiceMode.addEventListener('change', debouncedSave);
        ui.chatSearch.addEventListener('input', () => {
            window.AppFeaturesChat.loadConversationList();
        });
    },

    _bindImageControls() {
        const ui = window.AppUI.get();

        ui.attachImgBtn.addEventListener('click', () => {
            ui.imageUpload.click();
        });

        ui.imageUpload.addEventListener('change', (e) => {
            window.AppImageController.handleFileSelect(e.target.files[0]);
        });

        ui.clearImgBtn.addEventListener('click', () => {
            window.AppImageController.clearAttachment();
        });

        ui.generateImgBtn.addEventListener('click', () => {
            window.AppImageController.generateImage();
        });

        ui.scenarioImgBtn.addEventListener('click', () => {
            window.AppImageController.generateScenarioImage();
        });

        ui.newCharAvatarBtn.addEventListener('click', () => {
            ui.newCharAvatarFile.click();
        });

        ui.newCharAvatarFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                window.AppState.set('newCharacterAvatarBase64', event.target.result);
                ui.newCharAvatarPreview.src = event.target.result;
                ui.newCharAvatarPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    },

    _bindVoice() {
        const ui = window.AppUI.get();

        ui.voiceSheet.addEventListener('click', (e) => {
            if (e.target.closest('#voice-cancel-btn') || e.target.closest('#voice-progress-container')) return;
            const state = window.AppVoiceManager.getState();
            if (state === 'speaking' || state === 'thinking') {
                const controller = window.AppState.get('controller');
                if (controller) controller.abort();
                window.AppVoiceManager.interruptAndListen();
            } else if (state === 'idle') {
                window.AppVoiceManager.startListening();
            }
        });

        ui.voiceCancelBtn.addEventListener('click', () => {
            window.AppVoiceView.hideSheet();
            window.AppVoiceManager.stopAll();
            const controller = window.AppState.get('controller');
            if (controller) controller.abort();
        });

        ui.micBtn.addEventListener('click', () => {
            if (!window.AppState.get('user')) {
                window.AppToasts.show('Please sign in first.', 'error');
                return;
            }
            if (window.AppState.get('isExecuting')) return;
            window.AppVoiceView.showSheet();
            const state = window.AppVoiceManager.getState();
            if (state === 'idle' || state === 'ready') {
                window.AppVoiceManager.startListening();
            } else if (state === 'initializing') {
                window.AppVoiceManager.setPendingStart(true);
            }
        });
    },

    _bindExport() {
        const ui = window.AppUI.get();
        if (ui.exportBtn) {
            ui.exportBtn.addEventListener('click', () => {
                window.AppExportChat.export();
            });
        }
        const mobileExportBtn = document.getElementById('mobile-export-btn');
        if (mobileExportBtn) {
            mobileExportBtn.addEventListener('click', () => {
                window.AppExportChat.export();
            });
        }
    },

    _bindArchitect() {
        const ui = window.AppUI.get();

        ui.architectBtn.addEventListener('click', () => {
            window.AppModals.open('architectModal');
        });

        ui.closeArchitectModal.addEventListener('click', () => {
            window.AppModals.close('architectModal');
        });

        ui.architectBuildBtn.addEventListener('click', () => {
            window.AppArchitect.build();
        });
    },

    _bindSendControls() {
        const ui = window.AppUI.get();

        ui.sendBtn.addEventListener('click', () => {
            window.AppFeaturesChat.execute(false);
        });

        ui.stopBtn.addEventListener('click', () => {
            window.AppFeaturesChat.stop();
        });
    },

    _bindConversationControls() {
        const ui = window.AppUI.get();

        ui.newChatBtn.addEventListener('click', async () => {
            if (window.AppState.get('user')) {
                await window.AppFeaturesChat.startNewChat();
            }
        });
    },

    _bindSettings() {
        const ui = window.AppUI.get();

        ui.apiKey.addEventListener('change', () => {
            window.AppFeaturesSettings.saveApiKey(ui.apiKey.value);
        });

        ui.googleTtsKey.addEventListener('change', () => {
            window.AppFeaturesSettings.saveTtsKey(ui.googleTtsKey.value);
        });
    },

    _bindAuth() {
        const ui = window.AppUI.get();

        ui.loginBtn.addEventListener('click', () => {
            window.AppModals.open('authModal');
        });

        ui.closeAuthModal.addEventListener('click', () => {
            window.AppModals.close('authModal');
        });

        ui.authLoginBtn.addEventListener('click', async () => {
            try {
                const email = ui.authEmail.value;
                const pass = ui.authPassword.value;
                await window.AppAuthService.login(email, pass);
                window.AppModals.close('authModal');
            } catch (e) {
                window.AppToasts.show(e.message, 'error');
            }
        });
        
        ui.authSignupBtn.addEventListener('click', async () => {
            try {
                const email = ui.authEmail.value;
                const pass = ui.authPassword.value;
                await window.AppAuthService.signup(email, pass);
                window.AppModals.close('authModal');
            } catch (e) {
                window.AppToasts.show(e.message, 'error');
            }
        });

        ui.logoutBtn.addEventListener('click', () => {
            window.AppAuthService.logout();
        });
    }
};
