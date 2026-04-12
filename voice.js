const VoiceManager = (() => {
    let audioContext;
    let analyser;
    let microphone;
    let javascriptNode;
    let canvas, canvasCtx;
    let isListening = false;
    let isSpeaking = false;
    let silenceTimer;
    let ttsQueue = [];
    let currentTtsSource = null;
    let sttWorker = null;
    let ttsWorker = null;
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
                const out = await tts(e.data.text);
                self.postMessage({ type: 'audio', buffer: out.audio, sampleRate: out.sampling_rate });
            } catch (err) {}
        }
    };
    `;

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
                if(onStateChange) onStateChange('ready');
            } else if (e.data.type === 'progress') {
                document.getElementById('voice-progress-container').classList.remove('hidden');
                document.getElementById('voice-progress-bar').style.width = '50%';
            } else if (e.data.type === 'transcription') {
                if(onTranscription) onTranscription(e.data.text);
                if(onStateChange) onStateChange('thinking');
            } else if (e.data.type === 'audio') {
                playAudioBuffer(e.data.buffer, e.data.sampleRate);
            }
        };
        sttWorker.postMessage({ type: 'init' });
    }

    async function startListening() {
        if (!audioContext) {
            audioContext = new AudioContext({ sampleRate: 16000 });
        }
        if (audioContext.state === 'suspended') await audioContext.resume();

        stopPlayback();
        ttsQueue = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.smoothingTimeConstant = 0.5;
            analyser.fftSize = 1024;

            javascriptNode = audioContext.createScriptProcessor(1024, 1, 1);
            microphone.connect(analyser);
            analyser.connect(javascriptNode);
            javascriptNode.connect(audioContext.destination);

            let audioChunks = [];
            isListening = true;
            if(onStateChange) onStateChange('listening');

            javascriptNode.onaudioprocess = (e) => {
                if (!isListening) return;
                const inputData = e.inputBuffer.getChannelData(0);
                audioChunks.push(new Float32Array(inputData));

                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                let sum = 0;
                for (let i = 0; i < array.length; i++) sum += array[i];
                const average = sum / array.length;

                drawVisualizer(array);

                if (average > 10) {
                    clearTimeout(silenceTimer);
                    silenceTimer = setTimeout(() => {
                        stopListening(audioChunks);
                    }, 1500); 
                }
            };
        } catch (err) {
            if(onStateChange) onStateChange('error');
        }
    }

    function stopListening(chunks) {
        isListening = false;
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

    function queueText(text) {
        ttsQueue.push(text);
        processQueue();
    }

    function processQueue() {
        if (isSpeaking || ttsQueue.length === 0) return;
        isSpeaking = true;
        if(onStateChange) onStateChange('speaking');
        const text = ttsQueue.shift();
        sttWorker.postMessage({ type: 'speak', text });
    }

    function playAudioBuffer(bufferData, sampleRate) {
        if (!audioContext) return;
        const audioBuffer = audioContext.createBuffer(1, bufferData.length, sampleRate);
        audioBuffer.getChannelData(0).set(bufferData);

        currentTtsSource = audioContext.createBufferSource();
        currentTtsSource.buffer = audioBuffer;
        
        const vizAnalyser = audioContext.createAnalyser();
        currentTtsSource.connect(vizAnalyser);
        vizAnalyser.connect(audioContext.destination);

        currentTtsSource.onended = () => {
            isSpeaking = false;
            currentTtsSource = null;
            if (ttsQueue.length > 0) {
                processQueue();
            } else {
                if(onStateChange) onStateChange('ready');
                drawVisualizer(new Uint8Array(vizAnalyser.frequencyBinCount));
            }
        };

        currentTtsSource.start(0);
        
        function drawOutput() {
            if(!isSpeaking) return;
            requestAnimationFrame(drawOutput);
            const arr = new Uint8Array(vizAnalyser.frequencyBinCount);
            vizAnalyser.getByteFrequencyData(arr);
            drawVisualizer(arr);
        }
        drawOutput();
    }

    function stopPlayback() {
        if (currentTtsSource) {
            currentTtsSource.stop();
            currentTtsSource.disconnect();
            currentTtsSource = null;
        }
        ttsQueue = [];
        isSpeaking = false;
        if(onStateChange) onStateChange('ready');
    }

    function stopAll() {
        isListening = false;
        stopPlayback();
        if (microphone) microphone.disconnect();
        if (javascriptNode) javascriptNode.disconnect();
        clearTimeout(silenceTimer);
    }

    function drawVisualizer(dataArray) {
        if (!canvasCtx) return;
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        canvasCtx.clearRect(0, 0, width, height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#ffb6c1';
        canvasCtx.beginPath();

        const sliceWidth = width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
    }

    return { init, startListening, queueText, stopPlayback, stopAll };
})();
