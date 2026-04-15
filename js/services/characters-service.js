window.AppCharactersService = {
    async list(mode) {
        const user = window.AppState.get('user');
        if (!user) return { data: [], error: null };

        const currentMode = mode || window.AppState.get('currentMode') || 'chat';

        try {
            const { data, error } = await window.supabaseClient
                .from('characters')
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
                .from('characters')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async create(data) {
        const user = window.AppState.get('user');
        if (!user) return { data: null, error: new Error('Not authenticated') };

        const payload = {
            user_id: user.id,
            name: data.name,
            avatar: data.avatar || '',
            system_prompt: data.system_prompt,
            mode: data.mode || window.AppState.get('currentMode') || 'chat'
        };

        try {
            const { data: char, error } = await window.supabaseClient
                .from('characters')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            return { data: char, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async update(id, data) {
        const payload = {};
        if (data.name !== undefined) payload.name = data.name;
        if (data.avatar !== undefined) payload.avatar = data.avatar;
        if (data.system_prompt !== undefined) payload.system_prompt = data.system_prompt;

        try {
            const { data: char, error } = await window.supabaseClient
                .from('characters')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data: char, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async delete(id) {
        try {
            const { error } = await window.supabaseClient
                .from('characters')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    }
};
