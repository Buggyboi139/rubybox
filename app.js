const UI = {
  menuBtn: document.getElementById('menu-toggle'),
  sidebar: document.getElementById('sidebar'),
  apiKey: document.getElementById('api-key'),
  model: document.getElementById('model-select'),
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
  compressionCount: 0
};

const SYSTEM_PROMPT = `You are the RubyBox orchestrator. 
Strict protocol:
1. PLAN: Outline steps required.
2. EXECUTE: Perform the step.
3. REVIEW: Confirm output meets requirements.
Be concise. Do not apologize.`;

function saveState() {
  localStorage.setItem('ruby_state', JSON.stringify(state));
  localStorage.setItem('ruby_key', UI.apiKey.value);
}

function loadState() {
  UI.apiKey.value = localStorage.getItem('ruby_key') || '';
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

UI.clearBtn.addEventListener('click', () => {
  state.messages = [];
  state.totalCost = 0;
  state.compressionCount = 0;
  saveState();
  renderMessages();
  updateCostDisplay();
});

UI.compressBtn.addEventListener('click', () => {
  triggerCompression();
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
    console.error("Compression failed", e);
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
    { role: "system", content: SYSTEM_PROMPT },
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
