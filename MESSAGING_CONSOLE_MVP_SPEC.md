# Messaging Console MVP - Specification

**Status:** 📋 Planning
**Priority:** High (Next Major Feature after Omnichannel Migration)
**Estimated Time:** 2-3 days
**Goal:** Build internal testing interface for SMS/email before integrating Twilio/SendGrid

---

## Overview

The Messaging Console is an admin-facing interface that allows testing SMS and email communication flows without requiring Twilio or SendGrid integration. It simulates inbound messages, generates AI responses, and validates the omnichannel schema for multi-message threading.

### Why This Matters
- **Validates omnichannel schema** for SMS/email (currently only tested with voice)
- **Tests AI response generation** across different channels
- **Proves multi-message threading** works correctly
- **De-risks production integration** by catching issues early
- **Enables demo/testing** without external service dependencies

---

## User Stories

### As a Med Spa Administrator:
1. **View all conversations** across voice, SMS, and email in one place
2. **Send test SMS/email messages** to simulate customer communications
3. **See AI-generated responses** to validate conversation quality
4. **Review conversation threads** with proper chronological ordering
5. **Filter by channel** to focus on specific communication types

### As a Developer:
1. **Test SMS/email flows** without Twilio/SendGrid API keys
2. **Validate satisfaction scoring** on multi-message conversations
3. **Debug message threading** and conversation state management
4. **Verify data integrity** across all communication channels

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│              Admin Dashboard (Next.js)                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Messaging Console Page                    │  │
│  │  /messaging                                       │  │
│  │                                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │ Conversation    │  │ Message Thread  │       │  │
│  │  │ List            │  │ Display         │       │  │
│  │  │                 │  │                 │       │  │
│  │  │ - Channel filter│  │ - Chronological │       │  │
│  │  │ - Status filter │  │ - Send message  │       │  │
│  │  │ - Search        │  │ - AI response   │       │  │
│  │  └─────────────────┘  └─────────────────┘       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────┐
│           FastAPI Backend (/api/admin/messaging)         │
│                                                          │
│  POST   /send              - Send test message          │
│  GET    /conversations     - List conversations         │
│  GET    /conversations/:id - Get conversation detail    │
│  POST   /generate-response - Generate AI response       │
└─────────────────────────────────────────────────────────┘
                           │
                           │ SQL
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL                     │
│                                                          │
│  conversations              communication_messages       │
│  sms_details                email_details                │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### API Endpoints

#### 1. POST `/api/admin/messaging/send`
Send a test message (SMS or email) to create a new conversation or add to existing.

**Request Body:**
```json
{
  "channel": "sms" | "email",
  "customer_phone": "+1234567890",  // for SMS
  "customer_email": "test@example.com",  // for email
  "customer_name": "Test Customer",
  "content": "I'd like to book a Botox appointment",
  "subject": "Appointment Inquiry",  // email only
  "conversation_id": "uuid"  // optional, for replies
}
```

**Response:**
```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "ai_response": {
    "content": "I'd be happy to help you book a Botox appointment...",
    "message_id": "uuid"
  }
}
```

**Logic:**
1. Check if conversation exists (by phone/email or conversation_id)
2. If new: Create conversation with appropriate channel
3. Add customer message to conversation
4. Generate AI response using GPT-4
5. Add AI response message to conversation
6. Return both message IDs

---

#### 2. POST `/api/admin/messaging/generate-response`
Generate AI response for a given conversation context.

**Request Body:**
```json
{
  "conversation_id": "uuid"
}
```

**Response:**
```json
{
  "content": "Generated response text",
  "message_id": "uuid"
}
```

**Logic:**
1. Fetch conversation with all messages
2. Build context from message history
3. Call GPT-4 with conversation context
4. Generate contextually appropriate response
5. Add response message to conversation
6. Return response content

---

#### 3. GET `/api/admin/messaging/conversations`
List all conversations with filtering options.

