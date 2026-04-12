window.App.loadUserSettings = async function() {
    const { data } = await window.supabaseClient.from('user_settings').select('*').eq('user_id', window.App.user.id).single();
    if (data) {
        window.App.state.settings.temperature = data.temperature ?? 0.7;
        window.App.state.settings.contextLimit = data.context_limit ?? 10;
        if(data.default_model) window.App.state.settings.defaultModel = data.default_model;
        if(data.encrypted_api_key) window.App.UI.apiKey.value = data.encrypted_api_key; 
        if(data.system_prompt) window.App.UI.sysPrompt.value = data.system_prompt;
        if(data.narrative_prompt) window.App.UI.narrativePrompt.value = data.narrative_prompt;
        if(data.voice_mode) window.App.state.settings.voiceMode = data.voice_mode;
    }
    window.App.UI.tempSlider.value = window.App.state.settings.temperature;
    window.App.UI.tempVal.textContent = window.App.state.settings.temperature;
    window.App.UI.ctxSlider.value = window.App.state.settings.contextLimit;
    window.App.UI.ctxVal.textContent = window.App.state.settings.contextLimit;
    window.App.UI.model.value = window.App.state.settings.defaultModel;
    window.App.UI.voiceMode.value = window.App.state.settings.voiceMode;
};

window.App.saveUserSettings = async function() {
    if (!window.App.user) return;
    window.App.state.settings.voiceMode = window.App.UI.voiceMode.value;
    await window.supabaseClient.from('user_settings').upsert({
        user_id: window.App.user.id,
        temperature: parseFloat(window.App.UI.tempSlider.value),
        context_limit: parseInt(window.App.UI.ctxSlider.value),
        default_model: window.App.UI.model.value,
        encrypted_api_key: window.App.UI.apiKey.value,
        system_prompt: window.App.UI.sysPrompt.value,
        narrative_prompt: window.App.UI.narrativePrompt.value,
        voice_mode: window.App.state.settings.voiceMode
    });
};

window.App.uploadImageToStorage = async function(base64) {
    if (!base64) return null;
    try {
        const res = await fetch(base64);
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'png';
        const fileName = `${window.App.user.id}/${Date.now()}.${ext}`;
        const { error } = await window.supabaseClient.storage.from('chat-images').upload(fileName, blob);
        if (error) throw error;
        const { data } = window.supabaseClient.storage.from('chat-images').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        return base64;
    }
};

window.App.loadCharacters = async function() {
    const { data } = await window.supabaseClient.from('characters').select('*').eq('user_id', window.App.user.id).order('created_at', { ascending: false });
    if (data) { window.App.state.characters = data; window.App.renderCharacters(); }
};

window.App.loadConversations = async function() {
    const { data } = await window.supabaseClient.from('conversations').select('*').eq('user_id', window.App.user.id).order('updated_at', { ascending: false });
    window.App.UI.conversationsList.innerHTML = "";
    if (data && data.length > 0) {
        if (!window.App.currentConversationId || !data.find(c => c.id === window.App.currentConversationId)) window.App.currentConversationId = data[0].id;
        
        const filterText = window.App.UI.chatSearch.value.toLowerCase();
        
        data.forEach(conv => {
            if (filterText && !conv.title.toLowerCase().includes(filterText)) return;
            const div = document.createElement('div');
            div.className = `chat-sidebar-item ${conv.id === window.App.currentConversationId ? 'active' : ''}`;
            div.dataset.id = conv.id;
            div.innerHTML = `
                <div class="chat-sidebar-info" onclick="window.App.loadConversationHistory('${conv.id}')">
                    <div class="chat-sidebar-title">${DOMPurify.sanitize(conv.title)}</div>
                    <div class="chat-sidebar-date">${new Date(conv.updated_at).toLocaleDateString()}</div>
                </div>
                <div class="chat-sidebar-actions">
                    <button class="chat-sidebar-btn" title="Fork Chat" onclick="event.stopPropagation(); window.App.forkChat('${conv.id}')">⑂</button>
                    <button class="chat-sidebar-btn" title="Copy Chat" onclick="event.stopPropagation(); window.App.copyChat('${conv.id}')">⎘</button>
                    <button class="chat-sidebar-btn danger" title="Delete Chat" onclick="event.stopPropagation(); window.App.deleteChat('${conv.id}')">&times;</button>
                </div>
            `;
            window.App.UI.conversationsList.appendChild(div);
        });
        if (window.App.currentConversationId) window.App.loadConversationHistory(window.App.currentConversationId, false);
    } else {
        await window.App.startNewChat();
    }
};

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
    if(window.innerWidth <= 768) { window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); }
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
    if(window.innerWidth <= 768) { window.App.UI.sidebar.classList.remove('show'); window.App.UI.overlay.classList.remove('show'); }
};

window.App.forkChat = async function(convId) {
    if(!window.App.user) return;
    const { data: oldMsgs } = await window.supabaseClient.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    const { data: convData } = await window.supabaseClient.from('conversations').insert([{ user_id: window.App.user.id, title: 'Forked Chat' }]).select().single();
    if (convData && oldMsgs) {
        for (const msg of oldMsgs) {
            await window.supabaseClient.from('messages').insert([{ conversation_id: convData.id, user_id: window.App.user.id, role: msg.role, content: msg.content }]);
        }
        window.App.loadConversationHistory(convData.id);
    }
};

window.App.copyChat = async function(convId) {
    const { data } = await window.supabaseClient.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    if (data) {
        let text = data.map(m => {
            let txt = m.content;
            if (Array.isArray(txt)) txt = txt.find(c => c.type === 'text')?.text || '';
            return `**${m.role.toUpperCase()}**:\n${txt}\n`;
        }).join('\n---\n');
        navigator.clipboard.writeText(text);
        window.App.showToast("Chat copied to clipboard.");
    }
};

window.App.deleteChat = async function(convId) {
    if(!confirm("Delete this chat permanently?")) return;
    await window.supabaseClient.from('conversations').delete().eq('id', convId);
    if (window.App.currentConversationId === convId) window.App.currentConversationId = null;
    window.App.loadConversations();
};
