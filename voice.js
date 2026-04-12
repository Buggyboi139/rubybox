const VoiceManager = (() => {
    let globalAudioContext;
    let globalAnalyser;
    let micAnalyser;
    let canvas, canvasCtx;
    
    let currentState = 'idle';
    let ttsQueue = [];
    let activeSources = [];
    let nextStartTime = 0;
    
    let sttWorker = null;
    let isGenerating = false;
    let currentSessionId = 0;
    let isStreamComplete = false;
    let modelProgress = {};
    
    let onTranscription = null;
    let onStateChange = null;
    
    let nativeRecognition = null;
    let nativeSynth = window.speechSynthesis;
    let vadInstance = null;

    const workerCode = `
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';
    env.allowLocalModels = false;
    
    let stt;
    let tts;

    self.onmessage = async (e) => {
        if (e.data.type === 'init') {
            try {
                stt = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                    progress_callback: data => self.postMessage({ type: 'download_progress', data })
                });
                tts = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
                    progress_callback: data => self.postMessage({ type: 'download_progress', data })
                });
                self.postMessage({ type: 'ready' });
            } catch (err) {
                self.postMessage({ type: 'error', message: err.message });
            }
        } else if (e.data.type === 'transcribe') {
            try {
                const result = await stt(e.data.audio);
                self.postMessage({ type: 'transcription', text: result.text });
            } catch (err) {
                self.postMessage({ type: 'error', message: err.message });
            }
        } else if (e.data.type === 'speak') {
            try {
                const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
                const out = await tts(e.data.text, { speaker_embeddings });
                self.postMessage({ type: 'audio', buffer: out.audio, sampleRate: out.sampling_rate, sessionId: e.data.sessionId });
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
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        sttWorker = new Worker(URL.createObjectURL(blob), { type: 'module' });
        
        sttWorker.onmessage = (e) => {
            if (e.data.type === 'ready') {
                document.getElementById('voice-progress-container').classList.add('hidden');
                changeState('ready');
            } else if (e.data.type === 'download_progress') {
                const data = e.data.data;
                document.getElementById('voice-progress-container').classList.remove('hidden');
                if (data.status === 'progress') {
                    modelProgress[data.file] = data.progress;
                } else if (data.status === 'ready' || data.status === 'done') {
                    modelProgress[data.file] = 100;
                }
                let total = 0;
                let count = 0;
                for (let file in modelProgress) {
                    total += modelProgress[file];
                    count++;
                }
                let avg = count > 0 ? total / count : 0;
                document.getElementById('voice-progress-bar').style.width = avg + '%';
            } else if (e.data.type === 'transcription') {
                if(onTranscription) onTranscription(e.data.text);
                changeState('thinking');
            } else if (e.data.type === 'audio') {
                if (e.data.sessionId !== currentSessionId) return;
                isGenerating = false;
                const trimmed = trimSilence(e.data.buffer, e.data.sampleRate);
                scheduleAudio(trimmed, e.data.sampleRate);
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
        nextStartTime = 0;
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        nativeSynth.cancel();

        const mode = window.App && window.App.state && window.App.state.settings ? window.App.state.settings.voiceMode : 'local';

        if (mode === 'native' && nativeRecognition) {
            changeState('listening');
            playDing();
            try { nativeRecognition.start(); } catch(e){}
            return;
        }

        if (!globalAudioContext) {
            globalAudioContext = new AudioContext({ sampleRate: 16000 });
            globalAnalyser = globalAudioContext.createAnalyser();
            globalAnalyser.connect(globalAudioContext.destination);
            micAnalyser = globalAudioContext.createAnalyser();
        }
        if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = globalAudioContext.createMediaStreamSource(stream);
            source.connect(micAnalyser);

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
            } else {
                changeState('error');
            }
        } catch (err) {
            changeState('error');
        }
    }

    let sentenceBuffer = "";
    
    function receiveDelta(delta) {
        sentenceBuffer += delta;
        let cleaned = sentenceBuffer.replace(/[*#~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
        let parts = cleaned.split(/([.!?]["']?\s+)/);
        
        if (parts.length > 1) {
            sentenceBuffer = parts.pop();
            let currentSentence = "";
            for (let i = 0; i < parts.length; i++) {
                currentSentence += parts[i];
                if (i % 2 === 1) {
                    let isAbbrev = /(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|ie|eg)[.!?]["']?\s+$/i.test(currentSentence);
                    if (!isAbbrev) {
                        if (currentSentence.trim().length > 1) queueText(currentSentence.trim());
                        currentSentence = "";
                    }
                }
            }
            sentenceBuffer = currentSentence + sentenceBuffer;
        } else {
            sentenceBuffer = cleaned;
        }
    }

    function commitBuffer() {
        let cleaned = sentenceBuffer.replace(/[*#~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
        if (cleaned.length > 0) queueText(cleaned);
        sentenceBuffer = "";
    }

    function markStreamComplete() {
        isStreamComplete = true;
        checkConversationTurn();
    }

    function queueText(text) {
        if (!/[a-zA-Z0-9]/.test(text)) return;
        ttsQueue.push(text);
        processQueue();
    }

    function processQueue() {
        if (isGenerating || ttsQueue.length === 0) return;
        isGenerating = true;
        const text = ttsQueue.shift();
        
        const mode = window.App && window.App.state && window.App.state.settings ? window.App.state.settings.voiceMode : 'local';
        if (mode === 'native') {
            changeState('speaking');
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => {
                isGenerating = false;
                processQueue();
                checkConversationTurn();
            };
            nativeSynth.speak(utterance);
        } else {
            sttWorker.postMessage({ type: 'speak', text, sessionId: currentSessionId });
        }
    }

    function scheduleAudio(bufferData, sampleRate) {
        if (!globalAudioContext) return;
        const buffer = globalAudioContext.createBuffer(1, bufferData.length, sampleRate);
        buffer.getChannelData(0).set(bufferData);
        
        const source = globalAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(globalAnalyser);

        const currentTime = globalAudioContext.currentTime;
        if (nextStartTime < currentTime) nextStartTime = currentTime + 0.05;
        
        source.start(nextStartTime);
        activeSources.push(source);
        
        if (currentState !== 'speaking') changeState('speaking');

        nextStartTime += buffer.duration;
        
        source.onended = () => {
            activeSources = activeSources.filter(s => s !== source);
            checkConversationTurn();
        };
    }

    function checkConversationTurn() {
        const mode = window.App && window.App.state && window.App.state.settings ? window.App.state.settings.voiceMode : 'local';
        let speaking = mode === 'native' ? nativeSynth.speaking : activeSources.length > 0;
        if (!speaking && ttsQueue.length === 0 && !isGenerating && isStreamComplete && currentState !== 'listening') {
            isStreamComplete = false;
            startListening();
        }
    }

    function interruptAndListen() {
        startListening();
    }

    function stopPlayback() {
        currentSessionId++;
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        nativeSynth.cancel();
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
        nextStartTime = 0;
        isStreamComplete = false;
        changeState('idle');
    }

    function stopAll() {
        currentSessionId++;
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        nativeSynth.cancel();
        if (nativeRecognition) try { nativeRecognition.stop(); } catch(e){}
        if (vadInstance) { vadInstance.destroy(); vadInstance = null; }
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
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
            canvasCtx.lineWidth = 3;
            canvasCtx.strokeStyle = '#06b6d4';
            canvasCtx.beginPath();
            const sliceWidth = width / arr.length;
            let x = 0;
            for (let i = 0; i < arr.length; i++) {
                const v = arr[i] / 128.0;
                const y = (height - 30) - (v * 40); 
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
                x += sliceWidth;
            }
            canvasCtx.stroke();
        } else if (currentState === 'thinking') {
            const t = Date.now() / 300;
            let radius = 60 + Math.sin(t) * 20;
            canvasCtx.beginPath();
            canvasCtx.arc(width/2, height/2, radius, 0, 2*Math.PI);
            canvasCtx.fillStyle = 'rgba(168, 85, 247, 0.4)';
            canvasCtx.fill();
            canvasCtx.beginPath();
            canvasCtx.arc(width/2, height/2, radius * 0.6, 0, 2*Math.PI);
            canvasCtx.fillStyle = 'rgba(168, 85, 247, 0.8)';
            canvasCtx.fill();
        } else if (currentState === 'speaking' && globalAnalyser) {
            const arr = new Uint8Array(globalAnalyser.frequencyBinCount);
            globalAnalyser.getByteFrequencyData(arr);
            canvasCtx.lineWidth = 4;
            canvasCtx.strokeStyle = '#10b981';
            canvasCtx.beginPath();
            const sliceWidth = width / arr.length;
            let x = 0;
            for (let i = 0; i < arr.length; i++) {
                const v = arr[i] / 128.0;
                const y = height/2 + (v * 80 - 80);
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
                x += sliceWidth;
            }
            canvasCtx.stroke();
        }
    }

    return { init, startListening, receiveDelta, commitBuffer, markStreamComplete, interruptAndListen, stopPlayback, stopAll, getState: () => currentState };
})();
