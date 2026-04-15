window.App.startNewChat = async function() {
    window.App.currentConversationId = null;
    window.App.state.history = [];
    window.App.UI.chatLog.innerHTML = "";
    window.App.UI.persistMem.value = "";
    
    document.querySelectorAll('.chat-sidebar-item').forEach(el => {
        el.classList.remove('active');
    });

    const currentMode = window.App.currentMode || 'chat';
    const favChar = window.App.state.characters.find(c => c.is_favorite && c.mode === currentMode);
    window.App.state.activeCharacter = favChar || window.App.BASE_PERSONAS[currentMode];
    window.App.renderActiveCharacter();

    if (window.App.state.activeCharacter) {
        window.App.addMessage('assistant', `*${window.App.state.activeCharacter.name} is ready.*`);
    }
    
    window.App.UI.sidebar.classList.remove('show');
    window.App.UI.overlay.classList.remove('show');
};

window.App.loadConversationHistory = async function(convId, renderList = true) {
    if (window.App.currentConversationId !== convId) {
        window.App.renderSkeleton();
    }
    window.App.currentConversationId = convId;
    const { data: convData } = await window.supabaseClient.from('conversations').select('*').eq('id', convId).single();
    
    if (convData) {
        window.App.UI.persistMem.value = DOMPurify.sanitize(convData.summary_memory || "");
        if (convData.character_id) {
            const char = window.App.state.characters.find(c => c.id === convData.character_id);
            window.App.state.activeCharacter = char || window.App.BASE_PERSONAS[convData.mode || window.App.currentMode];
        } else {
            window.App.state.activeCharacter = window.App.BASE_PERSONAS[convData.mode || window.App.currentMode];
        }
        window.App.renderActiveCharacter();
    }

    const { data } = await window.supabaseClient.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    window.App.state.history = [];
    window.App.UI.chatLog.innerHTML = "";
    if (data) {
        data.forEach(msg => {
            let parsedContent = msg.content;
            try { parsedContent = JSON.parse(msg.content); } catch(e) {}
            window.App.state.history.push({ role: msg.role, content: parsedContent, id: msg.id });
            window.App.addMessage(msg.role, parsedContent, false, msg.id);
        });
    }
    if (renderList) await window.App.loadConversations();
    window.App.UI.sidebar.classList.remove('show');
    window.App.UI.overlay.classList.remove('show');
};

window.App.loadUserSettings = async function() {
    if (!window.App.user) return;
    const { data } = await window.supabaseClient.from('user_settings').select('*').eq('user_id', window.App.user.id).single();
    if (data) {
        window.App.settingsData = data;
        if (data.encrypted_api_key) window.App.UI.apiKey.value = DOMPurify.sanitize(data.encrypted_api_key);
        if (data.google_tts_key) window.App.UI.googleTtsKey.value = DOMPurify.sanitize(data.google_tts_key);
        if (data.google_tts_voice) window.App.UI.googleVoiceSelect.value = DOMPurify.sanitize(data.google_tts_voice);
        if (data.temperature) { window.App.UI.tempSlider.value = data.temperature; window.App.UI.tempVal.textContent = data.temperature; }
        if (data.context_limit) { window.App.UI.ctxSlider.value = data.context_limit; window.App.UI.ctxVal.textContent = data.context_limit; }
        if (data.max_tokens) { window.App.UI.maxTokensSlider.value = data.max_tokens; window.App.UI.maxTokensVal.textContent = data.max_tokens; }
        if (data.default_model) window.App.UI.model.value = DOMPurify.sanitize(data.default_model);
        if (data.voice_mode) window.App.UI.voiceMode.value = DOMPurify.sanitize(data.voice_mode);
        window.App.applyModeSettings();
    }
};

window.App.applyModeSettings = function() {
    if (!window.App.settingsData) return;
    const data = window.App.settingsData;
    if (window.App.currentMode === 'code') {
        window.App.UI.sysPrompt.value = DOMPurify.sanitize(data.system_prompt_code || '');
        window.App.UI.narrativePrompt.value = DOMPurify.sanitize(data.narrative_prompt_code || '');
    } else if (window.App.currentMode === 'nsfw') {
        window.App.UI.sysPrompt.value = DOMPurify.sanitize(data.system_prompt_nsfw || '');
        window.App.UI.narrativePrompt.value = DOMPurify.sanitize(data.narrative_prompt_nsfw || '');
    } else {
        window.App.UI.sysPrompt.value = DOMPurify.sanitize(data.system_prompt || '');
        window.App.UI.narrativePrompt.value = DOMPurify.sanitize(data.narrative_prompt || '');
    }
};

