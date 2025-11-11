"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/components/communication/message-bubble";
import type { CommunicationChannel, CommunicationMessage } from "@/types/communication";
import { Loader2, Mail, MessageSquare, Plus, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type MessagingChannel = Extract<CommunicationChannel, "sms" | "email">;

type ConversationSummary = {
  id: string;
  channel: MessagingChannel;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  subject?: string | null;
  status?: string | null;
  message_count?: number;
  last_message_preview?: string | null;
  last_activity_at?: string | null;
  initiated_at?: string | null;
};

const CHANNEL_DEFAULTS: Record<MessagingChannel, { customer_name: string; customer_phone?: string; customer_email?: string; subject?: string }> = {
  sms: {
    customer_name: "Messaging Console SMS Guest",
    customer_phone: "+15555550100",
  },
  email: {
    customer_name: "Messaging Console Email Guest",
    customer_email: "guest@example.com",
    subject: "Messaging console outreach",
  },
};

interface MessagingConsoleProps {
  initialConversations: ConversationSummary[];
  initialMessages: CommunicationMessage[];
  initialConversation?: ConversationSummary | null;
}

export function MessagingConsole({ initialConversations, initialMessages, initialConversation }: MessagingConsoleProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversation?.id ?? null);
  const [conversationChannelFilter, setConversationChannelFilter] = useState<"all" | MessagingChannel>("all");
  const [messages, setMessages] = useState<CommunicationMessage[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(initialConversation ?? null);
  const [channel, setChannel] = useState<MessagingChannel>(initialConversation?.channel ?? "sms");
  const [newCustomerName, setNewCustomerName] = useState<string>(
    initialConversation?.customer_name ?? CHANNEL_DEFAULTS[channel].customer_name
  );
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>(
    initialConversation?.customer_phone ?? CHANNEL_DEFAULTS.sms.customer_phone ?? ""
  );
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>(
    initialConversation?.customer_email ?? CHANNEL_DEFAULTS.email.customer_email ?? ""
  );
  const [newSubject, setNewSubject] = useState<string>(
    initialConversation?.subject ?? CHANNEL_DEFAULTS.email.subject ?? ""
  );
  const [newMessage, setNewMessage] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setConversation(initialConversation ?? null);
    if (initialConversation?.channel) {
      setChannel(initialConversation.channel);
    }
    setActiveConversationId(initialConversation?.id ?? null);
  }, [initialConversation]);

  useEffect(() => {
    if (conversation) {
      const defaults = CHANNEL_DEFAULTS[conversation.channel];
      setNewCustomerName(conversation.customer_name ?? defaults.customer_name);
      if (conversation.channel === "sms") {
        setNewCustomerPhone(conversation.customer_phone ?? CHANNEL_DEFAULTS.sms.customer_phone ?? "");
      } else {
        setNewCustomerEmail(conversation.customer_email ?? CHANNEL_DEFAULTS.email.customer_email ?? "");
        setNewSubject(conversation.subject ?? CHANNEL_DEFAULTS.email.subject ?? "");
      }
    } else {
      const defaults = CHANNEL_DEFAULTS[channel];
      setNewCustomerName(defaults.customer_name);
      setNewCustomerPhone(defaults.customer_phone ?? "");
      setNewCustomerEmail(defaults.customer_email ?? "");
      setNewSubject(defaults.subject ?? "");
    }
  }, [conversation, channel]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  const transformApiMessage = (message: {
    id: string;
    channel: string;
    direction: "inbound" | "outbound";
    content: string;
    sent_at: string | null;
    metadata?: Record<string, unknown>;
  }): CommunicationMessage => ({
    id: message.id,
    channel: (message.channel as CommunicationChannel) ?? channel,
    author: message.direction === "outbound" ? "assistant" : "customer",
    direction: message.direction,
    body: message.content,
    timestamp: message.sent_at ?? new Date().toISOString(),
    metadata: message.metadata ?? {},
  });

  const filteredConversations = useMemo(() => {
    const filtered = conversationChannelFilter === "all"
      ? conversations
      : conversations.filter((item) => item.channel === conversationChannelFilter);

    return [...filtered].sort((a, b) => {
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, conversationChannelFilter]);

  const selectConversation = (conversationId: string) => {
    const selected = conversations.find((c) => c.id === conversationId) ?? null;
    setActiveConversationId(selected?.id ?? null);
    setConversation(selected);
    if (selected?.channel) {
      setChannel(selected.channel);
    }
    setNewMessage("");
    setError(null);
  };

  const handleStartNewConversation = () => {
    setConversation(null);
    setActiveConversationId(null);
    setMessages([]);
    setChannel("sms");
    setNewMessage("");
    setError(null);
    setIsLoadingMessages(false);
  };

  const refreshConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await fetch("/api/admin/messaging");
      if (!response.ok) {
        throw new Error(`Failed to refresh conversations: ${response.statusText}`);
      }
      const data = (await response.json()) as { conversations: ConversationSummary[] };
      const items = data.conversations ?? [];
      setConversations(items);
      if (activeConversationId) {
        const updated = items.find((item) => item.id === activeConversationId);
        if (updated) {
          setConversation((prev) => (prev ? { ...prev, ...updated } : updated));
        }
      }
      setError(null);
    } catch (refreshError) {
      console.error(refreshError);
      setError("Unable to refresh conversations.");
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await fetch(`/api/admin/messaging/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error(`Failed to load conversation: ${response.statusText}`);
      }
      const data = (await response.json()) as {
        conversation: ConversationSummary;
        messages: Array<{
          id: string;
          channel: string;
          direction: "inbound" | "outbound";
          content: string;
          sent_at: string | null;
          metadata?: Record<string, unknown>;
        }>;
      };

      setConversation(data.conversation);
      setChannel(data.conversation.channel);
      setActiveConversationId(data.conversation.id);
      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          channel: (message.channel as CommunicationChannel) ?? data.conversation.channel,
          author: message.direction === "outbound" ? "assistant" : "customer",
          direction: message.direction,
          body: message.content,
          timestamp: message.sent_at ?? new Date().toISOString(),
          metadata: message.metadata ?? {},
        }))
      );
      setNewMessage("");
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to open conversation.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSend = async ({ channel: selectedChannel, content }: { channel: CommunicationChannel; content: string }) => {
    const activeChannel = selectedChannel as MessagingChannel;
    const timestamp = new Date().toISOString();
    const userMessage: CommunicationMessage = {
      id: `temp-${Date.now()}`,
      channel: activeChannel,
      author: "customer",
      direction: "inbound",
      body: content,
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        channel: activeChannel,
        content,
      };

      if (conversation?.id) {
        payload.conversation_id = conversation.id;
        if (conversation.customer_name) {
          payload.customer_name = conversation.customer_name;
        }
        if (activeChannel === "sms" && conversation.customer_phone) {
          payload.customer_phone = conversation.customer_phone;
        }
        if (activeChannel === "email" && conversation.customer_email) {
          payload.customer_email = conversation.customer_email;
          if (conversation.subject) {
            payload.subject = conversation.subject;
          }
        }
      } else {
        const defaults = CHANNEL_DEFAULTS[activeChannel];
        const trimmedName = newCustomerName.trim();
        const trimmedPhone = newCustomerPhone.trim();
        const trimmedEmail = newCustomerEmail.trim();
        const trimmedSubject = newSubject.trim();

        payload.customer_name = trimmedName || defaults.customer_name;
        if (defaults.customer_phone || trimmedPhone) {
          payload.customer_phone = trimmedPhone || defaults.customer_phone;
        }
        if (defaults.customer_email || trimmedEmail) {
          payload.customer_email = trimmedEmail || defaults.customer_email;
        }
        if (defaults.subject || trimmedSubject) {
          payload.subject = trimmedSubject || defaults.subject;
        }
      }

      const response = await fetch("/api/admin/messaging/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data: {
        conversation: ConversationSummary & { channel: MessagingChannel };
        customer_message: {
          id: string;
          channel: string;
          direction: "inbound" | "outbound";
          content: string;
          sent_at: string | null;
          metadata?: Record<string, unknown>;
        };
        assistant_message: {
          id: string;
          channel: string;
          direction: "inbound" | "outbound";
          content: string;
          sent_at: string | null;
          metadata?: Record<string, unknown>;
        };
      } = await response.json();

      const inbound = transformApiMessage(data.customer_message);
      const outbound = transformApiMessage(data.assistant_message);

      setConversation(data.conversation);
      setChannel(data.conversation.channel);
      setActiveConversationId(data.conversation.id);
      setConversations((prev) => {
        const filtered = prev.filter((item) => item.id !== data.conversation.id);
        return [data.conversation, ...filtered];
      });

      setMessages((prev) => {
        const withoutTemp = prev.filter((message) => message.id !== userMessage.id);
        return [...withoutTemp, inbound, outbound];
      });
      setNewMessage("");
      setError(null);
    } catch (error) {
      console.error(error);
      setError("Unable to send message. Please try again.");
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
    }
  };

  const canSend = useMemo(() => {
    if (!newMessage.trim()) {
      return false;
    }
    if (conversation) {
      return true;
    }
    if (!newCustomerName.trim()) {
      return false;
    }
    if (channel === "sms") {
      return Boolean(newCustomerPhone.trim());
    }
    if (channel === "email") {
      return Boolean(newCustomerEmail.trim());
    }
    return true;
  }, [conversation, newMessage, newCustomerName, newCustomerPhone, newCustomerEmail, channel]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row">
        <Card className="flex-1 border-zinc-200">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Conversations</CardTitle>
              <p className="text-xs text-zinc-500">Browse recent SMS and email interactions.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleStartNewConversation}
                  className="flex items-center gap-1"
                  variant="secondary"
                >
                  <Plus className="h-3 w-3" /> New conversation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshConversations}
                  disabled={isLoadingConversations}
                  className="flex items-center gap-1"
                >
                  {isLoadingConversations ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Refresh
                </Button>
              </div>
              <ToggleGroup
                type="single"
                value={conversationChannelFilter}
                onValueChange={(value) => {
                  if (value) {
                    setConversationChannelFilter(value as "all" | MessagingChannel);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1"
              >
                {[
                  { value: "all", label: "All" },
                  { value: "sms", label: "SMS" },
                  { value: "email", label: "Email" },
                ].map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                    className={cn(
                      "rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wide",
                      conversationChannelFilter === option.value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredConversations.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-zinc-200 text-center text-xs text-zinc-500">
                <p>No messaging conversations yet.</p>
                <p>Use the form to start a new SMS or email thread with Ava.</p>
              </div>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="flex flex-col gap-2 pr-3">
                  {filteredConversations.map((item) => {
                    const isActive = activeConversationId === item.id;
                    const icon = item.channel === "sms" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />;
                    const subtitle = item.channel === "sms" ? item.customer_phone : item.customer_email;
                    const timestamp = item.last_activity_at
                      ? formatDistanceToNow(new Date(item.last_activity_at), { addSuffix: true })
                      : "Unknown";

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          selectConversation(item.id);
                          void loadConversationMessages(item.id);
                        }}
                        className={cn(
                          "w-full rounded-lg border px-3 py-3 text-left transition",
                          isActive ? "border-zinc-900 bg-zinc-900/5" : "border-zinc-200 hover:border-zinc-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={isActive ? "default" : "outline"} className="flex items-center gap-1 text-[10px]">
                              {icon}
                              {item.channel.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-semibold text-zinc-900">
                              {item.customer_name ?? "Guest"}
                            </span>
                          </div>
                          <span className="text-[11px] uppercase tracking-wide text-zinc-400">{timestamp}</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-zinc-500">{subtitle ?? "No contact info"}</p>
                          <p className="line-clamp-2 text-xs text-zinc-600">
                            {item.last_message_preview ?? "No messages yet"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="flex-[2] border-zinc-200">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {conversation ? conversation.customer_name ?? "Conversation" : "New conversation"}
              </CardTitle>
              <p className="text-xs text-zinc-500">
                {conversation
                  ? "Review the timeline below and send follow-ups to Ava."
                  : "Fill in guest details to begin a mock conversation."}
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={channel}
              onValueChange={(value) => {
                if (value) {
                  setChannel(value as MessagingChannel);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1"
            >
              {[
                { value: "sms", label: "SMS" },
                { value: "email", label: "Email" },
              ].map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide",
                    channel === option.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  )}
                  disabled={Boolean(conversation?.id)}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
          <CardContent className="space-y-5">
            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            ) : null}

            <ScrollArea className="h-[360px] border border-zinc-100">
              <div ref={scrollRef} className="flex flex-col gap-5 p-4">
                {isLoadingMessages ? (
                  <div className="flex h-[200px] items-center justify-center text-xs text-zinc-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-zinc-500">
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
              </div>
            </ScrollArea>

            <div className="space-y-4 rounded-lg border border-dashed border-zinc-200 p-4">
              {!conversation && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Guest name
                    </label>
                    <Input
                      value={newCustomerName}
                      onChange={(event) => setNewCustomerName(event.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  {channel === "sms" ? (
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Phone number
                      </label>
                      <Input
                        value={newCustomerPhone}
                        onChange={(event) => setNewCustomerPhone(event.target.value)}
                        placeholder="+15555550100"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Email
                        </label>
                        <Input
                          value={newCustomerEmail}
                          onChange={(event) => setNewCustomerEmail(event.target.value)}
                          placeholder="guest@example.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Subject
                        </label>
                        <Input
                          value={newSubject}
                          onChange={(event) => setNewSubject(event.target.value)}
                          placeholder="Appointment follow-up"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Message to Ava
                </label>
                <Textarea
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder={channel === "sms" ? "Type a quick text message." : "Draft the email the guest sent."}
                  rows={channel === "email" ? 6 : 4}
                />
              </div>

              <Button
                className="w-full"
                disabled={isSending || !canSend}
                onClick={async () => {
                  if (!canSend || !newMessage.trim()) {
                    return;
                  }
                  try {
                    setIsSending(true);
                    await handleSend({ channel, content: newMessage.trim() });
                    await refreshConversations();
                  } finally {
                    setIsSending(false);
                  }
                }}
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Send to Ava
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-zinc-500">
            Conversation metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversation ? (
            <dl className="grid gap-3 text-sm text-zinc-600 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">Channel</dt>
                <dd>{conversation.channel.toUpperCase()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">Messages</dt>
                <dd>{conversation.message_count ?? messages.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">Last activity</dt>
                <dd>{
                  conversation.last_activity_at
                    ? formatDistanceToNow(new Date(conversation.last_activity_at), { addSuffix: true })
                    : "N/A"
                }</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">Status</dt>
                <dd>{conversation.status ?? "open"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">Start a conversation to see its metadata here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
