"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

export type TimelineItem = {
  id: string | number;
  type: "conversation" | "appointment";
  channel?: "voice" | "sms" | "email" | null;
  timestamp: string | null;
  status: string;
  summary: string;
  // Conversation-specific
  satisfaction_score?: number | null;
  outcome?: string | null;
  sentiment?: string | null;
  content_preview?: string;
  // Appointment-specific
  provider?: string | null;
  duration_minutes?: number;
  special_requests?: string | null;
  booked_by?: string;
  cancellation_reason?: string | null;
};

const channelIcon: Record<string, React.ReactNode> = {
  voice: <Phone className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const channelColor: Record<string, string> = {
  voice: "bg-sky-100 text-sky-700",
  sms: "bg-emerald-100 text-emerald-700",
  email: "bg-violet-100 text-violet-700",
};

const statusColor: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-sky-50 text-sky-700 border-sky-200",
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
};

function TimelineItemCard({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);

  const isConversation = item.type === "conversation";
  const isAppointment = item.type === "appointment";

  return (
    <Card className="border-zinc-200 p-4">
      <div className="flex gap-4">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            isConversation && item.channel
              ? channelColor[item.channel]
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {isConversation && item.channel ? (
            channelIcon[item.channel]
          ) : (
            <Calendar className="h-4 w-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-zinc-900">{item.summary}</h4>
              <p className="text-sm text-zinc-500">
                {item.timestamp
                  ? formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                    })
                  : "Unknown time"}
                {" • "}
                {item.timestamp
                  ? format(new Date(item.timestamp), "MMM d, yyyy 'at' h:mm a")
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {item.status && (
                <Badge
                  variant="outline"
                  className={statusColor[item.status] || ""}
                >
                  {item.status}
                </Badge>
              )}
              {isConversation && item.channel && (
                <Badge variant="outline" className="capitalize">
                  {item.channel}
                </Badge>
              )}
            </div>
          </div>

          {/* Conversation Details */}
          {isConversation && (
            <div className="space-y-2">
              {item.content_preview && (
                <p className="text-sm text-zinc-600 line-clamp-2">
                  {item.content_preview}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
                {item.satisfaction_score !== null &&
                  item.satisfaction_score !== undefined && (
                    <span
                      className={`font-medium ${
                        item.satisfaction_score >= 8
                          ? "text-emerald-600"
                          : item.satisfaction_score >= 5
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      Satisfaction: {item.satisfaction_score}/10
                    </span>
                  )}
                {item.outcome && (
                  <span>
                    Outcome:{" "}
                    <span className="capitalize">{item.outcome.replace("_", " ")}</span>
                  </span>
                )}
                {item.sentiment && (
                  <span>
                    Sentiment:{" "}
                    <span className="capitalize">{item.sentiment}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Appointment Details */}
          {isAppointment && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
                {item.provider && <span>Provider: {item.provider}</span>}
                {item.duration_minutes && (
                  <span>Duration: {item.duration_minutes} min</span>
                )}
                {item.booked_by && (
                  <span className="capitalize">Booked by: {item.booked_by}</span>
                )}
              </div>

              {item.special_requests && (
                <div className="rounded-lg bg-sky-50 p-3 text-sm">
                  <p className="font-medium text-sky-900">Special Requests:</p>
                  <p className="text-sky-700">{item.special_requests}</p>
                </div>
              )}

              {item.cancellation_reason && (
                <div className="rounded-lg bg-rose-50 p-3 text-sm">
                  <p className="font-medium text-rose-900">Cancellation Reason:</p>
                  <p className="text-rose-700">{item.cancellation_reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Expand/Collapse (future use for full transcripts) */}
          {isConversation && item.content_preview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-500 hover:text-zinc-900"
            >
              {expanded ? (
                <>
                  Show Less <ChevronUp className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  Show More <ChevronDown className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

interface CustomerTimelineProps {
  items: TimelineItem[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function CustomerTimeline({
  items,
  loading = false,
  onLoadMore,
  hasMore = false,
}: CustomerTimelineProps) {
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-500">Loading timeline...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Calendar className="mb-3 h-12 w-12 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-900">No activity yet</p>
        <p className="text-sm text-zinc-500">
          Customer interactions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <TimelineItemCard key={item.id} item={item} />
      ))}

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
