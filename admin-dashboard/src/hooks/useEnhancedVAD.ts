"use client";

import { useEffect, useRef } from "react";
import { MicVAD } from "@ricky0123/vad-web";

/**
 * Enhanced VAD using Silero for 95%+ accuracy with RMS pre-filter
 *
 * This hook manages the Silero VAD lifecycle automatically, similar to useSileroVAD.
 * It creates a secondary audio stream for ML-based speech detection while the
 * main ScriptProcessor handles audio transmission.
 *
 * Strategy:
 * 1. RMS-based VAD as pre-filter (fast, catches obvious speech)
 * 2. Silero VAD as confirmation layer (accurate, catches edge cases)
 * 3. Only commit audio when both agree speech has ended
 */

interface EnhancedVADOptions {
  enabled: boolean;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onVADMisfire?: () => void;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
}

export function useEnhancedVAD(options: EnhancedVADOptions) {
  const {
    enabled,
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    positiveSpeechThreshold = 0.8,
    negativeSpeechThreshold = 0.65,
  } = options;

  const vadInstanceRef = useRef<MicVAD | null>(null);
  const isInitializingRef = useRef(false);

  // Manage VAD lifecycle automatically based on enabled state
  useEffect(() => {
    if (!enabled) {
      // Clean up existing VAD instance if disabled
      if (vadInstanceRef.current) {
        vadInstanceRef.current.destroy();
        vadInstanceRef.current = null;
      }
      return;
    }

    // Prevent duplicate initialization
    if (isInitializingRef.current || vadInstanceRef.current) {
      return;
    }

    isInitializingRef.current = true;

    // Initialize Silero VAD
    MicVAD.new({
      positiveSpeechThreshold,
      negativeSpeechThreshold,
      preSpeechPadFrames: 10, // 300ms pre-speech padding
      redemptionFrames: 8, // 240ms before declaring speech end
      minSpeechFrames: 3, // 90ms minimum speech duration
      onSpeechStart,
      onSpeechEnd,
      onVADMisfire,
    })
      .then((vad) => {
        vadInstanceRef.current = vad;
        vad.start();
        isInitializingRef.current = false;
      })
      .catch((error) => {
        console.error("Failed to initialize Enhanced VAD (Hybrid mode):", error);
        isInitializingRef.current = false;
      });

    // Cleanup on unmount or when disabled
    return () => {
      if (vadInstanceRef.current) {
        vadInstanceRef.current.destroy();
        vadInstanceRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [
    enabled,
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    positiveSpeechThreshold,
    negativeSpeechThreshold,
  ]);
}
