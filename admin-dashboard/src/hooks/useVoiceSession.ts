"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  base64PCMToFloat32,
  float32ToBase64PCM,
  generateSessionId,
  httpUrlToWebSocket,
  type VoiceConnectionStatus,
} from "@/lib/voice-utils";

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

const COMMIT_DELAY_MS = 300;
const SAMPLE_RATE = 24000;
const PING_INTERVAL_MS = 5000;
const DEFAULT_VAD_THRESHOLD = 0.005;

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

export function useVoiceSession() {
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
    (delayMs: number = COMMIT_DELAY_MS) => {
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

  const handleServerMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as { type: string; data: any };
        if (message.type === "audio" && message.data) {
          playAudioChunk(message.data as string);
        } else if (message.type === "transcript" && message.data) {
          addTranscriptEntry(message.data.speaker ?? "Ava", message.data.text ?? "");
        } else if (message.type === "pong") {
          const clientSentAt = message.data?.client_sent_at
            ? new Date(message.data.client_sent_at).getTime()
            : null;
          const serverReceivedAt = message.data?.server_received_at
            ? new Date(message.data.server_received_at).getTime()
            : null;

          setDiagnostics((prev) => ({
            ...prev,
            latencyMs: clientSentAt ? Date.now() - clientSentAt : prev.latencyMs,
            lastHeartbeatAt: serverReceivedAt ?? Date.now(),
          }));
        } else if (message.type === "error") {
          const messageText = typeof message.data === "string" ? message.data : message.data?.message;
          setError(messageText ?? "Server returned an error");
          addTranscriptEntry("System", `Error: ${messageText ?? "Unknown"}`);
          setDiagnostics((prev) => ({
            ...prev,
            lastErrorAt: Date.now(),
          }));
        }
      } catch (err) {
        console.error("Failed to parse server message", err);
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
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (!isRecordingRef.current || !websocket || websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);
      const rms = calculateRMS(inputData);
      const shouldTransmit = !vadEnabled || rms >= vadThreshold;

      if (!shouldTransmit) {
        if (isUserSpeakingRef.current) {
          isUserSpeakingRef.current = false;
          scheduleCommit(120);
        }
        return;
      }

      if (!isUserSpeakingRef.current) {
        console.log('🎤 User started speaking (VAD)');
        isUserSpeakingRef.current = true;

        // If assistant is currently speaking, interrupt them
        if (vadEnabled && isAssistantSpeakingRef.current) {
          console.log('✋ Interrupting assistant');
          interruptPlayback();
        }
      }

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
  }, [addTranscriptEntry, interruptPlayback, scheduleCommit, vadEnabled, vadThreshold]);

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

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
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
