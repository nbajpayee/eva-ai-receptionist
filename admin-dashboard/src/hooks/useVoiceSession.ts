"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  base64PCMToFloat32,
  float32ToBase64PCM,
  generateSessionId,
  httpUrlToWebSocket,
  type VoiceConnectionStatus,
} from "@/lib/voice-utils";
import { useSileroVAD } from "./useSileroVAD";
import { useEnhancedVAD } from "./useEnhancedVAD";
import type { VADMode } from "@/components/voice/vad-settings";

export type TranscriptEntry = {
  id: string;
  speaker: string;
  text: string;
};

export type VoiceDiagnostics = {
  latencyMs: number | null;
  lastHeartbeatAt: number | null;
  reconnectAttempts: number;
  lastErrorAt: number | null;
  interruptions: number;
};

const COMMIT_DELAY_NORMAL_MS = 300;
const COMMIT_DELAY_FAST_MS = 120;
const SAMPLE_RATE = 24000;
const AUDIO_BUFFER_SIZE = 4096;
const PING_INTERVAL_MS = 5000;
const DEFAULT_VAD_THRESHOLD = 0.005;

type VoiceServerMessage =
  | { type: "audio"; data: string }
  | { type: "transcript"; data?: { speaker?: string; text?: string } }
  | { type: "pong"; data?: { client_sent_at?: string; server_received_at?: string } }
  | { type: "error"; data?: { message?: string } | string | null };

type UnknownVoiceServerMessage = { type: string; data?: unknown };

type AudioContextConstructor = new (contextOptions?: AudioContextOptions) => AudioContext;

const parseVoiceServerMessage = (payload: string): VoiceServerMessage | UnknownVoiceServerMessage | null => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const { type } = parsed as { type?: unknown };
    if (typeof type !== "string") {
      return null;
    }
    return parsed as VoiceServerMessage | UnknownVoiceServerMessage;
  } catch (err) {
    console.error("Failed to parse server payload", err);
    return null;
  }
};

const resolveAudioContextConstructor = (): AudioContextConstructor => {
  const win = window as Window & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };

  if (typeof win.AudioContext === "function") {
    return win.AudioContext;
  }

  if (typeof win.webkitAudioContext === "function") {
    return win.webkitAudioContext;
  }

  throw new Error("Web Audio API not supported in this browser");
};

const initialDiagnostics: VoiceDiagnostics = {
  latencyMs: null,
  lastHeartbeatAt: null,
  reconnectAttempts: 0,
  lastErrorAt: null,
  interruptions: 0,
};

function calculateRMS(buffer: Float32Array): number {
  if (!buffer.length) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = buffer[i];
    sum += value * value;
  }

  return Math.sqrt(sum / buffer.length);
}

interface UseVoiceSessionOptions {
  vadMode?: VADMode;
}

