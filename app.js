window.AppManager = (() => {
    const UI = {
        chatLog: document.getElementById('chat-log'),
        prompt: document.getElementById('prompt'),
        sendBtn: document.getElementById('send-btn'),
        stopBtn: document.getElementById('stop-btn'),
        micBtn: document.getElementById('mic-btn'),
        attachImgBtn: document.getElementById('attach-img-btn'),
        imageUpload: document.getElementById('image-upload'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        clearImgBtn: document.getElementById('clear-img-btn'),
        status: document.getElementById('status-badge'),
        model: document.getElementById('model-select'),
        apiKey: document.getElementById('api-key'),
        sysPrompt: document.getElementById('system-prompt'),
        narrativePrompt: document.getElementById('narrative-prompt'),
        persistMem: document.getElementById('persistent-memory'),
        tempSlider: document.getElementById('temp-slider'),
        tempVal: document.getElementById('temp-val'),
        ctxSlider: document.getElementById('ctx-slider'),
        ctxVal: document.getElementById('ctx-val'),
        sidebar: document.getElementById('sidebar'),
        menuBtn: document.getElementById('menu-toggle'),
        overlay: document.getElementById('sidebar-overlay'),
        newChatBtn: document.getElementById('new-chat-btn'),
        conversationsList: document.getElementById('conversations-list'),
        charsBtn: document.getElementById('chars-btn'),
        charModal: document.getElementById('charModal'),
        closeCharModal: document.getElementById('closeCharModal'),
        charList: document.getElementById('char-list'),
        newCharName: document.getElementById('newCharName'),
        newCharAvatar: document.getElementById('newCharAvatar'),
        newCharPrompt: document.getElementById('newCharPrompt'),
        saveCharBtn: document.getElementById('saveCharBtn'),
        profileBtn: document.getElementById('profile-btn'),
        profileModal: document.getElementById('profileModal'),
        closeProfileModal: document.getElementById('closeProfileModal'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        voiceSheet: document.getElementById('voice-bottom-sheet'),
        voiceCancelBtn: document.getElementById('voice-cancel-btn'),
        voiceInterruptBtn: document.getElementById('voice-interrupt-btn'),
        activeCharDisplay: document.getElementById('active-char-display'),
        activeCharImg: document.getElementById('active-char-img'),
        activeCharName: document.getElementById('active-char-name'),
        clearCharBtn: document.getElementById('clear-char-btn')
    };

    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-'
    });

    const DEFAULT_USER_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffb6c1"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    const DEFAULT_AI_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f8fafc"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a3 3 0 0 1 3 3v2h2v4h-2v2a3 3 0 0 1-3 3h-1v1.27a2 2 0 1 1-2 0V19h-1a3 3 0 0 1-3-3v-2H5v-4h2V10a3 3 0 0 1 3-3h1V5.73A2 2 0 0 1 12 2z"/></svg>';

    let controller = null;
    let isAutoScrolling = true;
    let user = null;
    let currentConversationId = null;
    let listenersBound = false;
    let attachedImageBase64 = null;
    let isSidebarHidden = false;
    
    let state = {
        history: [],
        characters: [],
        activeCharacter: null,
        settings: {
            temperature: 0.7,
            contextLimit: 10,
            defaultModel: "deepseek/deepseek-chat"
        }
    };

    async function initialize(authenticatedUser) {
        user = authenticatedUser;
        
        if (!listenersBound) {
            setupEventListeners();
            listenersBound = true;
        }

        if (!user) return;

        await loadUserSettings();
        await loadCharacters();
        await loadConversations();

        if (!currentConversationId) {
            await startNewChat();
        }
        
        VoiceManager.init(handleTranscriptionSubmit, handleVoiceStateChange);
    }

    async function loadUserSettings() {
        const { data } = await window.supabaseClient.from('user_settings').select('*').eq('user_id', user.id).single();
        if (data) {
            state.settings.temperature = data.temperature ?? 0.7;
            state.settings.contextLimit = data.context_limit ?? 10;
            if(data.default_model) state.settings.defaultModel = data.default_model;
            if(data.encrypted_api_key) UI.apiKey.value = data.encrypted_api_key; 
            if(data.system_prompt) UI.sysPrompt.value = data.system_prompt;
            if(data.narrative_prompt) UI.narrativePrompt.value = data.narrative_prompt;
        }
        UI.tempSlider.value = state.settings.temperature;
        UI.tempVal.textContent = state.settings.temperature;
        UI.ctxSlider.value = state.settings.contextLimit;
        UI.ctxVal.textContent = state.settings.contextLimit;
        UI.model.value = state.settings.defaultModel;
    }

    async function saveUserSettings() {
        if (!user) return;
        await window.supabaseClient.from('user_settings').upsert({
            user_id: user.id,
            temperature: parseFloat(UI.tempSlider.value),
            context_limit: parseInt(UI.ctxSlider.value),
            default_model: UI.model.value,
            encrypted_api_key: UI.apiKey.value,
            system_prompt: UI.sysPrompt.value,
            narrative_prompt: UI.narrativePrompt.value
        });
    }

    async function loadCharacters() {
        const { data } = await window.supabaseClient.from('characters').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (data) { state.characters = data; renderCharacters(); }
    }

    async function loadConversations() {
        const { data } = await window.supabaseClient.from('conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
        UI.conversationsList.innerHTML = "";
        if (data && data.length > 0) {
            if (!currentConversationId || !data.find(c => c.id === currentConversationId)) currentConversationId = data[0].id;
            
            data.forEach(conv => {
                const div = document.createElement('div');
                div.className = `chat-sidebar-item ${conv.id === currentConversationId ? 'active' : ''}`;
                div.dataset.id = conv.id;
                div.innerHTML = `
                    <div class="chat-sidebar-info" onclick="window.AppManager.loadConversationHistory('${conv.id}')">
                        <div class="chat-sidebar-title">${DOMPurify.sanitize(conv.title)}</div>
                        <div class="chat-sidebar-date">${new Date(conv.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div class="chat-sidebar-actions">
                        <button class="chat-sidebar-btn" title="Fork Chat" onclick="event.stopPropagation(); window.AppManager.forkChat('${conv.id}')">⑂</button>
                        <button class="chat-sidebar-btn" title="Copy Chat" onclick="event.stopPropagation(); window.AppManager.copyChat('${conv.id}')">⎘</button>
                        <button class="chat-sidebar-btn danger" title="Delete Chat" onclick="event.stopPropagation(); window.AppManager.deleteChat('${conv.id}')">&times;</button>
                    </div>
                `;
                UI.conversationsList.appendChild(div);
            });
            if (currentConversationId) loadConversationHistory(currentConversationId, false);
        } else {
            await startNewChat();
        }
    }

    async function startNewChat() {
        state.history = [];
        UI.chatLog.innerHTML = "";
        UI.narrativePrompt.value = "";
        UI.persistMem.value = "";
        const { data } = await window.supabaseClient.from('conversations').insert([{ user_id: user.id, title: 'New Chat' }]).select().single();
        if (data) {
            currentConversationId = data.id;
            loadConversations();
        }
        if(window.innerWidth <= 768) { UI.sidebar.classList.remove('show'); UI.overlay.classList.remove('show'); }
    }

    async function loadConversationHistory(convId, renderList = true) {
        currentConversationId = convId;
        const { data: convData } = await window.supabaseClient.from('conversations').select('*').eq('id', convId).single();
        if (convData) UI.persistMem.value = convData.summary_memory || "";

        const { data } = await window.supabaseClient.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
        state.history = [];
        UI.chatLog.innerHTML = "";
        if (data) {
            data.forEach(msg => {
                let parsedContent = msg.content;
                try { parsedContent = JSON.parse(msg.content); } catch(e) {}
                state.history.push({ role: msg.role, content: parsedContent, id: msg.id });
                addMessage(msg.role, parsedContent, false, msg.id);
            });
        }
        if (renderList) loadConversations();
        if(window.innerWidth <= 768) { UI.sidebar.classList.remove('show'); UI.overlay.classList.remove('show'); }
    }

    async function forkChat(convId) {
        if(!user) return;
        const { data: oldMsgs } = await window.supabaseClient.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
        const { data: convData } = await window.supabaseClient.from('conversations').insert([{ user_id: user.id, title: 'Forked Chat' }]).select().single();
        if (convData && oldMsgs) {
            for (const msg of oldMsgs) {
                await window.supabaseClient.from('messages').insert([{ conversation_id: convData.id, user_id: user.id, role: msg.role, content: msg.content }]);
            }
            loadConversationHistory(convData.id);
        }
    }

    async function copyChat(convId) {
        const { data } = await window.supabaseClient.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
        if (data) {
            let text = data.map(m => {
                let txt = m.content;
                if (Array.isArray(txt)) txt = txt.find(c => c.type === 'text')?.text || '';
                return `**${m.role.toUpperCase()}**:\n${txt}\n`;
            }).join('\n---\n');
            navigator.clipboard.writeText(text);
            alert("Chat copied to clipboard.");
        }
    }

    async function deleteChat(convId) {
        if(!confirm("Delete this chat permanently?")) return;
        await window.supabaseClient.from('conversations').delete().eq('id', convId);
        if (currentConversationId === convId) currentConversationId = null;
        loadConversations();
    }

    async function generateChatTitle(firstPrompt, convId) {
        if (!UI.apiKey.value) return;
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${UI.apiKey.value}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: UI.model.value,
                    messages: [{ role: "user", content: `Summarize this into a 3-5 word title. Only output the title: ${firstPrompt}` }],
                    stream: false
                })
            });
            if(response.ok) {
                const data = await response.json();
                const title = data.choices[0].message.content.replace(/["']/g, "").trim();
                await window.supabaseClient.from('conversations').update({ title }).eq('id', convId);
                loadConversations();
            }
        } catch(e) {}
    }

    function renderCharacters() {
        UI.charList.innerHTML = "";
        state.characters.forEach((c) => {
            const div = document.createElement('div');
            div.className = 'char-card';
            const avatarSrc = c.avatar || DEFAULT_AI_AVATAR;
            div.innerHTML = `
                <img src="${DOMPurify.sanitize(avatarSrc)}" alt="avatar">
                <div class="char-info">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="char-title">${DOMPurify.sanitize(c.name)}</div>
                        <button class="char-del" data-id="${c.id}" style="background:transparent; border:none; color:#fb7185; cursor:pointer; font-size:1.2rem;">×</button>
                    </div>
                    <div class="char-preview">${DOMPurify.sanitize(c.system_prompt)}</div>
                </div>
            `;
            div.addEventListener('click', (e) => {
                if (e.target.classList.contains('char-del')) return;
                state.activeCharacter = c;
                UI.sysPrompt.value = c.system_prompt;
                saveUserSettings();
                renderActiveCharacter();
                UI.charModal.classList.add('hidden');
            });
            div.querySelector('.char-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.supabaseClient.from('characters').delete().eq('id', c.id);
                if (state.activeCharacter && state.activeCharacter.id === c.id) {
                    state.activeCharacter = null;
                    renderActiveCharacter();
                }
                loadCharacters();
            });
            UI.charList.appendChild(div);
        });
    }

    function renderActiveCharacter() {
        if (state.activeCharacter) {
            UI.activeCharDisplay.classList.remove('hidden');
            UI.activeCharImg.src = state.activeCharacter.avatar || DEFAULT_AI_AVATAR;
            UI.activeCharName.textContent = state.activeCharacter.name;
        } else {
            UI.activeCharDisplay.classList.add('hidden');
        }
    }

    function handleVoiceStateChange(status) {
        const statusText = document.getElementById('voice-status-text');
        if (status === 'listening') {
            statusText.textContent = "Listening...";
            statusText.style.color = "#ffb6c1";
        } else if (status === 'thinking') {
            statusText.textContent = "Thinking...";
            statusText.style.color = "#38bdf8";
        } else if (status === 'speaking') {
            statusText.textContent = "Speaking...";
            statusText.style.color = "#34d399";
        }
    }

    function handleTranscriptionSubmit(text) {
        UI.prompt.value = text.trim();
        if (UI.prompt.value) execute(true);
    }

    function extractTextFromContent(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            const txtObj = content.find(c => c.type === 'text');
            return txtObj ? txtObj.text : '';
        }
        return '';
    }

    function extractImageFromContent(content) {
        if (Array.isArray(content)) {
            const imgObj = content.find(c => c.type === 'image_url');
            return imgObj ? imgObj.image_url.url : null;
        }
        return null;
    }

    function addMessage(role, content, streaming = false, msgId = null) {
        let container = streaming ? document.getElementById('streaming-container') : null;
        if (!container) {
            container = document.createElement('div');
            container.className = `msg-container ${role}`;
            if (streaming) container.id = 'streaming-container';
            if (msgId) container.dataset.id = msgId;

            const avatar = document.createElement('img');
            avatar.className = 'msg-avatar';
            avatar.src = role === 'user' ? DEFAULT_USER_AVATAR : ((state.activeCharacter && state.activeCharacter.avatar) ? state.activeCharacter.avatar : DEFAULT_AI_AVATAR);

            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${role}`;
            const inner = document.createElement('div');
            inner.className = 'content';
            
            const imgUrl = extractImageFromContent(content);
            if (imgUrl) {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.className = 'multimodal-img';
                msgDiv.appendChild(img);
            }
            msgDiv.appendChild(inner);

            if (!streaming && role !== 'system') {
                const actions = document.createElement('div');
                actions.className = 'action-row';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'action-btn';
                copyBtn.innerText = 'Copy';
                copyBtn.onclick = () => { navigator.clipboard.writeText(extractTextFromContent(content)); };
                actions.appendChild(copyBtn);

                if (role === 'user') {
                    const branchBtn = document.createElement('button');
                    branchBtn.className = 'action-btn';
                    branchBtn.innerText = 'Branch';
                    branchBtn.onclick = async () => {
                        const newPromptText = prompt("Enter new prompt for this branch:");
                        if (!newPromptText) return;
                        const domNodes = Array.from(UI.chatLog.children);
                        const domIndex = domNodes.indexOf(container);
                        const historyToKeep = state.history.slice(0, domIndex);

                        const { data: convData } = await window.supabaseClient.from('conversations').insert([{ user_id: user.id, title: 'Branched Chat' }]).select().single();
                        if (!convData) return;
                        currentConversationId = convData.id;
                        state.history = [];
                        UI.chatLog.innerHTML = "";

                        for (const oldMsg of historyToKeep) {
                            const dbContent = typeof oldMsg.content === 'string' ? oldMsg.content : JSON.stringify(oldMsg.content);
                            const { data: msgData } = await window.supabaseClient.from('messages').insert([{ conversation_id: currentConversationId, user_id: user.id, role: oldMsg.role, content: dbContent }]).select().single();
                            if (msgData) {
                                state.history.push({ role: oldMsg.role, content: oldMsg.content, id: msgData.id });
                                addMessage(oldMsg.role, oldMsg.content, false, msgData.id);
                            }
                        }
                        UI.prompt.value = newPromptText;
                        loadConversations();
                        execute();
                    };
                    actions.appendChild(branchBtn);

                    const editBtn = document.createElement('button');
                    editBtn.className = 'action-btn';
                    editBtn.innerText = 'Edit & Redo';
                    editBtn.onclick = async () => {
                        const domNodes = Array.from(UI.chatLog.children);
                        const domIndex = domNodes.indexOf(container);
                        UI.prompt.value = extractTextFromContent(state.history[domIndex].content);
                        UI.prompt.style.height = 'auto'; UI.prompt.style.height = (UI.prompt.scrollHeight) + 'px';
                        
                        const msgsToDelete = state.history.slice(domIndex);
                        for(const m of msgsToDelete) if(m.id) await window.supabaseClient.from('messages').delete().eq('id', m.id);
                        
                        state.history = state.history.slice(0, domIndex);
                        while(UI.chatLog.children.length > domIndex) UI.chatLog.lastChild.remove();
                    };
                    actions.appendChild(editBtn);

                    const delBtn = document.createElement('button');
                    delBtn.className = 'action-btn danger';
                    delBtn.innerText = 'Delete';
                    delBtn.onclick = async () => {
                        if(msgId) await window.supabaseClient.from('messages').delete().eq('id', msgId);
                        const index = state.history.findIndex(m => m.id === msgId);
                        if(index > -1) state.history.splice(index, 1);
                        container.remove();
                    };
                    actions.appendChild(delBtn);
                }

                if (role === 'assistant') {
                    const regenBtn = document.createElement('button');
                    regenBtn.className = 'action-btn';
                    regenBtn.innerText = 'Redo';
                    regenBtn.onclick = async () => {
                        const domNodes = Array.from(UI.chatLog.children);
                        const domIndex = domNodes.indexOf(container);
                        const msgsToDelete = state.history.slice(domIndex);
                        for(const m of msgsToDelete) if(m.id) await window.supabaseClient.from('messages').delete().eq('id', m.id);
                        state.history = state.history.slice(0, domIndex);
                        while(UI.chatLog.children.length > domIndex) UI.chatLog.lastChild.remove();
                        execute();
                    };
                    actions.appendChild(regenBtn);
                }
                msgDiv.appendChild(actions);
            }
            container.appendChild(avatar);
            container.appendChild(msgDiv);
            UI.chatLog.appendChild(container);
        }
        const target = container.querySelector('.content');
        target.innerHTML = DOMPurify.sanitize(marked.parse(extractTextFromContent(content)), { ADD_TAGS: ['think'] });
        if (isAutoScrolling) UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
        return target;
    }

    async function execute(fromVoice = false) {
        if (!user) return alert("Please sign in first.");

        const input = UI.prompt.value.trim();
        if (!input && state.history.length === 0) return;
        
        if (input || attachedImageBase64) {
            let contentPayload = input;
            if (attachedImageBase64) {
                contentPayload = [];
                if (input) contentPayload.push({ type: "text", text: input });
                contentPayload.push({ type: "image_url", image_url: { url: attachedImageBase64 } });
            }

            const dbContent = typeof contentPayload === 'string' ? contentPayload : JSON.stringify(contentPayload);
            const { data, error } = await window.supabaseClient.from('messages').insert([{ conversation_id: currentConversationId, user_id: user.id, role: 'user', content: dbContent }]).select().single();
            if (error) throw error;
            if(data) {
                state.history.push({ role: 'user', content: contentPayload, id: data.id });
                addMessage('user', contentPayload, false, data.id);
            }
            if(state.history.length === 1) generateChatTitle(input, currentConversationId);

            UI.prompt.value = ""; UI.prompt.style.height = '50px'; UI.clearImgBtn.click();
        }
        
        controller = new AbortController();
        if (!fromVoice) {
            UI.stopBtn.classList.remove('hidden');
            UI.sendBtn.classList.add('hidden');
        }
        
        const limit = parseInt(UI.ctxSlider.value);
        const recent = state.history.slice(-limit).map(m => ({ role: m.role, content: m.content }));
        const systemContent = `${UI.sysPrompt.value}\n\n[NARRATIVE CONTEXT]\n${UI.narrativePrompt.value}\n\n[PERSISTENT MEMORY]\n${UI.persistMem.value}`;
        const messages = [{ role: "system", content: systemContent }, ...recent];
        
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${UI.apiKey.value}`, "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({ model: UI.model.value, temperature: parseFloat(UI.tempSlider.value), messages: messages, stream: true })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = "";
            const box = addMessage('assistant', "", true);
            let sentenceBuffer = "";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    const cleanLine = line.replace(/^data: /, "").trim();
                    if (!cleanLine || cleanLine === "[DONE]") continue;
                    try {
                        const data = JSON.parse(cleanLine);
                        const delta = data.choices[0].delta.content || "";
                        fullText += delta;
                        sentenceBuffer += delta;

                        if (fromVoice && /[.!?]/.test(delta)) {
                            VoiceManager.queueText(sentenceBuffer.trim());
                            sentenceBuffer = "";
                        }

                        box.innerHTML = DOMPurify.sanitize(marked.parse(fullText), { ADD_TAGS: ['think'] });
                        if (isAutoScrolling) UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
                    } catch (e) {}
                }
            }
            if (fromVoice && sentenceBuffer.trim()) VoiceManager.queueText(sentenceBuffer.trim());
            
            const streamContainer = document.getElementById('streaming-container');
            if (streamContainer) streamContainer.id = "";
            
            const { data: aiData, error: aiError } = await window.supabaseClient.from('messages').insert([{ conversation_id: currentConversationId, user_id: user.id, role: 'assistant', content: fullText }]).select().single();
            if (aiError) throw aiError;
            if(aiData) {
                state.history.push({ role: 'assistant', content: fullText, id: aiData.id });
                if(streamContainer) streamContainer.dataset.id = aiData.id;
            }

        } catch (e) {
            if (e.name !== 'AbortError') addMessage('system', `ERROR: ${e.message}`);
        } finally {
            UI.stopBtn.classList.add('hidden');
            UI.sendBtn.classList.remove('hidden');
            controller = null;
        }
    }

    function setupEventListeners() {
        UI.chatLog.addEventListener('scroll', () => { isAutoScrolling = UI.chatLog.scrollHeight - UI.chatLog.scrollTop - UI.chatLog.clientHeight < 50; });
        UI.menuBtn.addEventListener('click', () => {
            if(window.innerWidth > 768) {
                isSidebarHidden = !isSidebarHidden;
                if(isSidebarHidden) UI.sidebar.classList.add('hidden-sidebar');
                else UI.sidebar.classList.remove('hidden-sidebar');
            } else {
                UI.sidebar.classList.toggle('show');
                UI.overlay.classList.toggle('show');
            }
        });
        UI.overlay.addEventListener('click', () => { UI.sidebar.classList.remove('show'); UI.overlay.classList.remove('show'); });

        UI.profileBtn.addEventListener('click', () => { UI.profileModal.classList.remove('hidden'); UI.sidebar.classList.remove('show'); UI.overlay.classList.remove('show'); });
        UI.closeProfileModal.addEventListener('click', () => UI.profileModal.classList.add('hidden'));
        UI.saveProfileBtn.addEventListener('click', () => { saveUserSettings(); UI.profileModal.classList.add('hidden'); });

        UI.sysPrompt.addEventListener('change', saveUserSettings);
        UI.narrativePrompt.addEventListener('change', saveUserSettings);
        UI.apiKey.addEventListener('change', saveUserSettings);
        UI.tempSlider.addEventListener('input', (e) => { UI.tempVal.textContent = e.target.value; saveUserSettings(); });
        UI.ctxSlider.addEventListener('input', (e) => { UI.ctxVal.textContent = e.target.value; saveUserSettings(); });
        UI.model.addEventListener('change', saveUserSettings);

        UI.attachImgBtn.addEventListener('click', () => UI.imageUpload.click());
        UI.imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                attachedImageBase64 = event.target.result;
                UI.imagePreview.src = attachedImageBase64;
                UI.imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
        UI.clearImgBtn.addEventListener('click', () => { attachedImageBase64 = null; UI.imagePreview.src = ''; UI.imagePreviewContainer.classList.add('hidden'); UI.imageUpload.value = ''; });

        UI.voiceCancelBtn.addEventListener('click', () => { UI.voiceSheet.classList.remove('show'); setTimeout(() => UI.voiceSheet.classList.add('hidden'), 400); VoiceManager.stopAll(); if(controller) controller.abort(); });
        UI.voiceInterruptBtn.addEventListener('click', () => { VoiceManager.stopPlayback(); if(controller) controller.abort(); });

        UI.micBtn.addEventListener('click', () => {
            if (!user) return alert("Please sign in first.");
            UI.voiceSheet.classList.remove('hidden');
            setTimeout(() => UI.voiceSheet.classList.add('show'), 10);
            VoiceManager.startListening();
        });

        UI.sendBtn.addEventListener('click', () => execute(false));
        UI.stopBtn.addEventListener('click', () => { if(controller) controller.abort(); });
        
        UI.newChatBtn.addEventListener('click', () => { if(user) startNewChat(); });

        UI.charsBtn.addEventListener('click', () => { if(user) { UI.sidebar.classList.remove('show'); UI.overlay.classList.remove('show'); UI.charModal.classList.remove('hidden'); }});
        UI.closeCharModal.addEventListener('click', () => UI.charModal.classList.add('hidden'));
        UI.clearCharBtn.addEventListener('click', () => { state.activeCharacter = null; renderActiveCharacter(); });

        UI.saveCharBtn.addEventListener('click', async () => {
            if (!user) return alert("Please sign in first.");
            const name = UI.newCharName.value.trim();
            const avatar = UI.newCharAvatar.value.trim();
            const prompt = UI.newCharPrompt.value.trim();
            if (name && prompt && user) {
                const { error } = await window.supabaseClient.from('characters').insert([{ user_id: user.id, name, avatar, system_prompt: prompt }]);
                if (error) return console.error(error);
                UI.newCharName.value = ""; UI.newCharAvatar.value = ""; UI.newCharPrompt.value = "";
                loadCharacters();
            }
        });

        UI.prompt.addEventListener('input', function() { this.style.height = '50px'; this.style.height = (this.scrollHeight) + 'px'; });
        UI.prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); execute(false); } });
    }

    return { initialize, loadConversationHistory, forkChat, copyChat, deleteChat };
})();
