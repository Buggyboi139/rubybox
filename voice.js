const VoiceManager = (() => {
    let globalAudioContext;
    let globalAnalyser;
    let micAnalyser;
    let canvas, canvasCtx;
    let currentState = 'initializing';
    let ttsQueue = [];
    let activeSources = [];
    let nextStartTime = 0;
    
    let sttWorker = null;
    let isGenerating = false;
    let currentSessionId = 0;
    let isStreamComplete = false;
    let pendingStart = false;
    let silenceTimer = null;
    let activeMicStream = null;
    
    let onTranscription = null;
    let onStateChange = null;
    
    let nativeRecognition = null;
    let nativeSynth = window.speechSynthesis;
    let vadInstance = null;

    let minBufferItems = 1;
    let isPlaying = false;
    let sentenceBuffer = "";
    let isThinking = false;

    const workerCode = `
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';
    env.allowLocalModels = false;
    let stt;

    self.onmessage = async (e) => {
        if (e.data.type === 'init') {
            try {
                stt = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
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
                document.getElementById('voice-progress-container').classList.remove('hidden');
            } else if (e.data.type === 'transcription') {
                if(onTranscription) onTranscription(e.data.text);
                changeState('thinking');
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
            globalAudioContext = new AudioContext();
            globalAnalyser = globalAudioContext.createAnalyser();
            globalAnalyser.connect(globalAudioContext.destination);
            micAnalyser = globalAudioContext.createAnalyser();
            micAnalyser.smoothingTimeConstant = 0.5;
            micAnalyser.fftSize = 1024;
        }
        if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

        try {
            if (activeMicStream) {
                activeMicStream.getTracks().forEach(t => t.stop());
            }
            activeMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            changeState('listening');
            playDing();

            if (window.vad && window.vad.MicVAD) {
                vadInstance = await window.vad.MicVAD.new({
                    stream: activeMicStream,
                    onSpeechEnd: (audio) => {
                        vadInstance.pause();
                        sttWorker.postMessage({ type: 'transcribe', audio });
                    }
                });
                vadInstance.start();
                
                const dummySource = globalAudioContext.createMediaStreamSource(activeMicStream);
                dummySource.connect(micAnalyser);
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

    async function processQueue() {
        if (isGenerating || ttsQueue.length === 0) {
            if (ttsQueue.length === 0 && isStreamComplete) isPlaying = false;
            return;
        }

        const currentGoogleKey = window.App.UI.googleTtsKey ? window.App.UI.googleTtsKey.value.trim() : '';
        if (!currentGoogleKey) {
            window.App.showToast('Missing Google TTS API Key', 'error');
            stopAll();
            return;
        }

        const selectedVoice = window.App.UI.googleVoiceSelect ? window.App.UI.googleVoiceSelect.value : 'en-US-Journey-F';
        const langCode = selectedVoice.substring(0, 5); 

        isGenerating = true;
        const item = ttsQueue.shift();
        const activeSessionId = currentSessionId;

        try {
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${currentGoogleKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: item.text },
                    voice: { languageCode: langCode, name: selectedVoice },
                    audioConfig: { audioEncoding: 'MP3' }
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            
            if (data.audioContent && activeSessionId === currentSessionId) {
                const binaryString = window.atob(data.audioContent);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
                
                const decodedBuffer = await globalAudioContext.decodeAudioData(bytes.buffer);
                scheduleAudio(decodedBuffer, item.delay);
            }
        } catch (e) {
            console.error(e);
        } finally {
            isGenerating = false;
            if (activeSessionId === currentSessionId) processQueue();
            checkConversationTurn();
        }
    }
    
    function scheduleAudio(buffer, delay) {
        if (!globalAudioContext) return;
        
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
    
    function interruptAndListen() {
        startListening();
    }

    function stopAll() {
        currentSessionId++;
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        if (vadInstance) { vadInstance.destroy(); vadInstance = null; }
        if (activeMicStream) {
            activeMicStream.getTracks().forEach(t => t.stop());
            activeMicStream = null;
        }
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

    return { init, startListening, receiveDelta, commitBuffer, markStreamComplete, interruptAndListen, stopAll, setPendingStart, getState: () => currentState };
})();
