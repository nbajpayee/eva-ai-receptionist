import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Phone,
  User,
  TrendingUp,
  MessageSquare,
  PhoneIncoming,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { MessageTimeline } from "@/components/communication/message-timeline";
import type { CommunicationChannel, CommunicationMessage } from "@/types/communication";

type TranscriptEntry = {
  speaker: string;
  text: string;
  timestamp: string;
};

type CallEvent = {
  id: string;
  event_type: string;
  timestamp: string;
  data: any;
};

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
};

type CallDetails = {
  call: {
    id: number;
    session_id: string;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    phone_number: string | null;
    satisfaction_score: number | null;
    sentiment: string | null;
    outcome: string | null;
    escalated: boolean;
    escalation_reason: string | null;
  };
  customer: Customer | null;
  transcript: TranscriptEntry[];
  events: CallEvent[];
};

function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function resolveInternalUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${getAppOrigin()}${basePath}${path}`;
}

async function fetchCallDetails(id: string): Promise<CallDetails | null> {
  try {
    const url = resolveInternalUrl(`/api/admin/communications/${id}`);
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch conversation details: ${response.statusText}`);
    }

    const data = await response.json();

    // Map new conversations schema to old CallDetails format
    const { conversation, messages, events } = data;

    // Extract transcript from voice message content
    let transcript: TranscriptEntry[] = [];
    const voiceMessage = messages.find((m: any) => m.voice);
    if (voiceMessage?.voice?.transcript_segments) {
      // Parse transcript segments
      const segments = voiceMessage.voice.transcript_segments;
      if (Array.isArray(segments) && segments.length > 0) {
        // If transcript_segments is array of parsed objects
        if (typeof segments[0] === 'object' && 'speaker' in segments[0]) {
          transcript = segments.map((seg: any) => ({
            speaker: seg.speaker || 'unknown',
            text: seg.text || '',
            timestamp: seg.timestamp || new Date().toISOString()
          }));
        } else {
          // If it's stored as JSON string, try to parse content
          try {
            const parsed = JSON.parse(voiceMessage.content || '[]');
            if (Array.isArray(parsed)) {
              transcript = parsed;
            }
          } catch (e) {
            console.warn('Failed to parse transcript:', e);
          }
        }
      }
    }

    // Calculate duration from timestamps
    const duration = conversation.completed_at
      ? Math.floor((new Date(conversation.completed_at).getTime() - new Date(conversation.initiated_at).getTime()) / 1000)
      : 0;

    return {
      call: {
        id: parseInt(conversation.metadata?.legacy_call_session_id || '0'),
        session_id: conversation.metadata?.session_id || conversation.id,
        started_at: conversation.initiated_at,
        ended_at: conversation.completed_at || conversation.initiated_at,
        duration_seconds: duration,
        phone_number: conversation.metadata?.phone_number || null,
        satisfaction_score: conversation.satisfaction_score,
        sentiment: conversation.sentiment,
        outcome: conversation.outcome,
        escalated: conversation.metadata?.escalated || false,
        escalation_reason: conversation.metadata?.escalation_reason || null,
      },
      customer: conversation.customer || null,
      transcript,
      events: events.map((event: any, index: number) => ({
        id: typeof event.id === "string" ? event.id : index.toString(),
        event_type: event.event_type,
        timestamp: event.timestamp,
        data: event.details,
      })),
    };
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    return null;
  }
}

async function fetchConversationMessages(conversationId: string): Promise<CommunicationMessage[]> {
  try {
    const response = await fetch(
      resolveInternalUrl(`/api/admin/messaging/conversations/${conversationId}`),
      { cache: "no-store" }
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      messages: Array<{
        id: string;
        channel: string;
        direction: "inbound" | "outbound";
        content: string;
        sent_at: string | null;
        metadata?: Record<string, unknown>;
      }>;
    };

    return data.messages.map((message) => ({
      id: message.id,
      channel: message.channel as CommunicationChannel,
      author: message.direction === "outbound" ? "assistant" : "customer",
      direction: message.direction,
      body: message.content,
      timestamp: message.sent_at ?? new Date().toISOString(),
      metadata: message.metadata ?? {},
    } satisfies CommunicationMessage));
  } catch (error) {
    console.error("Error fetching conversation messages", error);
    return [];
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case "positive":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "negative":
      return "text-rose-700 bg-rose-50 border-rose-200";
    case "neutral":
      return "text-zinc-700 bg-zinc-50 border-zinc-200";
    default:
      return "text-zinc-500 bg-zinc-50 border-zinc-200";
  }
}

