window.AppVoiceManager = {
    currentState: 'initializing',
    audioContext: null,
    analyser: null,
    micAnalyser: null,
    sessionId: 0,
    ttsQueue: [],
    activeSources: [],
    nextStartTime: 0,
    isPlaying: false,
    isGenerating: false,
    sentenceBuffer: '',
    isThinking: false,
    isStreamComplete: false,
    pendingStart: false,
    sttWorker: null,
    vadInstance: null,
    micStream: null,
    onTranscription: null,
    onStateChange: null,
    nativeRecognition: null,
    visualizerId: null,

    init(transcriptionCallback, stateCallback) {
        this.onTranscription = transcriptionCallback;
        this.onStateChange = stateCallback;
        this._changeState('initializing');
        this._initSTTWorker();
        this._initNativeRecognition();
        window.AppVoiceView.updateStatus('initializing');
    },

    _changeState(newState) {
        this.currentState = newState;
        if (this.onStateChange) this.onStateChange(newState);
        window.AppVoiceView.updateStatus(newState);
    },

    _initSTTWorker() {
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

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.sttWorker = new Worker(URL.createObjectURL(blob), { type: 'module' });

        this.sttWorker.onmessage = (e) => {
            if (e.data.type === 'ready') {
                window.AppVoiceView.hideProgress();
                this._changeState('idle');
                if (this.pendingStart) {
                    this.pendingStart = false;
                    this.startListening();
                }
            } else if (e.data.type === 'error') {
                this._changeState('error');
            } else if (e.data.type === 'download_progress') {
                window.AppVoiceView.showProgress(Math.random() * 80 + 10);
            } else if (e.data.type === 'transcription') {
                if (this.onTranscription) this.onTranscription(e.data.text);
                this._changeState('thinking');
            }
        };

        this.sttWorker.postMessage({ type: 'init' });
    },

    _initNativeRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.nativeRecognition = new SpeechRecognition();
            this.nativeRecognition.continuous = false;
            this.nativeRecognition.interimResults = false;
            this.nativeRecognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                if (this.onTranscription) this.onTranscription(text);
                this._changeState('thinking');
            };
            this.nativeRecognition.onerror = () => { this._changeState('idle'); };
            this.nativeRecognition.onend = () => {
                if (this.currentState === 'listening') this._changeState('idle');
            };
        }
    },

    _startVisualizer() {
        if (this.visualizerId) return;
        const canvas = document.getElementById('voice-visualizer');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const draw = () => {
            this.visualizerId = requestAnimationFrame(draw);
            
            // Match internal dimensions to actual display layout to prevent stretching
            if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
            if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let activeAnalyser = null;
            if (this.currentState === 'listening' || this.currentState === 'thinking') {
                activeAnalyser = this.micAnalyser;
                ctx.strokeStyle = '#06b6d4'; // Cyan for user
            } else if (this.currentState === 'speaking') {
                activeAnalyser = this.analyser;
                ctx.strokeStyle = '#10b981'; // Green for AI
            }
            
            // Draw baseline if waiting/idle/no active analyser
            if (!activeAnalyser) {
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.stroke();
                return;
            }
            
            const bufferLength = activeAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            activeAnalyser.getByteTimeDomainData(dataArray);
            
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };
        draw();
    },

    async startListening() {
        this.sessionId++;
        this._resetTTS();
        this._changeState('listening');
        this._playDing();

        if (!this.audioContext) {
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.connect(this.audioContext.destination);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.smoothingTimeConstant = 0.5;
            this.micAnalyser.fftSize = 1024;
            this._startVisualizer();
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        try {
            if (this.micStream) {
                this.micStream.getTracks().forEach(t => t.stop());
            }
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (window.vad && window.vad.MicVAD) {
                this.vadInstance = await window.vad.MicVAD.new({
                    stream: this.micStream,
                    onSpeechEnd: (audio) => {
                        this.vadInstance.pause();
                        this.sttWorker.postMessage({ type: 'transcribe', audio });
                    }
                });
                this.vadInstance.start();

                const dummySource = this.audioContext.createMediaStreamSource(this.micStream);
                dummySource.connect(this.micAnalyser);
            }
        } catch (err) {
            this._changeState('error');
        }
    },

    receiveDelta(delta) {
        if (delta.includes('<think>')) {
            this.isThinking = true;
        }
        if (delta.includes('</think>')) {
            this.isThinking = false;
            const parts = delta.split('</think>');
            delta = parts.length > 1 ? parts[1] : '';
        } else if (this.isThinking) {
            return;
        }
        
        if (!delta) return;

        this.sentenceBuffer += delta;
        let cleaned = this.sentenceBuffer
            .replace(/[*#~`]/g, '')
            .replace(/\[.*?\]\(.*?\)/g, '');
        let parts = cleaned.split(/([.!?]+|\n{2,})/);

        if (parts.length > 1) {
            let nextBuffer = parts.pop();
            let currentSentence = '';
            for (let i = 0; i < parts.length; i++) {
                currentSentence += parts[i];
                if (i % 2 === 1) {
                    const isAbbrev = /(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|ie|eg)[.!?]$/i.test(currentSentence);
                    if (!isAbbrev) {
                        if (currentSentence.trim().length > 1) {
                            this._queueText(currentSentence.trim());
                        }
                        currentSentence = '';
                    }
                }
            }
            this.sentenceBuffer = currentSentence + nextBuffer;
        } else if (cleaned.length > 250) {
            const spaceIndex = cleaned.lastIndexOf(' ', 250);
            if (spaceIndex > 0) {
                this._queueText(cleaned.substring(0, spaceIndex).trim());
                this.sentenceBuffer = cleaned.substring(spaceIndex);
            }
        }
    },

    commitBuffer() {
        let cleaned = this.sentenceBuffer
            .replace(/[*#~`]/g, '')
            .replace(/\[.*?\]\(.*?\)/g, '')
            .trim();
        if (cleaned.length > 0) this._queueText(cleaned);
        this.sentenceBuffer = '';
    },

    markStreamComplete() {
        this.isStreamComplete = true;
        if (!this.isPlaying) {
            if (this.ttsQueue.length > 0) {
                this.isPlaying = true;
                this._processQueue();
            } else {
                // Return control back if the response stripped out all speech/text
                this._checkConversationTurn();
            }
        }
    },

    _queueText(text) {
        if (!/[a-zA-Z0-9]/.test(text)) return;
        this.ttsQueue.push({ text, delay: 0.1 });
        if (!this.isPlaying && (this.ttsQueue.length >= 1 || this.isStreamComplete)) {
            this.isPlaying = true;
            this._processQueue();
        } else if (this.isPlaying && !this.isGenerating) {
            this._processQueue();
        }
    },

    async _processQueue() {
        if (this.isGenerating || this.ttsQueue.length === 0) {
            if (this.ttsQueue.length === 0 && this.isStreamComplete) {
                this.isPlaying = false;
            }
            return;
        }

        const ttsKey = window.AppState.get('decryptedTtsKey');
        if (!ttsKey) {
            window.AppToasts.show('Missing Google TTS API Key', 'error');
            this.stopAll();
            return;
        }

        const ui = window.AppUI.get();
        const selectedVoice = ui.googleVoiceSelect?.value || 'en-US-Journey-F';
        const langCode = selectedVoice.substring(0, 5);

        this.isGenerating = true;
        const item = this.ttsQueue.shift();
        const activeSessionId = this.sessionId;

        try {
            const response = await fetch(
                `${window.AppConfig.GOOGLE_TTS_URL}?key=${ttsKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: { text: item.text },
                        voice: { languageCode: langCode, name: selectedVoice },
                        audioConfig: { audioEncoding: 'MP3' }
                    })
                }
            );

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();

            if (data.audioContent && activeSessionId === this.sessionId) {
                const audioBuffer = window.AppTTSService.decodeAudioBase64(data.audioContent);
                const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer);
                this._scheduleAudio(decodedBuffer, item.delay);
            }
        } catch (e) {
            console.error('TTS error:', e);
        } finally {
            this.isGenerating = false;
            if (activeSessionId === this.sessionId) this._processQueue();
            this._checkConversationTurn();
        }
    },

    _scheduleAudio(buffer, delay) {
        if (!this.audioContext) return;
        
        // Wake context if the browser suspended it aggressively
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyser);

        const currentTime = this.audioContext.currentTime;
        if (this.nextStartTime < currentTime) this.nextStartTime = currentTime + 0.1;

        source.start(this.nextStartTime);
        this.activeSources.push(source);
        if (this.currentState !== 'speaking') this._changeState('speaking');

        this.nextStartTime += buffer.duration + (delay || 0.1);
        source.onended = () => {
            this.activeSources = this.activeSources.filter(s => s !== source);
            this._checkConversationTurn();
        };
    },

    _checkConversationTurn() {
        const speaking = this.activeSources.length > 0;
        if (!speaking && this.ttsQueue.length === 0 && !this.isGenerating && this.isStreamComplete && this.currentState !== 'listening') {
            this.isStreamComplete = false;
            this.startListening();
        }
    },

    interruptAndListen() {
        this.startListening();
    },

    stopAll() {
        this.sessionId++;
        this.activeSources.forEach(s => {
            try { s.stop(); } catch (e) {}
            s.disconnect();
        });
        this.activeSources = [];
        if (this.vadInstance) {
            this.vadInstance.destroy();
            this.vadInstance = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.visualizerId) {
            cancelAnimationFrame(this.visualizerId);
            this.visualizerId = null;
        }
        this._resetTTS();
        this._changeState('idle');
    },

    _resetTTS() {
        this.ttsQueue = [];
        this.sentenceBuffer = '';
        this.isGenerating = false;
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.isStreamComplete = false;
    },

    _playDing() {
        if (!this.audioContext) return;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    },

    setPendingStart(val) {
        this.pendingStart = val;
    },

    getState() {
        return this.currentState;
    }
};