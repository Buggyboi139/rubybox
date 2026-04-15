window.App.debounce = function(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

window.App.handleTranscriptionSubmit = function(text) {
    const currentText = window.App.UI.prompt.value;
    window.App.UI.prompt.value = currentText ? currentText + " " + text : text;
    window.App.execute(true);
};

window.App.setupEventListeners = function() {
    window.App.debouncedSaveUserSettings = window.App.debounce(window.App.saveUserSettings, 500);

    window.App.UI.chatLog.addEventListener('scroll', () => { 
        const diff = window.App.UI.chatLog.scrollHeight - window.App.UI.chatLog.scrollTop - window.App.UI.chatLog.clientHeight;
        window.App.isAutoScrolling = diff < 10; 
    });
    
    window.App.UI.menuBtn.addEventListener('click', () => {
        if(window.innerWidth > 768) {
            let isSidebarHidden = window.App.UI.sidebar.classList.contains('hidden-sidebar');
            if(!isSidebarHidden) window.App.UI.sidebar.classList.add('hidden-sidebar');
            else window.App.UI.sidebar.classList.remove('hidden-sidebar');
        } else {
            window.App.UI.sidebar.classList.toggle('show');
            window.App.UI.overlay.classList.toggle('show');
        }
    });

    window.App.UI.overlay.addEventListener('click', () => { 
        window.App.UI.sidebar.classList.remove('show'); 
        window.App.UI.overlay.classList.remove('show'); 
    });

    if (window.App.UI.mobileSidebarClose) {
        const closeSidebar = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            window.App.UI.sidebar.classList.remove('show');
            window.App.UI.overlay.classList.remove('show');
        };
        window.App.UI.mobileSidebarClose.addEventListener('click', closeSidebar);
        window.App.UI.mobileSidebarClose.addEventListener('touchstart', closeSidebar, { passive: false });
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('active');
            });
            e.target.classList.add('active');
            
            window.App.currentMode = e.target.getAttribute('data-mode');
            window.App.applyModeSettings();
            
            window.App.state.activeCharacter = window.App.BASE_PERSONAS[window.App.currentMode];
            window.App.renderActiveCharacter();
            
            await window.App.loadCharacters();
            await window.App.loadConversations();
            await window.App.startNewChat();
        });
    });

    window.App.UI.profileBtn.addEventListener('click', () => { window.App.UI.profileModal.classList.remove('hidden'); window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); });
    window.App.UI.closeProfileModal.addEventListener('click', () => window.App.UI.profileModal.classList.add('hidden'));
    
    if (window.App.UI.saveProfileBtn) {
        window.App.UI.saveProfileBtn.addEventListener('click', () => {
            window.App.saveUserSettings();
            window.App.UI.profileModal.classList.add('hidden');
        });
    }

    window.App.UI.cancelEditCharBtn.addEventListener('click', () => {
        window.App.editingCharId = null;
        window.App.UI.newCharName.value = "";
        window.App.UI.newCharPrompt.value = "";
        window.App.newCharAvatarBase64 = null;
        window.App.UI.newCharAvatarPreview.style.display = 'none';
        window.App.UI.newCharAvatarPreview.src = '';
        window.App.UI.saveCharBtn.textContent = 'Save Persona';
        window.App.UI.cancelEditCharBtn.classList.add('hidden');
    });

    window.App.UI.persistMem.addEventListener('change', async (e) => {
        if (window.App.currentConversationId) {
            await window.supabaseClient.from('conversations').update({ summary_memory: e.target.value.trim() }).eq('id', window.App.currentConversationId);
        }
    });
    
    window.App.UI.saveCharBtn.addEventListener('click', async () => {
        if (!window.App.user) {
            window.App.showToast("Please sign in first.", "error");
            return;
        }
        const name = window.App.UI.newCharName.value.trim();
        const avatar = window.App.newCharAvatarBase64 || '';
        const prompt = window.App.UI.newCharPrompt.value.trim();
        
        if (name && prompt && window.App.user) {
            if (window.App.editingCharId) {
                const { error } = await window.supabaseClient
                    .from('characters')
                    .update({ name, avatar, system_prompt: prompt })
                    .eq('id', window.App.editingCharId);
                
                if (error) return window.App.showToast(error.message, "error");
                
                if (window.App.state.activeCharacter && window.App.state.activeCharacter.id === window.App.editingCharId) {
                    window.App.state.activeCharacter.name = name;
                    window.App.state.activeCharacter.avatar = avatar;
                    window.App.state.activeCharacter.system_prompt = prompt;
                    window.App.renderActiveCharacter();
                }
                window.App.showToast("Persona updated");
            } else {
                const currentMode = window.App.currentMode || 'chat';
                const { error } = await window.supabaseClient
                    .from('characters')
                    .insert([{ user_id: window.App.user.id, name, avatar, system_prompt: prompt, mode: currentMode }]);
                
                if (error) return window.App.showToast(error.message, "error");
                window.App.showToast("Persona saved");
            }
            
            window.App.UI.cancelEditCharBtn.click();
            window.App.loadCharacters();
        }
    });

    window.App.UI.sysPrompt.addEventListener('change', window.App.debouncedSaveUserSettings);
    window.App.UI.narrativePrompt.addEventListener('change', window.App.debouncedSaveUserSettings);
    window.App.UI.apiKey.addEventListener('change', window.App.debouncedSaveUserSettings);
    
    window.App.UI.tempSlider.addEventListener('input', (e) => { window.App.UI.tempVal.textContent = e.target.value; });
    window.App.UI.tempSlider.addEventListener('change', window.App.debouncedSaveUserSettings);
    
    window.App.UI.ctxSlider.addEventListener('input', (e) => { window.App.UI.ctxVal.textContent = e.target.value; });
    window.App.UI.ctxSlider.addEventListener('change', window.App.debouncedSaveUserSettings);

    window.App.UI.maxTokensSlider.addEventListener('input', (e) => { window.App.UI.maxTokensVal.textContent = e.target.value; });
    window.App.UI.maxTokensSlider.addEventListener('change', window.App.debouncedSaveUserSettings);
    
    window.App.UI.model.addEventListener('change', window.App.debouncedSaveUserSettings);
    window.App.UI.voiceMode.addEventListener('change', window.App.debouncedSaveUserSettings);
    window.App.UI.chatSearch.addEventListener('input', window.App.loadConversations);

    window.App.UI.attachImgBtn.addEventListener('click', () => window.App.UI.imageUpload.click());
    window.App.UI.imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            window.App.attachedImageBase64 = event.target.result;
            window.App.UI.imagePreview.src = window.App.attachedImageBase64;
            window.App.UI.imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });
    window.App.UI.clearImgBtn.addEventListener('click', () => { window.App.attachedImageBase64 = null; window.App.UI.imagePreview.src = ''; window.App.UI.imagePreviewContainer.classList.add('hidden'); window.App.UI.imageUpload.value = ''; });

    window.App.UI.newCharAvatarBtn.addEventListener('click', () => window.App.UI.newCharAvatarFile.click());
    window.App.UI.newCharAvatarFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            window.App.newCharAvatarBase64 = event.target.result;
            window.App.UI.newCharAvatarPreview.src = window.App.newCharAvatarBase64;
            window.App.UI.newCharAvatarPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    window.App.UI.voiceSheet.addEventListener('click', (e) => {
        if (e.target.closest('#voice-cancel-btn') || e.target.closest('#voice-progress-container')) return;
        const s = VoiceManager.getState();
        if (s === 'speaking' || s === 'thinking') {
            if(window.App.controller) window.App.controller.abort();
            VoiceManager.interruptAndListen();
        } else if (s === 'idle') {
            VoiceManager.startListening();
        }
    });

    window.App.UI.voiceCancelBtn.addEventListener('click', () => { 
        window.App.UI.voiceSheet.classList.remove('show'); 
        setTimeout(() => window.App.UI.voiceSheet.classList.add('hidden'), 400); 
        VoiceManager.stopAll(); 
        if(window.App.controller) window.App.controller.abort(); 
    });

    window.App.UI.micBtn.addEventListener('click', () => {
        if (!window.App.user) {
            window.App.showToast("Please sign in first.", "error");
            return;
        }
        if (window.App.isExecuting) return;
        window.App.UI.voiceSheet.classList.remove('hidden');
        setTimeout(() => window.App.UI.voiceSheet.classList.add('show'), 10);
        
        const vState = VoiceManager.getState();
        if (vState === 'idle' || vState === 'ready') {
            VoiceManager.startListening();
        } else if (vState === 'initializing') {
            VoiceManager.setPendingStart(true);
        }
    });

    window.App.UI.generateImgBtn.addEventListener('click', () => {
        window.App.generateImage();
    });

    if (window.App.UI.exportBtn) {
        window.App.UI.exportBtn.addEventListener('click', window.App.exportChat);
    }
    
    const mobileExportBtn = document.getElementById('mobile-export-btn');
    if (mobileExportBtn) {
        mobileExportBtn.addEventListener('click', window.App.exportChat);
    }

    window.App.UI.architectBtn.addEventListener('click', () => {
        window.App.UI.architectModal.classList.remove('hidden');
    });

    window.App.UI.closeArchitectModal.addEventListener('click', () => {
        window.App.UI.architectModal.classList.add('hidden');
    });

    window.App.UI.architectBuildBtn.addEventListener('click', () => {
        window.App.buildFromArchitect();
    });
    
    window.App.UI.sendBtn.addEventListener('click', () => window.App.execute(false));
    window.App.UI.stopBtn.addEventListener('click', () => { if(window.App.controller) window.App.controller.abort(); VoiceManager.stopAll(); });
    
    window.App.UI.newChatBtn.addEventListener('click', () => { if(window.App.user) window.App.startNewChat(); });

    window.App.UI.charsBtn.addEventListener('click', () => { if(window.App.user) { window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); window.App.UI.charModal.classList.remove('hidden'); }});
    window.App.UI.closeCharModal.addEventListener('click', () => window.App.UI.charModal.classList.add('hidden'));
    
    window.App.UI.clearCharBtn.addEventListener('click', () => { 
        window.App.state.activeCharacter = window.App.BASE_PERSONAS[window.App.currentMode || 'chat']; 
        window.App.renderActiveCharacter(); 
    });

    window.App.UI.prompt.addEventListener('input', function() { 
        this.style.height = '50px'; 
        this.style.height = (this.scrollHeight) + 'px'; 
        const tokenEstimate = Math.ceil(this.value.length / 4);
        window.App.UI.tokenCounter.innerText = `~${tokenEstimate} tokens`;
    });
    window.App.UI.prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.App.execute(false); } });
};

window.App.initialize = async function(authenticatedUser) {
    window.App.user = authenticatedUser;
    let listenersBound = window.App.UI.prompt.getAttribute('data-bound');
    if (!listenersBound) {
        window.App.setupEventListeners();
        window.App.UI.prompt.setAttribute('data-bound', 'true');
    }
    if (!window.App.user) return;

    await window.App.loadUserSettings();
    await window.App.loadCharacters();
    await window.App.loadConversations();

    window.App.state.activeCharacter = window.App.BASE_PERSONAS[window.App.currentMode || 'chat'];
    window.App.renderActiveCharacter();

    if (!window.App.currentConversationId) await window.App.startNewChat();
    VoiceManager.init(window.App.handleTranscriptionSubmit, window.App.handleVoiceStateChange);
};
