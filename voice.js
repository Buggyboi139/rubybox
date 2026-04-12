const VoiceManager = (() => {
    let globalAudioContext;
    let globalAnalyser;
    let micAnalyser;
    let microphone;
    let javascriptNode;
    let canvas, canvasCtx;
    
    let currentState = 'idle';
    let silenceTimer;
    let ttsQueue = [];
    let activeSources = [];
    let nextStartTime = 0;
    
    let sttWorker = null;
    let isGenerating = false;
    
    let onTranscription = null;
    let onStateChange = null;

    const workerCode = `
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';
    env.allowLocalModels = false;
    
    let stt;
    let tts;

    self.onmessage = async (e) => {
        if (e.data.type === 'init') {
            self.postMessage({ type: 'progress', data: { status: 'loading' } });
            try {
                stt = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
                tts = await pipeline('text-to-speech', 'Xenova/speecht5_tts');
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
                self.postMessage({ type: 'audio', buffer: out.audio, sampleRate: out.sampling_rate });
            } catch (err) {
                self.postMessage({ type: 'audio_error' });
            }
        }
    };
    `;

    function changeState(newState) {
        currentState = newState;
        if(onStateChange) onStateChange(currentState);
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
            } else if (e.data.type === 'progress') {
                document.getElementById('voice-progress-container').classList.remove('hidden');
                document.getElementById('voice-progress-bar').style.width = '50%';
            } else if (e.data.type === 'transcription') {
                if(onTranscription) onTranscription(e.data.text);
                changeState('thinking');
            } else if (e.data.type === 'audio') {
                isGenerating = false;
                scheduleAudio(e.data.buffer, e.data.sampleRate);
                processQueue();
            } else if (e.data.type === 'audio_error') {
                isGenerating = false;
                processQueue();
            }
        };
        sttWorker.postMessage({ type: 'init' });
        drawVisualizer();
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
        if (!globalAudioContext) {
            globalAudioContext = new AudioContext({ sampleRate: 16000 });
            globalAnalyser = globalAudioContext.createAnalyser();
            globalAnalyser.connect(globalAudioContext.destination);
        }
        if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

        interruptAndListen(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone = globalAudioContext.createMediaStreamSource(stream);
            micAnalyser = globalAudioContext.createAnalyser();
            micAnalyser.smoothingTimeConstant = 0.5;
            micAnalyser.fftSize = 1024;

            javascriptNode = globalAudioContext.createScriptProcessor(1024, 1, 1);
            microphone.connect(micAnalyser);
            micAnalyser.connect(javascriptNode);
            javascriptNode.connect(globalAudioContext.destination);

            let audioChunks = [];
            changeState('listening');
            playDing();

            javascriptNode.onaudioprocess = (e) => {
                if (currentState !== 'listening') return;
                const inputData = e.inputBuffer.getChannelData(0);
                audioChunks.push(new Float32Array(inputData));

                const array = new Uint8Array(micAnalyser.frequencyBinCount);
                micAnalyser.getByteFrequencyData(array);
                let sum = 0;
                for (let i = 0; i < array.length; i++) sum += array[i];
                const average = sum / array.length;

                if (average > 10) {
                    clearTimeout(silenceTimer);
                    silenceTimer = setTimeout(() => {
                        stopRecording(audioChunks);
                    }, 1500); 
                }
            };
        } catch (err) {
            changeState('error');
        }
    }

    function stopRecording(chunks) {
        if (microphone) microphone.disconnect();
        if (javascriptNode) javascriptNode.disconnect();
        clearTimeout(silenceTimer);

        if (chunks && chunks.length > 0) {
            const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
            const combined = new Float32Array(totalLen);
            let offset = 0;
            chunks.forEach(c => { combined.set(c, offset); offset += c.length; });
            sttWorker.postMessage({ type: 'transcribe', audio: combined });
        }
    }

    let sentenceBuffer = "";
    
    function receiveDelta(delta) {
        sentenceBuffer += delta;
        let cleaned = sentenceBuffer.replace(/[*#~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
        let match = cleaned.match(/([.!?])\s+/);
        if (match) {
            let index = match.index + 1;
            let sentence = cleaned.substring(0, index);
            let isAbbrev = /(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|ie|eg)\.$/i.test(sentence.trim());
            if (!isAbbrev && sentence.trim().length > 2) {
                queueText(sentence.trim());
                sentenceBuffer = cleaned.substring(index).trim();
            }
        }
    }

    function commitBuffer() {
        let cleaned = sentenceBuffer.replace(/[*#~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
        if (cleaned.length > 0) queueText(cleaned);
        sentenceBuffer = "";
    }

    function queueText(text) {
        ttsQueue.push(text);
        processQueue();
    }

    function processQueue() {
        if (isGenerating || ttsQueue.length === 0) return;
        isGenerating = true;
        const text = ttsQueue.shift();
        sttWorker.postMessage({ type: 'speak', text });
    }

    function scheduleAudio(bufferData, sampleRate) {
        if (!globalAudioContext) return;
        const buffer = globalAudioContext.createBuffer(1, bufferData.length, sampleRate);
        buffer.getChannelData(0).set(bufferData);
        
        const source = globalAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(globalAnalyser);

        const currentTime = globalAudioContext.currentTime;
        if (nextStartTime < currentTime) nextStartTime = currentTime;
        
        source.start(nextStartTime);
        activeSources.push(source);
        
        if (currentState !== 'speaking') changeState('speaking');

        nextStartTime += buffer.duration;
        
        source.onended = () => {
            activeSources = activeSources.filter(s => s !== source);
            if (activeSources.length === 0 && ttsQueue.length === 0 && !isGenerating && currentState !== 'listening') {
                changeState('idle');
            }
        };
    }

    function interruptAndListen(skipStart = false) {
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
        nextStartTime = 0;
        if(!skipStart) startListening();
    }

    function stopAll() {
        activeSources.forEach(s => { try { s.stop(); } catch(e){} s.disconnect(); });
        activeSources = [];
        ttsQueue = [];
        sentenceBuffer = "";
        isGenerating = false;
        nextStartTime = 0;
        if (microphone) microphone.disconnect();
        if (javascriptNode) javascriptNode.disconnect();
        clearTimeout(silenceTimer);
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

    return { init, startListening, receiveDelta, commitBuffer, interruptAndListen, stopAll, getState: () => currentState };
})();
