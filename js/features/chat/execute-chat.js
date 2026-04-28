window.AppFeaturesChat = {
    async loadConversation(convId) {
        const currentId = window.AppState.get('currentConversationId');
        if (currentId !== convId) {
            window.AppChatView.renderSkeleton();
        }

        window.AppState.set('currentConversationId', convId);

        const { data: convData } = await window.AppConversationsService.get(convId);
        if (convData) {
            const ui = window.AppUI.get();
            if (ui.persistMem) {
                ui.persistMem.value = DOMPurify.sanitize(convData.summary_memory || '');
            }

            let activeChar = null;
            if (convData.character_id) {
                const chars = window.AppState.get('characters');
                activeChar = chars?.find(c => c.id === convData.character_id);
            }
            if (!activeChar) {
                activeChar = window.AppConfig.BASE_PERSONAS[convData.mode || window.AppState.get('currentMode')];
            }
            window.AppState.set('activeCharacter', activeChar);
            window.AppCharacterView.renderActiveCharacter();
        }

        const { data: msgs } = await window.AppMessagesService.list(convId);
        window.AppState.clearHistory();
        window.AppChatView.clearChatLog();

        if (msgs && msgs.length > 0) {
            const fragment = document.createDocumentFragment();
            msgs.forEach(msg => {
                let content = msg.content;
                try { 
                    content = JSON.parse(msg.content); 
                } catch (e) {
                }
                window.AppState.addMessage({
                    id: msg.id,
                    role: msg.role,
                    content,
                    conversation_id: convId
                });
                window.AppChatView.renderMessage(msg.role, content, msg.id, { container: fragment, skipScroll: true });
            });
            window.AppUI.get().chatLog.appendChild(fragment);
            window.AppChatView.scrollToBottom();
        }

        window.AppSidebar.setActiveConversation(convId);
        window.AppModals.toggleSidebar(false);
    }
};