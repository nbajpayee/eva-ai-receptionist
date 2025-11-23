"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { 
  Loader2, 
  Mail, 
  MessageSquare, 
  Menu, 
  Plus, 
  Send, 
  RefreshCw, 
  Zap,
  Search
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow, isFuture } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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

// Random Names List
const RANDOM_NAMES = [
  "Alice Smith", "Bob Johnson", "Carol Williams", "David Brown", "Eve Davis",
  "Frank Miller", "Grace Wilson", "Henry Moore", "Isabel Taylor", "Jack Anderson",
  "Kelly Thomas", "Liam Jackson", "Mia White", "Noah Harris", "Olivia Martin"
];

const getRandomName = () => {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
};

const RANDOM_SUBJECTS = [
  "Question about pricing", "Booking inquiry", "Reschedule appointment",
  "Botox consultation", "Follow up on visit", "Feedback about service",
  "New patient question", "Appointment confirmation"
];

const getRandomSubject = () => {
  return RANDOM_SUBJECTS[Math.floor(Math.random() * RANDOM_SUBJECTS.length)];
};

const getRandomEmail = (name: string) => {
  const sanitized = name.toLowerCase().replace(/[^a-z]/g, "");
  return `${sanitized}${Math.floor(Math.random() * 100)}@test.com`;
};

const QUICK_SCENARIOS = [
  { label: "Check Availability", text: "Hi, do you have any appointments available for tomorrow?" },
  { label: "Book Botox", text: "I'd like to book a botox appointment for Friday afternoon." },
  { label: "Ask Pricing", text: "How much do you charge for a consultation?" },
  { label: "Reschedule", text: "I need to reschedule my appointment." },
  { label: "Cancel", text: "Please cancel my appointment." },
];

