const UI = {
    chatLog: document.getElementById('chat-log'),
    prompt: document.getElementById('prompt'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    status: document.getElementById('status-badge'),
    model: document.getElementById('model-select'),
    apiKey: document.getElementById('api-key'),
    sysPrompt: document.getElementById('system-prompt'),
    persistMem: document.getElementById('persistent-memory'),
    sidebar: document.getElementById('sidebar'),
    menuBtn: document.getElementById('menu-toggle'),
    overlay: document.getElementById('sidebar-overlay'),
    clearBtn: document.getElementById('clear-btn'),
    compressBtn: document.getElementById('compress-btn'),
    charsBtn: document.getElementById('chars-btn'),
    charModal: document.getElementById('charModal'),
    closeCharModal: document.getElementById('closeCharModal'),
    charList: document.getElementById('char-list'),
    newCharName: document.getElementById('newCharName'),
    newCharAvatar: document.getElementById('newCharAvatar'),
    newCharPrompt: document.getElementById('newCharPrompt'),
    saveCharBtn: document.getElementById('saveCharBtn'),
    downloadBtn: document.getElementById('download-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
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

let controller = null;
let isAutoScrolling = true;
let state = JSON.parse(localStorage.getItem('rb_glass_state')) || {
    history: [],
    memory: "",
    characters: [],
    activeCharacter: null
};

const DEFAULT_USER_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffb6c1"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
const DEFAULT_AI_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f8fafc"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a3 3 0 0 1 3 3v2h2v4h-2v2a3 3 0 0 1-3 3h-1v1.27a2 2 0 1 1-2 0V19h-1a3 3 0 0 1-3-3v-2H5v-4h2V10a3 3 0 0 1 3-3h1V5.73A2 2 0 0 1 12 2z"/></svg>';

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

async function encryptData(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(text));
    const encryptedArray = new Uint8Array(encrypted);
    let combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encryptedArray, salt.length + iv.length);
    return btoa(String.fromCharCode.apply(null, combined));
}

async function decryptData(base64, password) {
    const str = atob(base64);
    const combined = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) combined[i] = str.charCodeAt(i);
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
    const dec = new TextDecoder();
    return dec.decode(decrypted);
}

UI.chatLog.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = UI.chatLog;
    isAutoScrolling = scrollHeight - scrollTop - clientHeight < 50;
});

const save = () => {
    state.memory = UI.persistMem.value;
    localStorage.setItem('rb_glass_state', JSON.stringify(state));
    localStorage.setItem('rb_glass_key', UI.apiKey.value);
    localStorage.setItem('rb_glass_sys', UI.sysPrompt.value);
    localStorage.setItem('rb_glass_model', UI.model.value);
};

const load = () => {
    UI.apiKey.value = localStorage.getItem('rb_glass_key') || "";
    UI.sysPrompt.value = localStorage.getItem('rb_glass_sys') || "";
    UI.model.value = localStorage.getItem('rb_glass_model') || "deepseek/deepseek-chat";
    UI.persistMem.value = state.memory || "";
    renderActiveCharacter();
    renderHistory();
    renderCharacters();
};

function renderActiveCharacter() {
    if (state.activeCharacter) {
        UI.activeCharDisplay.classList.remove('hidden');
        UI.activeCharImg.src = state.activeCharacter.avatar || DEFAULT_AI_AVATAR;
        UI.activeCharName.textContent = state.activeCharacter.name;
    } else {
        UI.activeCharDisplay.classList.add('hidden');
    }
}

function renderHistory() {
    UI.chatLog.innerHTML = "";
    state.history.forEach(m => addMessage(m.role, m.content, false));
}

function renderCharacters() {
    UI.charList.innerHTML = "";
    state.characters.forEach((c, index) => {
        const div = document.createElement('div');
        div.className = 'char-card';
        const avatarSrc = c.avatar || DEFAULT_AI_AVATAR;
        div.innerHTML = `
            <img src="${DOMPurify.sanitize(avatarSrc)}" alt="avatar">
            <div class="char-info">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="char-title">${DOMPurify.sanitize(c.name)}</div>
                    <button class="char-del" data-index="${index}" style="background:transparent; border:none; color:#fb7185; cursor:pointer; font-size:1.2rem;">×</button>
                </div>
                <div class="char-preview">${DOMPurify.sanitize(c.prompt)}</div>
            </div>
        `;
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('char-del')) return;
            state.activeCharacter = c;
            UI.sysPrompt.value = c.prompt;
            save();
            renderActiveCharacter();
            UI.charModal.classList.remove('show');
        });
        div.querySelector('.char-del').addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.activeCharacter && state.activeCharacter.name === c.name) {
                state.activeCharacter = null;
                renderActiveCharacter();
            }
            state.characters.splice(index, 1);
            save();
            renderCharacters();
        });
        UI.charList.appendChild(div);
    });
}

