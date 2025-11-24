"use client";

import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { Phone, MessageSquare, CalendarCheck, AlertTriangle, Clock } from "lucide-react";
import { type CallRecord } from "@/components/call-log-table";
import { cn } from "@/lib/utils";

interface CommunicationsStreamProps {
  calls: CallRecord[];
}

export function CommunicationsStream({ calls }: CommunicationsStreamProps) {
  return (
    <div className="relative space-y-8 pl-8 pt-4">
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-zinc-200 via-zinc-200 to-transparent" />
      
      {calls.map((call, i) => {
        let StatusIcon = Clock;
        let iconColor = "text-zinc-500";
        let bgColor = "bg-white";
        let ringColor = "ring-zinc-200";

        if (call.outcome === "booked") {
          StatusIcon = CalendarCheck;
          iconColor = "text-emerald-600";
          ringColor = "ring-emerald-200";
        } else if (call.escalated) {
          StatusIcon = AlertTriangle;
          iconColor = "text-amber-600";
          ringColor = "ring-amber-200";
        } else if (call.channel === "sms" || call.channel === "mobile_text") {
          StatusIcon = MessageSquare;
          iconColor = "text-sky-600";
          ringColor = "ring-sky-200";
        } else {
          StatusIcon = Phone;
          iconColor = "text-violet-600";
          ringColor = "ring-violet-200";
        }

        return (
          <motion.div
            key={call.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative"
          >
            <div className={cn(
              "absolute -left-[27px] flex h-10 w-10 items-center justify-center rounded-full border-4 border-zinc-50 bg-white shadow-sm",
              ringColor
            )}>
              <StatusIcon className={cn("h-4 w-4", iconColor)} />
            </div>
            
            <div className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-900">
                    {call.customerName ?? call.phoneNumber ?? "Unknown Customer"}
                  </h4>
                  <p className="text-sm text-zinc-500">
                    {call.outcome === "booked" && "Confirmed appointment"}
                    {call.outcome === "escalated" && "Requires attention"}
                    {call.outcome === "info_only" && "General inquiry"}
                    {call.outcome === "abandoned" && "Missed call"}
                  </p>
                </div>
                <span className="text-xs font-medium text-zinc-400">
                  {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
                </span>
              </div>
              
              {(call.satisfactionScore || call.durationSeconds > 0) && (
                <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                  {call.durationSeconds > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-1">
                      <Clock className="h-3 w-3" />
                      {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                    </span>
                  )}
                  {call.satisfactionScore && (
                    <span className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-1",
                      call.satisfactionScore >= 8 ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-700"
                    )}>
                      ★ {call.satisfactionScore}/10
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

