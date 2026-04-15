window.AppConversationsService = {
    async create(data) {
        const user = window.AppState.get('user');
        if (!user) return { data: null, error: new Error('Not authenticated') };

        const payload = {
            user_id: user.id,
            title: data.title || 'New Chat',
            summary_memory: data.summary_memory || '',
            mode: data.mode || window.AppState.get('currentMode') || 'chat',
            character_id: data.character_id || null
        };

        try {
            const { data: conv, error } = await window.supabaseClient
                .from('conversations')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            return { data: conv, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async list(mode) {
        const user = window.AppState.get('user');
        if (!user) return { data: [], error: null };

        const currentMode = mode || window.AppState.get('currentMode') || 'chat';

        try {
            const { data, error } = await window.supabaseClient
                .from('conversations')
                .select('*')
                .eq('user_id', user.id)
                .eq('mode', currentMode)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data: data || [], error: null };
        } catch (e) {
            return { data: [], error: e };
        }
    },

    async get(id) {
        try {
            const { data, error } = await window.supabaseClient
                .from('conversations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async update(id, updates) {
        try {
            const { data, error } = await window.supabaseClient
                .from('conversations')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async updateMemory(id, memory) {
        return this.update(id, { summary_memory: memory });
    },

    async updateTitle(id, title) {
        return this.update(id, { title });
    },

    async delete(id) {
        try {
            const { error } = await window.supabaseClient
                .from('conversations')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    },

    async deleteAll() {
        const user = window.AppState.get('user');
        if (!user) return { error: null };

        try {
            const { error } = await window.supabaseClient
                .from('conversations')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    }
};
