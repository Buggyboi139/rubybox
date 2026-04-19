window.AppBranchChat = {
    async open(text, messageId, containerConversationId) {
        const editContainer = document.createElement('div');
        editContainer.className = 'inline-edit-container';

        const ta = document.createElement('textarea');
        ta.className = 'glass-input inline-edit-ta';
        ta.value = text;

        const btnRow = document.createElement('div');
        btnRow.className = 'action-row';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn action-inline-btn';
        cancelBtn.innerText = 'Cancel';
        cancelBtn.onclick = () => editContainer.remove();

        const submitBtn = document.createElement('button');
        submitBtn.className = 'primary-btn action-inline-btn';
        submitBtn.innerText = 'Branch';
        submitBtn.onclick = () => this._createBranch(ta.value.trim(), messageId, containerConversationId);

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(submitBtn);
        editContainer.appendChild(ta);
        editContainer.appendChild(btnRow);

        const target = document.querySelector(`[data-id="${messageId}"] .msg`);
        if (target) {
            const content = target.querySelector('.content');
            if (content) target.replaceChild(editContainer, content);
        }
    },

    async _createBranch(branchText, sourceMessageId, sourceConversationId) {
        const user = window.AppState.get('user');
        if (!user) return;

        const history = window.AppState.getHistory();
        const sourceIndex = history.findIndex(m => m.id === sourceMessageId);
        if (sourceIndex === -1) return;

        const historyToKeep = history.slice(0, sourceIndex + 1);
        const currentMode = window.AppState.get('currentMode') || 'chat';
        const activeChar = window.AppState.get('activeCharacter');
        const charId = activeChar?.id && !activeChar.id.startsWith('base-') ? activeChar.id : null;

        const { data: newConv } = await window.AppConversationsService.create({
            title: 'Branched Chat',
            mode: currentMode,
            character_id: charId
        });

        if (!newConv) return;

        window.AppState.set('currentConversationId', newConv.id);
        window.AppState.clearHistory();
        window.AppChatView.clearChatLog();

        for (const oldMsg of historyToKeep) {
            const dbContent = window.AppMessageContent.serializeForDB(oldMsg.content);
            const { data: msgData } = await window.AppMessagesService.create({
                conversation_id: newConv.id,
                role: oldMsg.role,
                content: dbContent
            });

            if (msgData) {
                window.AppState.addMessage({
                    id: msgData.id,
                    role: oldMsg.role,
                    content: oldMsg.content,
                    conversation_id: newConv.id
                });
                window.AppChatView.renderMessage(oldMsg.role, oldMsg.content, msgData.id);
            }
        }

        const ui = window.AppUI.get();
        ui.prompt.value = branchText;
        ui.prompt.style.height = 'auto';
        ui.prompt.style.height = ui.prompt.scrollHeight + 'px';

        await window.AppFeaturesChat.loadConversationList();
        await window.AppFeaturesChat.execute();
    },

    editUserMessage(messageId) {
        const history = window.AppState.getHistory();
        const index = history.findIndex(m => m.id === messageId);
        if (index === -1) return;

        const msg = history[index];
        const ui = window.AppUI.get();
        ui.prompt.value = window.AppMessageContent.extractText(msg.content);
        ui.prompt.style.height = 'auto';
        ui.prompt.style.height = ui.prompt.scrollHeight + 'px';

        const toDelete = history.slice(index);
        toDelete.forEach(async m => {
            if (m.id) await window.AppMessagesService.delete(m.id);
        });
        
        window.AppState.set('history', history.slice(0, index));

        const containerEl = document.querySelector(`[data-id="${CSS.escape(messageId)}"]`);
        if (containerEl) {
            while (containerEl.nextSibling) {
                containerEl.nextSibling.remove();
            }
            containerEl.remove();
        }
    },

    editAssistantMessage(messageId, content, msgDiv, contentEl) {
        const originalText = window.AppMessageContent.extractText(content);

        const editContainer = document.createElement('div');
        editContainer.className = 'inline-edit-container';

        const ta = document.createElement('textarea');
        ta.className = 'glass-input inline-edit-ta';
        ta.value = originalText;

        const btnRow = document.createElement('div');
        btnRow.className = 'action-row';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn action-inline-btn';
        cancelBtn.innerText = 'Cancel';
        cancelBtn.onclick = () => msgDiv.replaceChild(contentEl, editContainer);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'primary-btn action-inline-btn';
        saveBtn.innerText = 'Save';
        saveBtn.onclick = async () => {
            const newText = ta.value.trim();
            if (!newText) return;

            await window.AppMessagesService.update(messageId, newText);
            window.AppState.updateMessage(messageId, { content: newText });

            contentEl.innerHTML = window.AppMarkdown.renderWithThink(newText);
            msgDiv.replaceChild(contentEl, editContainer);
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        editContainer.appendChild(ta);
        editContainer.appendChild(btnRow);

        msgDiv.replaceChild(editContainer, contentEl);
    }
};