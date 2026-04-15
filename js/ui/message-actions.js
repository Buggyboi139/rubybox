window.AppMessageActions = {
    attach(actionsContainer, role, content, messageId, container, msgDiv, contentEl) {
        this._addCopyButton(actionsContainer, content);
        this._addBranchButton(actionsContainer, content, messageId, container, msgDiv, contentEl);
        this._addEditButton(actionsContainer, role, content, messageId, container, msgDiv, contentEl);
        this._addDeleteButton(actionsContainer, messageId, container);

        if (role === 'assistant') {
            this._addRegenerateButton(actionsContainer, messageId, container);
        }
    },

    _addCopyButton(container, content) {
        const btn = document.createElement('button');
        btn.className = 'action-icon-btn';
        btn.innerHTML = '⎘';
        btn.title = 'Copy';
        btn.onclick = () => {
            const text = window.AppMessageContent.extractText(content);
            navigator.clipboard.writeText(text);
            window.AppToasts.show('Copied to clipboard');
        };
        container.appendChild(btn);
    },

    _addBranchButton(container, content, messageId, containerEl, msgDiv, contentEl) {
        const btn = document.createElement('button');
        btn.className = 'action-icon-btn';
        btn.innerHTML = '⑂';
        btn.title = 'Branch';
        btn.onclick = () => {
            const text = window.AppMessageContent.extractText(content);
            window.AppBranchChat.open(text, messageId, containerEl.dataset.id);
        };
        container.appendChild(btn);
    },

    _addEditButton(container, role, content, messageId, containerEl, msgDiv, contentEl) {
        const btn = document.createElement('button');
        btn.className = 'action-icon-btn';
        btn.innerHTML = '✎';
        btn.title = 'Edit & Redo';
        btn.onclick = () => {
            if (role === 'user') {
                window.AppBranchChat.editUserMessage(messageId);
            } else {
                window.AppBranchChat.editAssistantMessage(messageId, content, msgDiv, contentEl);
            }
        };
        container.appendChild(btn);
    },

    _addDeleteButton(container, messageId, containerEl) {
        const btn = document.createElement('button');
        btn.className = 'action-icon-btn danger';
        btn.innerHTML = '×';
        btn.title = 'Delete';
        btn.onclick = async () => {
            await window.AppFeaturesChat.deleteMessage(messageId);
            containerEl.remove();
        };
        container.appendChild(btn);
    },

    _addRegenerateButton(container, messageId, containerEl) {
        const btn = document.createElement('button');
        btn.className = 'action-icon-btn';
        btn.innerHTML = '↻';
        btn.title = 'Redo';
        btn.onclick = async () => {
            await window.AppFeaturesChat.regenerateFromMessage(messageId, containerEl);
        };
        container.appendChild(btn);
    }
};
