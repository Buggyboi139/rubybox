window.App.startNewChat = async function() {
    window.App.state.history = [];
    window.App.UI.chatLog.innerHTML = "";
    window.App.UI.narrativePrompt.value = "";
    window.App.UI.persistMem.value = "";
    const { data } = await window.supabaseClient.from('conversations').insert([{ user_id: window.App.user.id, title: 'New Chat' }]).select().single();
    if (data) {
        window.App.currentConversationId = data.id;
        window.App.loadConversations();
    }
    window.App.UI.sidebar.classList.remove('show');
    window.App.UI.overlay.classList.remove('show');
};

window.App.loadConversationHistory = async function(convId, renderList = true) {
    if (window.App.currentConversationId !== convId || window.App.state.history.length === 0) {
        window.App.renderSkeleton();
    }
    window.App.currentConversationId = convId;
    const { data: convData } = await window.supabaseClient.from('conversations').select('*').eq('id', convId).single();
    if (convData) window.App.UI.persistMem.value = convData.summary_memory || "";

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
    if (renderList) window.App.loadConversations();
    window.App.UI.sidebar.classList.remove('show');
    window.App.UI.overlay.classList.remove('show');
};

window.App.loadUserSettings = async function() {
    if (!window.App.user) return;
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('id', window.App.user.id).single();
    if (data) {
        if (data.api_key) window.App.UI.apiKey.value = data.api_key;
        if (data.system_prompt) window.App.UI.sysPrompt.value = data.system_prompt;
        if (data.narrative_prompt) window.App.UI.narrativePrompt.value = data.narrative_prompt;
        if (data.temperature) { window.App.UI.tempSlider.value = data.temperature; window.App.UI.tempVal.textContent = data.temperature; }
        if (data.context_limit) { window.App.UI.ctxSlider.value = data.context_limit; window.App.UI.ctxVal.textContent = data.context_limit; }
        if (data.model) window.App.UI.model.value = data.model;
        if (data.voice_mode) window.App.UI.voiceMode.value = data.voice_mode;
    }
};

window.App.saveUserSettings = async function() {
    if (!window.App.user) return;
    const settings = {
        id: window.App.user.id,
        api_key: window.App.UI.apiKey.value,
        system_prompt: window.App.UI.sysPrompt.value,
        narrative_prompt: window.App.UI.narrativePrompt.value,
        temperature: parseFloat(window.App.UI.tempSlider.value),
        context_limit: parseInt(window.App.UI.ctxSlider.value),
        model: window.App.UI.model.value,
        voice_mode: window.App.UI.voiceMode.value
    };
    await window.supabaseClient.from('profiles').upsert([settings]);
    window.App.showToast('Profile saved');
};

window.App.loadCharacters = async function() {
    if (!window.App.user) return;
    const { data } = await window.supabaseClient.from('characters').select('*').eq('user_id', window.App.user.id);
    window.App.state.characters = data || [];
    window.App.renderCharacters();
};

window.App.loadConversations = async function() {
    if (!window.App.user) return;
    const { data } = await window.supabaseClient.from('conversations').select('*').eq('user_id', window.App.user.id).order('created_at', { ascending: false });
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
                <button class="chat-sidebar-btn danger del-chat-btn" data-id="${conv.id}">×</button>
            </div>
        `;
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('del-chat-btn')) return;
            window.App.loadConversationHistory(conv.id);
        });
        div.querySelector('.del-chat-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.supabaseClient.from('conversations').delete().eq('id', conv.id);
            if (window.App.currentConversationId === conv.id) window.App.startNewChat();
            else window.App.loadConversations();
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