function addMessage(role, content, streaming = false) {
    let container = streaming ? document.getElementById('streaming-container') : null;
    if (!container) {
        container = document.createElement('div');
        container.className = `msg-container ${role}`;
        if (streaming) container.id = 'streaming-container';

        const avatar = document.createElement('img');
        avatar.className = 'msg-avatar';
        if (role === 'user') {
            avatar.src = DEFAULT_USER_AVATAR;
        } else if (role === 'assistant') {
            avatar.src = (state.activeCharacter && state.activeCharacter.avatar) ? state.activeCharacter.avatar : DEFAULT_AI_AVATAR;
        } else {
            avatar.style.display = 'none';
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${role}`;
        
        const inner = document.createElement('div');
        inner.className = 'content';
        msgDiv.appendChild(inner);

        if (!streaming && role !== 'system') {
            const actions = document.createElement('div');
            actions.className = 'action-row';

            if (role === 'user') {
                const editBtn = document.createElement('button');
                editBtn.className = 'action-btn';
                editBtn.innerText = 'Edit & Redo';
                editBtn.onclick = () => {
                    const domNodes = Array.from(UI.chatLog.children);
                    const domIndex = domNodes.indexOf(container);
                    UI.prompt.value = state.history[domIndex].content;
                    UI.prompt.style.height = 'auto';
                    UI.prompt.style.height = (UI.prompt.scrollHeight) + 'px';
                    state.history = state.history.slice(0, domIndex);
                    while(UI.chatLog.children.length > domIndex) {
                        UI.chatLog.lastChild.remove();
                    }
                    save();
                };
                actions.appendChild(editBtn);
            }

            if (role === 'assistant') {
                const regenBtn = document.createElement('button');
                regenBtn.className = 'action-btn';
                regenBtn.innerText = 'Redo';
                regenBtn.onclick = () => {
                    const domNodes = Array.from(UI.chatLog.children);
                    const domIndex = domNodes.indexOf(container);
                    state.history = state.history.slice(0, domIndex);
                    while(UI.chatLog.children.length > domIndex) {
                        UI.chatLog.lastChild.remove();
                    }
                    save();
                    execute();
                };
                actions.appendChild(regenBtn);
            }

            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn danger';
            delBtn.innerText = 'Delete';
            delBtn.onclick = () => {
                const domNodes = Array.from(UI.chatLog.children);
                const domIndex = domNodes.indexOf(container);
                state.history.splice(domIndex, 1);
                container.remove();
                save();
            };
            actions.appendChild(delBtn);
            msgDiv.appendChild(actions);
        }
        
        container.appendChild(avatar);
        container.appendChild(msgDiv);
        UI.chatLog.appendChild(container);
    }
    
    const target = container.querySelector('.content');
    target.innerHTML = DOMPurify.sanitize(marked.parse(content), { ADD_TAGS: ['think'] });
    
    if (isAutoScrolling) {
        UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
    }
    return target;
}

async function healMemory() {
    if (state.history.length < 5) return;
    UI.status.textContent = "HEALING";
    const summaryPrompt = `CRITICAL: Summarize the conversation. Extract: 1. Completed tasks 2. Pending goals 3. Technical constraints.`;
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${UI.apiKey.value}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: UI.model.value,
                messages: [...state.history, { role: "user", content: summaryPrompt }]
            })
        });
        if (res.ok) {
            const data = await res.json();
            UI.persistMem.value = data.choices[0].message.content;
            state.history = state.history.slice(-4);
            save();
            renderHistory();
        }
    } catch (e) {} finally {
        UI.status.textContent = "READY";
    }
}

async function execute() {
    const input = UI.prompt.value.trim();
    if (!input && state.history.length === 0) return;
    
    if (input) {
        state.history.push({ role: 'user', content: input });
        addMessage('user', input);
        UI.prompt.value = "";
        UI.prompt.style.height = '60px';
    }
    
    controller = new AbortController();
    UI.stopBtn.classList.remove('hidden');
    UI.sendBtn.classList.add('hidden');
    UI.status.textContent = "THINKING";
    
    const messages = [
        { role: "system", content: `${UI.sysPrompt.value}\n\n[MEMORY]\n${UI.persistMem.value}` },
        ...state.history
    ];
    
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${UI.apiKey.value}`,
                "Content-Type": "application/json"
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: UI.model.value,
                messages: messages,
                stream: true
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        const box = addMessage('assistant', "", true);
        
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
                    box.innerHTML = DOMPurify.sanitize(marked.parse(fullText), { ADD_TAGS: ['think'] });
                    if (isAutoScrolling) {
                        UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
                    }
                } catch (e) {}
            }
        }
        
        const streamContainer = document.getElementById('streaming-container');
        if (streamContainer) streamContainer.id = "";
        
        state.history.push({ role: 'assistant', content: fullText });
        if (state.history.length > 20) await healMemory();
        
    } catch (e) {
        if (e.name !== 'AbortError') addMessage('system', `ERROR: ${e.message}`);
    } finally {
        UI.stopBtn.classList.add('hidden');
        UI.sendBtn.classList.remove('hidden');
        UI.status.textContent = "READY";
        controller = null;
        save();
        renderHistory();
    }
}

