"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CHANNEL_TONES,
  CommunicationMessage,
  getChannelLabel,
} from "@/types/communication";

export function MessageBubble({ message }: { message: CommunicationMessage }) {
  const isAssistant = message.author === "assistant";
  const channelTone = CHANNEL_TONES[message.channel];

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        isAssistant ? "items-start" : "items-end"
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
        <span>{isAssistant ? "Ava" : "Guest"}</span>
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <span>{format(new Date(message.timestamp), "MMM d, yyyy • h:mm a")}</span>
      </div>
      <div
        className={cn(
          "max-w-xl rounded-2xl border px-5 py-4 text-sm leading-relaxed shadow-sm",
          isAssistant
            ? "border-zinc-200 bg-white text-zinc-800"
            : "border-zinc-900 bg-zinc-900 text-white"
        )}
      >
        <div className="whitespace-pre-line">{message.body}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Badge variant="outline" className={cn("border", channelTone)}>
            {getChannelLabel(message.channel)}
          </Badge>
          <Badge variant="secondary" className="uppercase tracking-wide">
            {message.direction === "inbound" ? "Incoming" : "Outgoing"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
