"use client";

import { Play, Square, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { VADSettings, type VADMode } from "@/components/voice/vad-settings";
import type { TranscriptEntry } from "@/hooks/useVoiceSession";
import type { VoiceConnectionStatus } from "@/lib/voice-utils";

const statusCopy: Record<VoiceConnectionStatus, string> = {
  idle: "Press start to begin a live call with Ava.",
  disconnected: "Session ended. Start a new call to continue testing.",
  connecting: "Establishing secure connection…",
  connected: "Connection ready. Initializing audio stream…",
  listening: "Ava is listening. Try asking about services or booking an appointment!",
  error: "Something went wrong. Review the error below and try again.",
  reconnecting: "Connection dropped. Attempting automatic reconnection…",
};

function LiveIndicator({ status }: { status: VoiceConnectionStatus }) {
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
        <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
        Attempting handshake…
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Connected. Preparing audio…
      </div>
    );
  }

  if (status === "listening") {
    return (
      <div
        className="flex items-end gap-[3px]"
        aria-label="Voice session is active"
        aria-live="polite"
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className="voice-wave-bar h-3 w-1 rounded-full bg-emerald-500"
            style={{ animationDelay: `${index * 0.1}s` }}
          />
        ))}
      </div>
    );
  }

  return null;
}

function TranscriptList({ entries }: { entries: TranscriptEntry[] }) {
  const formatTimestamp = useCallback((entry: TranscriptEntry) => {
    const [timestampPart] = entry.id.split("_");
    const timestamp = Number(timestampPart);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      const date = new Date(timestamp);
      if (!Number.isNaN(date.valueOf())) {
        return date.toLocaleTimeString();
      }
    }
    return "--";
  }, []);

  if (!entries.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
        Transcript will appear here once the session begins.
      </div>
    );
  }

  return (
    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500">
            {entry.speaker}
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span className="font-normal text-zinc-400">
              {formatTimestamp(entry)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-800">{entry.text}</p>
        </div>
      ))}
    </div>
  );
}

export default function VoiceConsolePage() {
  // VAD mode state with localStorage persistence
  const [vadMode, setVadMode] = useState<VADMode>("hybrid");

  // Load VAD mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem("vadMode");
    if (savedMode && (savedMode === "rms" || savedMode === "silero" || savedMode === "hybrid")) {
      setVadMode(savedMode as VADMode);
    }
  }, []);

  // Save VAD mode to localStorage when it changes
  const handleVadModeChange = useCallback((mode: VADMode) => {
    setVadMode(mode);
    localStorage.setItem("vadMode", mode);
  }, []);

  const {
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
    isActive,
  } = useVoiceSession({ vadMode });

  const helperText = useMemo(() => statusCopy[status] ?? statusCopy.idle, [status]);
  const formattedDuration = useMemo(() => {
    if (!callDurationMs) {
      return "00:00";
    }

    const totalSeconds = Math.floor(callDurationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");

    return `${minutes}:${seconds}`;
  }, [callDurationMs]);
  const latencyDisplay = useMemo(() => {
    if (diagnostics.latencyMs === null) return "--";
    return `${Math.round(diagnostics.latencyMs)} ms`;
  }, [diagnostics.latencyMs]);
  const heartbeatDisplay = useMemo(() => {
    if (!diagnostics.lastHeartbeatAt) return "--";
    return new Date(diagnostics.lastHeartbeatAt).toLocaleTimeString();
  }, [diagnostics.lastHeartbeatAt]);
  const reconnectDisplay = useMemo(() => diagnostics.reconnectAttempts.toString(), [
    diagnostics.reconnectAttempts,
  ]);
  const lastErrorDisplay = useMemo(() => {
    if (!diagnostics.lastErrorAt) return "None";
    return new Date(diagnostics.lastErrorAt).toLocaleTimeString();
  }, [diagnostics.lastErrorAt]);
  const interruptionsDisplay = useMemo(
    () => diagnostics.interruptions.toString(),
    [diagnostics.interruptions]
  );
  const canRefreshDiagnostics = status === "connected" || status === "listening";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">Voice Console</h1>
        <p className="text-sm text-zinc-500">
          Run a live call with Ava using the FastAPI Realtime endpoint. Keep this tab active
          while testing; audio capture pauses automatically when you end the session.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <Card className="h-fit">
          <CardHeader className="space-y-4 border-b border-zinc-100 pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Connection</CardTitle>
              <div className="flex min-h-[16px] items-center gap-3">
                <LiveIndicator status={status} />
                <StatusBadge status={status} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              <span>Elapsed</span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-600">
                {formattedDuration}
              </span>
            </div>
            <p className="text-sm leading-6 text-zinc-500">{helperText}</p>
            {sessionId ? (
              <p className="text-xs text-zinc-400">Session ID: {sessionId}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-900/90 disabled:cursor-not-allowed disabled:bg-zinc-300"
                onClick={startSession}
                disabled={isActive || status === "connecting"}
              >
                <Play className="h-4 w-4" />
                Start Session
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={endSession}
                disabled={!isActive}
              >
                <Square className="h-4 w-4" />
                End
              </button>
            </div>
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
              <p className="mb-2 font-semibold text-zinc-600">Requirements</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                    1
                  </span>
                  Allow microphone access when prompted.
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                    2
                  </span>
                  Keep FastAPI running locally at <code className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}</code>.
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                    3
                  </span>
                  Use headphones to avoid audio feedback loops.
                </li>
              </ul>
            </div>
            <VADSettings
              vadEnabled={vadEnabled}
              vadThreshold={vadThreshold}
              vadMode={vadMode}
              onVadEnabledChange={setVadEnabled}
              onVadThresholdChange={setVadThreshold}
              onVadModeChange={handleVadModeChange}
            />
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-700">Diagnostics</p>
                <button
                  type="button"
                  onClick={refreshDiagnostics}
                  disabled={!canRefreshDiagnostics}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Latency</dt>
                  <dd className="font-medium text-zinc-800">{latencyDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Last heartbeat</dt>
                  <dd className="font-medium text-zinc-800">{heartbeatDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Reconnect attempts</dt>
                  <dd className="font-medium text-zinc-800">{reconnectDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Interruptions</dt>
                  <dd className="font-medium text-zinc-800">{interruptionsDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Last error</dt>
                  <dd className="font-medium text-zinc-800">{lastErrorDisplay}</dd>
                </div>
              </dl>
            </div>
            {error ? (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>{error}</p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                  onClick={startSession}
                >
                  Retry connection
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-zinc-400" />
              <CardTitle className="text-base">Transcript</CardTitle>
            </div>
            <p className="text-sm text-zinc-500">
              Live transcript of your conversation with Ava. Messages update in near real-time
              as the session progresses.
            </p>
          </CardHeader>
          <CardContent>
            <TranscriptList entries={transcript} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
