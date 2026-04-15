window.AppTTSService = {
    async synthesize(text, voiceName) {
        const ttsKey = window.AppState.get('decryptedTtsKey');
        if (!ttsKey) {
            return { data: null, error: new Error('Google TTS API key not available') };
        }

        const langCode = voiceName.substring(0, 5);

        try {
            const response = await fetch(
                `${window.AppConfig.GOOGLE_TTS_URL}?key=${ttsKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        input: { text },
                        voice: {
                            languageCode: langCode,
                            name: voiceName
                        },
                        audioConfig: {
                            audioEncoding: 'MP3'
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`TTS API error: ${response.status}`);
            }

            const data = await response.json();
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    decodeAudioBase64(base64String) {
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
};
