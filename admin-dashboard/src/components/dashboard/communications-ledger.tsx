"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Phone, Mail, Smartphone } from "lucide-react";
import { type CallRecord } from "@/components/call-log-table";

interface CommunicationsLedgerProps {
  calls: CallRecord[];
}

const iconMap = {
  voice: Phone,
  sms: MessageSquare,
  mobile_text: Smartphone,
  email: Mail,
};

const statusColor = {
  booked: "bg-emerald-100 text-emerald-700",
  info_only: "bg-zinc-100 text-zinc-700",
  escalated: "bg-amber-100 text-amber-700",
  abandoned: "bg-rose-100 text-rose-700",
  rescheduled: "bg-blue-100 text-blue-700",
};

export function CommunicationsLedger({ calls }: CommunicationsLedgerProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-zinc-100 bg-zinc-50/50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <div className="w-8"></div>
        <div>Customer</div>
        <div>Channel</div>
        <div>Outcome</div>
        <div>Time</div>
        <div>Action</div>
      </div>
      
      <div className="divide-y divide-zinc-100">
        {calls.map((call, i) => {
          const Icon = iconMap[call.channel ?? "voice"];
          return (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200">
                <Icon className="h-4 w-4" />
              </div>
              
              <div className="font-medium text-zinc-900">
                {call.customerName ?? call.phoneNumber ?? "Unknown"}
              </div>
              
              <div>
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10">
                  {call.channel === "mobile_text" ? "SMS" : (call.channel ?? "Voice").toUpperCase()}
                </span>
              </div>
              
              <div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[call.outcome]}`}>
                  {call.outcome.replace("_", " ")}
                </span>
              </div>
              
              <div className="text-sm text-zinc-500">
                {format(new Date(call.startedAt), "h:mm a")}
              </div>
              
              <Button variant="ghost" size="icon" className="opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

