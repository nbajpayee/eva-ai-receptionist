import { MessagingConsole } from "@/components/messaging/messaging-console";

export const dynamic = "force-dynamic";

export default function MessagingPage() {
  // Let the client-side component handle all data fetching
  // This avoids SSR delays and auth issues
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
          initialConversations={[]}
          initialMessages={[]}
          initialConversation={null}
        />
      </div>
    </div>
  );
}
