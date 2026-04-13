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
    } catch(e) {}
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
        const { data, error } = await window.supabaseClient.from('messages').insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'user', content: dbContent }]).select().single();
        if (error) throw error;
        if(data) {
            window.App.state.history.push({ role: 'user', content: contentPayload, id: data.id });
            window.App.addMessage('user', contentPayload, false, data.id);
        }
        if(window.App.state.history.length === 1) window.App.generateChatTitle(input, window.App.currentConversationId);

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
    
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${window.App.UI.apiKey.value}`, "Content-Type": "application/json" },
            signal: window.App.controller.signal,
            body: JSON.stringify({ model: window.App.UI.model.value, temperature: parseFloat(window.App.UI.tempSlider.value), max_tokens: maxTokens, messages: messages, stream: true })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        const box = window.App.addMessage('assistant', "", true);
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
        if (streamContainer) streamContainer.id = "";
        
        const { data: aiData, error: aiError } = await window.supabaseClient.from('messages').insert([{ conversation_id: window.App.currentConversationId, user_id: window.App.user.id, role: 'assistant', content: fullText }]).select().single();
        if (aiError) throw aiError;
        if(aiData) {
            window.App.state.history.push({ role: 'assistant', content: fullText, id: aiData.id });
            if(streamContainer) streamContainer.dataset.id = aiData.id;
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
    }
};
