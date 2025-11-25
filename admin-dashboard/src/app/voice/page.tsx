"use client";

import { Play, Square, Waves, Mic, Activity, Settings2, Terminal, AlertCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { VADSettings, type VADMode } from "@/components/voice/vad-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/hooks/useVoiceSession";
import type { VoiceConnectionStatus } from "@/lib/voice-utils";

const statusCopy: Record<VoiceConnectionStatus, string> = {
  idle: "Ready to start session",
  disconnected: "Session ended",
  connecting: "Establishing connection...",
  connected: "Connected",
  listening: "Listening...",
  error: "Connection error",
  reconnecting: "Reconnecting...",
};

function LiveIndicator({ status }: { status: VoiceConnectionStatus }) {
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <span className="text-sm font-medium text-amber-600">Connecting</span>
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-600">Live</span>
      </div>
    );
  }

  if (status === "listening") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-end gap-[3px] h-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <motion.div
              key={index}
              className="w-1 rounded-full bg-emerald-500"
              animate={{
                height: [4, 12, 4],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: index * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        <span className="text-sm font-medium text-emerald-600">Listening</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <span className="text-sm font-medium text-zinc-500">Offline</span>
    </div>
  );
}

function TranscriptList({ entries }: { entries: TranscriptEntry[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const formatTimestamp = useCallback((entry: TranscriptEntry) => {
    const [timestampPart] = entry.id.split("_");
    const timestamp = Number(timestampPart);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      const date = new Date(timestamp);
      if (!Number.isNaN(date.valueOf())) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }
    return "--:--";
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 50;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !shouldAutoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
        <Terminal className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">No transcript available</p>
        <p className="text-xs mt-1">Start a session to see real-time conversation</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[500px] overflow-y-auto pr-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent"
    >
      {entries.map((entry) => {
        const isSystem = entry.speaker === "System";
        const isUser = entry.speaker === "User";
        
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4 p-4 rounded-xl text-sm leading-relaxed border",
              isSystem ? "bg-zinc-50 border-zinc-200 text-zinc-600" :
              isUser ? "bg-white border-zinc-200 text-zinc-800 ml-8 shadow-sm" :
              "bg-gradient-to-br from-sky-50 to-teal-50 border-sky-100 text-zinc-800 mr-8 shadow-sm"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              isSystem ? "bg-zinc-200 text-zinc-500" :
              isUser ? "bg-zinc-100 text-zinc-600" :
              "bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-md shadow-sky-500/20"
            )}>
              {isSystem ? "SYS" : isUser ? "YOU" : "EVA"}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs uppercase tracking-wider opacity-70">
                  {entry.speaker}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {formatTimestamp(entry)}
                </span>
              </div>
              <p>{entry.text}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function VoiceConsolePage() {
  const [vadMode, setVadMode] = useState<VADMode>("hybrid");

  useEffect(() => {
    const savedMode = localStorage.getItem("vadMode");
    if (savedMode && (savedMode === "rms" || savedMode === "silero" || savedMode === "hybrid")) {
      setVadMode(savedMode as VADMode);
    }
  }, []);

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
    sileroAvailable,
  } = useVoiceSession({ vadMode });

  const formattedDuration = useMemo(() => {
    if (!callDurationMs) return "00:00";
    const totalSeconds = Math.floor(callDurationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [callDurationMs]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen space-y-8 pb-8 font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-[30%] -translate-y-[20%] rounded-full bg-sky-200/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-[20%] translate-y-[20%] rounded-full bg-teal-200/20 blur-[100px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.header variants={itemVariants}>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Voice Console</h1>
            <p className="text-sm text-zinc-500 max-w-2xl">
              Real-time voice interaction testing environment. Configure VAD settings, monitor connection quality, and review live transcripts.
            </p>
          </div>
        </motion.header>

        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-[400px,1fr]">
          {/* Left Column: Controls & Settings */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="border-b border-zinc-100 bg-zinc-50/50 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-sky-500" />
                    <CardTitle className="text-base font-semibold text-zinc-900">Session Control</CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs font-normal">
                    {formattedDuration}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
                  <span className="text-sm font-medium text-zinc-600">Status</span>
                  <LiveIndicator status={status} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={startSession}
                    disabled={isActive || status === "connecting"}
                    className={cn(
                      "w-full bg-gradient-to-r from-sky-500 to-teal-500 text-white hover:from-sky-600 hover:to-teal-600 shadow-lg shadow-sky-500/20 transition-all",
                      (isActive || status === "connecting") && "opacity-50 cursor-not-allowed shadow-none"
                    )}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start
                  </Button>
                  <Button
                    onClick={endSession}
                    disabled={!isActive}
                    variant="outline"
                    className="w-full border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <Square className="mr-2 h-4 w-4 fill-current" />
                    End
                  </Button>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
                
                {sessionId && (
                   <div className="text-xs text-zinc-400 font-mono text-center">
                      Session: {sessionId}
                   </div>
                )}
              </CardContent>
            </Card>

            {/* VAD Settings */}
            <VADSettings
              vadEnabled={vadEnabled}
              vadThreshold={vadThreshold}
              vadMode={vadMode}
              onVadEnabledChange={setVadEnabled}
              onVadThresholdChange={setVadThreshold}
              onVadModeChange={handleVadModeChange}
            />

            {/* Diagnostics Panel */}
            <Card className="border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="py-4">
                 <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-zinc-900">Connection Diagnostics</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={refreshDiagnostics}
                      disabled={status !== "connected" && status !== "listening"}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                 </div>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Latency</p>
                    <p className="font-mono text-sm font-medium text-zinc-900">
                       {diagnostics.latencyMs ? `${Math.round(diagnostics.latencyMs)}ms` : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Heartbeat</p>
                    <p className="font-mono text-sm font-medium text-zinc-900">
                       {diagnostics.lastHeartbeatAt ? new Date(diagnostics.lastHeartbeatAt).toLocaleTimeString() : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Interrupts</p>
                    <p className="font-mono text-sm font-medium text-zinc-900">
                       {diagnostics.interruptions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Re-connects</p>
                    <p className="font-mono text-sm font-medium text-zinc-900">
                       {diagnostics.reconnectAttempts}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Transcript */}
          <div className="h-full min-h-[600px]">
            <Card className="h-full border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm flex flex-col">
              <CardHeader className="border-b border-zinc-100 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-teal-500" />
                    <div>
                      <CardTitle className="text-base font-semibold text-zinc-900">Live Transcript</CardTitle>
                      <CardDescription className="text-xs">Real-time conversation stream</CardDescription>
                    </div>
                  </div>
                  {isActive && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse">
                      <Mic className="mr-1 h-3 w-3" />
                      Recording
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6">
                <TranscriptList entries={transcript} />
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
