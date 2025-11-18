"use client";

import { useEffect, useRef, useState } from "react";
import { MicVAD } from "@ricky0123/vad-web";

export type VADState = "idle" | "loading" | "ready" | "error";

export interface SileroVADCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onVADMisfire?: () => void;
}

interface UseSileroVADOptions {
  enabled: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onVADMisfire?: () => void;
  minSpeechMs?: number;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
}

/**
 * Hook for managing Silero VAD (Voice Activity Detection)
 *
 * This provides more accurate speech detection than simple RMS-based VAD,
 * achieving 95%+ accuracy vs 70-80% with RMS alone.
 *
 * @param options Configuration options for the VAD
 * @returns VAD state and control functions
 */
export function useSileroVAD(options: UseSileroVADOptions) {
  const {
    enabled,
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    minSpeechMs = 250,
    positiveSpeechThreshold = 0.8,
    negativeSpeechThreshold = 0.8 - 0.15,
  } = options;

  const [vadState, setVADState] = useState<VADState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const vadRef = useRef<MicVAD | null>(null);

  // Initialize VAD when enabled
  useEffect(() => {
    if (!enabled) {
      // Clean up VAD if it was previously initialized
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
        setVADState("idle");
      }
      return;
    }

    setVADState("loading");

    // Initialize Silero VAD
    MicVAD.new({
      positiveSpeechThreshold,
      negativeSpeechThreshold,
      minSpeechFrames: Math.floor(minSpeechMs / 30), // 30ms per frame
      onSpeechStart: () => {
        setIsSpeaking(true);
        onSpeechStart?.();
      },
      onSpeechEnd: () => {
        setIsSpeaking(false);
        onSpeechEnd?.();
      },
      onVADMisfire: () => {
        onVADMisfire?.();
      },
    })
      .then((vad) => {
        vadRef.current = vad;
        setVADState("ready");
        vad.start();
      })
      .catch((error) => {
        console.error("Failed to initialize Silero VAD:", error);
        setVADState("error");
      });

    // Cleanup on unmount or when disabled
    return () => {
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
    };
  }, [
    enabled,
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    minSpeechMs,
    positiveSpeechThreshold,
    negativeSpeechThreshold,
  ]);

  const pause = () => {
    if (vadRef.current) {
      vadRef.current.pause();
    }
  };

  const resume = () => {
    if (vadRef.current) {
      vadRef.current.start();
    }
  };

  return {
    vadState,
    isSpeaking,
    pause,
    resume,
  };
}
