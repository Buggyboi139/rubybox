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
    clearBtn: document.getElementById('clear-btn'),
    compressBtn: document.getElementById('compress-btn'),
    exportBtn: document.getElementById('export-btn')
};

let controller = null;
let state = JSON.parse(localStorage.getItem('rb_claw_state')) || {
    history: [],
    cost: 0,
    memory: ""
};

const save = () => {
    state.memory = UI.persistMem.value;
    localStorage.setItem('rb_claw_state', JSON.stringify(state));
    localStorage.setItem('rb_claw_key', UI.apiKey.value);
    localStorage.setItem('rb_claw_sys', UI.sysPrompt.value);
};

const load = () => {
    UI.apiKey.value = localStorage.getItem('rb_claw_key') || "";
    UI.sysPrompt.value = localStorage.getItem('rb_claw_sys') || "You are a RubyBox autonomous agent.\n1. PLAN\n2. EXECUTE\n3. REVIEW";
    UI.persistMem.value = state.memory || "";
    UI.costDisplay.textContent = `$${state.cost.toFixed(5)}`;
    renderHistory();
};

function renderHistory() {
    UI.chatLog.innerHTML = "";
    state.history.forEach(m => addMessage(m.role, m.content, false));
}

function addMessage(role, content, streaming = false) {
    let div = streaming ? document.getElementById('streaming-box') : null;
    if (!div) {
        div = document.createElement('div');
        div.className = `msg ${role}`;
        if (streaming) div.id = 'streaming-box';
        const inner = document.createElement('div');
        inner.className = 'content';
        div.appendChild(inner);
        UI.chatLog.appendChild(div);
    }
    const target = div.querySelector('.content');
    target.innerHTML = marked.parse(content);
    UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
    return target;
}

async function healMemory() {
    if (state.history.length < 5) return;
    UI.status.textContent = "HEALING...";
    const summaryPrompt = `CRITICAL TASK: Summarize the conversation so far. Extract: 1. Completed tasks 2. Pending goals 3. Technical constraints. Update the 'Self-Healing Memory' block.`;
    
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${UI.apiKey.value}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "google/gemini-2.0-flash-lite-preview-05-10:free",
            messages: [
                { role: "system", content: "You are a context compression engine." },
                ...state.history,
                { role: "user", content: summaryPrompt }
            ]
        })
    });
    const data = await res.json();
    if (data.choices) {
        UI.persistMem.value = data.choices[0].message.content;
        state.history = state.history.slice(-4);
        UI.status.textContent = "HEALED";
        save();
        renderHistory();
    }
}

async function execute() {
    const input = UI.prompt.value.trim();
    if (!input && state.history.length === 0) return;

    if (input) {
        state.history.push({ role: 'user', content: input });
        addMessage('user', input);
        UI.prompt.value = "";
    }

    controller = new AbortController();
    UI.stopBtn.classList.remove('hidden');
    UI.status.textContent = "EXECUTING";

    const systemWithMemory = `${UI.sysPrompt.value}\n\n[PERSISTENT_MEMORY]\n${UI.persistMem.value}`;
    const messages = [{ role: "system", content: systemWithMemory }, ...state.history];

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${UI.apiKey.value}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://rubybox.chat",
                "X-Title": "RubyBox Claw"
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: UI.model.value,
                messages: messages,
                stream: true,
                plugins: [{ id: "openai", cache_control: "ephemeral" }]
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        const box = addMessage('ai', "", true);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    if (line.includes("[DONE]")) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        const delta = data.choices[0].delta.content || "";
                        fullText += delta;
                        box.innerHTML = marked.parse(fullText);
                        UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
                    } catch (e) {}
                }
            }
        }

        const finalId = document.getElementById('streaming-box');
        if (finalId) finalId.id = "";
        state.history.push({ role: 'assistant', content: fullText });
        
        if (state.history.length > 20) await healMemory();

    } catch (e) {
        if (e.name !== 'AbortError') addMessage('system', `!! ERROR: ${e.message}`);
    } finally {
        UI.stopBtn.classList.add('hidden');
        UI.status.textContent = "READY";
        controller = null;
        save();
    }
}

UI.sendBtn.addEventListener('click', execute);
UI.stopBtn.addEventListener('click', () => controller?.abort());
UI.menuBtn.addEventListener('click', () => UI.sidebar.classList.toggle('open'));
UI.clearBtn.addEventListener('click', () => {
    state.history = [];
    UI.chatLog.innerHTML = "";
    save();
});
UI.compressBtn.addEventListener('click', healMemory);
UI.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubybox_claw_${Date.now()}.json`;
    a.click();
});
UI.prompt.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        execute();
    }
});

load();
