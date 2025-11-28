# Booking Architecture

_Last updated: November 28, 2025_

This document explains Eva's unified booking architecture that powers appointment scheduling across all channels (voice, SMS, email).

## Overview

The booking system follows a **layered architecture** with clear separation between channel-specific UX and shared business logic:

```
┌──────────────────────────────────────────────────────────────────┐
│                     Channel Layer                                 │
│  ┌────────────────────┐           ┌─────────────────────┐        │
│  │  RealtimeClient    │           │  MessagingService   │        │
│  │  (Voice)           │           │  (SMS/Email)        │        │
│  └─────────┬──────────┘           └──────────┬──────────┘        │
│            │                                  │                   │
│            └──────────────┬───────────────────┘                   │
└───────────────────────────┼───────────────────────────────────────┘
                            │ constructs BookingContext
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Domain Layer                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │             BookingOrchestrator                           │  │
│  │  • check_availability(context, date, service_type)        │  │
│  │  • book_appointment(context, params)                      │  │
│  │  • reschedule_appointment(context, ...)                   │  │
│  │  • cancel_appointment(context, ...)                       │  │
│  │                                                            │  │
│  │  Delegates to:                                            │  │
│  │  ┌──────────────────────────────────────────────┐        │  │
│  │  │     SlotSelectionManager                     │        │  │
│  │  │  • record_offers() - Save slots to metadata │        │  │
│  │  │  • enforce_booking() - Validate slot reuse  │        │  │
│  │  │  • get_pending_slot_offers()                │        │  │
│  │  └──────────────────────────────────────────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ calls
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Integration Layer                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ CalendarSvc  │   │ AnalyticsSvc │   │ analytics_metrics│    │
│  │ (Google Cal) │   │ (Supabase)   │   │ (Logging)        │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. BookingContext (Data Transfer Object)

**File**: `backend/booking/orchestrator_types.py`

Carries all dependencies and metadata needed for booking operations:

```python
@dataclass
class BookingContext:
    db: Session                    # Database session
    conversation: Conversation      # Current conversation record
    customer: Optional[Customer]    # Customer making booking
    channel: BookingChannel         # voice, sms, email, staff_console
    calendar_service: CalendarService  # Calendar integration
    services_dict: Optional[Dict[str, Any]]  # Service definitions
    now: Optional[datetime]         # Override for testing
```

**Why it exists**: Avoids parameter bloat and makes it easy to add new context (e.g., timezone, location) without changing all function signatures.

### 2. BookingOrchestrator (Domain Service)

**File**: `backend/booking/orchestrator.py`

Single entry point for all booking operations. Thin orchestration layer that:
1. Calls existing `booking_handlers.py` functions (preserves existing logic)
2. Enforces slot selection via `SlotSelectionManager`
3. Returns typed results instead of raw dicts

```python
class BookingOrchestrator:
    def check_availability(
        self,
        context: BookingContext,
        *,
        date: str,
        service_type: str,
        limit: Optional[int] = 10,
        tool_call_id: Optional[str] = None,
    ) -> CheckAvailabilityResult:
        # 1. Call calendar service to fetch slots
        # 2. Record offered slots in conversation metadata
        # 3. Return typed result

    def book_appointment(
        self,
        context: BookingContext,
        *,
        params: Dict[str, Any],
    ) -> BookingResult:
        # 1. Enforce slot came from previous offer
        # 2. Book via calendar service
        # 3. Return typed result with event ID
```

**Key invariant**: Bookings must come from previously offered slots (prevents race conditions where calendar changes between offer and selection).

### 3. SlotSelectionManager (Enforcement Layer)

**File**: `backend/booking/manager.py`

Manages the lifecycle of slot offers and enforces deterministic booking:

```python
class SlotSelectionManager:
    @staticmethod
    def record_offers(
        db: Session,
        conversation: Conversation,
        *,
        tool_call_id: str,
        arguments: Dict[str, Any],
        output: Dict[str, Any],
    ) -> None:
        """Save offered slots to conversation.custom_metadata"""

    @staticmethod
    def enforce_booking(
        db: Session,
        conversation: Conversation,
        arguments: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], Dict[str, Dict[str, str]]]:
        """Validate booking request matches a previously offered slot.

        Raises SlotSelectionError if:
        - No pending offers exist
        - Requested slot doesn't match any offered slot
        - Offers have expired (>30 minutes old)
        """
