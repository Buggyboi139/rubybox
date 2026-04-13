const VoiceManager = (() => {
    let globalAudioContext;
    let globalAnalyser;
    let micAnalyser;
    let canvas, canvasCtx;
    let legacyScriptNode;
    let legacySource;
    
    let currentState = 'initializing';
    let ttsQueue = [];
    let activeSources = [];
    let nextStartTime = 0;
    
    let sttWorker = null;
    let isGenerating = false;
    let currentSessionId = 0;
    let isStreamComplete = false;
    let modelProgress = {};
    let pendingStart = false;
    let silenceTimer = null;
    
    let onTranscription = null;
    let onStateChange = null;
    
    let nativeRecognition = null;
    let nativeSynth = window.speechSynthesis;
    let vadInstance = null;

    let minBufferItems = 2;
    let isPlaying = false;
    let sentenceBuffer = "";
    let isThinking = false;

    const workerCode = `
    import { PiperWebWorkerEngine, HuggingFaceVoiceProvider } from 'https://cdn.jsdelivr.net/npm/piper-tts-web/+esm';

    let engine;

    self.onmessage = async (e) => {
        if (e.data.type === 'init') {
            try {
                const voiceProvider = new HuggingFaceVoiceProvider();
                engine = new PiperWebWorkerEngine({ voiceProvider });
                self.postMessage({ type: 'ready' });
            } catch (err) {
                self.postMessage({ type: 'error', message: err.message });
            }
        } else if (e.data.type === 'speak') {
            try {
                const voiceId = 'en_US-kristin-medium'; 
                const result = await engine.generate(e.data.text, voiceId, 0);
                const arrayBuffer = await result.audio.arrayBuffer();
                self.postMessage({ 
                    type: 'audio', 
                    buffer: new Float32Array(arrayBuffer), 
                    sampleRate: 22050, 
                    sessionId: e.data.sessionId,
                    delay: e.data.delay 
                });
            } catch (err) {
                self.postMessage({ type: 'audio_error', sessionId: e.data.sessionId });
            }
        }
    };
    `;

    function changeState(newState) {
        currentState = newState;
        if(onStateChange) onStateChange(currentState);
    }

    function setPendingStart(val) {
        pendingStart = val;
    }

    function trimSilence(bufferData, sampleRate) {
        let start = 0;
        let end = bufferData.length - 1;
        const threshold = 0.01;
        while (start < bufferData.length && Math.abs(bufferData[start]) < threshold) start++;
        while (end > 0 && Math.abs(bufferData[end]) < threshold) end--;
        if (start >= end) return bufferData;
        const padding = Math.floor(sampleRate * 0.05);
        start = Math.max(0, start - padding);
        end = Math.min(bufferData.length - 1, end + padding);
        return bufferData.slice(start, end + 1);
    }

    function init(transcriptionCallback, stateCallback) {
        onTranscription = transcriptionCallback;
        onStateChange = stateCallback;
        canvas = document.getElementById('voice-visualizer');
        canvasCtx = canvas.getContext('2d');
        
        changeState('initializing');
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        sttWorker = new Worker(URL.createObjectURL(blob), { type: 'module' });
        
        sttWorker.onmessage = (e) => {
            if (e.data.type === 'ready') {
                document.getElementById('voice-progress-container').classList.add('hidden');
                changeState('idle');
                if (pendingStart) {
                    pendingStart = false;
                    startListening();
                }
            } else if (e.data.type === 'error') {
                changeState('error');
            } else if (e.data.type === 'audio') {
                if (e.data.sessionId !== currentSessionId) return;
                isGenerating = false;
                const trimmed = trimSilence(e.data.buffer, e.data.sampleRate);
                scheduleAudio(trimmed, e.data.sampleRate, e.data.delay);
                processQueue();
                checkConversationTurn();
            } else if (e.data.type === 'audio_error') {
                if (e.data.sessionId !== currentSessionId) return;
                isGenerating = false;
                processQueue();
                checkConversationTurn();
            }
        };
        sttWorker.postMessage({ type: 'init' });
        drawVisualizer();

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            nativeRecognition = new SpeechRecognition();
            nativeRecognition.continuous = false;
            nativeRecognition.interimResults = false;
            nativeRecognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                if(onTranscription) onTranscription(text);
                changeState('thinking');
            };
            nativeRecognition.onerror = () => { changeState('idle'); };
            nativeRecognition.onend = () => { if (currentState === 'listening') changeState('idle'); };
        }
    }

    function playDing() {
        if (!globalAudioContext) return;
        const osc = globalAudioContext.createOscillator();
        const gain = globalAudioContext.createGain();
        osc.connect(gain);
        gain.connect(globalAudioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, globalAudioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, globalAudioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, globalAudioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, globalAudioContext.currentTime + 0.3);
        osc.start();
        osc.stop(globalAudioContext.currentTime + 0.3);
    }

    async function startListening() {
        currentSessionId++;
        isStreamComplete = false;
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
        isPlaying = false;
        nextStartTime = 0;
        clearTimeout(silenceTimer);
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        nativeSynth.cancel();

        if (!globalAudioContext) {
            globalAudioContext = new AudioContext({ sampleRate: 22050 });
            globalAnalyser = globalAudioContext.createAnalyser();
            globalAnalyser.connect(globalAudioContext.destination);
            micAnalyser = globalAudioContext.createAnalyser();
            micAnalyser.smoothingTimeConstant = 0.5;
            micAnalyser.fftSize = 1024;
        }
        if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            changeState('listening');
            playDing();

            if (window.vad && window.vad.MicVAD) {
                vadInstance = await window.vad.MicVAD.new({
                    stream: stream,
                    onSpeechEnd: (audio) => {
                        vadInstance.pause();
                        sttWorker.postMessage({ type: 'transcribe', audio });
                    }
                });
                vadInstance.start();
            }
        } catch (err) {
            changeState('error');
        }
    }

    function receiveDelta(delta) {
        if (delta.includes('<think>')) isThinking = true;
        if (isThinking) {
            if (delta.includes('</think>')) {
                isThinking = false;
                let parts = delta.split('</think>');
                delta = parts.length > 1 ? parts[1] : "";
            } else return;
        }
        if (!delta) return;
        
        sentenceBuffer += delta;
        let cleaned = sentenceBuffer.replace(/[*#~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
        let parts = cleaned.split(/([.!?]+|\n{2,})/);
        
        if (parts.length > 1) {
            let nextBuffer = parts.pop();
            let currentSentence = "";
            for (let i = 0; i < parts.length; i++) {
                currentSentence += parts[i];
                if (i % 2 === 1) {
                    let isAbbrev = /(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|ie|eg)[.!?]$/i.test(currentSentence);
                    if (!isAbbrev) {
                        if (currentSentence.trim().length > 1) queueText(currentSentence.trim());
                        currentSentence = "";
                    }
                }
            }
            sentenceBuffer = currentSentence + nextBuffer;
        } else if (cleaned.length > 250) {
            let spaceIndex = cleaned.lastIndexOf(' ', 250);
            if (spaceIndex > 0) {
                queueText(cleaned.substring(0, spaceIndex).trim());
                sentenceBuffer = cleaned.substring(spaceIndex);
            }
        }
    }

    function commitBuffer() {
        let cleaned = sentenceBuffer.replace(/[*#~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
        if (cleaned.length > 0) queueText(cleaned);
        sentenceBuffer = "";
    }

    function markStreamComplete() {
        isStreamComplete = true;
        if (!isPlaying && ttsQueue.length > 0) {
            isPlaying = true;
            processQueue();
        }
    }

    function queueText(text) {
        if (!/[a-zA-Z0-9]/.test(text)) return;
        ttsQueue.push({ text, delay: 0.1 });
        if (!isPlaying && (ttsQueue.length >= minBufferItems || isStreamComplete)) {
            isPlaying = true;
            processQueue();
        } else if (isPlaying && !isGenerating) {
            processQueue();
        }
    }

    function processQueue() {
        if (isGenerating || ttsQueue.length === 0) {
            if (ttsQueue.length === 0 && isStreamComplete) isPlaying = false;
            return;
        }
        isGenerating = true;
        const item = ttsQueue.shift();
        sttWorker.postMessage({ type: 'speak', text: item.text, sessionId: currentSessionId, delay: item.delay });
    }

    function scheduleAudio(bufferData, sampleRate, delay) {
        if (!globalAudioContext) return;
        const buffer = globalAudioContext.createBuffer(1, bufferData.length, sampleRate);
        buffer.getChannelData(0).set(bufferData);
        
        const source = globalAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(globalAnalyser);

        const currentTime = globalAudioContext.currentTime;
        if (nextStartTime < currentTime) nextStartTime = currentTime + 0.1;
        
        source.start(nextStartTime);
        activeSources.push(source);
        if (currentState !== 'speaking') changeState('speaking');

        nextStartTime += buffer.duration + (delay || 0.1);
        source.onended = () => {
            activeSources = activeSources.filter(s => s !== source);
            checkConversationTurn();
        };
    }

    function checkConversationTurn() {
        let speaking = activeSources.length > 0;
        if (!speaking && ttsQueue.length === 0 && !isGenerating && isStreamComplete && currentState !== 'listening') {
            isStreamComplete = false;
            startListening();
        }
    }

    function stopAll() {
        currentSessionId++;
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        if (vadInstance) { vadInstance.destroy(); vadInstance = null; }
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
        isPlaying = false;
        nextStartTime = 0;
        isStreamComplete = false;
        changeState('idle');
    }

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        if (!canvasCtx) return;
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        canvasCtx.clearRect(0, 0, width, height);
        if (currentState === 'listening' && micAnalyser) {
            const arr = new Uint8Array(micAnalyser.frequencyBinCount);
            micAnalyser.getByteFrequencyData(arr);
            canvasCtx.beginPath();
            let x = 0;
            const sliceWidth = width / arr.length;
            for (let i = 0; i < arr.length; i++) {
                const v = arr[i] / 128.0;
                const y = (height - 20) - (v * 40);
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
                x += sliceWidth;
            }
            canvasCtx.strokeStyle = '#06b6d4';
            canvasCtx.stroke();
        }
    }

    return { init, startListening, receiveDelta, commitBuffer, markStreamComplete, stopAll, setPendingStart, getState: () => currentState };
})();
