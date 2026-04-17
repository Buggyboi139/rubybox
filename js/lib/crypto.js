window.AppCrypto = {
    ITERATION_COUNT: 100000,
    KEY_LENGTH: 256,
    IV_LENGTH: 12,

    async deriveKey(passphrase, salt) {
        if (!passphrase || typeof passphrase !== 'string') {
            throw new window.AppErrors.InvalidPassphraseError('Passphrase must be a non-empty string');
        }
        
        if (!salt || typeof salt !== 'string') {
            throw new window.AppErrors.CryptoError('Salt must be a non-empty string');
        }

        try {
            if (!this.isAvailable()) {
                throw new window.AppErrors.CryptoError('Web Crypto API is not available');
            }

            const encoder = new TextEncoder();
            
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(passphrase),
                { name: 'PBKDF2' },
                false,
                ['deriveBits', 'deriveKey']
            );

            const key = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode(salt),
                    iterations: this.ITERATION_COUNT,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: this.KEY_LENGTH },
                false,
                ['encrypt', 'decrypt']
            );

            return key;
            
        } catch (error) {
            if (error instanceof window.AppErrors.CryptoError) {
                throw error;
            }
            console.error('[Crypto] Key derivation error:', error);
            throw new window.AppErrors.CryptoError('Failed to derive encryption key');
        }
    },

    async encrypt(plaintext, passphrase, salt) {
        if (!plaintext || typeof plaintext !== 'string') {
            throw new window.AppErrors.EncryptionFailedError('Plaintext must be a non-empty string');
        }

        try {
            const key = await this.deriveKey(passphrase, salt);
            const encoder = new TextEncoder();
            const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
            
            const cipherBuffer = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encoder.encode(plaintext)
            );

            return {
                cipher: this._arrayBufferToBase64(cipherBuffer),
                iv: this._arrayBufferToBase64(iv)
            };
            
        } catch (error) {
            if (error instanceof window.AppErrors.AppError) {
                throw error;
            }
            console.error('[Crypto] Encryption error:', error);
            throw new window.AppErrors.EncryptionFailedError('Encryption operation failed');
        }
    },

    async decrypt(cipherBase64, ivBase64, passphrase, salt) {
        if (!cipherBase64 || typeof cipherBase64 !== 'string') {
            throw new window.AppErrors.DecryptionFailedError('Ciphertext must be a non-empty string');
        }
        
        if (!ivBase64 || typeof ivBase64 !== 'string') {
            throw new window.AppErrors.DecryptionFailedError('IV must be a non-empty string');
        }

        try {
            const key = await this.deriveKey(passphrase, salt);
            const decoder = new TextDecoder();
            
            const cipher = this._base64ToUint8Array(cipherBase64);
            const iv = this._base64ToUint8Array(ivBase64);
            
            if (cipher.length === 0) {
                throw new window.AppErrors.DecryptionFailedError('Invalid ciphertext');
            }
            
            if (iv.length !== this.IV_LENGTH) {
                throw new window.AppErrors.DecryptionFailedError('Invalid IV length');
            }

            const plainBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                cipher
            );

            return decoder.decode(plainBuffer);
            
        } catch (error) {
            if (error instanceof window.AppErrors.AppError) {
                throw error;
            }
            if (error.name === 'OperationError') {
                throw new window.AppErrors.InvalidPassphraseError('Decryption failed - invalid passphrase or corrupted data');
            }
            console.error('[Crypto] Decryption error:', error);
            throw new window.AppErrors.DecryptionFailedError('Decryption operation failed');
        }
    },

    async generateSalt() {
        return window.AppUtils.generateSalt();
    },

    isAvailable() {
        return !!(window.crypto && window.crypto.subtle);
    },

    _arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    _base64ToUint8Array(base64) {
        if (!base64 || typeof base64 !== 'string') {
            throw new window.AppErrors.CryptoError('Invalid Base64 string');
        }
        
        try {
            const binary = atob(base64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        } catch (e) {
            throw new window.AppErrors.CryptoError('Failed to decode Base64 string');
        }
    }
};
