window.App.showToast = function(msg, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${DOMPurify.sanitize(type)}`;
    toast.innerText = DOMPurify.sanitize(msg);
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};
window.App.renderSkeleton = function() {
    window.App.UI.chatLog.innerHTML = `
        <div class="flex-end"><div class="skeleton-msg user"></div></div>
        <div class="flex-start"><div class="skeleton-msg"></div></div>
        <div class="flex-end"><div class="skeleton-msg user"></div></div>
    `;
};
window.App.renderCharacters = function() {
    window.App.UI.charList.innerHTML = "";
    window.App.state.characters.forEach((c) => {
        const div = document.createElement('div');
        div.className = 'char-card';
        const avatarSrc = c.avatar || window.App.DEFAULT_AI_AVATAR;
        div.innerHTML = `
            <button class="char-edit" data-id="${DOMPurify.sanitize(c.id)}">✎</button>
            <button class="char-del" data-id="${DOMPurify.sanitize(c.id)}">&times;</button>
            <img src="${DOMPurify.sanitize(avatarSrc)}" alt="avatar">
            <div class="char-title">${DOMPurify.sanitize(c.name)}</div>
            <div class="char-preview-tooltip">${DOMPurify.sanitize(c.system_prompt)}</div>
        `;
        div.addEventListener('click', async (e) => {
            if (e.target.classList.contains('char-del') || e.target.classList.contains('char-edit')) return;
            window.App.state.activeCharacter = c;
            window.App.renderActiveCharacter();
            window.App.UI.charModal.classList.add('hidden');
            await window.App.startNewChat();
        });
        div.querySelector('.char-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            window.App.editingCharId = c.id;
            window.App.UI.newCharName.value = c.name;
            window.App.UI.newCharPrompt.value = c.system_prompt;
            if (c.avatar) {
                window.App.newCharAvatarBase64 = c.avatar;
                window.App.UI.newCharAvatarPreview.src = c.avatar;
                window.App.UI.newCharAvatarPreview.style.display = 'block';
            } else {
                window.App.newCharAvatarBase64 = null;
                window.App.UI.newCharAvatarPreview.src = '';
                window.App.UI.newCharAvatarPreview.style.display = 'none';
            }
            window.App.UI.saveCharBtn.textContent = 'Update Persona';
            window.App.UI.cancelEditCharBtn.classList.remove('hidden');
        });
        div.querySelector('.char-del').addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.supabaseClient.from('characters').delete().eq('id', c.id);
            if (window.App.state.activeCharacter && window.App.state.activeCharacter.id === c.id) {
                window.App.state.activeCharacter = null;
                window.App.startNewChat();
            }
            if (window.App.editingCharId === c.id) {
                window.App.UI.cancelEditCharBtn.click();
            }
            window.App.loadCharacters();
        });
        window.App.UI.charList.appendChild(div);
    });
};
window.App.renderActiveCharacter = function() {
    if (!window.App.state.activeCharacter) {
        window.App.state.activeCharacter = window.App.BASE_PERSONAS[window.App.currentMode || 'chat'];
    }
    window.App.UI.activeCharDisplay.classList.remove('hidden');
    window.App.UI.activeCharImg.src = DOMPurify.sanitize(window.App.state.activeCharacter.avatar || window.App.DEFAULT_AI_AVATAR);
    const isBase = window.App.state.activeCharacter.id && window.App.state.activeCharacter.id.startsWith('base-');
    window.App.UI.activeCharName.innerHTML = `${DOMPurify.sanitize(window.App.state.activeCharacter.name)} ${isBase ? '<span class="base-badge">BASE</span>' : ''}`;
    window.App.UI.prompt.disabled = false;
    window.App.UI.prompt.placeholder = "Message...";
    window.App.UI.sendBtn.disabled = false;
};
window.App.handleVoiceStateChange = function(status) {
    const statusText = document.getElementById('voice-status-text');
    if (status === 'initializing') {
        statusText.textContent = "Initializing...";
        statusText.style.color = "#ffb6c1";
    } else if (status === 'idle') {
        statusText.textContent = "Ready - Tap Mic to Start";
        statusText.style.color = "#ffb6c1";
    } else if (status === 'listening') {
        statusText.textContent = "Listening...";
        statusText.style.color = "#06b6d4";
    } else if (status === 'thinking') {
        statusText.textContent = "Thinking...";
        statusText.style.color = "#a855f7";
    } else if (status === 'speaking') {
        statusText.textContent = "Speaking...";
        statusText.style.color = "#10b981";
    } else if (status === 'error') {
        statusText.textContent = "Error Occurred";
        statusText.style.color = "#fb7185";
    }
};
window.App.buildMessageContainer = function(role, streaming, msgId) {
    const container = document.createElement('div');
    container.className = `msg-container ${DOMPurify.sanitize(role)}`;
    if (streaming) container.id = 'streaming-container';
    if (msgId) container.dataset.id = DOMPurify.sanitize(msgId);
    const avatar = document.createElement('img');
    avatar.className = 'msg-avatar';
    avatar.src = DOMPurify.sanitize(role === 'user' ? window.App.DEFAULT_USER_AVATAR : ((window.App.state.activeCharacter && window.App.state.activeCharacter.avatar) ? window.App.state.activeCharacter.avatar : window.App.DEFAULT_AI_AVATAR));
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${DOMPurify.sanitize(role)}`;
    const inner = document.createElement('div');
    inner.className = 'content';
    container.appendChild(avatar);
    container.appendChild(msgDiv);
    return { container, msgDiv, inner };
};
window.App.handleBranchingLogic = async function(role, newPromptText, container) {
    if (!newPromptText) return;
    const domNodes = Array.from(window.App.UI.chatLog.children);
    const domIndex = domNodes.indexOf(container);
    const historyToKeep = window.App.state.history.slice(0, domIndex);
    const currentMode = window.App.currentMode || 'chat';
    const charId = (window.App.state.activeCharacter && !window.App.state.activeCharacter.id.startsWith('base-')) ? window.App.state.activeCharacter.id : null;
    const { data: convData } = await window.supabaseClient.from('conversations').insert([{ user_id: window.App.user.id, title: 'Branched Chat', mode: currentMode, character_id: charId }]).select().single();
    if (!convData) return;
    window.App.currentConversationId = convData.id;
    window.App.state.history = [];
    window.App.UI.chatLog.innerHTML = "";
    for (const oldMsg of historyToKeep) {
        const dbContent = typeof oldMsg.content === 'string' ? oldMsg.content : JSON.stringify(oldMsg.content);
        const { data: msgData } = await window.supabaseClient.from('messages').insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: oldMsg.role, content: dbContent }]).select().single();
        if (msgData) {
            window.App.state.history.push({ role: oldMsg.role, content: oldMsg.content, id: msgData.id });
            window.App.addMessage(oldMsg.role, oldMsg.content, false, msgData.id);
        }
    }
    if (role === 'user') {
        window.App.UI.prompt.value = newPromptText;
        window.App.loadConversations();
        window.App.execute();
    } else {
        const dbContent = typeof newPromptText === 'string' ? newPromptText : JSON.stringify(newPromptText);
        const { data: msgData } = await window.supabaseClient.from('messages').insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'assistant', content: dbContent }]).select().single();
        if (msgData) {
            window.App.state.history.push({ role: 'assistant', content: newPromptText, id: msgData.id });
            window.App.addMessage('assistant', newPromptText, false, msgData.id);
        }
        window.App.loadConversations();
    }
};
window.App.attachMessageActions = function(actions, role, content, msgId, container, msgDiv, inner) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-icon-btn';
    copyBtn.innerHTML = '⎘';
    copyBtn.title = 'Copy';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(window.App.extractTextFromContent(content));
        window.App.showToast('Copied to clipboard');
    };
    actions.appendChild(copyBtn);
    const branchBtn = document.createElement('button');
    branchBtn.className = 'action-icon-btn';
    branchBtn.innerHTML = '⑂';
    branchBtn.title = 'Branch';
    branchBtn.onclick = () => {
        const originalText = window.App.extractTextFromContent(content);
        const editContainer = document.createElement('div');
        editContainer.className = 'inline-edit-container';
        const ta = document.createElement('textarea');
        ta.className = 'glass-input inline-edit-ta';
        ta.value = originalText;
        const btnRow = document.createElement('div');
        btnRow.className = 'action-row';
        const submitBtn = document.createElement('button');
        submitBtn.className = 'primary-btn action-inline-btn';
        submitBtn.innerText = 'Submit';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn action-inline-btn';
        cancelBtn.innerText = 'Cancel';
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(submitBtn);
        editContainer.appendChild(ta);
        editContainer.appendChild(btnRow);
        msgDiv.replaceChild(editContainer, inner);
        actions.style.display = 'none';
        cancelBtn.onclick = () => {
            msgDiv.replaceChild(inner, editContainer);
            actions.style.display = 'flex';
        };
        submitBtn.onclick = () => window.App.handleBranchingLogic(role, ta.value.trim(), container);
    };
    actions.appendChild(branchBtn);
    const editBtn = document.createElement('button');
    editBtn.className = 'action-icon-btn';
    editBtn.innerHTML = '✎';
    editBtn.title = 'Edit & Redo';
    editBtn.onclick = async () => {
        if (role === 'user') {
            const domNodes = Array.from(window.App.UI.chatLog.children);
            const domIndex = domNodes.indexOf(container);
            window.App.UI.prompt.value = window.App.extractTextFromContent(window.App.state.history[domIndex].content);
            window.App.UI.prompt.style.height = 'auto'; window.App.UI.prompt.style.height = (window.App.UI.prompt.scrollHeight) + 'px';
            const msgsToDelete = window.App.state.history.slice(domIndex);
            for(const m of msgsToDelete) if(m.id) await window.supabaseClient.from('messages').delete().eq('id', m.id);
            window.App.state.history = window.App.state.history.slice(0, domIndex);
            while(window.App.UI.chatLog.children.length > domIndex) window.App.UI.chatLog.lastChild.remove();
        } else {
            const originalText = window.App.extractTextFromContent(content);
            const editContainer = document.createElement('div');
            editContainer.className = 'inline-edit-container';
            const ta = document.createElement('textarea');
            ta.className = 'glass-input inline-edit-ta';
            ta.value = originalText;
            const btnRow = document.createElement('div');
            btnRow.className = 'action-row';
            const submitBtn = document.createElement('button');
            submitBtn.className = 'primary-btn action-inline-btn';
            submitBtn.innerText = 'Save';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'secondary-btn action-inline-btn';
            cancelBtn.innerText = 'Cancel';
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(submitBtn);
            editContainer.appendChild(ta);
            editContainer.appendChild(btnRow);
            msgDiv.replaceChild(editContainer, inner);
            actions.style.display = 'none';
            cancelBtn.onclick = () => {
                msgDiv.replaceChild(inner, editContainer);
                actions.style.display = 'flex';
            };
            submitBtn.onclick = async () => {
                const newPromptText = ta.value.trim();
                if (!newPromptText) return;
                if (msgId) {
                    const dbContent = typeof newPromptText === 'string' ? newPromptText : JSON.stringify(newPromptText);
                    await window.supabaseClient.from('messages').update({ content: dbContent }).eq('id', msgId);
                }
                const domNodes = Array.from(window.App.UI.chatLog.children);
                const domIndex = domNodes.indexOf(container);
                if (window.App.state.history[domIndex]) {
                    window.App.state.history[domIndex].content = newPromptText;
                }
                content = newPromptText;
                let renderText = newPromptText;
                const openThinkCount = (renderText.match(/<think>/g) || []).length;
                const closeThinkCount = (renderText.match(/<\/think>/g) || []).length;
                if (openThinkCount > closeThinkCount) {
                    renderText += '</think>';
                }
                inner.innerHTML = DOMPurify.sanitize(marked.parse(renderText), { ADD_TAGS: ['think'] });
                msgDiv.replaceChild(inner, editContainer);
                actions.style.display = 'flex';
            };
        }
    };
    actions.appendChild(editBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'action-icon-btn danger';
    delBtn.innerHTML = '×';
    delBtn.title = 'Delete';
    delBtn.onclick = async () => {
        if(msgId) await window.supabaseClient.from('messages').delete().eq('id', msgId);
        const index = window.App.state.history.findIndex(m => m.id === msgId);
        if(index > -1) window.App.state.history.splice(index, 1);
        container.remove();
    };
    actions.appendChild(delBtn);
    if (role === 'assistant') {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-icon-btn';
        regenBtn.innerHTML = '↻';
        regenBtn.title = 'Redo';
        regenBtn.onclick = async () => {
            const domNodes = Array.from(window.App.UI.chatLog.children);
            const domIndex = domNodes.indexOf(container);
            const msgsToDelete = window.App.state.history.slice(domIndex);
            for(const m of msgsToDelete) if(m.id) await window.supabaseClient.from('messages').delete().eq('id', m.id);
            window.App.state.history = window.App.state.history.slice(0, domIndex);
            while(window.App.UI.chatLog.children.length > domIndex) window.App.UI.chatLog.lastChild.remove();
            window.App.execute();
        };
        actions.appendChild(regenBtn);
    }
};
window.App.addMessage = function(role, content, streaming = false, msgId = null) {
    let container = streaming ? document.getElementById('streaming-container') : null;
    let msgDiv, inner;
    if (!container) {
        const elements = window.App.buildMessageContainer(role, streaming, msgId);
        container = elements.container;
        msgDiv = elements.msgDiv;
        inner = elements.inner;
        const imgUrl = window.App.extractImageFromContent(content);
        if (imgUrl) {
            const img = document.createElement('img');
            img.src = DOMPurify.sanitize(imgUrl);
            img.className = 'multimodal-img';
            msgDiv.appendChild(img);
        }
        msgDiv.appendChild(inner);
        if (!streaming && role !== 'system') {
            const actions = document.createElement('div');
            actions.className = 'action-row';
            window.App.attachMessageActions(actions, role, content, msgId, container, msgDiv, inner);
            msgDiv.appendChild(actions);
        }
        window.App.UI.chatLog.appendChild(container);
    }
    const target = container.querySelector('.content');
    let renderText = window.App.extractTextFromContent(content);
    const openThinkCount = (renderText.match(/<think>/g) || []).length;
    const closeThinkCount = (renderText.match(/<\/think>/g) || []).length;
    if (openThinkCount > closeThinkCount) {
        renderText += '</think>';
    }
    target.innerHTML = DOMPurify.sanitize(marked.parse(renderText), { ADD_TAGS: ['think'] });
    if (window.App.isAutoScrolling) window.App.UI.chatLog.scrollTop = window.App.UI.chatLog.scrollHeight;
    return target;
};
window.App.extractTextFromContent = function(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        const txtObj = content.find(c => c.type === 'text');
        return txtObj ? txtObj.text : '';
    }
    return '';
};
window.App.extractImageFromContent = function(content) {
    if (Array.isArray(content)) {
        const imgObj = content.find(c => c.type === 'image_url');
        return imgObj ? imgObj.image_url.url : null;
    }
    return null;
};
window.App.generateChatTitle = async function(firstPrompt, convId) {
    if (!window.App.UI.apiKey.value) return;
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${window.App.UI.apiKey.value}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: `Summarize this into a 3-5 word title. Only output the title: ${firstPrompt}` }],
                stream: false
            })
        });
        if(response.ok) {
            const data = await response.json();
            const title = data.choices[0].message.content.replace(/["']/g, "").trim();
            await window.supabaseClient.from('conversations').update({ title }).eq('id', convId);
            window.App.loadConversations();
        }
    } catch(e) {
        console.error(e);
    }
};
window.App.exportChat = function() {
    if (window.App.state.history.length === 0) {
        window.App.showToast("No chat history to export.", "error");
        return;
    }
    let mdContent = window.App.state.history.map(m => {
        const text = window.App.extractTextFromContent(m.content);
        return `### ${m.role.toUpperCase()}\n${text}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubybox_chat_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.App.showToast("Chat exported to Markdown.");
};
window.App.execute = async function(fromVoice = false) {
    if (!window.App.user) {
        window.App.showToast("Please sign in first.", "error");
        return;
    }
    if (window.App.isExecuting) return;
    window.App.isExecuting = true;
    try {
        if (!window.App.state.activeCharacter) {
            window.App.state.activeCharacter = window.App.BASE_PERSONAS[window.App.currentMode || 'chat'];
            window.App.renderActiveCharacter();
        }
        const input = window.App.UI.prompt.value.trim();
        if (!input && window.App.state.history.length === 0) return;
        if (input || window.App.attachedImageBase64) {
            let contentPayload = input;
            if (window.App.attachedImageBase64) {
                contentPayload = [];
                if (input) contentPayload.push({ type: "text", text: input });
                const finalImgUrl = await window.App.uploadImageToStorage(window.App.attachedImageBase64);
                if (!finalImgUrl) {
                    window.App.showToast("Image upload failed.", "error");
                    window.App.UI.stopBtn.classList.add('hidden');
                    window.App.UI.sendBtn.classList.remove('hidden');
                    return;
                }
                contentPayload.push({ type: "image_url", image_url: { url: finalImgUrl } });
            }
            const dbContent = typeof contentPayload === 'string' ? contentPayload : JSON.stringify(contentPayload);
            if (!window.App.currentConversationId) {
                const title = input ? input.substring(0, 30).trim() + "..." : "New Chat";
                const currentMode = window.App.currentMode || 'chat';
                const charId = (window.App.state.activeCharacter && !window.App.state.activeCharacter.id.startsWith('base-')) ? window.App.state.activeCharacter.id : null;
                const { data: newChat, error: chatError } = await window.supabaseClient
                    .from('conversations')
                    .insert([{ 
                        user_id: window.App.user.id, 
                        title: title, 
                        summary_memory: window.App.UI.persistMem.value.trim(),
                        mode: currentMode,
                        character_id: charId
                    }])
                    .select()
                    .single();
                if (chatError) {
                    window.App.showToast("Failed to create chat", "error");
                    window.App.UI.stopBtn.classList.add('hidden');
                    window.App.UI.sendBtn.classList.remove('hidden');
                    return;
                }
                window.App.currentConversationId = newChat.id;
            }
            const { data, error } = await window.supabaseClient
                .from('messages')
                .insert([{ 
                    conversation_id: window.App.currentConversationId, 
                    user_id: window.App.user.id, 
                    role: 'user', 
                    content: dbContent 
                }])
                .select()
                .single();
            if (error) throw error;
            if(data) {
                window.App.state.history.push({ role: 'user', content: contentPayload, id: data.id });
                window.App.addMessage('user', contentPayload, false, data.id);
            }
            if(window.App.state.history.length === 1) {
                window.App.generateChatTitle(input, window.App.currentConversationId);
                window.App.loadConversations();
            }
            window.App.UI.prompt.value = ""; 
            window.App.UI.prompt.style.height = '50px'; 
            window.App.UI.tokenCounter.innerText = "~0 tokens";
            window.App.UI.clearImgBtn.click();
        }
        window.App.controller = new AbortController();
        if (!fromVoice) {
            window.App.UI.stopBtn.classList.remove('hidden');
            window.App.UI.sendBtn.classList.add('hidden');
        }
        const limit = parseInt(window.App.UI.ctxSlider.value);
        const maxTokens = parseInt(window.App.UI.maxTokensSlider.value) || 2000;
        const recent = window.App.state.history.slice(-limit).map(m => ({ role: m.role, content: m.content }));
        const activeCharPrompt = window.App.state.activeCharacter ? window.App.state.activeCharacter.system_prompt + "\n\n" : "";
        const systemContent = `${activeCharPrompt}${window.App.UI.sysPrompt.value}\n\n[NARRATIVE CONTEXT]\n${window.App.UI.narrativePrompt.value}\n\n[PERSISTENT MEMORY]\n${window.App.UI.persistMem.value}`;
        const messages = [{ role: "system", content: systemContent }, ...recent];
        const targetModel = window.App.UI.model.value;
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${window.App.UI.apiKey.value}`, "Content-Type": "application/json" },
            signal: window.App.controller.signal,
            body: JSON.stringify({ model: targetModel, temperature: parseFloat(window.App.UI.tempSlider.value), max_tokens: maxTokens, messages: messages, stream: true })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        const box = window.App.addMessage('assistant', fullText, true);
        let lastRenderTime = 0;
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
                    if (fromVoice) {
                        VoiceManager.receiveDelta(delta);
                    }
                    if (Date.now() - lastRenderTime > 50) {
                        let renderText = fullText;
                        const openThinkCount = (renderText.match(/<think>/g) || []).length;
                        const closeThinkCount = (renderText.match(/<\/think>/g) || []).length;
                        if (openThinkCount > closeThinkCount) renderText += '</think>';
                        box.innerHTML = DOMPurify.sanitize(marked.parse(renderText), { ADD_TAGS: ['think'] });
                        if (window.App.isAutoScrolling) window.App.UI.chatLog.scrollTop = window.App.UI.chatLog.scrollHeight;
                        lastRenderTime = Date.now();
                    }
                } catch (e) {}
            }
        }
        let finalRenderText = fullText;
        const finalOpen = (finalRenderText.match(/<think>/g) || []).length;
        const finalClose = (finalRenderText.match(/<\/think>/g) || []).length;
        if (finalOpen > finalClose) finalRenderText += '</think>';
        box.innerHTML = DOMPurify.sanitize(marked.parse(finalRenderText), { ADD_TAGS: ['think'] });
        if (window.App.isAutoScrolling) window.App.UI.chatLog.scrollTop = window.App.UI.chatLog.scrollHeight;
        if (fromVoice) {
            VoiceManager.commitBuffer();
            VoiceManager.markStreamComplete();
        }
        const streamContainer = document.getElementById('streaming-container');
        if (streamContainer) streamContainer.remove();
        const { data: aiData, error: aiError } = await window.supabaseClient.from('messages').insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'assistant', content: fullText }]).select().single();
        if (aiError) throw aiError;
        if(aiData) {
            window.App.state.history.push({ role: 'assistant', content: fullText, id: aiData.id });
            window.App.addMessage('assistant', fullText, false, aiData.id);
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            window.App.showToast(`ERROR: ${e.message}`, "error");
            window.App.addMessage('system', `ERROR: ${e.message}`);
        }
    } finally {
        window.App.UI.stopBtn.classList.add('hidden');
        window.App.UI.sendBtn.classList.remove('hidden');
        window.App.controller = null;
        window.App.isExecuting = false;
    }
};
window.App.generateImage = async function() {
    if (!window.App.user) {
        window.App.showToast("Please sign in first.", "error");
        return;
    }
    if (window.App.isExecuting) return;
    const input = window.App.UI.prompt.value.trim();
    if (!input) {
        window.App.showToast("Enter a prompt to generate an image.", "error");
        return;
    }
    window.App.isExecuting = true;
    window.App.UI.prompt.value = "";
    window.App.UI.prompt.style.height = '50px';
    window.App.UI.tokenCounter.innerText = "~0 tokens";
    window.App.UI.stopBtn.classList.remove('hidden');
    window.App.UI.sendBtn.classList.add('hidden');
    try {
        if (!window.App.state.activeCharacter) {
            window.App.state.activeCharacter = window.App.BASE_PERSONAS[window.App.currentMode || 'chat'];
            window.App.renderActiveCharacter();
        }
        if (!window.App.currentConversationId) {
            const title = input.substring(0, 30).trim() + "...";
            const currentMode = window.App.currentMode || 'chat';
            const charId = (window.App.state.activeCharacter && !window.App.state.activeCharacter.id.startsWith('base-')) ? window.App.state.activeCharacter.id : null;
            const { data: newChat, error: chatError } = await window.supabaseClient
                .from('conversations')
                .insert([{ user_id: window.App.user.id, title: title, summary_memory: window.App.UI.persistMem.value.trim(), mode: currentMode, character_id: charId }])
                .select()
                .single();
            if (chatError) throw chatError;
            window.App.currentConversationId = newChat.id;
        }
        const { data: userData, error: userError } = await window.supabaseClient
            .from('messages')
            .insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'user', content: input }])
            .select()
            .single();
        if (userError) throw userError;
        window.App.state.history.push({ role: 'user', content: input, id: userData.id });
        window.App.addMessage('user', input, false, userData.id);
        if(window.App.state.history.length === 1) {
            window.App.generateChatTitle(input, window.App.currentConversationId);
            window.App.loadConversations();
        }
        window.App.showToast("Generating image...");
        const encodedPrompt = encodeURIComponent(input);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        const imgRes = await fetch(imageUrl);
        const imgBlob = await imgRes.blob();
        const fileName = `gen_${window.App.user.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await window.supabaseClient.storage.from('chat_images').upload(fileName, imgBlob);
        let finalAvatarUrl = imageUrl; 
        if (!uploadError) {
            const { data: urlData } = window.supabaseClient.storage.from('chat_images').getPublicUrl(fileName);
            finalAvatarUrl = urlData.publicUrl;
        }
        const contentPayload = [{ type: "text", text: "Image generated:" }, { type: "image_url", image_url: { url: finalAvatarUrl } }];
        const dbContent = JSON.stringify(contentPayload);
        const { data: aiData, error: aiError } = await window.supabaseClient
            .from('messages')
            .insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'assistant', content: dbContent }])
            .select()
            .single();
        if (aiError) throw aiError;
        window.App.state.history.push({ role: 'assistant', content: contentPayload, id: aiData.id });
        window.App.addMessage('assistant', contentPayload, false, aiData.id);
    } catch (e) {
        window.App.showToast(`Generation failed: ${e.message}`, "error");
    } finally {
        window.App.UI.stopBtn.classList.add('hidden');
        window.App.UI.sendBtn.classList.remove('hidden');
        window.App.isExecuting = false;
    }
};
window.App.generateScenarioImage = async function() {
    if (!window.App.user || !window.App.UI.apiKey.value) {
        window.App.showToast("Authentication and OpenRouter API key required.", "error");
        return;
    }
    if (window.App.isExecuting) return;
    const historySlice = window.App.state.history.slice(-6);
    if (historySlice.length === 0) {
        window.App.showToast("Insufficient context to render scenario.", "error");
        return;
    }
    window.App.isExecuting = true;
    window.App.UI.stopBtn.classList.remove('hidden');
    window.App.UI.sendBtn.classList.add('hidden');
    try {
        window.App.showToast("Synthesizing context...");
        const chatLog = historySlice.map(m => `${m.role}: ${window.App.extractTextFromContent(m.content)}`).join('\n');
        const sysPrompt = "You are a visual prompt engineer. Read the chat history and summarize the current physical scenario, character appearance, and environment into a single, comma-separated list of highly descriptive visual tags for a Stable Diffusion image generator. Output ONLY the raw tags. Do not include introductory text, explanations, or dialogue.";
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${window.App.UI.apiKey.value}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "deepseek/deepseek-v3.2",
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: chatLog }
                ],
                temperature: 0.3
            })
        });
        if (!response.ok) throw new Error("Context synthesis failed.");
        const data = await response.json();
        const sdPrompt = data.choices[0].message.content.trim();
        window.App.showToast("Rendering scenario...");
        const encodedPrompt = encodeURIComponent(sdPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        const imgRes = await fetch(imageUrl);
        const imgBlob = await imgRes.blob();
        const fileName = `scenario_${window.App.user.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await window.supabaseClient.storage.from('chat_images').upload(fileName, imgBlob);
        let finalAvatarUrl = imageUrl; 
        if (!uploadError) {
            const { data: urlData } = window.supabaseClient.storage.from('chat_images').getPublicUrl(fileName);
            finalAvatarUrl = urlData.publicUrl;
        }
        const contentPayload = [{ type: "text", text: `*Scenario Rendered:* ${sdPrompt}` }, { type: "image_url", image_url: { url: finalAvatarUrl } }];
        const dbContent = JSON.stringify(contentPayload);
        const { data: aiData, error: aiError } = await window.supabaseClient
            .from('messages')
            .insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'assistant', content: dbContent }])
            .select()
            .single();
        if (aiError) throw aiError;
        window.App.state.history.push({ role: 'assistant', content: contentPayload, id: aiData.id });
        window.App.addMessage('assistant', contentPayload, false, aiData.id);
    } catch (e) {
        window.App.showToast(`Pipeline failure: ${e.message}`, "error");
    } finally {
        window.App.UI.stopBtn.classList.add('hidden');
        window.App.UI.sendBtn.classList.remove('hidden');
        window.App.isExecuting = false;
    }
};
window.App.buildFromArchitect = async function() {
    if (!window.App.user || !window.App.UI.apiKey.value) {
        window.App.showToast("Requires authentication and OpenRouter API key.", "error");
        return;
    }
    const input = window.App.UI.architectPrompt.value.trim();
    if (!input) return;
    window.App.UI.architectBuildBtn.classList.add('hidden');
    window.App.UI.architectLoading.classList.remove('hidden');
    try {
        const sysPrompt = `Role: You are the NSFW Architect, an expert and perverted world-builder and system designer. Your objective is to take a user's seed prompt and construct a highly sexual interactive, lore-dense, and mechanically sound scenario. The output may represent a single complex character, an ensemble cast (e.g., a harem), or a complete open-world RPG framework. Directive: Maximize information density and interactive potential. Zero flowery exposition. Do not write passive history; write active conflicts. Ground the world in sensory details and strict internal logic. Every word should help to fundamentally shape the lewd character or scenario. Output Structure: Whenever the user provides a prompt, you must generate the framework using the following strict categories: 1. Core Premise & Framework 2. Environmental Design (World-Building) 3. Entity/Cast Diagnostics (Character-Building) 4. The Engine (Event Triggers) 5. Point of Entry (The Opening) CRITICAL SYSTEM REQUIREMENT: You MUST output your entire response as a single, valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json. The JSON must exactly match this schema: { "name": "A brutal, concise title for this scenario or character", "avatar_prompt": "A comma-separated list of highly specific visual tags based on the Entity/Environmental design to be fed into a Stable Diffusion image generator (e.g., 1girl, glowing neon, hyper-detailed, specific clothing/anatomy).", "system_prompt": "The complete, detailed text of all 5 categories requested above, cleanly formatted in markdown." }`;
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${window.App.UI.apiKey.value}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "deepseek/deepseek-v3.2", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: input }], temperature: 0.85 })
        });
        if (!response.ok) throw new Error("Architect synthesis failed.");
        const data = await response.json();
        const rawText = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const profile = JSON.parse(rawText);
        const safeSystemPrompt = profile.system_prompt.replace(/<[^>]*>?/gm, '').replace(/(\{\{|<\||\|>|\}\})/g, '').trim();
        const safeName = profile.name.replace(/<[^>]*>?/gm, '').replace(/(\{\{|<\||\|>|\}\})/g, '').trim();
        const encodedPrompt = encodeURIComponent(profile.avatar_prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        const imgRes = await fetch(imageUrl);
        const imgBlob = await imgRes.blob();
        const fileName = `architect_${window.App.user.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await window.supabaseClient.storage.from('chat_images').upload(fileName, imgBlob);
        let finalAvatarUrl = imageUrl; 
        if (!uploadError) {
            const { data: urlData } = window.supabaseClient.storage.from('chat_images').getPublicUrl(fileName);
            finalAvatarUrl = urlData.publicUrl;
        }
        const currentMode = window.App.currentMode || 'chat';
        const charPayload = { user_id: window.App.user.id, name: safeName, system_prompt: safeSystemPrompt, avatar: finalAvatarUrl, mode: currentMode };
        const { error: dbError } = await window.supabaseClient.from('characters').insert([charPayload]);
        if (dbError) throw dbError;
        window.App.UI.architectPrompt.value = "";
        window.App.UI.architectModal.classList.add('hidden');
        window.App.showToast(`Constructed: ${safeName}`);
        await window.App.loadCharacters();
    } catch (e) {
        window.App.showToast(`Build failed: ${e.message}`, "error");
    } finally {
        window.App.UI.architectBuildBtn.classList.remove('hidden');
        window.App.UI.architectLoading.classList.add('hidden');
    }
};
