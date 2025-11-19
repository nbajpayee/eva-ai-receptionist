/**
 * Voice utilities for audio processing and WebSocket communication
 */

export type VoiceConnectionStatus =
  | "idle"
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "error"
  | "reconnecting";

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

/**
 * Convert HTTP URL to WebSocket URL
 */
export function httpUrlToWebSocket(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}

/**
 * Convert Float32Array PCM data to base64 string
 */
export function float32ToBase64PCM(float32Array: Float32Array): string {
  // Convert Float32Array to Int16Array (PCM16)
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return int16ArrayToBase64(int16Array);
}

/**
 * Convert base64 PCM string to Float32Array
 */
export function base64PCMToFloat32(base64: string): Float32Array {
  const int16Array = base64ToInt16(base64);
  const float32Array = new Float32Array(int16Array.length);

  for (let i = 0; i < int16Array.length; i++) {
    const sample = int16Array[i];
    float32Array[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }

  return float32Array;
}

/**
 * Convert Int16Array to base64 string
 */
function int16ArrayToBase64(int16Array: Int16Array): string {
  const arrayBuffer = int16Array.buffer.slice(
    int16Array.byteOffset,
    int16Array.byteOffset + int16Array.byteLength
  );
  return arrayBufferToBase64(arrayBuffer);
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

/**
 * Convert base64 string to Int16Array
 */
function base64ToInt16(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Int16Array(bytes.buffer);
}
