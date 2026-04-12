const UI = {
    chatLog: document.getElementById('chat-log'),
    prompt: document.getElementById('prompt'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    costDisplay: document.getElementById('cost-display'),
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
    newCharPrompt: document.getElementById('newCharPrompt'),
    saveCharBtn: document.getElementById('saveCharBtn'),
    downloadBtn: document.getElementById('download-btn')
};

marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-'
});

let controller = null;
let state = JSON.parse(localStorage.getItem('rb_glass_state')) || {
    history: [],
    cost: 0,
    memory: "",
    characters: []
};

const save = () => {
    state.memory = UI.persistMem.value;
    localStorage.setItem('rb_glass_state', JSON.stringify(state));
    localStorage.setItem('rb_glass_key', UI.apiKey.value);
    localStorage.setItem('rb_glass_sys', UI.sysPrompt.value);
};

const load = () => {
    UI.apiKey.value = localStorage.getItem('rb_glass_key') || "";
    UI.sysPrompt.value = localStorage.getItem('rb_glass_sys') || "";
    UI.persistMem.value = state.memory || "";
    UI.costDisplay.textContent = `$${state.cost.toFixed(5)}`;
    renderHistory();
    renderCharacters();
};

function renderHistory() {
    UI.chatLog.innerHTML = "";
    state.history.forEach(m => addMessage(m.role, m.content, false));
}

function renderCharacters() {
    UI.charList.innerHTML = "";
    state.characters.forEach((c, index) => {
        const div = document.createElement('div');
        div.className = 'char-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-title">${DOMPurify.sanitize(c.name)}</div>
                <button class="char-del" data-index="${index}">×</button>
            </div>
            <div class="char-preview">${DOMPurify.sanitize(c.prompt)}</div>
        `;
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('char-del')) return;
            UI.sysPrompt.value = c.prompt;
            save();
            UI.charModal.classList.remove('show');
        });
        div.querySelector('.char-del').addEventListener('click', (e) => {
            e.stopPropagation();
            state.characters.splice(index, 1);
            save();
            renderCharacters();
        });
        UI.charList.appendChild(div);
    });
}

function addMessage(role, content, streaming = false) {
    let div = streaming ? document.getElementById('streaming-box') : null;
    if (!div) {
        div = document.createElement('div');
        div.className = `msg ${role}`;
        if (streaming) div.id = 'streaming-box';
        const inner = document.createElement('div');
        inner.className = 'content';
        if (!streaming && role !== 'system') {
            const del = document.createElement('button');
            del.className = 'msg-del-btn';
            del.innerHTML = '×';
            del.onclick = () => {
                const index = Array.from(UI.chatLog.children).indexOf(div);
                state.history.splice(index, 1);
                div.remove();
                save();
            };
            div.appendChild(del);
        }
        div.appendChild(inner);
        UI.chatLog.appendChild(div);
    }
    const target = div.querySelector('.content');
    target.innerHTML = DOMPurify.sanitize(marked.parse(content));
    UI.chatLog.scrollTo({ top: UI.chatLog.scrollHeight, behavior: 'smooth' });
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
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        const box = addMessage('ai', "", true);
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
                    box.innerHTML = DOMPurify.sanitize(marked.parse(fullText));
                    UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
                } catch (e) {}
            }
        }
        document.getElementById('streaming-box').id = "";
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
    }
}

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
UI.saveCharBtn.addEventListener('click', () => {
    const name = UI.newCharName.value.trim();
    const prompt = UI.newCharPrompt.value.trim();
    if (name && prompt) {
        state.characters.push({ name, prompt });
        save();
        renderCharacters();
        UI.newCharName.value = "";
        UI.newCharPrompt.value = "";
    }
});
UI.downloadBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.history, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubybox-${Date.now()}.json`;
    a.click();
});
UI.prompt.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});
UI.prompt.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        execute();
    }
});

load();
