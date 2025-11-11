export type CommunicationChannel = "voice" | "sms" | "email";

export type CommunicationAuthor = "assistant" | "customer" | "system";

export type CommunicationDirection = "inbound" | "outbound";

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  voice: "Phone call",
  sms: "Text message",
  email: "Email",
};

export const CHANNEL_TONES: Record<CommunicationChannel, string> = {
  voice: "bg-indigo-50 text-indigo-700 border-indigo-200",
  sms: "bg-emerald-50 text-emerald-700 border-emerald-200",
  email: "bg-sky-50 text-sky-700 border-sky-200",
};

export type CommunicationMessage = {
  id: string;
  channel: CommunicationChannel;
  author: CommunicationAuthor;
  direction: CommunicationDirection;
  body: string;
  timestamp: string;
  metadata?: {
    subject?: string | null;
    source?: CommunicationChannel;
  };
};

export function getChannelLabel(channel: CommunicationChannel): string {
  return CHANNEL_LABELS[channel];
}
