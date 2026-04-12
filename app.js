const UI = {
  menuBtn: document.getElementById('menu-toggle'),
  sidebar: document.getElementById('sidebar'),
  apiKey: document.getElementById('api-key'),
  model: document.getElementById('model-select'),
  systemPrompt: document.getElementById('system-prompt'),
  charUpload: document.getElementById('char-upload'),
  charNameDisplay: document.getElementById('char-name'),
  importUpload: document.getElementById('import-upload'),
  exportBtn: document.getElementById('export-btn'),
  clearBtn: document.getElementById('clear-btn'),
  compressBtn: document.getElementById('compress-btn'),
  chatLog: document.getElementById('chat-log'),
  prompt: document.getElementById('prompt'),
  sendBtn: document.getElementById('send-btn'),
  status: document.getElementById('status'),
  costDisplay: document.getElementById('cost-display')
};

let state = JSON.parse(localStorage.getItem('ruby_state')) || {
  messages: [],
  totalCost: 0,
  compressionCount: 0,
  sysPrompt: "You are the RubyBox orchestrator.\n1. PLAN: Outline steps required.\n2. EXECUTE: Perform the step.\n3. REVIEW: Confirm output meets requirements.",
  character: null
};

function saveState() {
  state.sysPrompt = UI.systemPrompt.value;
  localStorage.setItem('ruby_state', JSON.stringify(state));
  localStorage.setItem('ruby_key', UI.apiKey.value);
}

function loadState() {
  UI.apiKey.value = localStorage.getItem('ruby_key') || '';
  UI.systemPrompt.value = state.sysPrompt || '';
  if (state.character && state.character.name) {
    UI.charNameDisplay.textContent = state.character.name;
  }
  updateCostDisplay();
  renderMessages();
}

function updateCostDisplay() {
  UI.costDisplay.textContent = `$${state.totalCost.toFixed(5)}`;
}

UI.menuBtn.addEventListener('click', () => {
  UI.sidebar.classList.toggle('open');
});

UI.apiKey.addEventListener('input', saveState);
UI.systemPrompt.addEventListener('input', saveState);

UI.clearBtn.addEventListener('click', () => {
  state.messages = [];
  state.totalCost = 0;
  state.compressionCount = 0;
  saveState();
  renderMessages();
  updateCostDisplay();
});

UI.compressBtn.addEventListener('click', triggerCompression);

UI.exportBtn.addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const el = document.createElement('a');
  el.setAttribute("href", dataStr);
  el.setAttribute("download", `rubybox_state_${Date.now()}.json`);
  document.body.appendChild(el);
  el.click();
  el.remove();
});

UI.importUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      state = parsed;
      loadState();
      saveState();
      UI.status.textContent = 'State Imported';
    } catch (err) {
      UI.status.textContent = 'ERR: BAD JSON';
    }
  };
  reader.readAsText(file);
});

UI.charUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const charData = JSON.parse(event.target.result);
      const name = charData.name || charData.data?.name || "Unknown";
      const desc = charData.description || charData.data?.description || "";
      const persona = charData.personality || charData.data?.personality || "";
      
      state.character = { name, description: desc, personality: persona };
      UI.charNameDisplay.textContent = name;
      saveState();
      UI.status.textContent = 'Char Loaded';
    } catch (err) {
      UI.status.textContent = 'ERR: CHAR PARSE';
    }
  };
  reader.readAsText(file);
});

function renderMessages() {
  UI.chatLog.innerHTML = '';
  state.messages.forEach(m => {
    if (m.role === 'system' && !m.isSummary) return;
    const div = document.createElement('div');
    div.className = `msg ${m.role === 'user' ? 'user' : (m.isSummary ? 'system' : 'ai')}`;
    div.textContent = m.content;
    UI.chatLog.appendChild(div);
  });
  UI.chatLog.scrollTop = UI.chatLog.scrollHeight;
}

function buildSystemMessage() {
  let content = UI.systemPrompt.value;
  if (state.character) {
    content += `\n\nCHARACTER IDENTITY:\nName: ${state.character.name}\nPersonality: ${state.character.personality}\nDescription: ${state.character.description}`;
  }
  return content;
}

async function triggerCompression() {
  if (state.messages.length < 4) return;
  
  UI.status.textContent = 'Compressing...';
  const key = UI.apiKey.value.trim();
  
  const compressionPrompt = "Summarize the following conversation retaining all factual data, decisions, and uncompleted plans. Output ONLY the summary.\n\n" + 
    state.messages.map(m => `${m.role}: ${m.content}`).join('\n');

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-preview-05-10:free",
        messages: [{ role: "user", content: compressionPrompt }]
      })
    });

    const data = await res.json();
    if (data.choices && data.choices[0]) {
      const summary = data.choices[0].message.content;
      state.messages = [
        { role: "system", content: `PREVIOUS CONTEXT SUMMARY:\n${summary}`, isSummary: true },
        ...state.messages.slice(-2) 
      ];
      state.compressionCount++;
      saveState();
      renderMessages();
    }
  } catch (e) {
    UI.status.textContent = 'ERR: COMPRESSION';
  }
  UI.status.textContent = 'Idle';
}

async function orchestrate() {
  const key = UI.apiKey.value.trim();
  if (!key) {
    UI.status.textContent = 'ERR: NO KEY';
    return;
  }
  
  UI.status.textContent = 'EXEC...';
  
  if (state.messages.length > 15) {
    await triggerCompression();
  }
  
  let formattedMessages = [
    { role: "system", content: buildSystemMessage() },
    ...state.messages.map(m => ({ role: m.role, content: m.content }))
  ];

  if (formattedMessages.length > 2) {
      formattedMessages[formattedMessages.length - 2].cache_control = { type: "ephemeral" };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "RubyBox PWA"
      },
      body: JSON.stringify({
        model: UI.model.value,
        messages: formattedMessages
      })
    });

    const data = await res.json();
    
    if (data.usage && data.usage.total_cost) {
        state.totalCost += data.usage.total_cost;
        updateCostDisplay();
    }

    if (data.choices && data.choices[0]) {
      const responseMsg = data.choices[0].message;
      state.messages.push(responseMsg);
      saveState();
      renderMessages();
      
      if (responseMsg.content.includes("PLAN:") && !responseMsg.content.includes("REVIEW:")) {
         UI.status.textContent = 'LOOPING...';
         state.messages.push({ role: 'user', content: 'Continue execution.' });
         await orchestrate();
      } else {
         UI.status.textContent = 'Idle';
      }

    } else {
      UI.status.textContent = 'ERR: API';
    }
  } catch (e) {
    UI.status.textContent = 'ERR: NET';
  }
}

UI.sendBtn.addEventListener('click', () => {
  const text = UI.prompt.value.trim();
  if (!text) return;
  state.messages.push({ role: 'user', content: text });
  UI.prompt.value = '';
  saveState();
  renderMessages();
  orchestrate();
});

loadState();
