"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type CallRecord = {
  id: string;
  startedAt: string;
  durationSeconds: number;
  outcome: "booked" | "info_only" | "escalated" | "abandoned" | "rescheduled";
  phoneNumber?: string | null;
  satisfactionScore?: number | null;
  escalated?: boolean;
  customerName?: string | null;
  channel?: "voice" | "mobile_text" | "sms" | "email";
};

const outcomeCopy: Record<CallRecord["outcome"], string> = {
  booked: "Booked",
  info_only: "Info Only",
  escalated: "Escalated",
  abandoned: "Abandoned",
  rescheduled: "Rescheduled",
};

const outcomeTone: Record<CallRecord["outcome"], string> = {
  booked: "bg-emerald-50 text-emerald-700 border-emerald-100",
  info_only: "bg-zinc-100 text-zinc-700 border-zinc-200",
  escalated: "bg-amber-50 text-amber-700 border-amber-100",
  abandoned: "bg-rose-50 text-rose-700 border-rose-100",
  rescheduled: "bg-primary/10 text-primary border-primary/20",
};

const channelCopy: Record<NonNullable<CallRecord["channel"]>, string> = {
  voice: "Voice",
  mobile_text: "SMS",
  sms: "SMS",
  email: "Email",
};

const channelTone: Record<NonNullable<CallRecord["channel"]>, string> = {
  voice: "bg-primary/10 text-primary border-primary/20",
  mobile_text: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sms: "bg-emerald-50 text-emerald-700 border-emerald-100",
  email: "bg-accent/10 text-accent-foreground border-accent/20",
};

function satisfactionTone(score: number): string {
  if (score >= 8) {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
  if (score >= 5) {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

interface CallLogTableProps {
  calls: CallRecord[];
}

export function CallLogTable({ calls }: CallLogTableProps) {
  return (
    <Card className="border-zinc-200">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Recent sessions</CardTitle>
          <p className="text-sm text-zinc-500">
            Live feed of Eva-managed conversations. Data refreshes every minute.
          </p>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
          voice.ai → analytics
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-3 font-medium">Start time</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Duration</th>
                <th className="px-6 py-3 font-medium">Outcome</th>
                <th className="px-6 py-3 font-medium">Satisfaction</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {calls.map((call) => (
                <tr key={call.id} className="group hover:bg-zinc-50/70">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                    {format(new Date(call.startedAt), "MMM d, yyyy • h:mm a")}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    {call.customerName ?? call.phoneNumber ?? "Unknown"}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    <Badge
                      variant="outline"
                      className={`${channelTone[call.channel ?? "voice"]} font-medium`}
                    >
                      {call.channel ? channelCopy[call.channel] : channelCopy.voice}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    {formatDuration(call.durationSeconds)}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    <Badge
                      variant="outline"
                      className={`${outcomeTone[call.outcome]} font-medium`}
                    >
                      {outcomeCopy[call.outcome]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    {call.satisfactionScore != null ? (
                      <Badge
                        variant="outline"
                        className={`${satisfactionTone(call.satisfactionScore)} font-medium`}
                      >
                        {call.satisfactionScore.toFixed(1)}/10
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/calls/${call.id}`}
                      className="flex items-center gap-1 text-sm font-medium text-zinc-600 opacity-0 transition-opacity hover:text-zinc-900 group-hover:opacity-100"
                    >
                      View
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 text-xs text-zinc-500">
          Showing {calls.length} recent session{calls.length !== 1 ? "s" : ""}. Click &quot;View&quot; to see full details and transcript.
        </div>
      </CardContent>
    </Card>
  );
}
