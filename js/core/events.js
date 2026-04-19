window.AppEvents = {
    init() {
        try {
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
        } catch (error) {
            console.error('[Events] Initialization error:', error);
        }
    },

    _bindScroll() {
        const ui = window.AppUI.get();
        if (!ui?.chatLog) return;

        const throttledScroll = window.AppUtils.throttle(() => {
            try {
                window.AppChatView.updateScrollState();
            } catch (error) {
                console.error('[Events] Scroll handler error:', error);
            }
        }, 100);

        ui.chatLog.addEventListener('scroll', throttledScroll, { passive: true });
    },

    _bindSidebar() {
        const ui = window.AppUI.get();
        if (!ui?.menuBtn) return;

        ui.menuBtn.addEventListener('click', () => {
            try {
                if (window.innerWidth > 768) {
                    ui.sidebar.classList.toggle('hidden-sidebar');
                } else {
                    ui.sidebar.classList.toggle('show');
                    ui.overlay.classList.toggle('show');
                }
            } catch (error) {
                console.error('[Events] Sidebar toggle error:', error);
            }
        });

        ui.overlay.addEventListener('click', () => {
            try {
                window.AppModals.handleOverlayClick();
            } catch (error) {
                console.error('[Events] Overlay click error:', error);
            }
        });

        if (ui.mobileSidebarClose) {
            ui.mobileSidebarClose.addEventListener('click', () => {
                try {
                    window.AppModals.toggleSidebar(false);
                } catch (error) {
                    console.error('[Events] Mobile sidebar close error:', error);
                }
            });
            
            ui.mobileSidebarClose.addEventListener('touchstart', () => {
                try {
                    window.AppModals.toggleSidebar(false);
                } catch (error) {
                    console.error('[Events] Mobile sidebar touch error:', error);
                }
            }, { passive: true });
        }
    },

    _bindModeSwitching() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                try {
                    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    const newMode = e.currentTarget.getAttribute('data-mode');
                    
                    if (!newMode) {
                        console.warn('[Events] Mode button missing data-mode attribute');
                        return;
                    }

                    window.AppState.set('currentMode', newMode);
                    window.AppConfigLoader.applyModeSettings();
                    
                    await window.AppFeaturesPersonas.loadCharacters();
                    await window.AppFeaturesChat.loadConversationList();
                    await window.AppFeaturesChat.startNewChat();
                    
                } catch (error) {
                    console.error('[Events] Mode switching error:', error);
                }
            });
        });
    },

    _bindProfile() {
        const ui = window.AppUI.get();
        if (!ui?.profileBtn) return;

        ui.profileBtn.addEventListener('click', () => {
            try {
                window.AppModals.open('profileModal');
            } catch (error) {
                console.error('[Events] Profile open error:', error);
            }
        });

        if (ui.closeProfileModal) {
            ui.closeProfileModal.addEventListener('click', () => {
                try {
                    window.AppModals.close('profileModal');
                } catch (error) {
                    console.error('[Events] Profile close error:', error);
                }
            });
        }

        if (ui.saveProfileBtn) {
            ui.saveProfileBtn.addEventListener('click', () => {
                try {
                    window.AppFeaturesSettings.saveProfile();
                    window.AppModals.close('profileModal');
                } catch (error) {
                    console.error('[Events] Profile save error:', error);
                    window.AppToasts.show('Failed to save profile', 'error');
                }
            });
        }
    },

    _bindCharacters() {
        const ui = window.AppUI.get();
        if (!ui?.charsBtn) return;

        ui.charsBtn.addEventListener('click', () => {
            try {
                if (window.AppState.get('user')) {
                    window.AppModals.toggleSidebar(false);
                    window.AppModals.open('charModal');
                }
            } catch (error) {
                console.error('[Events] Characters open error:', error);
            }
        });

        if (ui.closeCharModal) {
            ui.closeCharModal.addEventListener('click', () => {
                try {
                    window.AppModals.close('charModal');
                } catch (error) {
                    console.error('[Events] Character modal close error:', error);
                }
            });
        }

        if (ui.clearCharBtn) {
            ui.clearCharBtn.addEventListener('click', () => {
                try {
                    window.AppFeaturesPersonas.clearCharacter();
                } catch (error) {
                    console.error('[Events] Clear character error:', error);
                }
            });
        }

        if (ui.saveCharBtn) {
            ui.saveCharBtn.addEventListener('click', () => {
                try {
                    window.AppFeaturesPersonas.saveCharacter();
                } catch (error) {
                    console.error('[Events] Save character error:', error);
                    window.AppToasts.show('Failed to save character', 'error');
                }
            });
        }

        if (ui.cancelEditCharBtn) {
            ui.cancelEditCharBtn.addEventListener('click', () => {
                try {
                    window.AppFeaturesPersonas.cancelEdit();
                } catch (error) {
                    console.error('[Events] Cancel character edit error:', error);
                }
            });
        }

        if (ui.persistMem) {
            ui.persistMem.addEventListener('change', async (e) => {
                try {
                    const convId = window.AppState.get('currentConversationId');
                    if (convId) {
                        await window.AppConversationsService.updateMemory(convId, e.target.value.trim());
                    }
                } catch (error) {
                    console.error('[Events] Persist memory save error:', error);
                }
            });
        }
    },

    _bindPrompt() {
        const ui = window.AppUI.get();
        if (!ui?.prompt) return;

        const debouncedProfileSave = window.AppUtils.debounce(() => {
            try {
                window.AppFeaturesSettings.saveProfile();
            } catch (error) {
                console.error('[Events] Debounced profile save error:', error);
            }
        }, 500);

        ui.prompt.addEventListener('input', function() {
            try {
                this.style.height = '50px';
                this.style.height = this.scrollHeight + 'px';
                const tokenEstimate = Math.ceil(this.value.length / 4);
                if (ui.tokenCounter) {
                    ui.tokenCounter.innerText = `~${tokenEstimate} tokens`;
                }
            } catch (error) {
                console.error('[Events] Prompt input error:', error);
            }
        });

        ui.prompt.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                try {
                    window.AppFeaturesChat.execute(false);
                } catch (error) {
                    console.error('[Events] Enter key submit error:', error);
                }
            }
        });

        if (ui.sysPrompt) {
            ui.sysPrompt.addEventListener('change', debouncedProfileSave);
        }
        if (ui.narrativePrompt) {
            ui.narrativePrompt.addEventListener('change', debouncedProfileSave);
        }
        if (ui.tempSlider) {
            ui.tempSlider.addEventListener('input', (e) => {
                if (ui.tempVal) {
                    ui.tempVal.textContent = e.target.value;
                }
            });
            ui.tempSlider.addEventListener('change', debouncedProfileSave);
        }
        if (ui.ctxSlider) {
            ui.ctxSlider.addEventListener('input', (e) => {
                if (ui.ctxVal) {
                    ui.ctxVal.textContent = e.target.value;
                }
            });
            ui.ctxSlider.addEventListener('change', debouncedProfileSave);
        }
        if (ui.maxTokensSlider) {
            ui.maxTokensSlider.addEventListener('input', (e) => {
                if (ui.maxTokensVal) {
                    ui.maxTokensVal.textContent = e.target.value;
                }
            });
            ui.maxTokensSlider.addEventListener('change', debouncedProfileSave);
        }
        if (ui.model) {
            ui.model.addEventListener('change', debouncedProfileSave);
        }
        if (ui.voiceMode) {
            ui.voiceMode.addEventListener('change', debouncedProfileSave);
        }
        if (ui.chatSearch) {
            ui.chatSearch.addEventListener('input', () => {
                try {
                    window.AppFeaturesChat.loadConversationList();
                } catch (error) {
                    console.error('[Events] Chat search error:', error);
                }
            });
        }
    },

    _bindImageControls() {
        const ui = window.AppUI.get();
        if (!ui?.attachImgBtn) return;

        ui.attachImgBtn.addEventListener('click', () => {
            try {
                if (ui.imageUpload) {
                    ui.imageUpload.click();
                }
            } catch (error) {
                console.error('[Events] Attach image click error:', error);
            }
        });

        if (ui.imageUpload) {
            ui.imageUpload.addEventListener('change', (e) => {
                try {
                    window.AppImageController.handleFileSelect(e.target.files[0]);
                } catch (error) {
                    console.error('[Events] Image file select error:', error);
                    window.AppToasts.show('Failed to process image', 'error');
                }
            });
        }

        if (ui.clearImgBtn) {
            ui.clearImgBtn.addEventListener('click', () => {
                try {
                    window.AppImageController.clearAttachment();
                } catch (error) {
                    console.error('[Events] Clear image error:', error);
                }
            });
        }

        if (ui.generateImgBtn) {
            ui.generateImgBtn.addEventListener('click', () => {
                try {
                    window.AppImageController.generateImage();
                } catch (error) {
                    console.error('[Events] Generate image error:', error);
                }
            });
        }

        if (ui.scenarioImgBtn) {
            ui.scenarioImgBtn.addEventListener('click', () => {
                try {
                    window.AppImageController.generateScenarioImage();
                } catch (error) {
                    console.error('[Events] Scenario image error:', error);
                }
            });
        }

        if (ui.newCharAvatarBtn && ui.newCharAvatarFile) {
            ui.newCharAvatarBtn.addEventListener('click', () => {
                ui.newCharAvatarFile.click();
            });

            ui.newCharAvatarFile.addEventListener('change', (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        window.AppState.set('newCharacterAvatarBase64', event.target.result);
                        if (ui.newCharAvatarPreview) {
                            ui.newCharAvatarPreview.src = event.target.result;
                            ui.newCharAvatarPreview.style.display = 'block';
                        }
                    };
                    reader.onerror = () => {
                        console.error('[Events] FileReader error');
                        window.AppToasts.show('Failed to read image file', 'error');
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('[Events] Avatar file error:', error);
                    window.AppToasts.show('Failed to process avatar image', 'error');
                }
            });
        }
    },

    _bindVoice() {
        const ui = window.AppUI.get();
        if (!ui?.voiceSheet) return;

        ui.voiceSheet.addEventListener('click', (e) => {
            try {
                if (e.target.closest('#voice-cancel-btn') || e.target.closest('#voice-progress-container')) return;
                
                const state = window.AppVoiceManager.getState();
                if (state === 'speaking' || state === 'thinking') {
                    const controller = window.AppState.get('controller');
                    if (controller) controller.abort();
                    window.AppVoiceManager.interruptAndListen();
                } else if (state === 'idle') {
                    window.AppVoiceManager.startListening();
                }
            } catch (error) {
                console.error('[Events] Voice sheet click error:', error);
            }
        });

        if (ui.voiceCancelBtn) {
            ui.voiceCancelBtn.addEventListener('click', () => {
                try {
                    window.AppVoiceView.hideSheet();
                    window.AppVoiceManager.stopAll();
                    const controller = window.AppState.get('controller');
                    if (controller) controller.abort();
                } catch (error) {
                    console.error('[Events] Voice cancel error:', error);
                }
            });
        }

        if (ui.micBtn) {
            ui.micBtn.addEventListener('click', () => {
                try {
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
                } catch (error) {
                    console.error('[Events] Mic button error:', error);
                }
            });
        }
    },

    _bindExport() {
        const ui = window.AppUI.get();
        
        if (ui?.exportBtn) {
            ui.exportBtn.addEventListener('click', () => {
                try {
                    window.AppExportChat.export();
                } catch (error) {
                    console.error('[Events] Export error:', error);
                    window.AppToasts.show('Failed to export chat', 'error');
                }
            });
        }
        
        const mobileExportBtn = document.getElementById('mobile-export-btn');
        if (mobileExportBtn) {
            mobileExportBtn.addEventListener('click', () => {
                try {
                    window.AppExportChat.export();
                } catch (error) {
                    console.error('[Events] Mobile export error:', error);
                    window.AppToasts.show('Failed to export chat', 'error');
                }
            });
        }
    },

    _bindArchitect() {
        const ui = window.AppUI.get();
        if (!ui?.architectBtn) return;

        ui.architectBtn.addEventListener('click', () => {
            try {
                window.AppModals.open('architectModal');
            } catch (error) {
                console.error('[Events] Architect open error:', error);
            }
        });

        if (ui.closeArchitectModal) {
            ui.closeArchitectModal.addEventListener('click', () => {
                try {
                    window.AppModals.close('architectModal');
                } catch (error) {
                    console.error('[Events] Architect close error:', error);
                }
            });
        }

        if (ui.architectBuildBtn) {
            ui.architectBuildBtn.addEventListener('click', () => {
                try {
                    window.AppArchitect.build();
                } catch (error) {
                    console.error('[Events] Architect build error:', error);
                    window.AppToasts.show('Build failed', 'error');
                }
            });
        }
    },

    _bindSendControls() {
        const ui = window.AppUI.get();
        if (!ui?.sendBtn) return;

        ui.sendBtn.addEventListener('click', () => {
            try {
                window.AppFeaturesChat.execute(false);
            } catch (error) {
                console.error('[Events] Send button error:', error);
            }
        });

        if (ui.stopBtn) {
            ui.stopBtn.addEventListener('click', () => {
                try {
                    window.AppFeaturesChat.stop();
                } catch (error) {
                    console.error('[Events] Stop button error:', error);
                }
            });
        }
    },

    _bindConversationControls() {
        const ui = window.AppUI.get();
        if (!ui?.newChatBtn) return;

        ui.newChatBtn.addEventListener('click', async () => {
            try {
                if (window.AppState.get('user')) {
                    await window.AppFeaturesChat.startNewChat();
                }
            } catch (error) {
                console.error('[Events] New chat error:', error);
            }
        });
    },

    _bindSettings() {
        const ui = window.AppUI.get();
        if (!ui?.apiKey) return;

        ui.apiKey.addEventListener('change', () => {
            try {
                window.AppFeaturesSettings.saveApiKey(ui.apiKey.value);
            } catch (error) {
                console.error('[Events] API key save error:', error);
            }
        });

        if (ui.googleTtsKey) {
            ui.googleTtsKey.addEventListener('change', () => {
                try {
                    window.AppFeaturesSettings.saveTtsKey(ui.googleTtsKey.value);
                } catch (error) {
                    console.error('[Events] TTS key save error:', error);
                }
            });
        }

        if (ui.unlockKeysBtn) {
            ui.unlockKeysBtn.addEventListener('click', () => {
                try {
                    if (!window.AppState.get('user')) {
                        window.AppToasts.show('Please sign in first.', 'error');
                        return;
                    }
                    window.AppFeaturesSettings._showPassphraseModal('unlock');
                } catch (error) {
                    console.error('[Events] Unlock keys error:', error);
                }
            });
        }
    },

    _bindAuth() {
        const ui = window.AppUI.get();
        if (!ui?.loginBtn) return;

        ui.loginBtn.addEventListener('click', () => {
            try {
                window.AppModals.open('authModal');
            } catch (error) {
                console.error('[Events] Auth modal open error:', error);
            }
        });

        if (ui.closeAuthModal) {
            ui.closeAuthModal.addEventListener('click', () => {
                try {
                    window.AppModals.close('authModal');
                } catch (error) {
                    console.error('[Events] Auth modal close error:', error);
                }
            });
        }

        const _submitAuth = async (action) => {
            const email = ui.authEmail?.value || '';
            const pass = ui.authPassword?.value || '';
            if (ui.authLoginBtn) ui.authLoginBtn.disabled = true;
            if (ui.authSignupBtn) ui.authSignupBtn.disabled = true;
            try {
                const result = await action(email, pass);
                if (result.error) {
                    window.AppToasts.show(result.error.message, 'error');
                } else {
                    if (ui.authEmail) ui.authEmail.value = '';
                    if (ui.authPassword) ui.authPassword.value = '';
                    window.AppModals.close('authModal');
                }
            } catch (error) {
                console.error('[Events] Auth submit error:', error);
                window.AppToasts.show('Authentication failed', 'error');
            } finally {
                if (ui.authLoginBtn) ui.authLoginBtn.disabled = false;
                if (ui.authSignupBtn) ui.authSignupBtn.disabled = false;
            }
        };

        if (ui.authLoginBtn) {
            ui.authLoginBtn.addEventListener('click', () => {
                _submitAuth((email, pass) => window.AppAuthService.login(email, pass));
            });
        }

        if (ui.authSignupBtn) {
            ui.authSignupBtn.addEventListener('click', () => {
                _submitAuth((email, pass) => window.AppAuthService.signup(email, pass));
            });
        }

        if (ui.authEmail) {
            ui.authEmail.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    ui.authPassword?.focus();
                }
            });
        }

        if (ui.authPassword) {
            ui.authPassword.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    _submitAuth((email, pass) => window.AppAuthService.login(email, pass));
                }
            });
        }

        if (ui.logoutBtn) {
            ui.logoutBtn.addEventListener('click', () => {
                try {
                    window.AppAuthService.logout();
                } catch (error) {
                    console.error('[Events] Logout error:', error);
                }
            });
        }
    }
};