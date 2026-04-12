window.App.handleTranscriptionSubmit = function(text) {
    window.App.UI.prompt.value = text.trim();
    if (window.App.UI.prompt.value) window.App.execute(true);
};

window.App.setupEventListeners = function() {
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
    window.App.UI.overlay.addEventListener('click', () => { window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); });

    window.App.UI.profileBtn.addEventListener('click', () => { window.App.UI.profileModal.classList.remove('hidden'); window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); });
    window.App.UI.closeProfileModal.addEventListener('click', () => window.App.UI.profileModal.classList.add('hidden'));
    window.App.UI.saveProfileBtn.addEventListener('click', () => { window.App.saveUserSettings(); window.App.UI.profileModal.classList.add('hidden'); });

    window.App.UI.sysPrompt.addEventListener('change', window.App.saveUserSettings);
    window.App.UI.narrativePrompt.addEventListener('change', window.App.saveUserSettings);
    window.App.UI.apiKey.addEventListener('change', window.App.saveUserSettings);
    window.App.UI.tempSlider.addEventListener('input', (e) => { window.App.UI.tempVal.textContent = e.target.value; window.App.saveUserSettings(); });
    window.App.UI.ctxSlider.addEventListener('input', (e) => { window.App.UI.ctxVal.textContent = e.target.value; window.App.saveUserSettings(); });
    window.App.UI.model.addEventListener('change', window.App.saveUserSettings);
    window.App.UI.voiceMode.addEventListener('change', window.App.saveUserSettings);
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
        window.App.UI.voiceSheet.classList.remove('hidden');
        setTimeout(() => window.App.UI.voiceSheet.classList.add('show'), 10);
        VoiceManager.startListening();
    });

    window.App.UI.exportBtn.addEventListener('click', window.App.exportChat);
    window.App.UI.sendBtn.addEventListener('click', () => window.App.execute(false));
    window.App.UI.stopBtn.addEventListener('click', () => { if(window.App.controller) window.App.controller.abort(); VoiceManager.stopAll(); });
    
    window.App.UI.newChatBtn.addEventListener('click', () => { if(window.App.user) window.App.startNewChat(); });

    window.App.UI.charsBtn.addEventListener('click', () => { if(window.App.user) { window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); window.App.UI.charModal.classList.remove('hidden'); }});
    window.App.UI.closeCharModal.addEventListener('click', () => window.App.UI.charModal.classList.add('hidden'));
    window.App.UI.clearCharBtn.addEventListener('click', () => { window.App.state.activeCharacter = null; window.App.renderActiveCharacter(); });

    window.App.UI.saveCharBtn.addEventListener('click', async () => {
        if (!window.App.user) {
            window.App.showToast("Please sign in first.", "error");
            return;
        }
        const name = window.App.UI.newCharName.value.trim();
        const avatar = window.App.newCharAvatarBase64 || '';
        const prompt = window.App.UI.newCharPrompt.value.trim();
        if (name && prompt && window.App.user) {
            const { error } = await window.supabaseClient.from('characters').insert([{ user_id: window.App.user.id, name, avatar, system_prompt: prompt }]);
            if (error) return window.App.showToast(error.message, "error");
            window.App.UI.newCharName.value = ""; window.App.UI.newCharPrompt.value = ""; window.App.newCharAvatarBase64 = null;
            window.App.UI.newCharAvatarPreview.style.display = 'none'; window.App.UI.newCharAvatarPreview.src = '';
            window.App.loadCharacters();
            window.App.showToast("Persona saved");
        }
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

    if (!window.App.currentConversationId) await window.App.startNewChat();
    VoiceManager.init(window.App.handleTranscriptionSubmit, window.App.handleVoiceStateChange);
};
