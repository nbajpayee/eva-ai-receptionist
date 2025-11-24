"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { Phone, MessageSquare, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { type CallRecord } from "@/components/call-log-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CommunicationsPulseProps {
  calls: CallRecord[];
}

export function CommunicationsPulse({ calls }: CommunicationsPulseProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {calls.map((call, i) => (
        <motion.div
          key={call.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${
                call.outcome === 'booked' ? 'from-emerald-400 to-teal-500' :
                call.escalated ? 'from-amber-400 to-orange-500' :
                'from-indigo-400 to-violet-500'
              } text-white shadow-sm`}>
                {call.channel?.includes('text') || call.channel === 'sms' ? 
                  <MessageSquare className="h-5 w-5" /> : 
                  <Phone className="h-5 w-5" />
                }
              </div>
              <div>
                <p className="font-bold text-zinc-900 line-clamp-1">
                  {call.customerName ?? call.phoneNumber}
                </p>
                <p className="text-xs text-zinc-500">
                  {format(new Date(call.startedAt), "MMM d • h:mm a")}
                </p>
              </div>
            </div>
            
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
                {call.outcome}
              </Badge>
              {call.satisfactionScore && (
                <div className="flex items-center gap-1 text-xs font-medium text-zinc-600">
                  <span className={call.satisfactionScore >= 8 ? "text-emerald-500" : "text-amber-500"}>●</span>
                  {call.satisfactionScore}/10
                </div>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </motion.div>
      ))}
      
      {/* Add a "View All" card at the end if needed, or just let the grid flow */}
    </div>
  );
}