window.App.saveUserSettings = async function() {
    if (!window.App.user) return;
    const currentMode = window.App.currentMode || 'chat';
    const settings = {
        user_id: window.App.user.id,
        encrypted_api_key: window.App.UI.apiKey.value,
        google_tts_key: window.App.UI.googleTtsKey.value,
        google_tts_voice: window.App.UI.googleVoiceSelect.value,
        temperature: parseFloat(window.App.UI.tempSlider.value),
        context_limit: parseInt(window.App.UI.ctxSlider.value),
        max_tokens: parseInt(window.App.UI.maxTokensSlider.value),
        default_model: window.App.UI.model.value,
        voice_mode: window.App.UI.voiceMode.value
    };

    if (currentMode === 'code') {
        settings.system_prompt_code = window.App.UI.sysPrompt.value;
        settings.narrative_prompt_code = window.App.UI.narrativePrompt.value;
    } else if (currentMode === 'nsfw') {
        settings.system_prompt_nsfw = window.App.UI.sysPrompt.value;
        settings.narrative_prompt_nsfw = window.App.UI.narrativePrompt.value;
    } else {
        settings.system_prompt = window.App.UI.sysPrompt.value;
        settings.narrative_prompt = window.App.UI.narrativePrompt.value;
    }

    if (window.App.settingsData) {
        window.App.settingsData = { ...window.App.settingsData, ...settings };
    } else {
        window.App.settingsData = settings;
    }

    const { error } = await window.supabaseClient.from('user_settings').upsert(settings, { onConflict: 'user_id' });
    if (error) {
        window.App.showToast(error.message, "error");
    } else {
        window.App.showToast('Profile saved');
    }
};

window.App.loadCharacters = async function() {
    if (!window.App.user) return;
    const currentMode = window.App.currentMode || 'chat';
    const { data } = await window.supabaseClient.from('characters')
        .select('*')
        .eq('user_id', window.App.user.id)
        .eq('mode', currentMode)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });
    window.App.state.characters = data || [];
    window.App.renderCharacters();
};

window.App.loadConversations = async function() {
    if (!window.App.user) return;
    const currentMode = window.App.currentMode || 'chat';
    const { data } = await window.supabaseClient.from('conversations').select('*').eq('user_id', window.App.user.id).eq('mode', currentMode).order('created_at', { ascending: false });
    window.App.UI.conversationsList.innerHTML = "";
    const searchTerm = window.App.UI.chatSearch ? window.App.UI.chatSearch.value.toLowerCase() : "";
    
    (data || []).forEach(conv => {
        if (searchTerm && !conv.title.toLowerCase().includes(searchTerm)) return;
        const div = document.createElement('div');
        div.className = `chat-sidebar-item ${conv.id === window.App.currentConversationId ? 'active' : ''}`;
        div.innerHTML = `
            <div class="chat-sidebar-info">
                <div class="chat-sidebar-title">${DOMPurify.sanitize(conv.title || 'New Chat')}</div>
            </div>
            <div class="chat-sidebar-actions">
                <button class="chat-sidebar-btn danger del-chat-btn" data-id="${DOMPurify.sanitize(conv.id)}">×</button>
            </div>
        `;
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('del-chat-btn')) return;
            window.App.loadConversationHistory(conv.id);
        });
        div.querySelector('.del-chat-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.supabaseClient.from('conversations').delete().eq('id', conv.id);
            if (window.App.currentConversationId === conv.id) await window.App.startNewChat();
            else await window.App.loadConversations();
        });
        window.App.UI.conversationsList.appendChild(div);
    });
};

window.App.uploadImageToStorage = async function(base64Data) {
    if (!window.App.user) return null;
    const response = await fetch(base64Data);
    const blob = await response.blob();
    const fileName = `${window.App.user.id}_${Date.now()}.jpg`;
    const { data, error } = await window.supabaseClient.storage.from('chat_images').upload(fileName, blob);
    if (error) return null;
    const { data: urlData } = window.supabaseClient.storage.from('chat_images').getPublicUrl(fileName);
    return urlData.publicUrl;
};
