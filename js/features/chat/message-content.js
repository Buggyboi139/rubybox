window.AppMessageContent = {
    normalizeToApp(content) {
        if (typeof content === 'string') {
            try {
                return JSON.parse(content);
            } catch {
                return { type: 'text', text: content };
            }
        }
        if (Array.isArray(content)) {
            return content;
        }
        return { type: 'text', text: String(content) };
    },

    serializeForDB(content) {
        if (typeof content === 'string') return content;
        return JSON.stringify(content);
    },

    serializeForDisplay(content) {
        if (typeof content === 'string') return content;
        return JSON.stringify(content);
    },

    extractText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (content.type === 'text') return content.text || '';
        if (Array.isArray(content)) {
            const textObj = content.find(c => c.type === 'text');
            return textObj ? textObj.text : '';
        }
        try {
            return JSON.stringify(content);
        } catch {
            return String(content);
        }
    },

    extractImage(content) {
        if (Array.isArray(content)) {
            const imgObj = content.find(c => c.type === 'image_url');
            return imgObj?.image_url?.url || null;
        }
        return null;
    },

    hasText(content) {
        return !!this.extractText(content);
    },

    hasImage(content) {
        return !!this.extractImage(content);
    },

    buildTextContent(text) {
        return [{ type: 'text', text }];
    },

    buildMultimodalContent(text, imageUrl) {
        const parts = [];
        if (text) parts.push({ type: 'text', text });
        if (imageUrl) parts.push({ type: 'image_url', image_url: { url: imageUrl } });
        return parts;
    },

    buildAssistantTextResponse(text) {
        return [{ type: 'text', text }];
    }
};
