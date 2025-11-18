"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Calendar, MessageSquare, Video, Smile } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
};

type CustomerStats = {
  total_conversations: number;
  avg_satisfaction_score: number;
  total_bookings: number;
  channels_used: string[];
};

type TimelineEvent = {
  id: string;
  channel: string;
  initiated_at: string;
  completed_at: string | null;
  outcome: string | null;
  satisfaction_score: number | null;
  sentiment: string | null;
  ai_summary: string | null;
  message_count: number;
  status: string;
};

type CustomerTimelineData = {
  customer: Customer;
  stats: CustomerStats;
  timeline: TimelineEvent[];
};

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params?.id as string;

  const [data, setData] = useState<CustomerTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/admin/customers/${customerId}/timeline`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch customer timeline");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    if (customerId) {
      fetchTimeline();
    }
  }, [customerId]);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "voice":
        return <Phone className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "voice":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "sms":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "email":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return null;

    const badgeStyles: Record<string, string> = {
      appointment_scheduled: "bg-green-100 text-green-700 border-green-200",
      info_request: "bg-blue-100 text-blue-700 border-blue-200",
      complaint: "bg-red-100 text-red-700 border-red-200",
      unresolved: "bg-zinc-100 text-zinc-700 border-zinc-200",
    };

    const style = badgeStyles[outcome] || "bg-zinc-100 text-zinc-700 border-zinc-200";

    return (
      <Badge variant="outline" className={style}>
        {outcome.replace("_", " ")}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-red-600">Error loading customer</p>
          <p className="mt-1 text-xs text-zinc-500">{error || "Customer not found"}</p>
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Customer Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{data.customer.name}</h1>
            <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {data.customer.phone}
              </div>
              {data.customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {data.customer.email}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Customer since {format(new Date(data.customer.created_at), "MMM d, yyyy")}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-zinc-900">
                {data.stats.total_conversations}
              </div>
              <div className="text-xs text-zinc-500">Conversations</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900">
                {data.stats.total_bookings}
              </div>
              <div className="text-xs text-zinc-500">Bookings</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-zinc-900">
                {data.stats.avg_satisfaction_score.toFixed(1)}
                <Smile className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-xs text-zinc-500">Avg Satisfaction</div>
            </div>
          </div>
        </div>

        {/* Channels Used */}
        <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4">
          <span className="text-sm font-medium text-zinc-700">Channels:</span>
          <div className="flex gap-2">
            {data.stats.channels_used.map((channel) => (
              <Badge
                key={channel}
                variant="outline"
                className={`flex items-center gap-1.5 ${getChannelColor(channel)}`}
              >
                {getChannelIcon(channel)}
                {channel.charAt(0).toUpperCase() + channel.slice(1)}
              </Badge>
            ))}
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Conversation History</h2>

        {data.timeline.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-zinc-500">No conversation history yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.timeline.map((event, index) => (
              <Card key={event.id} className="relative transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                {/* Timeline connector line */}
                {index < data.timeline.length - 1 && (
                  <div className="absolute left-7 top-14 h-[calc(100%+1rem)] w-0.5 bg-zinc-200"></div>
                )}

                <div className="flex gap-4">
                  {/* Channel Icon */}
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ${getChannelColor(
                      event.channel
                    )}`}
                  >
                    {getChannelIcon(event.channel)}
                  </div>

                  {/* Event Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900">
                            {event.channel.charAt(0).toUpperCase() + event.channel.slice(1)}{" "}
                            Conversation
                          </span>
                          {event.outcome && getOutcomeBadge(event.outcome)}
                        </div>
                        <p className="mt-1 text-sm text-zinc-600">
                          {format(new Date(event.initiated_at), "MMM d, yyyy 'at' h:mm a")}
                          {event.completed_at && (
                            <>
                              {" "}
                              -{" "}
                              {format(new Date(event.completed_at), "h:mm a")}
                            </>
                          )}
                        </p>
                      </div>

                      {event.satisfaction_score !== null && (
                        <div className="flex items-center gap-1 text-sm">
                          <Smile className="h-4 w-4 text-amber-500" />
                          <span className="font-medium text-zinc-900">
                            {event.satisfaction_score}/10
                          </span>
                        </div>
                      )}
                    </div>

                    {event.ai_summary && (
                      <p className="mt-3 text-sm text-zinc-600">{event.ai_summary}</p>
                    )}

                    <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                      <span>{event.message_count} message(s)</span>
                      {event.sentiment && (
                        <span className="capitalize">{event.sentiment} sentiment</span>
                      )}
                      <span className="capitalize">{event.status}</span>
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
