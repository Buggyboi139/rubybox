window.AppCrypto = {
    async deriveKey(passphrase, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async encrypt(plaintext, passphrase, salt) {
        const key = await this.deriveKey(passphrase, salt);
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const cipherBuffer = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(plaintext)
        );
        return {
            cipher: this.arrayBufferToBase64(cipherBuffer),
            iv: this.arrayBufferToBase64(iv)
        };
    },

    async decrypt(cipherBase64, ivBase64, passphrase, salt) {
        const key = await this.deriveKey(passphrase, salt);
        const dec = new TextDecoder();
        const cipher = this.base64ToUint8Array(cipherBase64);
        const iv = this.base64ToUint8Array(ivBase64);
        const plainBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            cipher
        );
        return dec.decode(plainBuffer);
    },

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    base64ToUint8Array(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    async generateSalt() {
        return window.AppUtils.generateSalt();
    },

    isAvailable() {
        return !!(window.crypto && window.crypto.subtle);
    }
};
