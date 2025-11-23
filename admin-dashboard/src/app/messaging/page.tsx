import { MessagingConsole } from "@/components/messaging/messaging-console";
import type { CommunicationMessage } from "@/types/communication";

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
  return `${basePath}${path}`;
}

interface ConversationListItem {
  id: string;
  channel: "sms" | "email";
  status?: string | null;
  subject?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  message_count?: number;
  last_message_preview?: string | null;
  last_activity_at?: string | null;
  initiated_at?: string | null;
}

interface ConversationListResponse {
  conversations: ConversationListItem[];
}

interface ConversationDetailResponse {
  conversation: {
    id: string;
    channel: "sms" | "email";
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
  messages: Array<{
    id: string;
    channel: "sms" | "email";
    direction: "inbound" | "outbound";
    content: string;
    sent_at: string | null;
    metadata?: Record<string, unknown>;
  }>;
}

async function fetchInitialMessagingData(): Promise<{
  conversations: ConversationListItem[];
  conversation: ConversationDetailResponse["conversation"] | null;
  messages: CommunicationMessage[];
}> {
  try {
    const conversationsResponse = await fetch(resolveInternalUrl("/api/admin/messaging"), {
      cache: "no-store",
    });

    if (!conversationsResponse.ok) {
      console.warn("Failed to fetch conversations", conversationsResponse.statusText);
      return { conversations: [], conversation: null, messages: [] };
    }

    const conversationsData = (await conversationsResponse.json()) as ConversationListResponse;
    const conversations = conversationsData.conversations ?? [];

    if (!conversations.length) {
      return { conversations: [], conversation: null, messages: [] };
    }

    const latestConversation = conversations[0];

    const detailResponse = await fetch(
      resolveInternalUrl(`/api/admin/messaging/conversations/${latestConversation.id}`),
      { cache: "no-store" }
    );

    if (!detailResponse.ok) {
      console.warn("Failed to fetch conversation detail", detailResponse.statusText);
      return { conversations, conversation: null, messages: [] };
    }

    const detailData = (await detailResponse.json()) as ConversationDetailResponse;

    const messages = detailData.messages.map((message) => ({
      id: message.id,
      channel: message.channel,
      author: message.direction === "outbound" ? "assistant" : "customer",
      direction: message.direction,
      body: message.content,
      timestamp: message.sent_at ?? new Date().toISOString(),
      metadata: message.metadata ?? {},
    } satisfies CommunicationMessage));

    return {
      conversations,
      conversation: detailData.conversation,
      messages,
    };
  } catch (error) {
    console.error("Error fetching messages", error);
    return { conversations: [], conversation: null, messages: [] };
  }
}

export const dynamic = "force-dynamic";

export default async function MessagingPage() {
  const { conversations, messages, conversation } = await fetchInitialMessagingData();
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Background Decor */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 via-transparent to-white/50" />
          <div className="absolute right-0 top-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/2 rounded-full bg-sky-200/20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-[500px] w-[500px] translate-y-1/2 -translate-x-1/2 rounded-full bg-blue-200/20 blur-[100px]" />
      </div>

      <div className="space-y-6 py-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Messaging Console</h1>
          <p className="max-w-3xl text-sm text-zinc-500">
            Simulate guest conversations across SMS and email channels. Use this space to test how Eva
            handles written requests alongside voice calls.
          </p>
        </header>

        <MessagingConsole
          initialConversations={conversations}
          initialMessages={messages}
          initialConversation={conversation}
        />
      </div>
    </div>
  );
}