export function useVoiceSession(options: UseVoiceSessionOptions = {}) {
  const { vadMode = "rms" } = options;

  const [status, setStatus] = useState<VoiceConnectionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callDurationMs, setCallDurationMs] = useState(0);
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>(initialDiagnostics);
  const [vadEnabled, setVadEnabled] = useState(true);
  const [vadThreshold, setVadThreshold] = useState(DEFAULT_VAD_THRESHOLD);

  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlaybackTimeRef = useRef<number>(0);
  const commitTimeoutRef = useRef<number | null>(null);
  const hasUncommittedAudioRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const callStartRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isUserSpeakingRef = useRef<boolean>(false);
  const isAssistantSpeakingRef = useRef<boolean>(false);

  const isActive = status !== "idle" && status !== "error";

  const resetState = useCallback(() => {
    setStatus("idle");
    setSessionId(null);
    setTranscript([]);
    setError(null);
    setDiagnostics(initialDiagnostics);
    setVadEnabled(true);
    setVadThreshold(DEFAULT_VAD_THRESHOLD);
  }, []);

  const addTranscriptEntry = useCallback((speaker: string, text: string) => {
    setTranscript((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${prev.length}`,
        speaker,
        text,
      },
    ]);
  }, []);

  const clearCommitTimeout = useCallback(() => {
    if (commitTimeoutRef.current) {
      window.clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
  }, []);

  const sendCommit = useCallback(
    (force: boolean = false) => {
      const ws = websocketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!hasUncommittedAudioRef.current && !force) {
        return;
      }

      ws.send(JSON.stringify({ type: "commit" }));
      hasUncommittedAudioRef.current = false;
    },
    []
  );

  const scheduleCommit = useCallback(
    (delayMs: number = COMMIT_DELAY_NORMAL_MS) => {
      clearCommitTimeout();
      commitTimeoutRef.current = window.setTimeout(() => {
        sendCommit();
      }, delayMs);
    },
    [clearCommitTimeout, sendCommit]
  );

  const interruptPlayback = useCallback(
    (trackStats: boolean = true) => {
      if (!playbackSourcesRef.current.length) {
        return;
      }

      console.log(`✋ Interrupting ${playbackSourcesRef.current.length} audio sources`);

      // Stop all active audio sources
      playbackSourcesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch (err) {
          console.warn("Error stopping playback source", err);
        }
      });
      playbackSourcesRef.current = [];

      // Reset playback timing
      const audioContext = audioContextRef.current;
      if (audioContext) {
        nextPlaybackTimeRef.current = audioContext.currentTime;
      }

      // Mark assistant as no longer speaking
      isAssistantSpeakingRef.current = false;

      // Send interrupt message to backend
      const ws = websocketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "interrupt" }));
      }

      if (trackStats) {
        setDiagnostics((prev) => ({
          ...prev,
          interruptions: prev.interruptions + 1,
        }));
      }
    },
    []
  );

  const cleanupAudio = useCallback(() => {
    isRecordingRef.current = false;
    isUserSpeakingRef.current = false;
    isAssistantSpeakingRef.current = false;
    nextPlaybackTimeRef.current = 0;
    callStartRef.current = null;
    hasUncommittedAudioRef.current = false;
    clearCommitTimeout();

    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (pingIntervalRef.current) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    setCallDurationMs(0);
    setDiagnostics((prev) => ({
      ...prev,
      latencyMs: null,
      lastHeartbeatAt: null,
    }));

    interruptPlayback(false);

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    isUserSpeakingRef.current = false;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [clearCommitTimeout, interruptPlayback]);

  const playAudioChunk = useCallback(
    (base64: string) => {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      try {
        const float32 = base64PCMToFloat32(base64);
        const audioBuffer = audioContext.createBuffer(1, float32.length, SAMPLE_RATE);
        audioBuffer.getChannelData(0).set(float32);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // Mark assistant as speaking when first chunk starts
        if (!isAssistantSpeakingRef.current) {
          isAssistantSpeakingRef.current = true;
        }

        // Add to active sources for interruption handling
        playbackSourcesRef.current.push(source);

        const now = audioContext.currentTime;
        if (nextPlaybackTimeRef.current < now) {
          nextPlaybackTimeRef.current = now;
        }

        source.start(nextPlaybackTimeRef.current);
        nextPlaybackTimeRef.current += audioBuffer.duration;

        source.onended = () => {
          // Remove from active sources
          playbackSourcesRef.current = playbackSourcesRef.current.filter((item) => item !== source);

          // Update playback time if needed
          if (audioContext && nextPlaybackTimeRef.current < audioContext.currentTime) {
            nextPlaybackTimeRef.current = audioContext.currentTime;
          }

          // Check if all audio has finished playing
          if (playbackSourcesRef.current.length === 0) {
            isAssistantSpeakingRef.current = false;
          }
        };
      } catch (err) {
        console.error("Error playing audio chunk", err);
      }
    },
    []
  );

  const sendPing = useCallback(() => {
    const ws = websocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(
      JSON.stringify({
        type: "ping",
        data: {
          client_sent_at: new Date().toISOString(),
        },
      })
    );
  }, []);

  const refreshDiagnostics = useCallback(() => {
    if (status === "connected" || status === "listening") {
      sendPing();
    }
  }, [sendPing, status]);

  // Speech detection callbacks for Silero/Hybrid VAD
  // These callbacks are triggered by the ML VAD model when speech is detected
  const handleMLVADSpeechStart = useCallback(() => {
    if (!isUserSpeakingRef.current) {
      console.log('🎤 User started speaking (ML VAD)');
      isUserSpeakingRef.current = true;

      // If assistant is currently speaking, interrupt them
      if (isAssistantSpeakingRef.current) {
        console.log('✋ Interrupting assistant (ML VAD)');
        interruptPlayback();
      }
    }
  }, [interruptPlayback]);

  const handleMLVADSpeechEnd = useCallback(() => {
    if (isUserSpeakingRef.current) {
      console.log('🎤 User stopped speaking (ML VAD)');
      isUserSpeakingRef.current = false;
      scheduleCommit(COMMIT_DELAY_FAST_MS);
    }
  }, [scheduleCommit]);

  // Initialize Silero VAD for 'silero' mode
  // This creates a secondary audio stream for ML-based speech detection
  // while the ScriptProcessor continues to handle audio transmission
  useSileroVAD({
    enabled: vadMode === "silero" && vadEnabled && isActive,
    onSpeechStart: handleMLVADSpeechStart,
    onSpeechEnd: handleMLVADSpeechEnd,
    minSpeechMs: 250,
    positiveSpeechThreshold: 0.8,
    negativeSpeechThreshold: 0.65,
  });

  // Initialize Enhanced VAD for 'hybrid' mode
  // Uses RMS pre-filter + Silero confirmation for balanced accuracy
  // Lifecycle is managed automatically by the hook
  useEnhancedVAD({
    enabled: vadMode === "hybrid" && vadEnabled && isActive,
    onSpeechStart: handleMLVADSpeechStart,
    onSpeechEnd: handleMLVADSpeechEnd,
    positiveSpeechThreshold: 0.8,
    negativeSpeechThreshold: 0.65,
  });

  const handleServerMessage = useCallback(
    (event: MessageEvent<string>) => {
      const message = parseVoiceServerMessage(event.data);
      if (!message) {
        return;
      }

      switch (message.type) {
        case "audio": {
          if (typeof message.data === "string") {
            playAudioChunk(message.data);
          }
          break;
        }
        case "transcript": {
          const payload = message as Extract<VoiceServerMessage, { type: "transcript" }>;
          const speaker = payload.data?.speaker ?? "Ava";
          const text = payload.data?.text ?? "";
          addTranscriptEntry(speaker, text);
          break;
        }
        case "pong": {
          const payload = message as Extract<VoiceServerMessage, { type: "pong" }>;
          const clientSentAt = payload.data?.client_sent_at
            ? new Date(payload.data.client_sent_at).getTime()
            : null;
          const serverReceivedAt = payload.data?.server_received_at
            ? new Date(payload.data.server_received_at).getTime()
            : null;

          setDiagnostics((prev) => ({
            ...prev,
            latencyMs: clientSentAt ? Date.now() - clientSentAt : prev.latencyMs,
            lastHeartbeatAt: serverReceivedAt ?? Date.now(),
          }));
          break;
        }
        case "error": {
          const payload = message as Extract<VoiceServerMessage, { type: "error" }>;
          const messageText =
            typeof payload.data === "string"
              ? payload.data
              : payload.data?.message ?? null;
          const errorText = messageText ?? "Server returned an error";
          setError(errorText);
          addTranscriptEntry("System", `Error: ${errorText}`);
          setDiagnostics((prev) => ({
            ...prev,
            lastErrorAt: Date.now(),
          }));
          break;
        }
        default:
          // Unknown message types are ignored for now
          break;
      }
    },
    [addTranscriptEntry, playAudioChunk]
  );

  const startAudioCapture = useCallback(() => {
    const audioContext = audioContextRef.current;
    const mediaStream = mediaStreamRef.current;
    const websocket = websocketRef.current;

    if (!audioContext || !mediaStream || !websocket) {
      return;
    }

    const source = audioContext.createMediaStreamSource(mediaStream);
    const processor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);

    processor.onaudioprocess = (event) => {
      if (!isRecordingRef.current || !websocket || websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);

      // For Silero and Hybrid modes, always transmit audio (VAD handled by ML model)
      // For RMS mode, use traditional RMS-based VAD
      if (vadMode === "rms") {
        const rms = calculateRMS(inputData);
        const shouldTransmit = !vadEnabled || rms >= vadThreshold;

        if (!shouldTransmit) {
          if (isUserSpeakingRef.current) {
            isUserSpeakingRef.current = false;
            scheduleCommit(COMMIT_DELAY_FAST_MS);
          }
          return;
        }

        if (!isUserSpeakingRef.current) {
          console.log('🎤 User started speaking (RMS VAD)');
          isUserSpeakingRef.current = true;

          // If assistant is currently speaking, interrupt them
          if (isAssistantSpeakingRef.current) {
            console.log('✋ Interrupting assistant (RMS VAD)');
            interruptPlayback();
          }
        }
      }

      // Transmit audio to backend
      const payload = float32ToBase64PCM(inputData);
      websocket.send(
        JSON.stringify({
          type: "audio",
          data: payload,
        })
      );
      hasUncommittedAudioRef.current = true;
      scheduleCommit();
    };

    // Connect audio chain: microphone → processor → silent gain → destination
    // The silent gain prevents feedback while keeping the processing chain alive
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0; // Mute the microphone playback

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);
    processorRef.current = processor;

    isRecordingRef.current = true;
    setStatus("listening");
    addTranscriptEntry("System", "Call started. You can speak now!");
  }, [addTranscriptEntry, interruptPlayback, scheduleCommit, vadEnabled, vadThreshold, vadMode]);

  const startSession = useCallback(async () => {
    if (status === "connecting" || status === "connected" || status === "listening") {
      return;
    }

    try {
      if (status === "error") {
        cleanupAudio();
        setDiagnostics((prev) => ({
          ...prev,
          reconnectAttempts: prev.reconnectAttempts + 1,
        }));
      }

      setError(null);
      setTranscript([]);
      setStatus("connecting");

      const newSessionId = generateSessionId();
      setSessionId(newSessionId);

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = mediaStream;

      const AudioContextClass = resolveAudioContextConstructor();
      const audioContext = new AudioContextClass({
        sampleRate: SAMPLE_RATE,
      });
      audioContextRef.current = audioContext;

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!baseUrl) {
        throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
      }

      const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
      const wsUrl = httpUrlToWebSocket(`${normalizedBaseUrl}/ws/voice/${newSessionId}`);
      const websocket = new WebSocket(wsUrl);
      websocketRef.current = websocket;

      websocket.onopen = async () => {
        setStatus("connected");
        nextPlaybackTimeRef.current = 0;
        callStartRef.current = Date.now();
        if (durationIntervalRef.current) {
          window.clearInterval(durationIntervalRef.current);
        }
        durationIntervalRef.current = window.setInterval(() => {
          if (!callStartRef.current) {
            return;
          }

          setCallDurationMs(Date.now() - callStartRef.current);
        }, 500);
        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = window.setInterval(() => {
          sendPing();
        }, PING_INTERVAL_MS);
        sendPing();
        await audioContext.resume();
        startAudioCapture();
      };

      websocket.onmessage = handleServerMessage;

      websocket.onerror = (evt) => {
        console.error("WebSocket error", evt);
        setError("Connection error");
        setStatus("error");
        addTranscriptEntry("System", "Connection error occurred");
        setDiagnostics((prev) => ({
          ...prev,
          lastErrorAt: Date.now(),
        }));
      };

      websocket.onclose = (event) => {
        cleanupAudio();
        setStatus("idle");
        if (websocketRef.current === websocket) {
          websocketRef.current = null;
        }

        if (status !== "error" && event.code !== 1000) {
          setDiagnostics((prev) => ({
            ...prev,
            lastErrorAt: Date.now(),
          }));
        }
      };
    } catch (err) {
      console.error("Failed to start session", err);
      setError(err instanceof Error ? err.message : String(err));
      cleanupAudio();
      setStatus("error");
    }
  }, [addTranscriptEntry, cleanupAudio, handleServerMessage, sendPing, startAudioCapture, status]);

  const endSession = useCallback(() => {
    const websocket = websocketRef.current;
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      sendCommit();
      websocket.send(JSON.stringify({ type: "end_session" }));
      websocket.close();
    }

    cleanupAudio();
    setStatus("idle");
    addTranscriptEntry("System", "Call ended. Thanks for chatting!");
  }, [addTranscriptEntry, cleanupAudio, sendCommit]);

  useEffect(() => {
    return () => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        try {
          sendCommit();
          websocketRef.current.send(JSON.stringify({ type: "end_session" }));
        } catch (err) {
          console.warn("Error sending end_session on unmount", err);
        }
        websocketRef.current.close();
      }
      cleanupAudio();
      resetState();
    };
  }, [cleanupAudio, resetState, sendCommit]);

  return {
    status,
    sessionId,
    transcript,
    error,
    callDurationMs,
    diagnostics,
    refreshDiagnostics,
    vadEnabled,
    vadThreshold,
    setVadEnabled,
    setVadThreshold,
    startSession,
    endSession,
    isActive: status !== "idle" && status !== "error",
  };
}
