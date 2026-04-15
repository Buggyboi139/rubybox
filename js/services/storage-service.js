window.AppStorageService = {
    async uploadImage(base64Data, prefix = 'chat') {
        const user = window.AppState.get('user');
        if (!user) return { data: null, error: new Error('Not authenticated') };

        try {
            const response = await fetch(base64Data);
            const blob = await response.blob();
            const fileName = `${prefix}_${user.id}_${Date.now()}.jpg`;

            const { data, error } = await window.supabaseClient.storage
                .from('chat_images')
                .upload(fileName, blob);

            if (error) throw error;

            const { data: urlData } = window.supabaseClient.storage
                .from('chat_images')
                .getPublicUrl(fileName);

            return { data: urlData.publicUrl, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async uploadGeneratedImage(blob, prefix = 'gen') {
        const user = window.AppState.get('user');
        if (!user) return { data: null, error: new Error('Not authenticated') };

        try {
            const fileName = `${prefix}_${user.id}_${Date.now()}.jpg`;

            const { error } = await window.supabaseClient.storage
                .from('chat_images')
                .upload(fileName, blob);

            if (error) throw error;

            const { data: urlData } = window.supabaseClient.storage
                .from('chat_images')
                .getPublicUrl(fileName);

            return { data: urlData.publicUrl, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async deleteImage(fileName) {
        try {
            const { error } = await window.supabaseClient.storage
                .from('chat_images')
                .remove([fileName]);

            if (error) throw error;
            return { error: null };
        } catch (e) {
            return { error: e };
        }
    },

    getPublicUrl(fileName) {
        const { data } = window.supabaseClient.storage
            .from('chat_images')
            .getPublicUrl(fileName);
        return data.publicUrl;
    }
};