function getOutcomeColor(outcome: string | null): string {
  switch (outcome) {
    case "booked":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "rescheduled":
      return "text-sky-700 bg-sky-50 border-sky-200";
    case "cancelled":
      return "text-rose-700 bg-rose-50 border-rose-200";
    case "info_only":
      return "text-zinc-700 bg-zinc-50 border-zinc-200";
    default:
      return "text-zinc-500 bg-zinc-50 border-zinc-200";
  }
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, conversation] = await Promise.all([
    fetchCallDetails(id),
    fetchConversationMessages(id),
  ]);

  if (!data) {
    notFound();
  }

  const { call, customer, transcript, events } = data;

  type SupportedChannel = CommunicationChannel;
  let primaryChannel: SupportedChannel = "voice";

  if (transcript.length > 0) {
    primaryChannel = "voice";
  } else {
    const firstNonVoiceMessage = conversation.find((message) => message.channel !== "voice");
    const fallbackChannel = firstNonVoiceMessage?.channel ?? conversation[0]?.channel;
    if (fallbackChannel) {
      primaryChannel = fallbackChannel;
    }
  }

  const channelMessages =
    primaryChannel === "voice"
      ? []
      : conversation.filter((message) => message.channel === primaryChannel);

  const channelTitles: Record<SupportedChannel, string> = {
    voice: "Voice call",
    sms: "Mobile text",
    email: "Email",
  };

  const channelIcons: Record<SupportedChannel, typeof MessageSquare> = {
    voice: PhoneIncoming,
    sms: MessageSquare,
    email: Mail,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-zinc-900">Communication detail</h1>
        <p className="text-sm text-zinc-500">Session ID: {call.session_id}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-lg">Interaction overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-700">Started</p>
                <p className="text-sm text-zinc-600">{formatTimestamp(call.started_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-700">Duration</p>
                <p className="text-sm text-zinc-600">{formatDuration(call.duration_seconds)}</p>
              </div>
            </div>
            {call.phone_number && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-700">Phone</p>
                  <p className="text-sm text-zinc-600">{call.phone_number}</p>
                </div>
              </div>
            )}
            {call.satisfaction_score !== null && (
              <div className="flex items-start gap-3">
                <TrendingUp className="mt-0.5 h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-700">Satisfaction</p>
                  <p className="text-sm text-zinc-600">{call.satisfaction_score}/10</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {call.sentiment && (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">Sentiment</p>
                <Badge variant="outline" className={getSentimentColor(call.sentiment)}>
                  {call.sentiment}
                </Badge>
              </div>
            )}
            {call.outcome && (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">Outcome</p>
                <Badge variant="outline" className={getOutcomeColor(call.outcome)}>
                  {call.outcome}
                </Badge>
              </div>
            )}
            {call.escalated && (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">Escalation</p>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Escalated
                </Badge>
                {call.escalation_reason && (
                  <p className="mt-1 text-xs text-zinc-600">{call.escalation_reason}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {customer && (
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-900">{customer.name}</p>
                  <p className="text-sm text-zinc-600">{customer.phone}</p>
                  {customer.email && <p className="text-sm text-zinc-600">{customer.email}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <section className="space-y-6">
        {primaryChannel === "voice" ? (
          <Card className="border-zinc-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneIncoming className="h-5 w-5 text-zinc-400" />
                <CardTitle className="text-lg">{channelTitles[primaryChannel]}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {transcript.length === 0 ? (
                <p className="text-center text-sm text-zinc-500">No transcript available</p>
              ) : (
                <div className="space-y-4">
                  {transcript.map((entry, index) => (
                    <div
                      key={index}
                      className={`rounded-lg border p-4 ${
                        entry.speaker === "customer"
                          ? "border-sky-200 bg-sky-50/60"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            entry.speaker === "customer"
                              ? "bg-sky-100 text-sky-700 border-sky-200"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          }`}
                        >
                          {entry.speaker}
                        </Badge>
                        <span className="text-xs text-zinc-500">{formatTime(entry.timestamp)}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-900">{entry.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-zinc-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = channelIcons[primaryChannel];
                  return <Icon className="h-5 w-5 text-zinc-400" />;
                })()}
                <CardTitle className="text-lg">{channelTitles[primaryChannel]}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {channelMessages.length === 0 ? (
                <p className="text-center text-sm text-zinc-500">No messages recorded for this session yet.</p>
              ) : (
                <MessageTimeline messages={channelMessages} />
              )}
            </CardContent>
          </Card>
        )}

        {events.length > 0 && (
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg">Operational timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                    <div className="h-2 w-2 rounded-full bg-zinc-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-zinc-700">{event.event_type}</p>
                    <p className="text-xs text-zinc-500">{formatTime(event.timestamp)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