```

Slot offers are stored in `conversation.custom_metadata`:

```json
{
  "pending_slot_offers": {
    "tool_call_id": "call-abc123",
    "arguments": {"date": "2025-11-29", "service_type": "botox"},
    "slots": [
      {"start": "2025-11-29T10:00:00-05:00", "end": "2025-11-29T11:00:00-05:00"},
      {"start": "2025-11-29T14:00:00-05:00", "end": "2025-11-29T15:00:00-05:00"}
    ],
    "offered_at": "2025-11-28T15:30:00Z"
  }
}
```

### 4. Typed Results (Return Types)

**File**: `backend/booking/orchestrator_types.py`

Replace `Dict[str, Any]` with structured types for type safety:

```python
@dataclass
class CheckAvailabilityResult:
    success: bool
    date: Optional[str]
    service_type: Optional[str]
    available_slots: List[Dict[str, Any]]
    all_slots: List[Dict[str, Any]]
    availability_windows: List[Dict[str, Any]]
    availability_summary: Optional[str]
    suggested_slots: List[Dict[str, Any]]
    error: Optional[str]
    raw: Dict[str, Any]  # Preserves full response

@dataclass
class BookingResult:
    success: bool
    event_id: Optional[str]
    start_time: Optional[str]
    service: Optional[str]
    service_type: Optional[str]
    provider: Optional[str]
    duration_minutes: Optional[int]
    error: Optional[str]
    raw: Dict[str, Any]
```

These can be converted back to dicts for JSON serialization via `.to_dict()`.

## Channel Integration

### Voice (RealtimeClient)

**File**: `backend/realtime_client.py`

Voice calls are handled via OpenAI Realtime API. When the AI decides to call a booking function:

```python
class RealtimeClient:
    def handle_function_call(self, function_name: str, arguments: Dict):
        if function_name == "check_availability":
            # 1. Build context
            context = self._booking_context_factory.for_voice()

            # 2. Call orchestrator
            orchestrator = BookingOrchestrator(channel=BookingChannel.VOICE)
            result = orchestrator.check_availability(
                context,
                date=arguments["date"],
                service_type=arguments["service_type"],
            )

            # 3. Record metrics
            record_tool_execution(
                tool_name="check_availability",
                channel="voice",
                success=result.success,
                latency_ms=...,
            )

            # 4. Return formatted response for AI
            return result.to_dict()