**Query Parameters:**
- `channel` (optional): Filter by "voice", "sms", "email"
- `status` (optional): Filter by "active", "completed"
- `page` (default: 1)
- `page_size` (default: 20)

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "channel": "sms",
      "customer_name": "Test Customer",
      "customer_phone": "+1234567890",
      "last_message": "Thank you for your help!",
      "last_activity_at": "2025-11-11T12:00:00Z",
      "status": "completed",
      "message_count": 5
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

---

#### 4. GET `/api/admin/messaging/conversations/:id`
Get full conversation detail with all messages.

**Response:**
```json
{
  "conversation": {
    "id": "uuid",
    "channel": "mobile_text",
    "customer": {
      "id": 1,
      "name": "Test Customer",
      "phone": "+1234567890"
    },
    "status": "active",
    "initiated_at": "2025-11-11T12:00:00Z",
    "message_count": 5
  },
  "messages": [
    {
      "id": "uuid",
      "direction": "inbound",
      "content": "I'd like to book an appointment",
      "sent_at": "2025-11-11T12:00:00Z"
    },
    {
      "id": "uuid",
      "direction": "outbound",
      "content": "I'd be happy to help you...",
      "sent_at": "2025-11-11T12:00:30Z"
    }
  ]
}
```

---

### Backend Code Structure

**File: `backend/main.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal

messaging_router = APIRouter(prefix="/api/admin/messaging", tags=["messaging"])

class SendMessageRequest(BaseModel):
    channel: Literal["sms", "email"]
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: str
    content: str
    subject: Optional[str] = None  # email only
    conversation_id: Optional[str] = None  # for replies

class GenerateResponseRequest(BaseModel):
    conversation_id: str

@messaging_router.post("/send")
async def send_test_message(
    request: SendMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Send a test message and generate AI response.
    """
    # 1. Find or create conversation
    conversation = None

    if request.conversation_id:
        # Reply to existing conversation
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id
        ).first()
        if not conversation:
            raise HTTPException(404, "Conversation not found")
    else:
        # New conversation - check for existing by customer contact
        if request.channel == "sms" and request.customer_phone:
            conversation = db.query(Conversation).filter(
                Conversation.channel == "sms",
                Conversation.customer_phone == request.customer_phone,
                Conversation.status == "active"
            ).first()
        elif request.channel == "email" and request.customer_email:
            conversation = db.query(Conversation).filter(
                Conversation.channel == "email",
                Conversation.customer_email == request.customer_email,
                Conversation.status == "active"
            ).first()

    # Create new conversation if needed
    if not conversation:
        conversation = MessagingService.find_or_create_conversation(
            db=db,
            channel=request.channel,
            customer_name=request.customer_name,
            customer_phone=request.customer_phone,
            customer_email=request.customer_email,
            subject=request.subject
        )

    # 2. Add customer message
    customer_message = AnalyticsService.add_message(
        db=db,
        conversation_id=conversation.id,
        direction='inbound',
        content=request.content,
        sent_at=datetime.utcnow(),
        metadata={'source': 'messaging_console'}
    )

    # 3. Generate AI response
    ai_response_content = await generate_ai_response(db, conversation.id)

    # 4. Add AI response message
    ai_message = AnalyticsService.add_message(
        db=db,
        conversation_id=conversation.id,
        direction='outbound',
        content=ai_response_content,
        sent_at=datetime.utcnow(),
        metadata={'generated_by': 'gpt-4', 'source': 'messaging_console'}
    )

    return {
        "conversation_id": str(conversation.id),
        "message_id": str(customer_message.id),
        "ai_response": {
            "content": ai_response_content,
            "message_id": str(ai_message.id)
        }
    }

async def generate_ai_response(db: Session, conversation_id: str) -> str:
    """
    Generate contextually appropriate AI response using GPT-4.
    """
    from sqlalchemy.orm import joinedload

    # Get conversation with messages
    conversation = db.query(Conversation)\
        .options(joinedload(Conversation.messages))\
        .filter(Conversation.id == conversation_id)\
        .first()

    if not conversation:
        raise HTTPException(404, "Conversation not found")

    # Build context from message history
    messages_sorted = sorted(conversation.messages, key=lambda m: m.sent_at)

    context_messages = [
        {
            "role": "system",
            "content": f"""You are Ava, the AI receptionist for Luxury Med Spa.
You're helping customers via {conversation.channel.replace('_', ' ')}.

Your responsibilities:
- Answer questions about services, pricing, hours
- Help schedule appointments
- Provide friendly, professional assistance

Med Spa Info:
- Name: Luxury Med Spa
- Hours: Mon-Fri 9am-6pm, Sat 10am-4pm
- Phone: (555) 123-4567
- Services: Botox, Dermal Fillers, Laser Treatments, Chemical Peels, etc.

Keep responses concise for {conversation.channel}. Be warm and professional."""
        }
    ]

    # Add conversation history
    for msg in messages_sorted:
        role = "user" if msg.direction == "inbound" else "assistant"
        context_messages.append({
            "role": role,
            "content": msg.content
        })

    # Generate response
    response = openai_client.chat.completions.create(
        model="gpt-4",
        messages=context_messages,
        temperature=0.7,
        max_tokens=500 if conversation.channel == "sms" else 1000
    )

    return response.choices[0].message.content

@messaging_router.get("/conversations")
async def list_conversations(
    channel: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    """
    List conversations with filtering for messaging console.
    """
    query = db.query(Conversation)

    if channel:
        query = query.filter(Conversation.channel == channel)
    if status:
        query = query.filter(Conversation.status == status)

    # Exclude voice calls (already shown in main dashboard)
    query = query.filter(Conversation.channel.in_(["sms", "email"]))

    total = query.count()

    conversations = query\
        .order_by(Conversation.last_activity_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()

    return {
        "conversations": [
            {
                "id": str(c.id),
                "channel": c.channel,
                "customer_name": c.customer.name if c.customer else "Unknown",
                "customer_phone": c.customer_phone,
                "customer_email": c.customer_email,
                "last_activity_at": c.last_activity_at.isoformat(),
                "status": c.status,
                "message_count": len(c.messages)
            }
            for c in conversations
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }

# Register router
app.include_router(messaging_router)
```

