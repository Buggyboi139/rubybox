const ValidationUtils = {
    isDefined(value) {
        return value !== undefined && value !== null;
    },

    isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    },

    isValidEmail(value) {
        if (typeof value !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value.trim());
    },

    isValidUrl(value) {
        if (typeof value !== 'string') return false;
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },

    isValidBase64(value) {
        if (typeof value !== 'string') return false;
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        return base64Regex.test(value) && value.length % 4 === 0;
    },

    isPositiveInteger(value) {
        return Number.isInteger(value) && value > 0;
    },

    isInRange(value, min, max) {
        return typeof value === 'number' && value >= min && value <= max;
    },

    sanitizeString(value) {
        if (typeof value !== 'string') return '';
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    truncateString(value, maxLength, suffix = '...') {
        if (typeof value !== 'string') return '';
        if (value.length <= maxLength) return value;
        return value.substring(0, maxLength - suffix.length) + suffix;
    },

    validateRequiredFields(obj, requiredFields) {
        const missingFields = [];
        
        if (!obj || typeof obj !== 'object') {
            return { valid: false, missingFields: requiredFields };
        }

        for (const field of requiredFields) {
            if (!this.isDefined(obj[field])) {
                missingFields.push(field);
            }
        }

        return {
            valid: missingFields.length === 0,
            missingFields
        };
    },

    validateMessageContent(content) {
        if (!this.isDefined(content)) {
            return { valid: false, error: 'Message content is required' };
        }

        if (typeof content === 'string') {
            if (!this.isNonEmptyString(content)) {
                return { valid: false, error: 'Message content cannot be empty' };
            }
            return { valid: true, error: null };
        }

        if (Array.isArray(content)) {
            if (content.length === 0) {
                return { valid: false, error: 'Message content array cannot be empty' };
            }
            for (const item of content) {
                if (typeof item !== 'object' || !item.type) {
                    return { valid: false, error: 'Invalid content array item' };
                }
                if (item.type === 'text' && !this.isNonEmptyString(item.text)) {
                    return { valid: false, error: 'Text content cannot be empty' };
                }
                if (item.type === 'image_url' && !item.image_url?.url) {
                    return { valid: false, error: 'Image URL is required for image content' };
                }
            }
            return { valid: true, error: null };
        }

        return { valid: false, error: 'Invalid message content format' };
    },

    validateConversationId(conversationId) {
        if (!this.isDefined(conversationId)) {
            return { valid: false, error: 'Conversation ID is required' };
        }
        if (typeof conversationId !== 'string' && typeof conversationId !== 'number') {
            return { valid: false, error: 'Conversation ID must be a string or number' };
        }
        return { valid: true, error: null };
    },

    validateChatInput(input, requireAuth = true, user = null) {
        if (requireAuth && !user) {
            return { valid: false, error: 'Please sign in first' };
        }
        if (!this.isNonEmptyString(input)) {
            return { valid: false, error: 'Message cannot be empty' };
        }
        return { valid: true, error: null };
    },

    validateTemperature(temperature) {
        const temp = parseFloat(temperature);
        if (isNaN(temp)) {
            return { valid: false, value: 0.7, error: 'Invalid temperature, using default' };
        }
        if (!this.isInRange(temp, 0, 2)) {
            return { valid: false, value: 0.7, error: 'Temperature out of range (0-2), using default' };
        }
        return { valid: true, value: temp, error: null };
    },

    validateMaxTokens(maxTokens) {
        const tokens = parseInt(maxTokens, 10);
        if (isNaN(tokens) || tokens <= 0) {
            return { valid: false, value: 2000, error: 'Invalid max tokens, using default' };
        }
        if (tokens > 32000) {
            return { valid: false, value: 32000, error: 'Max tokens exceeds limit, using 32000' };
        }
        return { valid: true, value: tokens, error: null };
    }
};

window.AppValidation = ValidationUtils;
