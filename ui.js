window.App.showToast = function(msg, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
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
        <div style="display:flex; justify-content:flex-end;"><div class="skeleton-msg user"></div></div>
        <div style="display:flex;"><div class="skeleton-msg"></div></div>
        <div style="display:flex; justify-content:flex-end;"><div class="skeleton-msg user"></div></div>
    `;
};

window.App.renderCharacters = function() {
    window.App.UI.charList.innerHTML = "";
    window.App.state.characters.forEach((c) => {
        const div = document.createElement('div');
        div.className = 'char-card';
        const avatarSrc = c.avatar || window.App.DEFAULT_AI_AVATAR;
        div.innerHTML = `
            <button class="char-edit" data-id="${c.id}">✎</button>
            <button class="char-del" data-id="${c.id}">&times;</button>
            <img src="${DOMPurify.sanitize(avatarSrc)}" alt="avatar">
            <div class="char-title">${DOMPurify.sanitize(c.name)}</div>
            <div class="char-preview-tooltip">${DOMPurify.sanitize(c.system_prompt)}</div>
        `;
        
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('char-del') || e.target.classList.contains('char-edit')) return;
            window.App.state.activeCharacter = c;
            window.App.renderActiveCharacter();
            window.App.UI.charModal.classList.add('hidden');
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
                window.App.renderActiveCharacter();
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
    if (window.App.state.activeCharacter) {
        window.App.UI.activeCharDisplay.classList.remove('hidden');
        window.App.UI.activeCharImg.src = window.App.state.activeCharacter.avatar || window.App.DEFAULT_AI_AVATAR;
        window.App.UI.activeCharName.textContent = window.App.state.activeCharacter.name;
    } else {
        window.App.UI.activeCharDisplay.classList.add('hidden');
    }
};

window.App.UI.architectBtn.addEventListener('click', () => {
        window.App.UI.architectModal.classList.remove('hidden');
    });

    window.App.UI.closeArchitectModal.addEventListener('click', () => {
        window.App.UI.architectModal.classList.add('hidden');
    });

    window.App.UI.architectBuildBtn.addEventListener('click', () => {
        window.App.buildFromArchitect();
    });

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

window.App.addMessage = function(role, content, streaming = false, msgId = null) {
    let container = streaming ? document.getElementById('streaming-container') : null;
    if (!container) {
        container = document.createElement('div');
        container.className = `msg-container ${role}`;
        if (streaming) container.id = 'streaming-container';
        if (msgId) container.dataset.id = msgId;

        const avatar = document.createElement('img');
        avatar.className = 'msg-avatar';
        avatar.src = role === 'user' ? window.App.DEFAULT_USER_AVATAR : ((window.App.state.activeCharacter && window.App.state.activeCharacter.avatar) ? window.App.state.activeCharacter.avatar : window.App.DEFAULT_AI_AVATAR);

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${role}`;
        const inner = document.createElement('div');
        inner.className = 'content';
        
        const imgUrl = window.App.extractImageFromContent(content);
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
                ta.className = 'glass-input';
                ta.value = originalText;
                
                const btnRow = document.createElement('div');
                btnRow.className = 'action-row';
                
                const submitBtn = document.createElement('button');
                submitBtn.className = 'primary-btn';
                submitBtn.style.width = 'auto';
                submitBtn.style.padding = '8px 16px';
                submitBtn.style.marginTop = '0';
                submitBtn.innerText = 'Submit';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'secondary-btn';
                cancelBtn.style.width = 'auto';
                cancelBtn.style.padding = '8px 16px';
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
                    const domNodes = Array.from(window.App.UI.chatLog.children);
                    const domIndex = domNodes.indexOf(container);
                    const historyToKeep = window.App.state.history.slice(0, domIndex);

                    const { data: convData } = await window.supabaseClient.from('conversations').insert([{ user_id: window.App.user.id, title: 'Branched Chat' }]).select().single();
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
                    ta.className = 'glass-input';
                    ta.value = originalText;
                    
                    const btnRow = document.createElement('div');
                    btnRow.className = 'action-row';
                    
                    const submitBtn = document.createElement('button');
                    submitBtn.className = 'primary-btn';
                    submitBtn.style.width = 'auto';
                    submitBtn.style.padding = '8px 16px';
                    submitBtn.style.marginTop = '0';
                    submitBtn.innerText = 'Save';
                    
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'secondary-btn';
                    cancelBtn.style.width = 'auto';
                    cancelBtn.style.padding = '8px 16px';
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
            msgDiv.appendChild(actions);
        }
        container.appendChild(avatar);
        container.appendChild(msgDiv);
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