```

Voice-specific helpers:
- `_BookingContextFactory`: Constructs `BookingContext` from voice session
- `_VoiceSessionState`: Persists booking metadata in session for cross-turn context

### SMS/Email (MessagingService)

**File**: `backend/messaging_service.py`

Messaging uses deterministic tool execution (automatically calls tools when conditions are met):

```python
class MessagingService:
    def _execute_tool_call(
        self,
        *,
        db: Session,
        conversation: Conversation,
        customer: Customer,
        name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        if name in {"check_availability", "book_appointment", ...}:
            # 1. Build context
            context = BookingContext(
                db=db,
                conversation=conversation,
                customer=customer,
                channel=BookingChannel.SMS,  # or EMAIL
                calendar_service=calendar_service,
                services_dict=services,
            )

            # 2. Call orchestrator
            orchestrator = BookingOrchestrator(channel=...)

            if name == "check_availability":
                result = orchestrator.check_availability(context, ...)
            elif name == "book_appointment":
                result = orchestrator.book_appointment(context, params=arguments)

            # 3. Record metrics
            record_tool_execution(
                tool_name=name,
                channel="sms",  # or "email"
                success=result.success,
                ...
            )

            return result.to_dict()
```

## Metrics & Observability

### Tool Execution Metrics

**File**: `backend/analytics_metrics.py`

All booking tool calls (check/book/reschedule/cancel) emit structured metrics:

```python
record_tool_execution(
    tool_name="book_appointment",
    channel="voice",  # or "sms", "email"
    success=True,
    latency_ms=1250.5,
    error_code=None,  # or "slot_selection_mismatch", etc.
    extra={"conversation_id": "uuid-..."}
)
```

These are logged and can be aggregated for monitoring:
- Success rate per tool per channel
- P50/P95/P99 latency
- Error breakdown by code

### Calendar Error Tracking

```python
record_calendar_error(
    reason="check_availability_calendar_error",
    http_status=503,
    channel="voice",
    extra={"date": "2025-11-29", "service": "botox"}
)
```

Tracks calendar API failures for alerting and debugging.

### Health Endpoint

**Endpoint**: `GET /api/admin/health/booking?minutes=60`

Returns recent booking health metrics:

```json
{
  "window_start": "2025-11-28T14:30:00Z",
  "window_end": "2025-11-28T15:30:00Z",
  "total_conversations": 42,
  "ai_appointments_scheduled": 35,
  "appointments_cancelled": 2,
  "conversion_rate": 83.3
}
```

Used for pilot monitoring and SLO tracking.

## Key Design Decisions

### 1. Why BookingOrchestrator is Thin

The orchestrator **does not** duplicate booking_handlers logic. It:
- Calls existing handlers (preserving 100+ lines of calendar logic)
- Adds slot selection enforcement
- Returns typed results

This keeps the refactor low-risk and incremental.

### 2. Why Slot Enforcement Uses Metadata

Alternatives considered:
- **Database table**: Too heavy, requires migrations, cleanup jobs
- **In-memory cache**: Lost on restart, no cross-channel support
- **Conversation metadata (chosen)**:
  - Already persistent
  - Naturally scoped per conversation
  - Easy to query/debug
  - Supports cross-channel (voice → SMS handoff)

### 3. Why Channel Adapters Stay Separate

Voice and messaging have different:
- **AI prompts** (spoken vs written language)
- **Turn models** (streaming audio vs discrete messages)
- **Error handling** (retry vs graceful degradation)
- **Metadata needs** (session_id vs phone_number)

Shared `BookingOrchestrator` handles **business rules**, adapters handle **UX**.

## Testing Strategy

### Unit Tests

**File**: `backend/tests/booking/test_orchestrator.py`

Test orchestrator in isolation with fake calendar service:

```python
def test_check_availability_registers_slot_offers():
    # Setup fake calendar with slots
    # Call orchestrator.check_availability()
    # Assert slots saved to conversation metadata

def test_book_appointment_uses_enforced_slot():
    # Record slot offers
    # Call orchestrator.book_appointment()
    # Assert booking succeeds and matches offer

def test_book_appointment_rejects_mismatched_slot():
    # Record offers for 9 AM
    # Try to book 2 PM (not in offers)
    # Assert SlotSelectionError raised
```

### Integration Tests

**Files**: `backend/tests/integration/test_*_booking_flows.py`

Test full end-to-end flows:
- Voice: offer → select → book
- SMS: multi-message booking with slot capture
- Cross-channel: voice offers, SMS books

### Coverage

- **Core booking tests**: 21/21 passing (100%)
- **Integration tests**: 34/39 passing (87%)
  - 5 failing tests are advanced features (cross-channel transfers, preferences)

## Migration Notes

### What Changed

**Before** (October 2025):
```python
# messaging_service.py
result = handle_check_availability(
    calendar_service,
    date=date,
    service_type=service_type,
)
# Hope the AI picks a slot we offered...
```

**After** (November 2025):
```python
# messaging_service.py
context = BookingContext(...)
orchestrator = BookingOrchestrator(channel=BookingChannel.SMS)
result = orchestrator.check_availability(context, ...)  # Slots auto-saved
result = orchestrator.book_appointment(context, ...)    # Enforces slot reuse
```

### Backward Compatibility

- ✅ Public APIs unchanged (admin dashboard endpoints still work)
- ✅ Database schema unchanged (uses existing conversation metadata)
- ✅ Existing `booking_handlers.py` functions still work (called by orchestrator)
- ✅ All existing tests pass

## Future Enhancements

### Planned
- [ ] Multi-appointment booking (book 3 Botox sessions in one conversation)
- [ ] Appointment reminders via scheduled messages
- [ ] Waitlist management (notify when slots open)
- [ ] Provider preferences ("I prefer Dr. Smith")

### Nice-to-Have
- [ ] Booking approval workflow for staff
- [ ] Group bookings (couples massage)
- [ ] Package deals (buy 3 sessions, get discount)
- [ ] Integration with Boulevard scheduling system

## Troubleshooting

### "Slot selection mismatch" errors

**Symptom**: Bookings fail with `slot_selection_mismatch` error

**Cause**: User requested a slot that wasn't in the previously offered slots

**Fix**:
1. Check `conversation.custom_metadata.pending_slot_offers`
2. Verify offers haven't expired (>30 min old)
3. Re-run `check_availability` to get fresh slots

### Metrics not appearing

**Symptom**: `/api/admin/health/booking` shows 0 conversations

**Cause**: Metrics helper not being called, or wrong time window

**Fix**:
1. Check logs for `tool_execution` entries
2. Verify `record_tool_execution()` called in both channels
3. Try wider time window (e.g., `?minutes=1440` for 24 hours)

### Cross-channel bookings not working

**Symptom**: Voice call offers slots, but SMS can't book them

**Cause**: Slot offers are scoped to conversation, not customer

**Fix**: Implement slot offer transfer in metadata when switching channels

## See Also

- `ARCHITECTURE_REFACTOR_PLAN.md` - Original refactor plan with milestones
- `backend/booking/orchestrator.py` - Orchestrator implementation
- `backend/booking/manager.py` - SlotSelectionManager implementation
- `backend/tests/booking/` - Unit tests
