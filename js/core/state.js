window.AppState = {
    _state: {
        user: null,
        session: null,
        currentMode: 'chat',
        currentConversationId: null,
        activeCharacter: null,
        conversations: [],
        characters: [],
        history: [], // array of { id, role, content, conversation_id }
        settings: null,
        encryptionSalt: null,
        encryptionUnlocked: false,
        sessionPassphrase: null,
        decryptedApiKey: null,
        decryptedTtsKey: null,
        isExecuting: false,
        isAutoScrolling: true,
        controller: null,
        attachedImageBase64: null,
        editingCharacterId: null,
        newCharacterAvatarBase64: null,
        streamingMessageId: null,
        lastRequestId: 0
    },

    listeners: [],

    get(key) {
        if (key) return this._state[key];
        return { ...this._state };
    },

    set(key, value) {
        const oldValue = this._state[key];
        this._state[key] = value;
        this._notify(key, value, oldValue);
    },

    update(updates) {
        Object.keys(updates).forEach(key => {
            const oldValue = this._state[key];
            this._state[key] = updates[key];
            this._notify(key, updates[key], oldValue);
        });
    },

    reset() {
        const preserved = {
            user: this._state.user,
            session: this._state.session,
            currentMode: this._state.currentMode,
            encryptionSalt: this._state.encryptionSalt,
            encryptionUnlocked: this._state.encryptionUnlocked,
            sessionPassphrase: this._state.sessionPassphrase,
            decryptedApiKey: this._state.decryptedApiKey,
            decryptedTtsKey: this._state.decryptedTtsKey
        };
        this._state = {
            user: preserved.user,
            session: preserved.session,
            currentMode: preserved.currentMode,
            currentConversationId: null,
            activeCharacter: null,
            conversations: [],
            characters: [],
            history: [],
            settings: null,
            encryptionSalt: preserved.encryptionSalt,
            encryptionUnlocked: preserved.encryptionUnlocked,
            sessionPassphrase: preserved.sessionPassphrase,
            decryptedApiKey: preserved.decryptedApiKey,
            decryptedTtsKey: preserved.decryptedTtsKey,
            isExecuting: false,
            isAutoScrolling: true,
            controller: null,
            attachedImageBase64: null,
            editingCharacterId: null,
            newCharacterAvatarBase64: null,
            streamingMessageId: null,
            lastRequestId: 0
        };
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    _notify(key, newValue, oldValue) {
        this.listeners.forEach(listener => {
            try {
                listener(key, newValue, oldValue);
            } catch (e) {
                console.error('State listener error:', e);
            }
        });
    },

    getHistory() {
        return [...this._state.history];
    },

    addMessage(message) {
        this._state.history.push(message);
        this._notify('history', this._state.history, null);
    },

    updateMessage(messageId, updates) {
        const index = this._state.history.findIndex(m => m.id === messageId);
        if (index > -1) {
            this._state.history[index] = { ...this._state.history[index], ...updates };
            this._notify('history', this._state.history, null);
        }
    },

    removeMessage(messageId) {
        this._state.history = this._state.history.filter(m => m.id !== messageId);
        this._notify('history', this._state.history, null);
    },

    removeMessagesAfter(messageId) {
        if (messageId === null || messageId === undefined) {
            this.clearHistory();
            return;
        }
        const index = this._state.history.findIndex(m => m.id === messageId);
        if (index > -1) {
            this._state.history = this._state.history.slice(0, index + 1);
            this._notify('history', this._state.history, null);
        }
    },

    getMessagesByConversation(conversationId) {
        return this._state.history.filter(m => m.conversation_id === conversationId);
    },

    clearHistory() {
        this._state.history = [];
        this._notify('history', this._state.history, null);
    },

    setUser(user) {
        this._state.user = user;
    },

    setExecutionState(isExecuting) {
        this._state.isExecuting = isExecuting;
    },

    setStreamingMessageId(id) {
        this._state.streamingMessageId = id;
    },

    getStreamingMessageId() {
        return this._state.streamingMessageId;
    },

    incrementRequestId() {
        this._state.lastRequestId++;
        return this._state.lastRequestId;
    },

    getLastRequestId() {
        return this._state.lastRequestId;
    }
};
