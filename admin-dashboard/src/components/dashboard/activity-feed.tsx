"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Phone, MessageSquare, Calendar, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ActivityItem {
  id: string;
  type: "call" | "message" | "booking";
  customer: string;
  description: string;
  timestamp: string | Date;
  status: "success" | "pending" | "failed" | "neutral";
  details?: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

const iconMap = {
  call: Phone,
  message: MessageSquare,
  booking: Calendar,
};

const statusColorMap = {
  success: "bg-emerald-500",
  pending: "bg-amber-500",
  failed: "bg-rose-500",
  neutral: "bg-blue-500",
};

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="rounded-full bg-zinc-100 p-4">
          <Clock className="h-8 w-8 text-zinc-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-zinc-900">No activity yet</h3>
        <p className="mt-1 text-sm text-zinc-500">
          New interactions will appear here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-200" />
        
        <div className="space-y-6">
          {activities.map((item, index) => {
            const Icon = iconMap[item.type];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex gap-4"
              >
                <div className={cn(
                  "absolute left-4 -translate-x-1/2 mt-1.5 h-2 w-2 rounded-full ring-4 ring-white",
                  statusColorMap[item.status]
                )} />
                
                <div className="ml-8 flex-1 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-zinc-100 p-2">
                        <Icon className="h-4 w-4 text-zinc-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{item.customer}</p>
                        <p className="text-xs text-zinc-500">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {item.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {item.status === 'failed' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-sm text-zinc-700">{item.description}</p>
                    {item.details && (
                      <div className="mt-2 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                        {item.details}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      View Details
                    </Button>
                    {item.type === 'call' && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        Call Back
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

