window.AppChatView = {
    renderSkeleton() {
        const ui = window.AppUI.get();
        ui.chatLog.innerHTML = `
            <div class="flex-end"><div class="skeleton-msg user"></div></div>
            <div class="flex-start"><div class="skeleton-msg"></div></div>
            <div class="flex-end"><div class="skeleton-msg user"></div></div>
        `;
    },

    clearChatLog() {
        const ui = window.AppUI.get();
        ui.chatLog.innerHTML = '';
    },

    buildMessageContainer(role, messageId = null) {
        const ui = window.AppUI.get();
        const container = document.createElement('div');
        container.className = `msg-container ${role}`;
        if (messageId) {
            container.dataset.id = messageId;
        }

        const avatar = document.createElement('img');
        avatar.className = 'msg-avatar';

        const state = window.AppState.get();
        if (role === 'user') {
            avatar.src = window.AppConfig.DEFAULT_USER_AVATAR;
        } else {
            const char = state.activeCharacter;
            avatar.src = char?.avatar || window.AppConfig.DEFAULT_AI_AVATAR;
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${role}`;

        const content = document.createElement('div');
        content.className = 'content';

        container.appendChild(avatar);
        container.appendChild(msgDiv);
        msgDiv.appendChild(content);

        return { container, msgDiv, content };
    },

    renderMessage(role, content, messageId = null, options = {}) {
        const ui = window.AppUI.get();
        const { streaming = false } = options;

        const existingStreaming = streaming ? document.getElementById('streaming-container') : null;
        if (existingStreaming) {
            return existingStreaming.querySelector('.content');
        }

        const { container, msgDiv, content: contentEl } = this.buildMessageContainer(role, messageId);

        const imageUrl = window.AppMessageContent.extractImage(content);
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'multimodal-img';
            msgDiv.appendChild(img);
        }

        const text = window.AppMessageContent.extractText(content);
        const rendered = window.AppMarkdown.renderWithThink(text);
        contentEl.innerHTML = rendered;

        if (!streaming) {
            const actions = document.createElement('div');
            actions.className = 'action-row';
            window.AppMessageActions.attach(actions, role, content, messageId, container, msgDiv, contentEl);
            msgDiv.appendChild(actions);
        }

        ui.chatLog.appendChild(container);

        if (window.AppState.get('isAutoScrolling')) {
            ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
        }

        return contentEl;
    },

    updateStreamingMessage(html) {
        const streamingEl = document.getElementById('streaming-container');
        if (streamingEl) {
            const content = streamingEl.querySelector('.content');
            if (content) {
                content.innerHTML = html;
            }
            const ui = window.AppUI.get();
            if (window.AppState.get('isAutoScrolling')) {
                ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
            }
        }
    },

    finalizeStreamingMessage(messageId, content) {
        const streamingEl = document.getElementById('streaming-container');
        if (streamingEl) {
            streamingEl.id = '';
            streamingEl.dataset.id = messageId;
            const contentEl = streamingEl.querySelector('.content');
            if (contentEl) {
                const text = window.AppMessageContent.extractText(content);
                contentEl.innerHTML = window.AppMarkdown.renderWithThink(text);
            }
            const actions = document.createElement('div');
            actions.className = 'action-row';
            window.AppMessageActions.attach(
                actions,
                'assistant',
                content,
                messageId,
                streamingEl,
                streamingEl.querySelector('.msg'),
                contentEl
            );
            streamingEl.querySelector('.msg').appendChild(actions);
        }
    },

    removeStreamingMessage() {
        const streamingEl = document.getElementById('streaming-container');
        if (streamingEl) {
            streamingEl.remove();
        }
    },

    removeMessage(messageId) {
        const el = document.querySelector(`[data-id="${messageId}"]`);
        if (el) el.remove();
    },

    renderSystemMessage(text) {
        const ui = window.AppUI.get();
        const container = document.createElement('div');
        container.className = 'msg-container system';

        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg system';
        msgDiv.textContent = text;

        container.appendChild(msgDiv);
        ui.chatLog.appendChild(container);
    },

    scrollToBottom() {
        const ui = window.AppUI.get();
        ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
    },

    updateScrollState() {
        const ui = window.AppUI.get();
        const diff = ui.chatLog.scrollHeight - ui.chatLog.scrollTop - ui.chatLog.clientHeight;
        window.AppState.set('isAutoScrolling', diff < 10);
    }
};
