window.AppUtils = {
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    throttle(func, wait) {
        let lastTime = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastTime >= wait) {
                lastTime = now;
                func.apply(this, args);
            }
        };
    },

    generateId() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    generateSalt() {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array));
    },

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    },

    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    isValidFileType(file, allowedTypes) {
        return allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.replace('/*', '/'));
            }
            return file.type === type;
        });
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes =['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    pick(obj, keys) {
        return keys.reduce((acc, key) => {
            if (key in obj) acc[key] = obj[key];
            return acc;
        }, {});
    },

    omit(obj, keys) {
        const keySet = new Set(keys);
        return Object.keys(obj).reduce((acc, key) => {
            if (!keySet.has(key)) acc[key] = obj[key];
            return acc;
        }, {});
    }
};