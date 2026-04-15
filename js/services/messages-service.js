window.AppMessagesService = {
    async list(conversationId) {
        if (!conversationId) return { data: [], error: null };

        try {
            const { data, error } = await window.supabaseClient
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return { data: data || [], error: null };
        } catch (e) {
            return { data: [], error: e };
        }
    },

    async create(data) {
        const user = window.AppState.get('user');
        if (!user) return { data: null, error: new Error('Not authenticated') };

        const payload = {
            conversation_id: data.conversation_id,
            user_id: user.id,
            role: data.role,
            content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
        };

        try {
            const { data: msg, error } = await window.supabaseClient
                .from('messages')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            return { data: msg, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async update(id, content) {
        try {
            const payload = {
                content: typeof content === 'string' ? content : JSON.stringify(content)
            };

            const { data, error } = await window.supabaseClient
                .from('messages')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async delete(id) {
        try {
            const { error } = await window.supabaseClient
                .from('messages')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    },

    async deleteAfter(conversationId, afterMessageId) {
        const user = window.AppState.get('user');
        if (!user) return { error: null };

        const messages = await this.list(conversationId);
        if (messages.error || !messages.data) return { error: messages.error };

        const afterIndex = messages.data.findIndex(m => m.id === afterMessageId);
        if (afterIndex === -1) return { error: null };

        const toDelete = messages.data.slice(afterIndex + 1);
        const idsToDelete = toDelete.map(m => m.id).filter(Boolean);

        if (idsToDelete.length === 0) return { error: null };

        try {
            const { error } = await window.supabaseClient
                .from('messages')
                .delete()
                .in('id', idsToDelete);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    },

    async deleteAll(conversationId) {
        if (!conversationId) return { error: null };

        try {
            const { error } = await window.supabaseClient
                .from('messages')
                .delete()
                .eq('conversation_id', conversationId);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    }
};
