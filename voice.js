const VoiceManager = (() => {
    const workerCode = `
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.1';
    env.allowLocalModels = false;
    let transcriber;

    self.onmessage = async (e) => {
        if (e.data.type === 'init') {
            self.postMessage({ status: 'loading' });
            try {
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
                self.postMessage({ status: 'ready' });
            } catch (error) {
                self.postMessage({ status: 'error', message: error.message });
            }
        } else if (e.data.type === 'transcribe') {
            try {
                const result = await transcriber(e.data.audio);
                self.postMessage({ status: 'complete', text: result.text });
            } catch (error) {
                self.postMessage({ status: 'error', message: error.message });
            }
        }
    };
    `;

    let worker = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let onTranscriptionComplete = null;
    let onStateChange = null;

    async function resampleAudio(audioBlob) {
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer.getChannelData(0);
    }

    function init(transcriptionCallback, stateCallback) {
        onTranscriptionComplete = transcriptionCallback;
        onStateChange = stateCallback;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
        
        worker.onmessage = (e) => {
            if (e.data.status === 'loading') {
                if (onStateChange) onStateChange('loading');
            } else if (e.data.status === 'ready') {
                if (onStateChange) onStateChange('ready');
            } else if (e.data.status === 'complete') {
                if (onTranscriptionComplete) onTranscriptionComplete(e.data.text);
                if (onStateChange) onStateChange('ready');
            } else if (e.data.status === 'error') {
                if (onStateChange) onStateChange('error');
            }
        };
        worker.postMessage({ type: 'init' });
    }

    async function toggleRecording() {
        if (!worker) return;

        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            if (onStateChange) onStateChange('thinking');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioData = await resampleAudio(audioBlob);
                worker.postMessage({ type: 'transcribe', audio: audioData });
            };

            mediaRecorder.start();
            isRecording = true;
            if (onStateChange) onStateChange('recording');
        } catch (err) {
            if (onStateChange) onStateChange('error');
        }
    }

    function speakText(text) {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        
        const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '')
                              .replace(/```[\s\S]*?```/g, 'Code block omitted.')
                              .replace(/[*_#`]/g, '');
                              
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.lang.includes('en-US'));
            if (preferredVoice) utterance.voice = preferredVoice;
        }
        utterance.rate = 1.05;
        speechSynthesis.speak(utterance);
    }

    function stopSpeaking() {
        if (window.speechSynthesis) speechSynthesis.cancel();
    }

    return {
        init,
        toggleRecording,
        speakText,
        stopSpeaking,
        get isRecording() { return isRecording; }
    };
})();
