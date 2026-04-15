window.AppVoiceView = {
    updateStatus(status) {
        const ui = window.AppUI.get();
        const statusText = ui.voiceStatusText;
        if (!statusText) return;

        const statusMap = {
            initializing: { text: 'Initializing...', color: '#ffb6c1' },
            idle: { text: 'Ready - Tap Mic to Start', color: '#ffb6c1' },
            listening: { text: 'Listening...', color: '#06b6d4' },
            thinking: { text: 'Thinking...', color: '#a855f7' },
            speaking: { text: 'Speaking...', color: '#10b981' },
            error: { text: 'Error Occurred', color: '#fb7185' }
        };

        const config = statusMap[status] || statusMap.idle;
        statusText.textContent = config.text;
        statusText.style.color = config.color;
    },

    showProgress(percent) {
        const ui = window.AppUI.get();
        ui.voiceProgressContainer?.classList.remove('hidden');
        if (ui.voiceProgressBar) {
            ui.voiceProgressBar.style.width = `${percent}%`;
        }
    },

    hideProgress() {
        const ui = window.AppUI.get();
        ui.voiceProgressContainer?.classList.add('hidden');
        if (ui.voiceProgressBar) {
            ui.voiceProgressBar.style.width = '0%';
        }
    },

    showSheet() {
        const ui = window.AppUI.get();
        ui.voiceSheet?.classList.remove('hidden');
        setTimeout(() => ui.voiceSheet?.classList.add('show'), 10);
    },

    hideSheet() {
        const ui = window.AppUI.get();
        ui.voiceSheet?.classList.remove('show');
        setTimeout(() => ui.voiceSheet?.classList.add('hidden'), 400);
    }
};