function safeFormatDistanceToNow(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  
  // If date is invalid, return empty string
  if (isNaN(date.getTime())) return "";

  // If date is in the future (due to slight server drift or timezone issues), clamp to "Just now"
  if (isFuture(date)) {
    return "Just now";
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

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
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [messages, setMessages] = useState<CommunicationMessage[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(initialConversation ?? null);
  const [channel, setChannel] = useState<MessagingChannel>(initialConversation?.channel ?? "sms");
  
  // Form State
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRefreshPaused, setIsRefreshPaused] = useState(false);

  // Sync props to state
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

  // Update form defaults when conversation/channel changes
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
      // If no active conversation, don't force reset unless channel changed explicitly
      // We handle resets in startNewConversationFlow
    }
  }, [conversation]);

  // Auto-scroll
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
    let filtered = conversations;
    
    // Filter by Channel
    if (conversationChannelFilter !== "all") {
      filtered = filtered.filter((item) => item.channel === conversationChannelFilter);
    }
    
    // Filter by Search Query
    if (conversationSearchQuery.trim()) {
      const query = conversationSearchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        (item.customer_name?.toLowerCase().includes(query)) ||
        (item.customer_phone?.includes(query)) ||
        (item.customer_email?.toLowerCase().includes(query)) ||
        (item.last_message_preview?.toLowerCase().includes(query))
      );
    }

    return [...filtered].sort((a, b) => {
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, conversationChannelFilter, conversationSearchQuery]);

  const refreshConversations = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoadingConversations(true);
    }
    try {
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
      if (!silent) {
        setIsLoadingConversations(false);
      }
    }
  }, [activeConversationId]);

  const loadConversationMessages = useCallback(
    async (conversationId: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoadingMessages(true);
      }
      try {
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
        if (!silent) {
          setIsLoadingMessages(false);
        }
      }
    },
    []
  );

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      setError(null);
      setIsSheetOpen(false);
      void loadConversationMessages(conversationId);
    },
    [loadConversationMessages]
  );

  const getNextPhoneNumber = useCallback(() => {
    // Find highest phone number ending
    let maxNum = 5555550100; // default base
    conversations.forEach(c => {
      if (c.channel === 'sms' && c.customer_phone) {
        // Simple heuristic to extract digits
        const digits = c.customer_phone.replace(/\D/g, '');
        if (digits.length >= 10) {
           const num = parseInt(digits);
           if (!isNaN(num) && num > maxNum) {
             maxNum = num;
           }
        }
      }
    });
    // Format back to +1...
    return `+${maxNum + 1}`;
  }, [conversations]);

  const startNewConversationFlow = useCallback(() => {
    setConversation(null);
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setIsLoadingMessages(false);
    
    // Auto-populate random data
    setChannel("sms");
    const name = getRandomName();
    setNewCustomerName(name);
    setNewCustomerPhone(getNextPhoneNumber());
    setNewCustomerEmail(getRandomEmail(name));
    setNewSubject(getRandomSubject());
    setNewMessage("");
  }, [getNextPhoneNumber]);

  useEffect(() => {
    if (isRefreshPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshConversations({ silent: true });
      if (activeConversationId) {
        void loadConversationMessages(activeConversationId, { silent: true });
      }
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRefreshPaused, activeConversationId, refreshConversations, loadConversationMessages]);

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
        // New conversation flow
        const trimmedName = newCustomerName.trim();
        const trimmedPhone = newCustomerPhone.trim();
        const trimmedEmail = newCustomerEmail.trim();
        const trimmedSubject = newSubject.trim();

        // Ensure we have fallbacks if fields are empty
        const defaults = CHANNEL_DEFAULTS[activeChannel];
        payload.customer_name = trimmedName || defaults.customer_name;
        
        if (activeChannel === "sms") {
            payload.customer_phone = trimmedPhone || defaults.customer_phone;
        } else {
            payload.customer_email = trimmedEmail || defaults.customer_email;
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

  const threadSubtitle = conversation
    ? [
        `${conversation.message_count ?? messages.length} messages`,
        conversation.last_activity_at
          ? `Last activity ${safeFormatDistanceToNow(conversation.last_activity_at)}`
          : "No activity yet",
        conversation.channel.toUpperCase(),
      ]
        .filter(Boolean)
        .join(" · ")
    : "Start a simulated SMS or email thread with Eva.";

  const ConversationListContent = () => (
    <>
      <div className="space-y-4 border-b border-zinc-100/80 pb-4">
        <div className="flex items-start justify-between gap-2 px-1">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-zinc-900">Conversations</h3>
            <p className="text-[11px] text-zinc-500">Recent SMS & Email threads</p>
          </div>
          {isLoadingConversations ? (
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
             >
              <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
             </motion.div>
          ) : null}
        </div>
        
        <Button
            size="sm"
            onClick={startNewConversationFlow}
            className="w-full items-center gap-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-600 shadow-sm transition-all"
        >
            <Plus className="h-3.5 w-3.5" /> New Simulation
        </Button>
        
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <Input 
                    className="h-9 pl-8 text-xs bg-zinc-50/50 border-zinc-200" 
                    placeholder="Search conversations..." 
                    value={conversationSearchQuery}
                    onChange={(e) => setConversationSearchQuery(e.target.value)}
                />
            </div>
            
            <ToggleGroup
                type="single"
                value={conversationChannelFilter}
                onValueChange={(value) => {
                if (value) {
                    setConversationChannelFilter(value as "all" | MessagingChannel);
                }
                }}
                className="inline-flex w-full items-center gap-1 rounded-lg bg-zinc-100/50 p-1 ring-1 ring-zinc-200/50"
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
                    "h-7 flex-1 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-all",
                    conversationChannelFilter === option.value
                        ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50"
                    )}
                >
                    {option.label}
                </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
      </div>
      
      {filteredConversations.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center opacity-60">
          <div className="rounded-full bg-zinc-100 p-3">
            <MessageSquare className="h-6 w-6 text-zinc-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-900">No conversations</p>
            <p className="text-xs text-zinc-500">
                {conversationSearchQuery ? "Try a different search term" : "Start a new simulation"}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mr-3 pr-3">
          <div className="flex flex-col gap-2 p-1 pb-4">
            {filteredConversations.map((item) => {
              const isActive = activeConversationId === item.id;
              const icon = item.channel === "sms" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />;
              const subtitle = item.channel === "sms" ? item.customer_phone : item.customer_email;
              const timestamp = item.last_activity_at
                ? safeFormatDistanceToNow(item.last_activity_at)
                : "Just now";

              return (
                <button
                  key={item.id}
                  onClick={() => handleConversationSelect(item.id)}
                  className={cn(
                    "relative w-full rounded-xl p-3 text-left transition-all duration-200 group",
                    isActive 
                      ? "bg-gradient-to-br from-white to-sky-50 shadow-md ring-1 ring-sky-100" 
                      : "hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-zinc-200/50"
                  )}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-sky-500"
                    />
                  )}
                  <div className={cn("flex items-center justify-between", isActive ? "pl-2" : "")}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border shadow-sm",
                        isActive ? "bg-sky-100 border-sky-200 text-sky-700" : "bg-white border-zinc-100 text-zinc-400"
                      )}>
                        {icon}
                      </div>
                      <span className={cn("text-sm font-medium truncate max-w-[120px]", isActive ? "text-sky-900" : "text-zinc-700")}>
                        {item.customer_name ?? "Guest"}
                      </span>
                    </div>
                    <span className="text-[9px] text-zinc-400 whitespace-nowrap">{timestamp}</span>
                  </div>
                  <div className={cn("mt-2 space-y-1", isActive ? "pl-2" : "")}>
                    <p className="text-[10px] text-zinc-400 font-medium truncate">{subtitle ?? "No contact info"}</p>
                    <p className={cn("line-clamp-1 text-xs", isActive ? "text-sky-700/80" : "text-zinc-500")}>
                      {item.last_message_preview ?? "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </>
  );

  const conversationListPanel = (
    <Card className="h-full border-white/40 bg-white/60 shadow-xl backdrop-blur-xl ring-1 ring-zinc-900/5 overflow-hidden rounded-2xl">
      <div className="p-4 h-full flex flex-col">
        <ConversationListContent />
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
           {/* Mobile Header elements if needed */}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center justify-center rounded-full"
            onClick={() => setIsSheetOpen(true)}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open conversations</span>
          </Button>
          <Button size="sm" onClick={startNewConversationFlow} className="flex items-center gap-1 rounded-full bg-sky-500 text-white hover:bg-sky-600">
            <Plus className="h-3 w-3" />
            <span>New</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:h-[700px]">
        <aside className="hidden w-80 flex-shrink-0 lg:block lg:h-full">
            {conversationListPanel}
        </aside>

        <main className="flex-1 min-w-0 h-full">
          <Card className="flex flex-col h-full border-white/40 bg-white/80 shadow-2xl backdrop-blur-xl ring-1 ring-zinc-900/5 overflow-hidden rounded-2xl">
            <CardHeader className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100/80 bg-white/50 px-6 py-4 backdrop-blur-md">
              <div className="space-y-1">
                {conversation ? (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={conversation.id}
                  >
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-lg font-semibold text-zinc-900">
                        {conversation.customer_name ?? "Conversation"}
                        </CardTitle>
                        <Badge variant="secondary" className="bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-100 capitalize">
                            {conversation.channel}
                        </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1.5">
                         {conversation.channel === 'email' && conversation.subject && (
                             <span className="text-xs font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                                {conversation.subject}
                             </span>
                         )}
                         <p className="text-xs text-zinc-500 flex items-center gap-2">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            {threadSubtitle}
                        </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                  >
                    <CardTitle className="text-lg font-medium text-zinc-400">New Simulation</CardTitle>
                    <p className="text-xs text-zinc-500 mt-1">Configure the guest details to start.</p>
                  </motion.div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="flex flex-col flex-1 p-0 overflow-hidden">
               {/* Messages Area */}
              <ScrollArea className="flex-1 bg-zinc-50/30">
                <div ref={scrollRef} className="flex flex-col gap-6 p-6 min-h-full">
                  {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm text-rose-700 backdrop-blur-sm">
                      {error}
                    </div>
                  ) : null}

                  {isLoadingMessages ? (
                    <div className="flex h-full items-center justify-center py-20 text-sm text-zinc-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-sky-500" /> Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                     <div className="flex h-full w-full flex-col items-center justify-center p-2">
                      {!conversation ? (
                          <div className="flex w-full max-w-3xl flex-row items-center justify-center gap-8">
                              {/* Left Pane: Visuals & Context */}
                              <div className="flex max-w-[200px] flex-col items-start gap-3 text-left">
                                <div className="rounded-xl bg-gradient-to-br from-sky-100 to-white p-3 shadow-sm ring-1 ring-sky-100">
                                  {channel === 'sms' ? (
                                    <MessageSquare className="h-6 w-6 text-sky-500" />
                                  ) : (
                                    <Mail className="h-6 w-6 text-sky-500" />
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                                    Start New Simulation
                                  </h3>
                                  <p className="text-xs leading-relaxed text-zinc-500">
                                    Configure a guest persona to test Eva's capabilities. 
                                  </p>
                                </div>
                              </div>

                              {/* Divider */}
                              <div className="h-32 w-px bg-gradient-to-b from-transparent via-zinc-200 to-transparent" />

                              {/* Right Pane: Configuration Form */}
                              <div className="w-full max-w-xs space-y-4">
                                 {/* Channel Selector */}
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Channel</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            size="sm"
                                            variant={channel === "sms" ? "default" : "outline"}
                                            className={cn("justify-start h-8 text-xs", channel === "sms" ? "bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/20" : "bg-white hover:bg-zinc-50")}
                                            onClick={() => setChannel("sms")}
                                        >
                                            <MessageSquare className="mr-2 h-3.5 w-3.5" /> SMS
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={channel === "email" ? "default" : "outline"}
                                            className={cn("justify-start h-8 text-xs", channel === "email" ? "bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/20" : "bg-white hover:bg-zinc-50")}
                                            onClick={() => setChannel("email")}
                                        >
                                            <Mail className="mr-2 h-3.5 w-3.5" /> Email
                                        </Button>
                                    </div>
                                 </div>

                                 <div className="space-y-2">
                                     <div className="space-y-1">
                                         <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Guest Details</label>
                                         <Input 
                                            className="bg-white h-8 text-xs"
                                            placeholder="Guest Name"
                                            value={newCustomerName} 
                                            onChange={(e) => setNewCustomerName(e.target.value)} 
                                         />
                                     </div>
                                     
                                     {channel === 'sms' ? (
                                         <Input 
                                             className="bg-white h-8 text-xs"
                                             placeholder="Phone Number"
                                             value={newCustomerPhone} 
                                             onChange={(e) => setNewCustomerPhone(e.target.value)} 
                                         />
                                     ) : (
                                         <div className="space-y-2">
                                             <Input 
                                                 className="bg-white h-8 text-xs"
                                                 placeholder="Email Address"
                                                 value={newCustomerEmail} 
                                                 onChange={(e) => setNewCustomerEmail(e.target.value)} 
                                             />
                                             <Input 
                                                 className="bg-white h-8 text-xs"
                                                 placeholder="Subject Line"
                                                 value={newSubject} 
                                                 onChange={(e) => setNewSubject(e.target.value)} 
                                             />
                                         </div>
                                     )}
                                 </div>
                              </div>
                          </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-6 text-center opacity-80">
                           <div className="rounded-full bg-gradient-to-br from-sky-100 to-white p-6 shadow-sm ring-1 ring-sky-100">
                              {channel === 'sms' ? <MessageSquare className="h-10 w-10 text-sky-400" /> : <Mail className="h-10 w-10 text-sky-400" />}
                           </div>
                           <div className="space-y-2 max-w-sm">
                               <p className="text-lg font-semibold text-zinc-900">No messages yet</p>
                               <p className="text-sm text-zinc-500 leading-relaxed">
                                   Send a message below to simulate a guest inquiry.
                               </p>
                           </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <MessageBubble message={message} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="flex-shrink-0 p-4 bg-white border-t border-zinc-100/80">
                <form
                  className="relative rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 transition-all focus-within:bg-white focus-within:shadow-lg focus-within:ring-1 focus-within:ring-sky-200"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!canSend || isSending) {
                      return;
                    }
                    setIsSending(true);
                    const content = newMessage.trim();
                    if (!content) {
                      setIsSending(false);
                      return;
                    }
                    void handleSend({ channel, content }).finally(() => setIsSending(false));
                  }}
                >
                  {/* Quick Scenarios */}
                  <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <div className="flex items-center gap-1 pr-2 text-[10px] font-semibold uppercase tracking-wider text-sky-600/80 whitespace-nowrap">
                         <Zap className="h-3 w-3" /> Scenarios
                    </div>
                    {QUICK_SCENARIOS.map((scenario) => (
                        <button
                            key={scenario.label}
                            type="button"
                            onClick={() => setNewMessage(scenario.text)}
                            className="flex-shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        >
                            {scenario.label}
                        </button>
                    ))}
                  </div>

                  {!conversation && (
                    <div className="mb-3 rounded-lg bg-sky-50/50 p-3 text-xs text-sky-700 border border-sky-100">
                        <p>You are composing the <strong>first message</strong> as a new guest.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Textarea
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onFocus={() => setIsRefreshPaused(true)}
                      onBlur={() => setIsRefreshPaused(false)}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder={
                        conversation
                          ? "Type a message as the guest..."
                          : `Simulate an incoming ${channel === 'sms' ? 'SMS' : 'Email'}...`
                      }
                      rows={conversation ? 2 : 4}
                      className="min-h-[60px] resize-none border-0 bg-transparent p-0 placeholder:text-zinc-400 focus-visible:ring-0 text-base"
                    />
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-zinc-200">
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse"></span>
                        <p className="text-[10px] text-zinc-400 font-medium">
                            Simulating Guest • Eva will auto-reply
                        </p>
                    </div>
                    <Button 
                        type="submit" 
                        disabled={!canSend || isSending}
                        className={cn(
                            "rounded-full px-6 transition-all duration-300",
                            canSend 
                                ? "bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5" 
                                : "bg-zinc-100 text-zinc-400"
                        )}
                    >
                      {isSending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {conversation ? "Send Reply" : "Start Simulation"}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="left" className="flex w-full max-w-xs flex-col p-0">
          <SheetHeader className="border-b border-zinc-100 p-4 text-left">
            <SheetTitle className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Conversations</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <ConversationListContent />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
