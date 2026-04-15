window.App.Crypto = {
    async deriveKey(pin, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(pin),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode(salt),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async encrypt(text, pin, salt) {
        const key = await this.deriveKey(pin, salt);
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const cipherBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(text)
        );
        return {
            cipher: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
            iv: btoa(String.fromCharCode(...iv))
        };
    },

    async decrypt(cipherBase64, ivBase64, pin, salt) {
        const key = await this.deriveKey(pin, salt);
        const dec = new TextDecoder();
        const cipher = new Uint8Array(atob(cipherBase64).split("").map(c => c.charCodeAt(0)));
        const iv = new Uint8Array(atob(ivBase64).split("").map(c => c.charCodeAt(0)));
        const plainBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            cipher
        );
        return dec.decode(plainBuffer);
    }
};
