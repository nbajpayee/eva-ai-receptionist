/**
 * Voice AI Test Interface - Client-side JavaScript
 */

let websocket = null;
let audioContext = null;
let mediaStream = null;
let audioWorkletNode = null;
let isRecording = false;
let sessionId = null;
let nextPlaybackTime = 0;
let isAssistantSpeaking = false;  // Track if assistant is currently speaking
let activeAudioSources = [];  // Track all playing audio sources for interruption

// GPT-5's Smart Commit Strategy
let commitTimeout = null;
const COMMIT_DELAY_NORMAL_MS = 300;  // Normal delay after streaming audio
const COMMIT_DELAY_FAST_MS = 120;    // Fast delay when VAD detects speech stopped
let hasUncommittedAudio = false;
let isUserSpeaking = false;
const VAD_THRESHOLD = 0.005;  // RMS threshold for voice detection

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const connectionStatus = document.getElementById('connectionStatus');
const transcript = document.getElementById('transcript');

/**
 * Generate a unique session ID
 */
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Update connection status display
 */
function updateStatus(status, className) {
    connectionStatus.textContent = status;
    connectionStatus.className = 'status-value ' + className;
}

/**
 * Add message to transcript
 */
function addToTranscript(speaker, text) {
    // Remove empty message if exists
    const emptyMsg = transcript.querySelector('.transcript-empty');
    if (emptyMsg) {
        emptyMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `transcript-message ${speaker.toLowerCase()}`;
    messageDiv.innerHTML = `
        <div class="transcript-speaker">${speaker}</div>
        <div class="transcript-text">${text}</div>
    `;
    transcript.appendChild(messageDiv);
    transcript.scrollTop = transcript.scrollHeight;
}

/**
 * Calculate RMS (Root Mean Square) for VAD
 */
function calculateRMS(buffer) {
    if (!buffer.length) return 0;

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
}

/**
 * Clear any pending commit timeout
 */
function clearCommitTimeout() {
    if (commitTimeout) {
        clearTimeout(commitTimeout);
        commitTimeout = null;
    }
}

/**
 * Send commit to backend (GPT-5's implementation)
 */
function sendCommit(force = false) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        return;
    }

    if (!hasUncommittedAudio && !force) {
        return;
    }

    console.log('📤 Sending commit to backend');
    websocket.send(JSON.stringify({ type: 'commit' }));
    hasUncommittedAudio = false;
}

/**
 * Schedule a commit with delay (GPT-5's dual-speed strategy)
 */
function scheduleCommit(delayMs = COMMIT_DELAY_NORMAL_MS) {
    clearCommitTimeout();
    commitTimeout = setTimeout(() => {
        sendCommit();
    }, delayMs);
}

/**
 * Stop all currently playing audio (for interruptions)
 */
function stopAllAudio() {
    console.log(`✋ Stopping ${activeAudioSources.length} active audio sources`);

    // Stop all active audio sources
    activeAudioSources.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            // Source may have already stopped naturally
        }
    });

    // Clear the array
    activeAudioSources = [];

    // Reset playback timing
    if (audioContext) {
        nextPlaybackTime = audioContext.currentTime;
    }

    // Mark assistant as no longer speaking
    isAssistantSpeaking = false;
}

/**
 * Start a call session
 */
async function startCall() {
    try {
        // Generate session ID
        sessionId = generateSessionId();

        // Request microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Initialize Web Audio API
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000
        });

        // Connect to WebSocket
        const wsUrl = `ws://localhost:8000/ws/voice/${sessionId}`;
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log('WebSocket connected');
            updateStatus('Connected', 'connected');
            startBtn.disabled = true;
            stopBtn.disabled = false;

            // Start audio capture
            startAudioCapture();

            // Reset playback scheduler
            nextPlaybackTime = 0;
        };

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('Error', 'disconnected');
            addToTranscript('System', 'Connection error occurred');
        };

        websocket.onclose = () => {
            console.log('WebSocket disconnected');
            updateStatus('Disconnected', 'disconnected');
            startBtn.disabled = false;
            stopBtn.disabled = true;
            cleanupAudio();
        };

    } catch (error) {
        console.error('Error starting call:', error);
        alert('Failed to start call. Please check microphone permissions and ensure the backend is running.');
        updateStatus('Error', 'disconnected');
    }
}

/**
 * Start capturing audio from microphone
 */
