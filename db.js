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