> **Implementation note:** introduce a lightweight `MessagingService` module that the endpoints can rely on to keep responsibilities tidy. It should:
>
> 1. Look up or create a `Customer` by phone/email (mirroring the logic we added for voice calls) and return the `customer_id`.
> 2. Call `AnalyticsService.create_conversation(customer_id=..., channel=..., metadata=...)` and backfill any channel-specific metadata (e.g. email subject) on the conversation.
> 3. Provide helpers for channel detail writes that generate required placeholder values. For example, populate `provider_message_id=f"test-{uuid.uuid4()}"` when calling `AnalyticsService.add_sms_details`, and supply reasonable defaults for `EmailDetails` fields (`from_address`, `to_address`, `body_text`). This keeps the schema happy while we’re still mocking external providers.

### Prompt Management

- Add a shared helper (e.g. `get_system_prompt(channel: str)`) that wraps the existing `SYSTEM_PROMPT` defined in `backend/config.py`. This function can append light channel-specific guidance (shorter responses for SMS, etc.) while keeping the core persona text centralized.
- Update the voice WebSocket initialization and the new messaging AI response path to both call this helper, ensuring every communication mode stays in sync when we adjust the persona.
- Expose the helper via the forthcoming `MessagingService` so future channels (chat widget, push notifications) can re-use it without duplicating prompt text.

---

## Frontend Implementation

### Page Structure

