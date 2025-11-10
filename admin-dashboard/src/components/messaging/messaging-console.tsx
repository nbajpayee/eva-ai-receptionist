"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/components/communication/message-bubble";
import { MessageComposer } from "@/components/communication/message-composer";
import type { CommunicationChannel, CommunicationMessage } from "@/types/communication";

export function MessagingConsole({ initialMessages }: { initialMessages: CommunicationMessage[] }) {
  type MessagingChannel = Extract<CommunicationChannel, "mobile_text" | "email">;
  const [messages, setMessages] = useState<CommunicationMessage[]>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<MessagingChannel>("mobile_text");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  const handleSend = async ({ channel, content }: { channel: CommunicationChannel; content: string }) => {
    const timestamp = new Date().toISOString();
    const userMessage: CommunicationMessage = {
      id: `temp-${Date.now()}`,
      channel,
      author: "customer",
      direction: "inbound",
      body: content,
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setError(null);

    try {
      const response = await fetch("/api/admin/messaging", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data: { reply: CommunicationMessage } = await response.json();
      setMessages((prev) => [...prev, data.reply]);
    } catch (error) {
      console.error(error);
      setError("Unable to send message. Please try again.");
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
    }
  };

  return (
    <div>
      <Card className="border-zinc-200">
        <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-base">Conversation timeline</CardTitle>
            <p className="text-xs text-zinc-500">
              Simulate guest conversations and switch between SMS or email responses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                { value: "mobile_text", label: "Mobile text" },
                { value: "email", label: "Email" },
              ].map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide",
                    channel === option.value
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
        <CardContent className="space-y-5">
          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
          <ScrollArea className="h-[360px]">
            <div ref={scrollRef} className="flex flex-col gap-5 pr-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No messages yet. Start the conversation below.
                </div>
              ) : (
                messages.map((message) => <MessageBubble key={message.id} message={message} />)
              )}
            </div>
          </ScrollArea>
          <MessageComposer channel={channel} onSend={handleSend} />
        </CardContent>
      </Card>
    </div>
  );
}