UI.model.addEventListener('change', save);
UI.sendBtn.addEventListener('click', execute);
UI.stopBtn.addEventListener('click', () => controller?.abort());
UI.menuBtn.addEventListener('click', () => {
    UI.sidebar.classList.toggle('show');
    UI.overlay.classList.toggle('show');
});
UI.overlay.addEventListener('click', () => {
    UI.sidebar.classList.remove('show');
    UI.overlay.classList.remove('show');
});
UI.clearBtn.addEventListener('click', () => {
    state.history = [];
    UI.chatLog.innerHTML = "";
    save();
});
UI.compressBtn.addEventListener('click', healMemory);
UI.charsBtn.addEventListener('click', () => {
    UI.sidebar.classList.remove('show');
    UI.overlay.classList.remove('show');
    UI.charModal.classList.add('show');
});
UI.closeCharModal.addEventListener('click', () => UI.charModal.classList.remove('show'));

UI.clearCharBtn.addEventListener('click', () => {
    state.activeCharacter = null;
    save();
    renderActiveCharacter();
});

UI.saveCharBtn.addEventListener('click', () => {
    const name = UI.newCharName.value.trim();
    const avatar = UI.newCharAvatar.value.trim();
    const prompt = UI.newCharPrompt.value.trim();
    if (name && prompt) {
        state.characters.push({ name, avatar, prompt });
        save();
        renderCharacters();
        UI.newCharName.value = "";
        UI.newCharAvatar.value = "";
        UI.newCharPrompt.value = "";
    }
});

UI.downloadBtn.addEventListener('click', async () => {
    const exportData = {
        history: state.history,
        character: state.activeCharacter,
        characters: state.characters,
        memory: state.memory,
        sysPrompt: UI.sysPrompt.value,
        apiKey: UI.apiKey.value,
        model: UI.model.value
    };
    const rawJson = JSON.stringify(exportData);
    const pass = prompt("Enter a password to encrypt your vault, or leave blank to export unencrypted JSON:");
    
    let outputData = rawJson;
    let ext = "json";
    
    if (pass) {
        try {
            outputData = await encryptData(rawJson, pass);
            ext = "enc";
        } catch (e) {
            alert("Encryption failed.");
            return;
        }
    }
    
    const blob = new Blob([outputData], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubybox-vault-${Date.now()}.${ext}`;
    a.click();
});

UI.importBtn.addEventListener('click', () => UI.importFile.click());

UI.importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        let text = event.target.result;
        try {
            let parsed;
            if (text.trim().startsWith('{')) {
                parsed = JSON.parse(text);
            } else {
                const pass = prompt("Vault is encrypted. Please enter your password:");
                if (!pass) return;
                const dec = await decryptData(text.trim(), pass);
                parsed = JSON.parse(dec);
            }
            
            state.history = parsed.history || [];
            state.characters = parsed.characters || [];
            state.activeCharacter = parsed.character || null;
            state.memory = parsed.memory || "";
            
            UI.persistMem.value = state.memory;
            if (parsed.sysPrompt !== undefined) UI.sysPrompt.value = parsed.sysPrompt;
            if (parsed.apiKey !== undefined) UI.apiKey.value = parsed.apiKey;
            if (parsed.model !== undefined) UI.model.value = parsed.model;
            
            save();
            renderActiveCharacter();
            renderHistory();
            renderCharacters();
            UI.importFile.value = "";
        } catch (err) {
            alert("Import failed. Wrong password or invalid file.");
        }
    };
    reader.readAsText(file);
});

UI.prompt.addEventListener('input', function() {
    this.style.height = '60px';
    this.style.height = (this.scrollHeight) + 'px';
});

UI.prompt.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        execute();
    }
});

load();
