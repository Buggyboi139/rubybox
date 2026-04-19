window.AppChatView = {
    _streamAnimationFrame: null,
    _pendingStreamHtml: null,
    STREAM_UPDATE_INTERVAL: 16,

    renderSkeleton() {
        try {
            const ui = window.AppUI.get();
            if (!ui?.chatLog) {
                console.warn('[ChatView] Cannot render skeleton: chatLog not found');
                return;
            }
            ui.chatLog.innerHTML = `
                <div class="flex-end"><div class="skeleton-msg user"></div></div>
                <div class="flex-start"><div class="skeleton-msg"></div></div>
                <div class="flex-end"><div class="skeleton-msg user"></div></div>
            `;
        } catch (error) {
            console.error('[ChatView] Skeleton render error:', error);
        }
    },

    clearChatLog() {
        try {
            const ui = window.AppUI.get();
            if (!ui?.chatLog) {
                console.warn('[ChatView] Cannot clear chat log: chatLog not found');
                return;
            }
            ui.chatLog.innerHTML = '';
        } catch (error) {
            console.error('[ChatView] Clear chat log error:', error);
        }
    },

    buildMessageContainer(role, messageId = null, isStreaming = false) {
        const container = document.createElement('div');
        container.className = `msg-container ${role}`;
        
        if (isStreaming) {
            container.id = 'streaming-container';
        }
        
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
        try {
            const ui = window.AppUI.get();
            if (!ui?.chatLog) {
                console.warn('[ChatView] Cannot render message: chatLog not found');
                return null;
            }

            const { streaming = false, container: targetContainer, skipScroll = false } = options;

            if (streaming) {
                const existing = document.getElementById('streaming-container');
                if (existing) {
                    return existing.querySelector('.content');
                }
            }

            const { container, msgDiv, content: contentEl } = this.buildMessageContainer(role, messageId, streaming);

            const imageUrl = window.AppMessageContent.extractImage(content);
            if (imageUrl) {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.className = 'multimodal-img';
                img.onerror = () => img.remove();
                msgDiv.insertBefore(img, contentEl);
            }

            const text = window.AppMessageContent.extractText(content);
            contentEl.innerHTML = window.AppMarkdown.renderWithThink(text);

            if (!streaming) {
                const actions = document.createElement('div');
                actions.className = 'action-row';
                window.AppMessageActions.attach(actions, role, content, messageId, container, msgDiv, contentEl);
                msgDiv.appendChild(actions);
            }

            const target = targetContainer || ui.chatLog;
            target.appendChild(container);

            if (!skipScroll && window.AppState.get('isAutoScrolling')) {
                this._scrollToBottom(ui.chatLog);
            }

            return contentEl;
            
        } catch (error) {
            console.error('[ChatView] Render message error:', error);
            return null;
        }
    },

    updateStreamingMessage(html) {
        this._pendingStreamHtml = html;
        
        if (this._streamAnimationFrame !== null) {
            return;
        }

        this._streamAnimationFrame = requestAnimationFrame(() => {
            this._flushStreamingUpdate();
        });
    },

    _flushStreamingUpdate() {
        try {
            const html = this._pendingStreamHtml;
            if (html === null) {
                this._streamAnimationFrame = null;
                return;
            }

            const streamingEl = document.getElementById('streaming-container');
            if (streamingEl) {
                const content = streamingEl.querySelector('.content');
                if (content) {
                    content.innerHTML = html;
                }

                const ui = window.AppUI.get();
                if (ui?.chatLog && window.AppState.get('isAutoScrolling')) {
                    this._scrollToBottom(ui.chatLog);
                }
            }

            this._pendingStreamHtml = null;
            
        } catch (error) {
            console.error('[ChatView] Streaming update error:', error);
        } finally {
            this._streamAnimationFrame = null;
        }
    },

    finalizeStreamingMessage(messageId, content) {
        try {
            if (this._streamAnimationFrame !== null) {
                cancelAnimationFrame(this._streamAnimationFrame);
                this._flushStreamingUpdate();
            }

            const streamingEl = document.getElementById('streaming-container');
            if (!streamingEl) return;

            streamingEl.removeAttribute('id');
            streamingEl.dataset.id = messageId;

            const msgDiv = streamingEl.querySelector('.msg');
            const contentEl = streamingEl.querySelector('.content');

            if (contentEl) {
                const text = window.AppMessageContent.extractText(content);
                contentEl.innerHTML = window.AppMarkdown.renderWithThink(text);
            }

            const existingActions = msgDiv?.querySelector('.action-row');
            if (existingActions) existingActions.remove();

            const actions = document.createElement('div');
            actions.className = 'action-row';
            window.AppMessageActions.attach(
                actions,
                'assistant',
                content,
                messageId,
                streamingEl,
                msgDiv,
                contentEl
            );
            msgDiv?.appendChild(actions);

        } catch (error) {
            console.error('[ChatView] Finalize streaming message error:', error);
        }
    },

    removeStreamingMessage() {
        try {
            if (this._streamAnimationFrame !== null) {
                cancelAnimationFrame(this._streamAnimationFrame);
                this._streamAnimationFrame = null;
            }
            this._pendingStreamHtml = null;

            const streamingEl = document.getElementById('streaming-container');
            if (streamingEl) {
                streamingEl.remove();
            }
        } catch (error) {
            console.error('[ChatView] Remove streaming message error:', error);
        }
    },

    removeMessage(messageId) {
        try {
            if (!messageId) return;
            const el = document.querySelector(`[data-id="${CSS.escape(messageId)}"]`);
            if (el) {
                el.remove();
            }
        } catch (error) {
            console.error('[ChatView] Remove message error:', error);
        }
    },

    renderSystemMessage(text) {
        try {
            const ui = window.AppUI.get();
            if (!ui?.chatLog) {
                console.warn('[ChatView] Cannot render system message: chatLog not found');
                return;
            }

            const container = document.createElement('div');
            container.className = 'msg-container system';

            const msgDiv = document.createElement('div');
            msgDiv.className = 'msg system';
            msgDiv.textContent = text;

            container.appendChild(msgDiv);
            ui.chatLog.appendChild(container);
            
        } catch (error) {
            console.error('[ChatView] System message render error:', error);
        }
    },

    scrollToBottom() {
        try {
            const ui = window.AppUI.get();
            if (ui?.chatLog) {
                this._scrollToBottom(ui.chatLog);
            }
        } catch (error) {
            console.error('[ChatView] Scroll to bottom error:', error);
        }
    },

    updateScrollState() {
        try {
            const ui = window.AppUI.get();
            if (!ui?.chatLog) return;

            const { scrollHeight, scrollTop, clientHeight } = ui.chatLog;
            const diff = scrollHeight - scrollTop - clientHeight;
            window.AppState.set('isAutoScrolling', diff < 10);
        } catch (error) {
            console.error('[ChatView] Update scroll state error:', error);
        }
    },

    _scrollToBottom(element) {
        try {
            element.scrollTop = element.scrollHeight;
        } catch (error) {
            console.error('[ChatView] Scroll to bottom DOM error:', error);
        }
    }
};