**File: `admin-dashboard/src/app/messaging/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Mail, Send } from 'lucide-react';

type Channel = 'sms' | 'email';

interface Conversation {
  id: string;
  channel: Channel;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  last_activity_at: string;
  status: string;
  message_count: number;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  sent_at: string;
}

export default function MessagingConsolePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // New message form state
  const [newMessageChannel, setNewMessageChannel] = useState<Channel>('sms');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [channelFilter]);

  const loadConversations = async () => {
    const params = new URLSearchParams();
    if (channelFilter !== 'all') params.append('channel', channelFilter);

    const response = await fetch(`/api/admin/messaging/conversations?${params}`);
    const data = await response.json();
    setConversations(data.conversations);
  };

  const loadMessages = async (conversationId: string) => {
    const response = await fetch(`/api/admin/messaging/conversations/${conversationId}`);
    const data = await response.json();
    setMessages(data.messages);
  };

  const sendMessage = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: newMessageChannel,
          customer_name: customerName,
          customer_phone: newMessageChannel === 'sms' ? customerPhone : undefined,
          customer_email: newMessageChannel === 'email' ? customerEmail : undefined,
          content: messageContent,
          subject: newMessageChannel === 'email' ? subject : undefined,
          conversation_id: selectedConversation?.id
        })
      });

      const data = await response.json();

      // Refresh conversations and messages
      await loadConversations();
      if (data.conversation_id) {
        await loadMessages(data.conversation_id);
      }

      // Clear form
      setMessageContent('');
      setSubject('');
      if (!selectedConversation) {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Messaging Console</h1>
        <p className="text-sm text-zinc-500">Test SMS and email conversations</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[400px,1fr]">
        {/* Conversation List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conversations</CardTitle>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    loadMessages(conv.id);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{conv.customer_name}</span>
                    <Badge variant="outline">
                      {conv.channel === 'sms' ? (
                        <MessageSquare className="h-3 w-3 mr-1" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      {conv.message_count}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {conv.customer_phone || conv.customer_email}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread + Send Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedConversation
                ? `${selectedConversation.customer_name} - ${selectedConversation.channel.replace('_', ' ')}`
                : 'New Conversation'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Message Thread */}
            {selectedConversation && (
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.direction === 'inbound'
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-zinc-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        {msg.direction === 'inbound' ? 'Customer' : 'Ava'}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {new Date(msg.sent_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Send Form */}
            <div className="space-y-4 pt-4 border-t">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Channel</label>
                  <Select
                    value={newMessageChannel}
                    onValueChange={(v) => setNewMessageChannel(v as Channel)}
                    disabled={!!selectedConversation}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!selectedConversation && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Customer Name</label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>

                    {newMessageChannel === 'sms' ? (
                      <div>
                        <label className="text-sm font-medium">Phone Number</label>
                        <Input
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+1234567890"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-sm font-medium">Email</label>
                        <Input
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="john@example.com"
                        />
                      </div>
                    )}
                  </>
                )}

                {newMessageChannel === 'email' && !selectedConversation && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Appointment Inquiry"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="I'd like to book a Botox appointment..."
                  rows={4}
                />
              </div>

              <Button onClick={sendMessage} disabled={isLoading} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {isLoading ? 'Sending...' : 'Send & Generate AI Response'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### Navigation Integration

**File: `admin-dashboard/src/app/layout.tsx`**

Add messaging console to navigation:

```typescript
const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Messaging', href: '/messaging', icon: MessageSquareIcon },  // NEW
  { name: 'Appointments', href: '/appointments', icon: CalendarIcon },
];
```

---

## Testing Plan

### Manual Testing Checklist

#### SMS Flow
- [ ] Create new SMS conversation with customer name + phone
- [ ] Verify conversation appears in list
- [ ] Send customer message
- [ ] Verify AI response is generated
- [ ] Send follow-up message in same conversation
- [ ] Verify conversation threading works
- [ ] Check database: messages stored correctly
- [ ] Check database: sms_details populated

#### Email Flow
- [ ] Create new email conversation with customer name + email + subject
- [ ] Verify conversation appears in list
- [ ] Send customer message
- [ ] Verify AI response is generated
- [ ] Reply to email (add to existing conversation)
- [ ] Verify threading works
- [ ] Check database: messages stored correctly
- [ ] Check database: email_details populated

#### Satisfaction Scoring
- [ ] Complete a multi-message conversation (5+ messages)
- [ ] Mark conversation as completed
- [ ] Run satisfaction scoring
- [ ] Verify score, sentiment, outcome populated correctly
- [ ] Compare voice vs SMS vs email scoring accuracy

#### Edge Cases
- [ ] Send message with no customer name (should error)
- [ ] Send SMS without phone number (should error)
- [ ] Send email without email address (should error)
- [ ] Send very long message (500+ chars)
- [ ] Send message with special characters
- [ ] Try to reply to non-existent conversation
- [ ] Confirm conversation list headline/summary is meaningful (not generic greeting) after AI/customer exchange

---

## Database Validation

### Queries to Run After Testing

```sql
-- Check conversations created
SELECT channel, COUNT(*) as count
FROM conversations
WHERE channel IN ('sms', 'email')
GROUP BY channel;

