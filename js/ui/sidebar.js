window.AppSidebar = {
    renderConversations(conversations, activeId = null) {
        const ui = window.AppUI.get();
        ui.conversationsList.innerHTML = '';

        const searchTerm = ui.chatSearch?.value?.toLowerCase() || '';
        const fragment = document.createDocumentFragment();

        conversations.forEach(conv => {
            if (searchTerm && !conv.title?.toLowerCase().includes(searchTerm)) return;

            const item = document.createElement('div');
            item.className = `chat-sidebar-item ${conv.id === activeId ? 'active' : ''}`;
            item.dataset.id = conv.id;

            item.innerHTML = `
                <div class="chat-sidebar-info">
                    <div class="chat-sidebar-title">${DOMPurify.sanitize(conv.title || 'New Chat')}</div>
                </div>
                <div class="chat-sidebar-actions">
                    <button class="chat-sidebar-btn danger del-chat-btn" data-id="${DOMPurify.sanitize(conv.id)}">×</button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('del-chat-btn')) return;
                window.AppFeaturesChat.loadConversation(conv.id);
            });

            item.querySelector('.del-chat-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.AppConversationsService.delete(conv.id);
                if (window.AppState.get('currentConversationId') === conv.id) {
                    await window.AppFeaturesChat.startNewChat();
                }
                await window.AppFeaturesChat.loadConversationList();
            });

            fragment.appendChild(item);
        });
        
        ui.conversationsList.appendChild(fragment);
    },

    setActiveConversation(id) {
        document.querySelectorAll('.chat-sidebar-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });
    }
};