"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommunicationMessage } from "@/types/communication";
import { MessageBubble } from "@/components/communication/message-bubble";

export function MessageTimeline({ messages }: { messages: CommunicationMessage[] }) {
  return (
    <ScrollArea className="max-h-[540px]">
      <div className="flex flex-col gap-5 pr-4">
        {messages.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
            No communications yet for this contact.
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>
    </ScrollArea>
  );
}
