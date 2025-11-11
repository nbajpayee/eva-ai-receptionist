"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommunicationChannel } from "@/types/communication";

const PLACEHOLDERS: Record<CommunicationChannel, string> = {
  sms: "Send a quick SMS update",
  email: "Compose the email Ava should send",
  voice: "Voice responses are captured automatically after calls.",
};

const SHORTCUT_HINTS: Record<CommunicationChannel, string> = {
  sms: "Press Enter to send. Use Shift+Enter for a new line.",
  email: "Press ⌘+Enter (Ctrl+Enter) to send. Enter adds a new line.",
  voice: "Voice responses are captured automatically after calls.",
};

export type MessageComposerProps = {
  channel: CommunicationChannel;
  onSend: (payload: { channel: CommunicationChannel; content: string }) => Promise<void> | void;
  disabled?: boolean;
};

export function MessageComposer({ channel, onSend, disabled }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || isSending) return;
    try {
      setIsSending(true);
      await onSend({
        channel,
        content: message.trim(),
      });
      setMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage();
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (channel === "sms" && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
      return;
    }
    if (channel === "email" && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      await sendMessage();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        id="message"
        name="message"
        placeholder={PLACEHOLDERS[channel] ?? "Send a note to the guest."}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending || disabled}
        rows={channel === "email" ? 8 : 4}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {SHORTCUT_HINTS[channel] ?? "Press Enter to send."}
        </p>
        <Button type="submit" disabled={isSending || disabled || !message.trim()}>
          {isSending ? "Sending…" : "Send to Ava"}
        </Button>
      </div>
    </form>
  );
}
