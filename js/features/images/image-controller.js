window.AppImageController = {
    handleFileSelect(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            window.AppState.set('attachedImageBase64', event.target.result);
            const ui = window.AppUI.get();
            ui.imagePreview.src = event.target.result;
            ui.imagePreviewContainer?.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    },

    clearAttachment() {
        window.AppState.set('attachedImageBase64', null);
        const ui = window.AppUI.get();
        ui.imagePreview.src = '';
        ui.imagePreviewContainer?.classList.add('hidden');
        ui.imageUpload.value = '';
    },

    async generateImage() {
        const user = window.AppState.get('user');
        if (!user) {
            window.AppToasts.show('Please sign in first.', 'error');
            return;
        }

        if (window.AppState.get('isExecuting')) return;

        const ui = window.AppUI.get();
        const input = ui.prompt.value.trim();
        if (!input) {
            window.AppToasts.show('Enter a prompt to generate an image.', 'error');
            return;
        }

        window.AppState.setExecutionState(true);
        this._updateButtons(true);

        ui.prompt.value = '';
        ui.prompt.style.height = '50px';
        ui.tokenCounter.innerText = '~0 tokens';

        try {
            const activeChar = window.AppState.get('activeCharacter') ||
                window.AppConfig.BASE_PERSONAS[window.AppState.get('currentMode')];

            const convId = await this._ensureConversation(input, activeChar);
            if (!convId) throw new Error('Failed to create conversation');

            const { data: userMsg, error: userError } = await window.AppMessagesService.create({
                conversation_id: convId,
                role: 'user',
                content: input
            });

            if (userError) throw userError;

            window.AppState.addMessage({
                id: userMsg.id,
                role: 'user',
                content: input,
                conversation_id: convId
            });

            window.AppChatView.renderMessage('user', input, userMsg.id);

            if (window.AppState.getHistory().length === 1) {
                window.AppLLMService.generateTitle(input, convId);
                await window.AppFeaturesChat.loadConversationList();
            }

            window.AppToasts.show('Generating image...');

            const imgResult = await window.AppImageService.generate(input);
            if (imgResult.error) throw imgResult.error;

            const contentPayload = [
                { type: 'text', text: 'Image generated:' },
                { type: 'image_url', image_url: { url: imgResult.data } }
            ];

            const { data: aiMsg, error: aiError } = await window.AppMessagesService.create({
                conversation_id: convId,
                role: 'assistant',
                content: contentPayload
            });

            if (aiError) throw aiError;

            window.AppState.addMessage({
                id: aiMsg.id,
                role: 'assistant',
                content: contentPayload,
                conversation_id: convId
            });

            window.AppChatView.renderMessage('assistant', contentPayload, aiMsg.id);
        } catch (e) {
            window.AppToasts.show(`Generation failed: ${e.message}`, 'error');
        } finally {
            window.AppState.setExecutionState(false);
            this._updateButtons(false);
        }
    },

    async generateScenarioImage() {
        const user = window.AppState.get('user');
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();

        if (!user || !apiKey) {
            window.AppToasts.show('Authentication and OpenRouter API key required.', 'error');
            return;
        }

        if (window.AppState.get('isExecuting')) return;

        const history = window.AppState.getHistory();
        if (history.length === 0) {
            window.AppToasts.show('Insufficient context to render scenario.', 'error');
            return;
        }

        window.AppState.setExecutionState(true);
        this._updateButtons(true);

        try {
            window.AppToasts.show('Synthesizing context...');

            const synthResult = await window.AppLLMService.synthesizeScenarioPrompt(history.slice(-6));
            if (synthResult.error) throw synthResult.error;

            const sdPrompt = synthResult.data;

            window.AppToasts.show('Rendering scenario...');

            const imgResult = await window.AppImageService.generateScenario(sdPrompt);
            if (imgResult.error) throw imgResult.error;

            const contentPayload = [
                { type: 'text', text: `*Scenario Rendered:* ${sdPrompt}` },
                { type: 'image_url', image_url: { url: imgResult.data } }
            ];

            const convId = window.AppState.get('currentConversationId');
            if (!convId) throw new Error('No active conversation');

            const { data: aiMsg, error: aiError } = await window.AppMessagesService.create({
                conversation_id: convId,
                role: 'assistant',
                content: contentPayload
            });

            if (aiError) throw aiError;

            window.AppState.addMessage({
                id: aiMsg.id,
                role: 'assistant',
                content: contentPayload,
                conversation_id: convId
            });

            window.AppChatView.renderMessage('assistant', contentPayload, aiMsg.id);
        } catch (e) {
            window.AppToasts.show(`Pipeline failure: ${e.message}`, 'error');
        } finally {
            window.AppState.setExecutionState(false);
            this._updateButtons(false);
        }
    },

    async _ensureConversation(title, activeChar) {
        let convId = window.AppState.get('currentConversationId');

        if (!convId) {
            const charId = activeChar?.id && !activeChar.id.startsWith('base-') ? activeChar.id : null;
            const { data: newConv, error } = await window.AppConversationsService.create({
                title: window.AppUtils.truncateText(title, 30),
                summary_memory: window.AppUI.get().persistMem?.value?.trim() || '',
                mode: window.AppState.get('currentMode'),
                character_id: charId
            });

            if (error) return null;
            convId = newConv.id;
            window.AppState.set('currentConversationId', convId);
        }

        return convId;
    },

    _updateButtons(isExecuting) {
        const ui = window.AppUI.get();
        if (isExecuting) {
            ui.stopBtn?.classList.remove('hidden');
            ui.sendBtn?.classList.add('hidden');
        } else {
            ui.stopBtn?.classList.add('hidden');
            ui.sendBtn?.classList.remove('hidden');
        }
    }
};
