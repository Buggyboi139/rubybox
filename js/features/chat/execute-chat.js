window.AppFeaturesChat = {
    async execute(fromVoice = false) {
        const user = window.AppState.get('user');
        if (!user) {
            window.AppToasts.show('Please sign in first.', 'error');
            return;
        }

        if (window.AppState.get('isExecuting')) return;

        const requestId = window.AppState.incrementRequestId();
        window.AppState.setExecutionState(true);
        this._updateSendStopButtons(true);

        try {
            await this._executeCore(requestId, fromVoice);
        } catch (e) {
            if (e.name !== 'AbortError') {
                window.AppToasts.show(`ERROR: ${e.message}`, 'error');
                window.AppChatView.renderSystemMessage(`ERROR: ${e.message}`);
            }
        } finally {
            window.AppState.setExecutionState(false);
            this._updateSendStopButtons(false);
            window.AppState.set('controller', null);
        }
    },

    async _executeCore(requestId, fromVoice) {
        const ui = window.AppUI.get();
        const input = ui.prompt.value.trim();
        const attachedImage = window.AppState.get('attachedImageBase64');
        const state = window.AppState.get();

        let activeChar = state.activeCharacter;
        if (!activeChar) {
            activeChar = window.AppConfig.BASE_PERSONAS[state.currentMode] || window.AppConfig.BASE_PERSONAS.chat;
            window.AppState.set('activeCharacter', activeChar);
        }

        let contentPayload = input;
        if (attachedImage) {
            contentPayload = [];
            if (input) contentPayload.push({ type: 'text', text: input });
            const imageUrl = await this._uploadAttachedImage(attachedImage);
            if (!imageUrl) {
                window.AppToasts.show('Image upload failed.', 'error');
                return;
            }
            contentPayload.push({ type: 'image_url', image_url: { url: imageUrl } });
        }

        const conversationId = await this._ensureConversationExists(contentPayload, activeChar);
        if (!conversationId) return;

        const { data: userMsg, error: userError } = await window.AppMessagesService.create({
            conversation_id: conversationId,
            role: 'user',
            content: contentPayload
        });

        if (userError) throw userError;

        window.AppState.addMessage({
            id: userMsg.id,
            role: 'user',
            content: contentPayload,
            conversation_id: conversationId
        });

        window.AppChatView.renderMessage('user', contentPayload, userMsg.id);

        if (window.AppState.getHistory().length === 1) {
            window.AppLLMService.generateTitle(input, conversationId);
            await this.loadConversationList();
        }

        ui.prompt.value = '';
        ui.prompt.style.height = '50px';
        ui.tokenCounter.innerText = '~0 tokens';
        if (!fromVoice) {
            this._clearImageAttachment();
        }

        const controller = new AbortController();
        window.AppState.set('controller', controller);

        const streamContentEl = window.AppChatView.renderMessage('assistant', '', null, { streaming: true });
        window.AppState.setStreamingMessageId(null);

        let fullText = '';
        const messages = this._buildMessages(activeChar);

        const onChunk = (delta, text) => {
            if (window.AppState.getLastRequestId() !== requestId) return;
            fullText = text;
            const rendered = window.AppMarkdown.renderWithThink(text);
            streamContentEl.innerHTML = rendered;
            if (fromVoice) {
                window.AppVoiceManager.receiveDelta(delta);
            }
        };

        const onComplete = (text) => {
            if (window.AppState.getLastRequestId() !== requestId) return;
            fullText = text;
        };

        const result = await window.AppLLMService.streamComplete({
            model: ui.model.value,
            temperature: parseFloat(ui.tempSlider.value),
            max_tokens: parseInt(ui.maxTokensSlider.value) || 2000,
            messages,
            signal: controller.signal,
            onChunk,
            onComplete
        });

        if (result.error) throw result.error;

        window.AppChatView.removeStreamingMessage();

        if (fromVoice) {
            window.AppVoiceManager.commitBuffer();
            window.AppVoiceManager.markStreamComplete();
        }

        const { data: aiMsg, error: aiError } = await window.AppMessagesService.create({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullText
        });

        if (aiError) throw aiError;

        window.AppState.addMessage({
            id: aiMsg.id,
            role: 'assistant',
            content: fullText,
            conversation_id: conversationId
        });

        window.AppChatView.renderMessage('assistant', fullText, aiMsg.id);
    },

    async _ensureConversationExists(content, activeChar) {
        let convId = window.AppState.get('currentConversationId');

        if (!convId) {
            const ui = window.AppUI.get();
            const text = window.AppMessageContent.extractText(content);
            const title = text
                ? window.AppUtils.truncateText(text, 30)
                : 'New Chat';

            const charId = activeChar?.id && !activeChar.id.startsWith('base-') ? activeChar.id : null;

            const { data: newConv, error } = await window.AppConversationsService.create({
                title,
                summary_memory: ui.persistMem?.value?.trim() || '',
                mode: window.AppState.get('currentMode'),
                character_id: charId
            });

            if (error) {
                window.AppToasts.show('Failed to create chat', 'error');
                return null;
            }

            convId = newConv.id;
            window.AppState.set('currentConversationId', convId);
        }

        return convId;
    },

    async _uploadAttachedImage(base64Data) {
        const result = await window.AppStorageService.uploadImage(base64Data, 'attach');
        return result.data;
    },

    _buildMessages(activeChar) {
        const ui = window.AppUI.get();
        const limit = parseInt(ui.ctxSlider?.value || 10);
        const history = window.AppState.getHistory().slice(-limit);

        const activeCharPrompt = activeChar ? activeChar.system_prompt + '\n\n' : '';
        const systemContent = [
            activeCharPrompt,
            ui.sysPrompt?.value || '',
            '\n[NARRATIVE CONTEXT]\n',
            ui.narrativePrompt?.value || '',
            '\n[PERSISTENT MEMORY]\n',
            ui.persistMem?.value || ''
        ].join('');

        const messages = [{ role: 'system', content: systemContent }];
        history.forEach(m => {
            messages.push({ role: m.role, content: m.content });
        });

        return messages;
    },

    _updateSendStopButtons(isExecuting) {
        const ui = window.AppUI.get();
        if (isExecuting) {
            ui.stopBtn?.classList.remove('hidden');
            ui.sendBtn?.classList.add('hidden');
        } else {
            ui.stopBtn?.classList.add('hidden');
            ui.sendBtn?.classList.remove('hidden');
        }
    },

    _clearImageAttachment() {
        window.AppState.set('attachedImageBase64', null);
        const ui = window.AppUI.get();
        ui.imagePreview.src = '';
        ui.imagePreviewContainer?.classList.add('hidden');
        ui.imageUpload.value = '';
    },

    stop() {
        const controller = window.AppState.get('controller');
        if (controller) controller.abort();
        window.AppVoiceManager?.stopAll();
    },

    async loadConversationList() {
        const { data, error } = await window.AppConversationsService.list();
        if (error) return;

        window.AppState.set('conversations', data || []);
        window.AppSidebar.renderConversations(data || [], window.AppState.get('currentConversationId'));
    },

    async loadConversation(convId) {
        const currentId = window.AppState.get('currentConversationId');
        if (currentId !== convId) {
            window.AppChatView.renderSkeleton();
        }

        window.AppState.set('currentConversationId', convId);

        const { data: convData } = await window.AppConversationsService.get(convId);
        if (convData) {
            const ui = window.AppUI.get();
            if (ui.persistMem) ui.persistMem.value = DOMPurify.sanitize(convData.summary_memory || '');

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

        if (msgs) {
            msgs.forEach(msg => {
                let content = msg.content;
                try { content = JSON.parse(msg.content); } catch {}
                window.AppState.addMessage({
                    id: msg.id,
                    role: msg.role,
                    content,
                    conversation_id: convId
                });
                window.AppChatView.renderMessage(msg.role, content, msg.id);
            });
        }

        window.AppSidebar.setActiveConversation(convId);
        window.AppModals.toggleSidebar(false);
    },

    async startNewChat() {
        window.AppState.set('currentConversationId', null);
        window.AppState.clearHistory();
        window.AppChatView.clearChatLog();

        const ui = window.AppUI.get();
        if (ui.persistMem) ui.persistMem.value = '';

        document.querySelectorAll('.chat-sidebar-item').forEach(el => el.classList.remove('active'));

        const mode = window.AppState.get('currentMode');
        let activeChar = window.AppState.get('activeCharacter');
        if (!activeChar || activeChar.mode !== mode) {
            activeChar = window.AppConfig.BASE_PERSONAS[mode] || window.AppConfig.BASE_PERSONAS.chat;
            window.AppState.set('activeCharacter', activeChar);
        }

        window.AppCharacterView.renderActiveCharacter();

        if (activeChar) {
            const initMsg = `*${activeChar.name} is ready.*`;
            window.AppChatView.renderSystemMessage(initMsg);
        }

        window.AppModals.toggleSidebar(false);
    },

    async deleteMessage(messageId) {
        await window.AppMessagesService.delete(messageId);
        window.AppState.removeMessage(messageId);
    },

    async regenerateFromMessage(messageId, containerEl) {
        const history = window.AppState.getHistory();
        const index = history.findIndex(m => m.id === messageId);
        if (index === -1) return;

        const toDelete = history.slice(index);
        for (const m of toDelete) {
            if (m.id) await window.AppMessagesService.delete(m.id);
        }

        window.AppState.removeMessagesAfter(history[index - 1]?.id || null);

        while (containerEl.nextSibling) {
            containerEl.nextSibling.remove();
        }

        await this.execute();
    }
};
