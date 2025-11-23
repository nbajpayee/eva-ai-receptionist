declare module "@ricky0123/vad-web" {
  export type VADOptions = {
    positiveSpeechThreshold?: number;
    negativeSpeechThreshold?: number;
    onsetDelayFrames?: number;
    offsetDelayFrames?: number;
    preSpeechPadFrames?: number;
    redemptionFrames?: number;
    minSpeechFrames?: number;
    baseAssetPath?: string;
    onnxWASMBasePath?: string;
    processorType?: "AudioWorklet" | "ScriptProcessor" | "auto";
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: unknown) => void;
    onVADMisfire?: () => void;
  };

  export class MicVAD {
    static new(options?: VADOptions): Promise<MicVAD>;
    start(): void;
    pause(): void;
    destroy(): void;
  }
}
