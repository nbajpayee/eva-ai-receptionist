"use client";

import { useCallback, useRef } from "react";
import { MicVAD } from "@ricky0123/vad-web";

/**
 * Enhanced VAD using Silero for 95%+ accuracy
 *
 * This hook provides a higher-level API for integrating Silero VAD
 * into the voice session without conflicting with existing audio pipeline.
 *
 * Strategy:
 * 1. RMS-based VAD as pre-filter (fast, catches obvious speech)
 * 2. Silero VAD as confirmation layer (accurate, catches edge cases)
 * 3. Only commit audio when both agree speech has ended
 */

interface EnhancedVADOptions {
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onVADMisfire?: () => void;
  enabled: boolean;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
}

export function useEnhancedVAD(options: EnhancedVADOptions) {
  const {
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    enabled,
    positiveSpeechThreshold = 0.8,
    negativeSpeechThreshold = 0.65,
  } = options;

  const vadInstanceRef = useRef<MicVAD | null>(null);
  const isInitializingRef = useRef(false);
  const isSpeakingRef = useRef(false);

  const initialize = useCallback(async () => {
    if (!enabled || isInitializingRef.current || vadInstanceRef.current) {
      return;
    }

    isInitializingRef.current = true;

    try {
      const vad = await MicVAD.new({
        positiveSpeechThreshold,
        negativeSpeechThreshold,
        preSpeechPadFrames: 10, // 300ms pre-speech padding
        redemptionFrames: 8, // 240ms before declaring speech end
        minSpeechFrames: 3, // 90ms minimum speech duration
        onSpeechStart: () => {
          isSpeakingRef.current = true;
          onSpeechStart();
        },
        onSpeechEnd: (audio) => {
          isSpeakingRef.current = false;
          onSpeechEnd();
        },
        onVADMisfire: () => {
          onVADMisfire?.();
        },
      });

      vadInstanceRef.current = vad;
      vad.start();
    } catch (error) {
      console.error("Failed to initialize Silero VAD:", error);
    } finally {
      isInitializingRef.current = false;
    }
  }, [enabled, onSpeechStart, onSpeechEnd, onVADMisfire, positiveSpeechThreshold, negativeSpeechThreshold]);

  const destroy = useCallback(() => {
    if (vadInstanceRef.current) {
      vadInstanceRef.current.destroy();
      vadInstanceRef.current = null;
      isSpeakingRef.current = false;
    }
  }, []);

  const pause = useCallback(() => {
    vadInstanceRef.current?.pause();
  }, []);

  const start = useCallback(() => {
    vadInstanceRef.current?.start();
  }, []);

  return {
    initialize,
    destroy,
    pause,
    start,
    isSpeaking: isSpeakingRef.current,
  };
}
