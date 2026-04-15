window.AppFeaturesPersonas = {
    async loadCharacters() {
        const { data, error } = await window.AppCharactersService.list();
        if (error) return;

        window.AppState.set('characters', data || []);
        window.AppCharacterView.renderCharacterList(data || []);
    },

    async selectCharacter(char) {
        window.AppState.set('activeCharacter', char);
        window.AppCharacterView.renderActiveCharacter();
        window.AppModals.close('charModal');
        await window.AppFeaturesChat.startNewChat();
    },

    async deleteCharacter(charId) {
        await window.AppCharactersService.delete(charId);

        const active = window.AppState.get('activeCharacter');
        if (active?.id === charId) {
            window.AppState.set('activeCharacter', null);
            await window.AppFeaturesChat.startNewChat();
        }

        if (window.AppState.get('editingCharacterId') === charId) {
            this._resetEditMode();
        }

        await this.loadCharacters();
    },

    openEditMode(char) {
        window.AppState.set('editingCharacterId', char.id);
        const ui = window.AppUI.get();
        ui.newCharName.value = char.name;
        ui.newCharPrompt.value = char.system_prompt;

        if (char.avatar) {
            window.AppState.set('newCharacterAvatarBase64', char.avatar);
            ui.newCharAvatarPreview.src = char.avatar;
            ui.newCharAvatarPreview.style.display = 'block';
        } else {
            window.AppState.set('newCharacterAvatarBase64', null);
            ui.newCharAvatarPreview.src = '';
            ui.newCharAvatarPreview.style.display = 'none';
        }

        ui.saveCharBtn.textContent = 'Update Persona';
        ui.cancelEditCharBtn?.classList.remove('hidden');
    },

    _resetEditMode() {
        window.AppState.set('editingCharacterId', null);
        window.AppState.set('newCharacterAvatarBase64', null);
        const ui = window.AppUI.get();
        ui.newCharName.value = '';
        ui.newCharPrompt.value = '';
        ui.newCharAvatarPreview.style.display = 'none';
        ui.newCharAvatarPreview.src = '';
        ui.saveCharBtn.textContent = 'Save Persona';
        ui.cancelEditCharBtn?.classList.add('hidden');
    },

    async saveCharacter() {
        const user = window.AppState.get('user');
        if (!user) {
            window.AppToasts.show('Please sign in first.', 'error');
            return;
        }

        const ui = window.AppUI.get();
        const name = ui.newCharName.value.trim();
        const prompt = ui.newCharPrompt.value.trim();
        const avatar = window.AppState.get('newCharacterAvatarBase64') || '';
        const editingId = window.AppState.get('editingCharacterId');

        if (!name || !prompt) {
            window.AppToasts.show('Name and prompt are required', 'error');
            return;
        }

        if (editingId) {
            const { error } = await window.AppCharactersService.update(editingId, { name, avatar, system_prompt: prompt });
            if (error) {
                window.AppToasts.show(error.message, 'error');
                return;
            }

            const active = window.AppState.get('activeCharacter');
            if (active?.id === editingId) {
                window.AppState.set('activeCharacter', { ...active, name, avatar, system_prompt: prompt });
                window.AppCharacterView.renderActiveCharacter();
            }

            window.AppToasts.show('Persona updated');
        } else {
            const currentMode = window.AppState.get('currentMode') || 'chat';
            const { error } = await window.AppCharactersService.create({
                name,
                avatar,
                system_prompt: prompt,
                mode: currentMode
            });

            if (error) {
                window.AppToasts.show(error.message, 'error');
                return;
            }

            window.AppToasts.show('Persona saved');
        }

        this._resetEditMode();
        await this.loadCharacters();
    },

    cancelEdit() {
        this._resetEditMode();
    },

    clearCharacter() {
        window.AppCharacterView.clearActiveCharacter();
    }
};
