import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VoiceConnectionStatus } from "@/lib/voice-utils";

const statusConfig: Record<VoiceConnectionStatus, { label: string; variant?: "default" | "secondary" | "outline" } & { tone: string }> = {
  idle: { label: "Idle", variant: "secondary", tone: "bg-zinc-200" },
  connecting: { label: "Connecting", variant: "outline", tone: "bg-amber-200" },
  connected: { label: "Connected", tone: "bg-emerald-200" },
  listening: { label: "Listening", tone: "bg-emerald-200" },
  disconnected: { label: "Disconnected", variant: "outline", tone: "bg-zinc-200" },
  reconnecting: { label: "Reconnecting", variant: "outline", tone: "bg-amber-200" },
  error: { label: "Error", variant: "outline", tone: "bg-red-200" },
};

export function StatusBadge({ status }: { status: VoiceConnectionStatus }) {
  const config = statusConfig[status ?? "idle"];
  return (
    <Badge
      variant={config.variant ?? "default"}
      className={cn("gap-2", config.tone && "pr-3")}
    >
      <span className={cn("block h-2 w-2 rounded-full", config.tone ?? "bg-emerald-500")}></span>
      {config.label}
    </Badge>
  );
}
