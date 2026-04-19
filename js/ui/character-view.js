window.AppCharacterView = {
    renderCharacterList(characters) {
        const ui = window.AppUI.get();
        ui.charList.innerHTML = '';
        const fragment = document.createDocumentFragment();

        characters.forEach(char => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.dataset.id = char.id;

            const avatarSrc = char.avatar || window.AppConfig.DEFAULT_AI_AVATAR;
            card.innerHTML = `
                <button class="char-edit" data-id="${DOMPurify.sanitize(char.id)}">✎</button>
                <button class="char-del" data-id="${DOMPurify.sanitize(char.id)}">&times;</button>
                <img src="${DOMPurify.sanitize(avatarSrc)}" alt="avatar">
                <div class="char-title">${DOMPurify.sanitize(char.name)}</div>
                <div class="char-preview-tooltip">${DOMPurify.sanitize(char.system_prompt)}</div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('char-del') || e.target.classList.contains('char-edit')) return;
                window.AppFeaturesPersonas.selectCharacter(char);
            });

            card.querySelector('.char-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                window.AppFeaturesPersonas.openEditMode(char);
            });

            card.querySelector('.char-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.AppFeaturesPersonas.deleteCharacter(char.id);
            });

            fragment.appendChild(card);
        });
        
        ui.charList.appendChild(fragment);
    },

    renderActiveCharacter() {
        const ui = window.AppUI.get();
        const active = window.AppState.get('activeCharacter');

        if (!active) {
            ui.activeCharDisplay?.classList.add('hidden');
            return;
        }

        ui.activeCharDisplay?.classList.remove('hidden');
        ui.activeCharImg.src = DOMPurify.sanitize(active.avatar || window.AppConfig.DEFAULT_AI_AVATAR);

        const isBase = active.id?.startsWith('base-');
        ui.activeCharName.innerHTML = `${DOMPurify.sanitize(active.name)} ${isBase ? '<span class="base-badge">BASE</span>' : ''}`;

        ui.prompt.disabled = false;
        ui.prompt.placeholder = 'Message...';
        ui.sendBtn.disabled = false;
    },

    clearActiveCharacter() {
        const mode = window.AppState.get('currentMode');
        const base = window.AppConfig.BASE_PERSONAS[mode] || window.AppConfig.BASE_PERSONAS.chat;
        window.AppState.set('activeCharacter', base);
        this.renderActiveCharacter();
    }
};