-- Check message counts
SELECT c.id, c.channel, COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN communication_messages m ON m.conversation_id = c.id
WHERE c.channel IN ('sms', 'email')
GROUP BY c.id, c.channel;

-- Check SMS details populated
SELECT COUNT(*) FROM sms_details;

-- Check email details populated
SELECT COUNT(*) FROM email_details;

-- Verify satisfaction scoring works on multi-message threads
SELECT id, channel, satisfaction_score, sentiment, outcome
FROM conversations
WHERE channel IN ('mobile_text', 'email')
  AND satisfaction_score IS NOT NULL;
```

---

## Success Criteria

### MVP is complete when:

1. **Backend** ✅
   - [ ] All 4 API endpoints implemented and tested
   - [ ] AI response generation working for SMS and email
   - [ ] Message threading working correctly
   - [ ] Customer lookup/creation working

2. **Frontend** ✅
   - [ ] Conversation list displays SMS and email
   - [ ] Message thread displays chronologically
   - [ ] Send message form works for both channels
   - [ ] AI responses appear in real-time

3. **Database** ✅
   - [ ] SMS conversations stored with sms_details
   - [ ] Email conversations stored with email_details
   - [ ] Multi-message threading verified
   - [ ] Satisfaction scoring works on text conversations

4. **Validation** ✅
   - [ ] All test cases pass
   - [ ] No data integrity issues
   - [ ] Dashboard displays conversations correctly

---

## Out of Scope (Post-MVP)

The following features are intentionally excluded from MVP:

- ❌ Real Twilio SMS integration
- ❌ Real SendGrid email integration
- ❌ Delivery status tracking
- ❌ Read receipts
- ❌ Message attachments
- ❌ Push notifications
- ❌ Real-time updates (WebSocket)
- ❌ Conversation archiving
- ❌ Message search
- ❌ Bulk messaging

These will be added in Phase 3 after MVP validation.

---

## Implementation Timeline

### Day 1: Backend (4-6 hours)
- [ ] 1-2 hrs: Implement `/send` endpoint
- [ ] 1 hr: Implement `/generate-response` logic
- [ ] 1 hr: Implement `/conversations` endpoints
- [ ] 1-2 hrs: Test all endpoints with Postman/curl

### Day 2: Frontend (4-6 hours)
- [ ] 2 hrs: Create messaging page layout
- [ ] 2 hrs: Implement conversation list
- [ ] 1 hr: Implement message thread display
- [ ] 1 hr: Implement send form with validation

### Day 3: Testing & Polish (3-4 hours)
- [ ] 2 hrs: Manual testing (all test cases)
- [ ] 1 hr: Database validation queries
- [ ] 1 hr: UI polish and error handling

**Total: 11-16 hours (~2-3 days)**

---

## Next Steps

After this spec is approved:

1. **Create tasks in TODO.md**
2. **Start with backend implementation** (Day 1)
3. **Test backend with Postman** before building frontend
4. **Build frontend** (Day 2)
5. **End-to-end testing** (Day 3)
6. **Update documentation** and commit

Would you like to proceed with implementation? I can start with the backend endpoints first.
