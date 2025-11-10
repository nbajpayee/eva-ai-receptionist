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
  return `${getAppOrigin()}${basePath}${path}`;
}

async function fetchMessages(): Promise<CommunicationMessage[]> {
  try {
    const response = await fetch(resolveInternalUrl("/api/admin/messaging"), {
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Failed to fetch messages", response.statusText);
      return [];
    }

    const data = (await response.json()) as { messages: CommunicationMessage[] };
    return data.messages;
  } catch (error) {
    console.error("Error fetching messages", error);
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function MessagingPage() {
  const messages = await fetchMessages();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-zinc-900">Messaging console</h1>
        <p className="text-sm text-zinc-500">
          Simulate guest conversations across SMS and email channels. Use this space to test how Ava
          handles written requests alongside voice calls.
        </p>
      </header>

      <MessagingConsole initialMessages={messages} />
    </div>
  );
}
