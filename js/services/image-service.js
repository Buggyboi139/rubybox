window.AppImageService = {
    async generate(prompt, options = {}) {
        const width = options.width || 512;
        const height = options.height || 512;

        try {
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `${window.AppConfig.POLLINATIONS_URL}/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Image generation failed');

            const blob = await response.blob();
            const uploadResult = await window.AppStorageService.uploadGeneratedImage(blob, 'gen');

            if (uploadResult.error) {
                return { data: url, error: null };
            }

            return { data: uploadResult.data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async generateScenario(sdPrompt) {
        try {
            const encodedPrompt = encodeURIComponent(sdPrompt);
            const url = `${window.AppConfig.POLLINATIONS_URL}/${encodedPrompt}?width=512&height=512&nologo=true`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Scenario image generation failed');

            const blob = await response.blob();
            const uploadResult = await window.AppStorageService.uploadGeneratedImage(blob, 'scenario');

            if (uploadResult.error) {
                return { data: url, error: null };
            }

            return { data: uploadResult.data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async generateAvatar(avatarPrompt) {
        try {
            const encodedPrompt = encodeURIComponent(avatarPrompt);
            const url = `${window.AppConfig.POLLINATIONS_URL}/${encodedPrompt}?width=512&height=512&nologo=true`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Avatar generation failed');

            const blob = await response.blob();
            const uploadResult = await window.AppStorageService.uploadGeneratedImage(blob, 'architect');

            if (uploadResult.error) {
                return { data: url, error: null };
            }

            return { data: uploadResult.data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    }
};
