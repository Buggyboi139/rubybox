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

    const workerCode = `
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';
    import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js/+esm";
    env.allowLocalModels = false;
    
    let stt;
    let tts;

    self.onmessage = async (e) => {
        if (e.data.type === 'init') {
            try {
                stt = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                    progress_callback: data => self.postMessage({ type: 'download_progress', data })
                });
                tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
                    dtype: "q8",
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
                const out = await tts.generate(e.data.text, { voice: 'af_bella' });
                self.postMessage({ type: 'audio', buffer: out.audio, sampleRate: out.sampling_rate, sessionId: e.data.sessionId, delay: e.data.delay });
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

    function setupLegacySilenceDetection(stream) {
        if (!globalAudioContext) return;
        legacySource = globalAudioContext.createMediaStreamSource(stream);
        legacySource.connect(micAnalyser);
        
        legacyScriptNode = globalAudioContext.createScriptProcessor(1024, 1, 1);
        micAnalyser.connect(legacyScriptNode);
        
        const dummyGain = globalAudioContext.createGain();
        dummyGain.gain.value = 0;
        legacyScriptNode.connect(dummyGain);
        dummyGain.connect(globalAudioContext.destination);

        let audioChunks = [];
        legacyScriptNode.onaudioprocess = (e) => {
            if (currentState !== 'listening') return;
            const inputData = e.inputBuffer.getChannelData(0);
            audioChunks.push(new Float32Array(inputData));

            const array = new Uint8Array(micAnalyser.frequencyBinCount);
            micAnalyser.getByteFrequencyData(array);
            let sum = 0;
            for (let i = 0; i < array.length; i++) sum += array[i];
            const average = sum / array.length;

            if (average > 15) {
                clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => {
                    if (legacySource) legacySource.disconnect();
                    if (legacyScriptNode) legacyScriptNode.disconnect();
                    if (audioChunks.length > 0) {
                        const totalLen = audioChunks.reduce((acc, c) => acc + c.length, 0);
                        const combined = new Float32Array(totalLen);
                        let offset = 0;
                        audioChunks.forEach(c => { combined.set(c, offset); offset += c.length; });
                        sttWorker.postMessage({ type: 'transcribe', audio: combined });
                    }
                }, 1500); 
            }
        };
    }

    async function startListening() {
        currentSessionId++;
        isStreamComplete = false;
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
        nextStartTime = 0;
        clearTimeout(silenceTimer);
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        nativeSynth.cancel();

        const mode = (window.App && window.App.UI && window.App.UI.voiceMode) ? window.App.UI.voiceMode.value : 'local';

        if (mode === 'native' && nativeRecognition) {
            changeState('listening');
            playDing();
            try { nativeRecognition.start(); } catch(e){}
            return;
        }

        if (!globalAudioContext) {
            globalAudioContext = new AudioContext({ sampleRate: 24000 });
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

            try {
                if (window.vad && window.vad.MicVAD) {
                    vadInstance = await window.vad.MicVAD.new({
                        stream: stream,
                        onSpeechEnd: (audio) => {
                            vadInstance.pause();
                            sttWorker.postMessage({ type: 'transcribe', audio });
                        }
                    });
                    vadInstance.start();
                    const dummySource = globalAudioContext.createMediaStreamSource(stream);
                    dummySource.connect(micAnalyser);
                } else {
                    throw new Error("VAD unavailable");
                }
            } catch (err) {
                setupLegacySilenceDetection(stream);
            }
        } catch (err) {
            changeState('error');
        }
    }

    let sentenceBuffer = "";
    
    let isThinking = false;

    function receiveDelta(delta) {
        if (delta.includes('<think>')) isThinking = true;
        
        if (isThinking) {
            if (delta.includes('</think>')) {
                isThinking = false;
                let parts = delta.split('</think>');
                delta = parts.length > 1 ? parts[1] : "";
            } else {
                return;
            }
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
        } else {
            if (cleaned.length > 250) {
                let spaceIndex = cleaned.lastIndexOf(' ', 250);
                if (spaceIndex > 0) {
                    queueText(cleaned.substring(0, spaceIndex).trim());
                    sentenceBuffer = cleaned.substring(spaceIndex);
                } else {
                    sentenceBuffer = cleaned;
                }
            } else {
                sentenceBuffer = cleaned;
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
        checkConversationTurn();
    }

    function queueText(text) {
        if (!/[a-zA-Z0-9]/.test(text)) return;
        let delay = 0.2;
        ttsQueue.push({ text, delay });
        processQueue();
    }

    function processQueue() {
        if (isGenerating || ttsQueue.length === 0) return;
        isGenerating = true;
        const item = ttsQueue.shift();
        
        const mode = (window.App && window.App.UI && window.App.UI.voiceMode) ? window.App.UI.voiceMode.value : 'local';
        if (mode === 'native') {
            changeState('speaking');
            const utterance = new SpeechSynthesisUtterance(item.text);
            utterance.onend = () => {
                isGenerating = false;
                processQueue();
                checkConversationTurn();
            };
            nativeSynth.speak(utterance);
        } else {
            sttWorker.postMessage({ type: 'speak', text: item.text, sessionId: currentSessionId, delay: item.delay });
        }
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

        nextStartTime += buffer.duration + (delay !== undefined ? delay : 1.0);
        
        source.onended = () => {
            activeSources = activeSources.filter(s => s !== source);
            checkConversationTurn();
        };
    }

    function checkConversationTurn() {
        const mode = (window.App && window.App.UI && window.App.UI.voiceMode) ? window.App.UI.voiceMode.value : 'local';
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
        clearTimeout(silenceTimer);
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        nativeSynth.cancel();
        if (nativeRecognition) try { nativeRecognition.stop(); } catch(e){}
        if (vadInstance) { vadInstance.destroy(); vadInstance = null; }
        if (legacySource) { legacySource.disconnect(); }
        if (legacyScriptNode) { legacyScriptNode.disconnect(); }
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
                const y = (height - 20) - (v * 40); 
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
                x += sliceWidth;
            }
            canvasCtx.stroke();
        } else if (currentState === 'thinking') {
            const t = Date.now() / 300;
            let radius = 40 + Math.sin(t) * 15;
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
                const y = height/2 + (v * 60 - 60);
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
                x += sliceWidth;
            }
            canvasCtx.stroke();
        }
    }

    return { init, startListening, receiveDelta, commitBuffer, markStreamComplete, interruptAndListen, stopPlayback, stopAll, setPendingStart, getState: () => currentState };
})();
