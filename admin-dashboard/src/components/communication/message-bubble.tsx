"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  CommunicationMessage,
  getChannelLabel,
} from "@/types/communication";

function parseBackendTimestamp(isoString: string | null | undefined): Date {
  if (!isoString) return new Date();
  // If the string already includes timezone info (Z or offset), trust it as-is
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(isoString)) {
    return new Date(isoString);
  }
  // Treat naive timestamps from the backend as UTC by appending Z
  return new Date(`${isoString}Z`);
}

export function MessageBubble({ message }: { message: CommunicationMessage }) {
  const isAssistant = message.author === "assistant";
  // We'll use custom styling instead of CHANNEL_TONES for the bubble itself to match the new aesthetic
  
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        isAssistant ? "items-start" : "items-end"
      )}
    >
      <div className={cn(
        "flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider",
        isAssistant ? "text-zinc-500 ml-1" : "text-zinc-400 mr-1"
      )}>
        <span>{isAssistant ? "Eva" : "Guest"}</span>
        <span className="h-0.5 w-0.5 rounded-full bg-zinc-300" />
        <span>{format(parseBackendTimestamp(message.timestamp), "h:mm a")}</span>
      </div>
      <div
        className={cn(
          "relative max-w-xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm transition-all",
          isAssistant
            ? "rounded-tl-none border border-zinc-200/60 bg-white/80 text-zinc-700 backdrop-blur-sm"
            : "rounded-tr-none border border-sky-600/20 bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/10"
        )}
      >
        <div className="whitespace-pre-line">{message.body}</div>
        <div className={cn(
          "mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium opacity-80",
          isAssistant ? "text-zinc-400" : "text-sky-100"
        )}>
           {/* Simplified footer info */}
           <span>{getChannelLabel(message.channel)}</span>
        </div>
      </div>
    </div>
  );
}