async function startAudioCapture() {
    try {
        const source = audioContext.createMediaStreamSource(mediaStream);

        // Create audio processor (using ScriptProcessor for simplicity)
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

        processor.onaudioprocess = (e) => {
            if (!isRecording || !websocket || websocket.readyState !== WebSocket.OPEN) {
                return;
            }

            const inputData = e.inputBuffer.getChannelData(0);

            // GPT-5's VAD: Calculate RMS to detect speech
            const rms = calculateRMS(inputData);
            const shouldTransmit = rms >= VAD_THRESHOLD;

            // If user stopped speaking, schedule fast commit
            if (!shouldTransmit) {
                if (isUserSpeaking) {
                    console.log('🔇 User stopped speaking (VAD), scheduling fast commit');
                    isUserSpeaking = false;
                    scheduleCommit(COMMIT_DELAY_FAST_MS);  // 120ms fast commit
                }
                return;
            }

            // User is speaking
            if (!isUserSpeaking) {
                console.log('🎤 User started speaking (VAD)');
                isUserSpeaking = true;

                // If assistant is currently speaking, interrupt them
                if (isAssistantSpeaking) {
                    console.log('✋ Interrupting assistant');

                    // Stop all audio playback immediately
                    stopAllAudio();

                    // Send interrupt message to backend
                    websocket.send(JSON.stringify({ type: 'interrupt' }));
                }
            }

            // Convert Float32Array to Int16Array (PCM16)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            const base64Audio = int16ArrayToBase64(pcmData);

            // Send audio and mark as uncommitted
            websocket.send(JSON.stringify({
                type: 'audio',
                data: base64Audio
            }));
            hasUncommittedAudio = true;
            scheduleCommit(COMMIT_DELAY_NORMAL_MS);  // 300ms normal commit
        };

        // Connect audio chain: microphone → processor → silent gain → destination
        // The silent gain prevents feedback while keeping the processing chain alive
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;  // Mute the microphone playback

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioContext.destination);

        isRecording = true;
        updateStatus('Listening...', 'listening');

        addToTranscript('System', 'Call started. You can speak now!');

    } catch (error) {
        console.error('Error capturing audio:', error);
        alert('Failed to capture audio: ' + error.message);
    }
}

/**
 * Handle messages from server
 */
function handleServerMessage(message) {
    const { type, data } = message;

    if (type === 'audio') {
        // Received audio from AI - play it back
        playAudioChunk(data);
    } else if (type === 'transcript') {
        // Received transcript update
        addToTranscript(data.speaker, data.text);
    } else if (type === 'error') {
        console.error('Server error:', data);
        addToTranscript('System', 'Error: ' + data.message);
    }
}

/**
 * Play audio chunk from server
 */
async function playAudioChunk(audioDataBase64) {
    try {
        const int16Array = base64ToInt16(audioDataBase64);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
        }

        const playbackSampleRate = 24000;
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, playbackSampleRate);
        audioBuffer.getChannelData(0).set(float32Array);

        // Play audio
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        const now = audioContext.currentTime;
        if (nextPlaybackTime < now) {
            nextPlaybackTime = now;
        }

        // Mark assistant as speaking when first chunk starts
        if (!isAssistantSpeaking) {
            isAssistantSpeaking = true;
        }

        // Add to active sources for interruption handling
        activeAudioSources.push(source);

        source.start(nextPlaybackTime);
        nextPlaybackTime += audioBuffer.duration;

        source.onended = () => {
            // Remove from active sources
            const index = activeAudioSources.indexOf(source);
            if (index > -1) {
                activeAudioSources.splice(index, 1);
            }

            // Update playback time if needed
            if (audioContext && nextPlaybackTime < audioContext.currentTime) {
                nextPlaybackTime = audioContext.currentTime;
            }

            // Check if all audio has finished playing
            if (activeAudioSources.length === 0) {
                isAssistantSpeaking = false;
            }
        };

    } catch (error) {
        console.error('Error playing audio:', error);
    }
}

/**
 * End the call session
 */
function endCall() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        // GPT-5: Force commit before closing to capture trailing speech
        sendCommit(true);
        websocket.send(JSON.stringify({ type: 'end_session' }));
        websocket.close();
    }

    cleanupAudio();
    updateStatus('Call Ended', 'disconnected');
    addToTranscript('System', 'Call ended. Thank you!');
}

/**
 * Cleanup audio resources
 */
function cleanupAudio() {
    isRecording = false;
    isUserSpeaking = false;
    hasUncommittedAudio = false;
    isAssistantSpeaking = false;

    clearCommitTimeout();
    nextPlaybackTime = 0;

    // Stop and clear all active audio sources
    activeAudioSources.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            // Source may have already stopped
        }
    });
    activeAudioSources = [];

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (websocket) {
        // GPT-5: Force commit before closing to capture trailing speech
        sendCommit(true);
        websocket.close();
    }
    cleanupAudio();
});

/**
 * Utility: Convert Int16Array PCM data to base64 string
 */
function int16ArrayToBase64(int16Array) {
    const arrayBuffer = int16Array.buffer.slice(
        int16Array.byteOffset,
        int16Array.byteOffset + int16Array.byteLength
    );
    return arrayBufferToBase64(arrayBuffer);
}

/**
 * Utility: Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

/**
 * Utility: Convert base64 PCM back to Int16Array
 */
function base64ToInt16(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
}
