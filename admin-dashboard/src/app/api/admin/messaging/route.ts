import { NextResponse } from "next/server";

import type { CommunicationChannel, CommunicationMessage } from "@/types/communication";

const INITIAL_MESSAGES: CommunicationMessage[] = [
  {
    id: "msg-1",
    channel: "mobile_text",
    author: "customer",
    direction: "inbound",
    body: "Hey Ava, do you have any Botox appointments this Thursday afternoon?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "msg-2",
    channel: "mobile_text",
    author: "assistant",
    direction: "outbound",
    body: "Hi there! I do have availability on Thursday at 2:30 PM or 4:15 PM. Which time works best for you?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4.5).toISOString(),
  },
  {
    id: "msg-3",
    channel: "email",
    author: "assistant",
    direction: "outbound",
    body: "Following up with the pre-treatment instructions we discussed on the call. Please review them before your appointment tomorrow.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    metadata: {
      subject: "Pre-treatment checklist",
    },
  },
];

let conversationState: CommunicationMessage[] = [...INITIAL_MESSAGES];

export async function GET() {
  return NextResponse.json({ messages: conversationState });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { channel, content } = body as { channel: CommunicationChannel; content: string };

  const inbound: CommunicationMessage = {
    id: `msg-${Date.now()}`,
    channel,
    author: "customer",
    direction: "inbound",
    body: content,
    timestamp: new Date().toISOString(),
  };

  conversationState = [...conversationState, inbound];

  const reply: CommunicationMessage = {
    id: `msg-${Date.now()}-reply`,
    channel,
    author: "assistant",
    direction: "outbound",
    body:
      channel === "email"
        ? "Thanks for the update! I'll draft an email confirming your appointment and include any prep steps you might need."
        : "Great! I'll lock that in for you. Let me know if you'd like to add a skincare booster or change the time.",
    timestamp: new Date().toISOString(),
  };

  conversationState = [...conversationState, reply];

  return NextResponse.json({ reply });
}
