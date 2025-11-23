"use client";

import { useEffect, useRef, useState } from "react";
import type { MicVAD } from "@ricky0123/vad-web";

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
  onError?: (error: Error) => void;
}

type MicVADClass = {
  new: (options: unknown) => Promise<MicVAD>;
};

declare global {
  interface Window {
    vad?: {
      MicVAD?: MicVADClass;
    };
  }
}

let micVADLoadPromise: Promise<MicVADClass | null> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener(
        "load",
        () => {
          resolve();
        },
        { once: true }
      );

      existing.addEventListener(
        "error",
        (event) => {
          reject(event);
        },
        { once: true }
      );

      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = (event) => {
      reject(event);
    };
    document.body.appendChild(script);
  });
}

export async function getMicVADClass(): Promise<MicVADClass | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (micVADLoadPromise) {
    return micVADLoadPromise;
  }

  micVADLoadPromise = (async () => {
    await loadScript("/ort/ort.js");
    await loadScript("/vad/bundle.min.js");
    return window.vad?.MicVAD ?? null;
  })();

  return micVADLoadPromise;
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
    onError,
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

    let cancelled = false;

    setVADState("loading");

    getMicVADClass()
      .then((MicVADClass) => {
        if (!MicVADClass || cancelled) {
          throw new Error("MicVAD is not available");
        }

        // Initialize Silero VAD using global MicVAD
        return MicVADClass.new({
          positiveSpeechThreshold,
          negativeSpeechThreshold,
          onnxWASMBasePath: "/ort/",
          baseAssetPath: "/vad/",
          processorType: "ScriptProcessor",
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
        });
      })
      .then((vad) => {
        if (!vad || cancelled) {
          if (vad) {
            vad.destroy();
          }
          return;
        }

        vadRef.current = vad;
        setVADState("ready");
        vad.start();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to initialize Silero VAD:", error);
        setVADState("error");
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        onError?.(normalizedError);
      });

    // Cleanup on unmount or when disabled
    return () => {
      cancelled = true;
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
