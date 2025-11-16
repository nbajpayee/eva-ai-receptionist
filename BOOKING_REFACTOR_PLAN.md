# Booking Flow Refactor Plan

**Goal**: Modularize slot-selection logic so SMS, email, and voice all share identical booking guardrails.

**Status**: 🟡 In Progress
**Started**: November 16, 2025
**Last Updated**: November 16, 2025

---

## Executive Summary

Currently, SMS/email use robust slot-selection logic in `MessagingService` (record offers, capture user choice, enforce selection before booking). Voice calls bypass this entirely, booking directly via `RealtimeClient`. This refactor extracts the shared logic into a dedicated `booking/` package so all channels benefit from the same guardrails.

**Key Benefits**:
- ✅ Single source of truth for slot selection
- ✅ Voice gets same fail-fast validation as SMS/email
- ✅ Future improvements automatically apply to all channels
- ✅ Easier testing (one module to test thoroughly)

---

## Architecture Overview

### Current State
```
MessagingService (SMS/Email)
├── _record_slot_offers()          # Stores availability check results
├── _capture_slot_selection()      # Detects user's choice from message
├── _enforce_slot_selection()      # Validates booking matches selection
└── _to_eastern(), _parse_iso()    # Timezone utilities

RealtimeClient (Voice)
└── handle_function_call()         # Direct booking, NO slot validation ⚠️
```

### Target State
```
booking/
├── time_utils.py                  # Shared timezone utilities
├── slot_selection.py              # Core slot offer/capture/enforcement logic
└── manager.py                     # SlotSelectionManager façade

MessagingService (SMS/Email)
├── Thin wrappers → SlotSelectionManager
└── Channel-specific formatting

RealtimeClient (Voice)
└── Calls SlotSelectionManager for validation
```

---

## Phase 1: Extract + Wrap (Safe Migration)

**Goal**: Move slot-selection logic to shared module while keeping existing APIs stable.

**Duration**: 1-2 hours

### 1.1 Create Package Structure
```bash
backend/booking/
├── __init__.py
├── time_utils.py
├── slot_selection.py
└── manager.py
```

### 1.2 Extract Time Utilities (`time_utils.py`)

**Move from**: `messaging_service.py`, `booking_handlers.py`

**Functions**:
```python
EASTERN_TZ = pytz.timezone("America/New_York")

def parse_iso_datetime(value: str) -> datetime:
    """Parse ISO 8601 string, handling 'Z' suffix."""

def to_eastern(dt: datetime) -> datetime:
    """Convert datetime to Eastern timezone."""

def format_for_display(dt: datetime, channel: str) -> str:
    """Format datetime for user-facing display (channel-aware)."""
```

**Update imports in**:
- `messaging_service.py`
- `booking_handlers.py`

### 1.3 Extract Slot Selection Core (`slot_selection.py`)

**Move from**: `messaging_service.py`

**Functions**:
```python
class SlotSelectionCore:
    @staticmethod
    def record_offers(
        db: Session,
        conversation: Conversation,
        tool_call_id: Optional[str],
        arguments: Dict[str, Any],
        output: Dict[str, Any]
    ) -> None:
        """Store availability check results in conversation metadata."""

    @staticmethod
    def capture_selection(
        db: Session,
        conversation: Conversation,
        message: CommunicationMessage
    ) -> bool:
        """Detect and record user's slot choice from message content.
        Returns True if selection was captured."""

    @staticmethod
    def enforce_booking(
        db: Session,
        conversation: Conversation,
        arguments: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Optional[str]]]]:
        """Validate booking request against stored slot offers.
        Raises SlotSelectionError if validation fails."""

    @staticmethod
    def get_pending_summary(
        db: Session,
        conversation: Conversation
    ) -> List[Dict[str, Any]]:
        """Return current slot offers for display/validation."""

    @staticmethod
    def clear_offers(
        db: Session,
        conversation: Conversation
    ) -> None:
        """Clear slot offers from conversation metadata."""

    @staticmethod
    def extract_choice(
        message_text: str,
        slots: List[Dict[str, Any]]
    ) -> Optional[int]:
        """Extract slot choice index from natural language or numeric input."""

    @staticmethod
    def slot_matches_request(
        slot: Dict[str, Any],
        requested_iso: str
    ) -> bool:
        """Check if slot timestamp matches requested time (timezone-agnostic)."""
```

**Internal helpers** (keep private):
- `_conversation_metadata()`
- `_persist_conversation_metadata()`
- `_get_pending_slot_offers()`

**Move exception**:
```python
class SlotSelectionError(Exception):
    """Raised when booking requests do not align with offered slots."""
```

### 1.4 Create Manager Façade (`manager.py`)

```python
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from database import Conversation, CommunicationMessage
from .slot_selection import SlotSelectionCore

class SlotSelectionManager:
    """
    Unified API for slot-selection logic across all channels (SMS, email, voice).

    Usage:
        # After check_availability
        SlotSelectionManager.record_offers(db, conversation, call_id, args, output)

        # After user message
        captured = SlotSelectionManager.capture_selection(db, conversation, message)

        # Before book_appointment
        try:
            normalized_args, adjustments = SlotSelectionManager.enforce_booking(
                db, conversation, arguments
            )
        except SlotSelectionError as exc:
            # Handle validation failure
    """

    @staticmethod
    def record_offers(*args, **kwargs):
        """Store availability check results."""
        return SlotSelectionCore.record_offers(*args, **kwargs)

    @staticmethod
    def capture_selection(*args, **kwargs):
        """Detect and record user's slot choice."""
        return SlotSelectionCore.capture_selection(*args, **kwargs)

    @staticmethod
    def enforce_booking(*args, **kwargs):
        """Validate booking request against stored offers."""
        return SlotSelectionCore.enforce_booking(*args, **kwargs)

    @staticmethod
    def get_pending_summary(*args, **kwargs):
        """Return current slot offers."""
        return SlotSelectionCore.get_pending_summary(*args, **kwargs)

    @staticmethod
    def clear_offers(*args, **kwargs):
        """Clear slot offers."""
        return SlotSelectionCore.clear_offers(*args, **kwargs)
```

### 1.5 Add Backward-Compatible Wrappers

**In `messaging_service.py`**:
```python
from booking.manager import SlotSelectionManager

class MessagingService:
    # ... existing methods ...

    @staticmethod
    def _record_slot_offers(*args, **kwargs):
        """LEGACY WRAPPER - Delegates to shared booking module."""
        return SlotSelectionManager.record_offers(*args, **kwargs)

    @staticmethod
    def _capture_slot_selection_from_message(*args, **kwargs):
        """LEGACY WRAPPER - Delegates to shared booking module."""
        return SlotSelectionManager.capture_selection(*args, **kwargs)

    @staticmethod
    def _enforce_slot_selection_for_booking(*args, **kwargs):
        """LEGACY WRAPPER - Delegates to shared booking module."""
        return SlotSelectionManager.enforce_booking(*args, **kwargs)

    @staticmethod
    def _pending_slot_summary(*args, **kwargs):
        """LEGACY WRAPPER - Delegates to shared booking module."""
        return SlotSelectionManager.get_pending_summary(*args, **kwargs)

    @staticmethod
    def _clear_slot_offers(*args, **kwargs):
        """LEGACY WRAPPER - Delegates to shared booking module."""
        return SlotSelectionManager.clear_offers(*args, **kwargs)
```

**Why wrappers?**
- ✅ SMS/email APIs remain unchanged during extraction
- ✅ Zero-downtime refactor
- ✅ Voice can integrate at its own pace
- ✅ Easy rollback if issues arise

### 1.6 Validation

**Run all existing tests**:
```bash
python -m pytest backend/tests/test_messaging_service.py -v
```

**Expected**: All 6 tests pass (no behavior changes)

**Smoke test**:
- Send SMS booking request → should work identically
- Send email booking request → should work identically

---

## Phase 2: Voice Integration

**Goal**: Update `RealtimeClient` to use shared slot-selection logic.

**Duration**: 2-3 hours

### 2.1 Add Database Session to RealtimeClient

**Current**: `RealtimeClient` has no database session

**Update**:
```python
# realtime_client.py
from database import SessionLocal

class RealtimeClient:
    def __init__(self, session_id: str, ...):
        self.session_id = session_id
        self.db = SessionLocal()
        # ... existing init ...

    async def cleanup(self):
        # ... existing cleanup ...
        if self.db:
            self.db.close()
```

### 2.2 Map Voice Sessions to Conversations

**Current**: Voice uses `CallSession`, not `Conversation`

**Option A**: Create `Conversation` record for every voice call
```python
def _get_or_create_conversation(self) -> Conversation:
    """Ensure voice session has a corresponding Conversation for metadata."""
    existing = self.db.query(Conversation).filter(
        Conversation.channel == "voice",
        Conversation.custom_metadata["call_session_id"].astext == self.session_id
    ).first()

    if existing:
        return existing

    # Create new conversation
    conversation = Conversation(
        customer_id=self.customer_id,  # Set when customer identified
        channel="voice",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={"call_session_id": self.session_id}
    )
    self.db.add(conversation)
    self.db.commit()
    return conversation
```

**Option B**: Add `custom_metadata` JSONB column to `CallSession` table
(Simpler, but doesn't unify data model)

**Recommendation**: Use Option A for consistency with omnichannel architecture.

### 2.3 Update Function Call Handlers

**In `realtime_client.py`**:

```python
from booking.manager import SlotSelectionManager, SlotSelectionError

async def handle_function_call(self, call):
    name = call.function.name
    arguments = json.loads(call.function.arguments)

    if name == "check_availability":
        # Existing calendar check
        result = await self.calendar_service.check_availability(
            date=arguments.get("date"),
            service_type=arguments.get("service_type")
        )

        # NEW: Store slot offers in conversation metadata
        if result.get("success"):
            conversation = self._get_or_create_conversation()
            SlotSelectionManager.record_offers(
                db=self.db,
                conversation=conversation,
                tool_call_id=call.id,
                arguments=arguments,
                output=result
            )

        return result

    elif name == "book_appointment":
        conversation = self._get_or_create_conversation()

        # NEW: Enforce slot selection BEFORE booking
        try:
            normalized_args, adjustments = SlotSelectionManager.enforce_booking(
                db=self.db,
                conversation=conversation,
                arguments=arguments
            )
        except SlotSelectionError as exc:
            # Voice-friendly error message
            return {
                "success": False,
                "error": str(exc),
                "user_message": "I'm sorry, I need to check availability first before I can book that time. Let me find some available slots for you."
            }

        # Proceed with validated arguments
        result = await self.calendar_service.book_appointment(**normalized_args)

        # Clear offers after successful booking
        if result.get("success"):
            SlotSelectionManager.clear_offers(self.db, conversation)

        return result
```

### 2.4 Capture Voice Selections from Transcripts

**Challenge**: Voice doesn't have discrete "messages" like SMS. Selections come from streaming transcripts.

**Solution**: Create message records for transcript chunks containing selections

```python
# In RealtimeClient, when processing transcript
async def handle_transcript_chunk(self, transcript_text: str):
    conversation = self._get_or_create_conversation()

    # Check if user is making a slot selection
    pending_offers = SlotSelectionManager.get_pending_summary(self.db, conversation)
    if pending_offers:
        # Create message record for transcript
        from analytics import AnalyticsService
        message = AnalyticsService.add_message(
            db=self.db,
            conversation_id=conversation.id,
            direction="inbound",
            content=transcript_text,
            sent_at=datetime.utcnow(),
            metadata={"source": "voice_transcript"}
        )

        # Attempt to capture selection
        SlotSelectionManager.capture_selection(self.db, conversation, message)
```

**Alternative**: Direct text-based capture (bypasses message creation)
```python
from booking.slot_selection import SlotSelectionCore

if pending_offers:
    choice_index = SlotSelectionCore.extract_choice(
        transcript_text,
        pending_offers
    )
    if choice_index:
        # Manually update metadata with selection
        # (requires exposing internal _update_selection method)
```

**Recommendation**: Use message-based approach for consistency with omnichannel model.

### 2.5 Update Voice Response Formatting

```python
from booking.time_utils import format_for_display

def format_booking_confirmation(self, result: Dict[str, Any]) -> str:
    """Generate voice-friendly confirmation message."""
    start_iso = result.get("start_time")
    service = result.get("service")

    if start_iso:
        from booking.time_utils import parse_iso_datetime, format_for_display
        dt = parse_iso_datetime(start_iso)
        time_str = format_for_display(dt, channel="voice")
        # "2 PM on November 16, 2025"
        return f"Perfect! I've booked your {service} appointment for {time_str}."

    return f"Your {service} appointment is confirmed."
```

### 2.6 Validation

**Voice-specific tests**:
```python
# tests/test_voice_booking.py
def test_voice_records_slot_offers():
    """Voice calls record_offers after check_availability."""
    # Simulate check_availability call
    # Assert conversation metadata contains slot offers

def test_voice_enforces_slot_selection():
    """Voice cannot book without checking availability first."""
    # Simulate book_appointment without prior check_availability
    # Assert SlotSelectionError is raised

def test_voice_captures_numbered_selection():
    """Voice transcripts like 'option 2' capture selection."""
    # Simulate transcript "I'll take option 2"
    # Assert metadata updated with selected_option_index=2

def test_voice_captures_natural_language_selection():
    """Voice transcripts like 'the 2pm slot' capture selection."""
    # Simulate transcript "I'll take the 2pm slot"
    # Assert metadata updated with correct slot
```

**End-to-end test**:
1. Initiate voice call
2. Ask for availability → AI calls `check_availability`
3. User says "option 1" → selection captured
4. AI calls `book_appointment` → enforcement passes
5. Booking succeeds with correct slot

---

## Phase 3: Testing & Validation

**Goal**: Ensure all channels work correctly with shared logic.

**Duration**: 1-2 hours

### 3.1 Unit Tests for Shared Module

**Create**: `backend/tests/booking/test_slot_selection.py`

```python
def test_record_offers_stores_metadata():
    """Slot offers are persisted to conversation metadata."""

def test_record_offers_preserves_existing_selection():
    """Re-checking availability preserves user's prior selection."""

def test_capture_selection_numeric_input():
    """User messages like '1' or 'option 2' are captured."""

def test_capture_selection_natural_language():
    """Messages like 'the 2pm slot' are captured."""

def test_enforce_booking_with_selection():
    """Booking succeeds when user selected a valid slot."""

def test_enforce_booking_without_availability_check():
    """Booking fails if check_availability wasn't called first."""

def test_enforce_booking_with_wrong_slot():
    """Booking fails if requested time doesn't match offered slots."""

def test_clear_offers_removes_metadata():
    """Slot offers are removed after successful booking."""
```

**Create**: `backend/tests/booking/test_time_utils.py`

```python
def test_parse_iso_datetime_with_z_suffix():
    """Handles ISO strings ending in 'Z'."""

def test_to_eastern_from_utc():
    """Converts UTC datetime to Eastern."""

def test_to_eastern_from_pacific():
    """Converts Pacific datetime to Eastern."""

def test_format_for_display_voice():
    """Voice format: '2 PM on November 16, 2025'."""

def test_format_for_display_sms():
    """SMS format: 'November 16, 2025 at 2:00 PM'."""
```

### 3.2 Update Existing Tests

**Update**: `backend/tests/test_messaging_service.py`

- Tests should continue to pass (wrappers maintain API compatibility)
- Optionally update to import from `SlotSelectionManager` directly

### 3.3 Cross-Channel Consistency Test

```python
def test_slot_selection_works_across_channels():
    """All channels enforce same slot-selection rules."""
    for channel in ["sms", "email", "voice"]:
        conversation = create_conversation(channel=channel)

        # Record offers
        SlotSelectionManager.record_offers(db, conversation, ...)

        # Capture selection
        message = create_message(content="1")
        SlotSelectionManager.capture_selection(db, conversation, message)

        # Enforce booking
        normalized_args, _ = SlotSelectionManager.enforce_booking(
            db, conversation, {"start_time": "..."}
        )

        # Assert same behavior regardless of channel
        assert normalized_args["start_time"] == expected_slot_time
```

### 3.4 Smoke Tests

**SMS**:
1. Send "book me for 2pm today"
2. AI lists slots
3. Reply "1"
4. Verify booking succeeds with correct slot

**Email**:
1. Send email requesting appointment
2. AI responds with slot options
3. Reply with choice
4. Verify booking confirmation shows correct time

**Voice**:
1. Start call
2. Request "Botox at 2pm"
3. AI offers slots
4. Say "option 1"
5. Verify booking confirmation announces correct time

---

## Phase 4: Cleanup (Optional)

**Goal**: Remove legacy wrappers after voice integration is stable.

**Duration**: 30 minutes

### 4.1 Direct Integration

**Update `api_messaging.py`**:
```python
# Before
result = MessagingService._execute_tool_call(...)

# After
from booking.manager import SlotSelectionManager
if name == "check_availability":
    SlotSelectionManager.record_offers(...)
```

### 4.2 Deprecate Wrappers

**In `messaging_service.py`**:
```python
@staticmethod
@deprecated("Use SlotSelectionManager.record_offers() directly")
def _record_slot_offers(*args, **kwargs):
    return SlotSelectionManager.record_offers(*args, **kwargs)
```

### 4.3 Remove Wrappers

After confirming all callsites updated:
- Delete wrapper methods from `MessagingService`
- Update any remaining imports

**Note**: This phase is optional. Thin wrappers are harmless and maintain backward compatibility.

---

## Migration Checklist

### Phase 1: Extract + Wrap
- [ ] Create `backend/booking/__init__.py`
- [ ] Create `backend/booking/time_utils.py`
  - [ ] Move `EASTERN_TZ`, `parse_iso_datetime()`, `to_eastern()`
  - [ ] Move `format_for_display()` (channel-aware)
- [ ] Create `backend/booking/slot_selection.py`
  - [ ] Move `SlotSelectionError` exception
  - [ ] Move `SlotSelectionCore` class with all methods
  - [ ] Move internal helpers
- [ ] Create `backend/booking/manager.py`
  - [ ] Implement `SlotSelectionManager` façade
- [ ] Update `backend/messaging_service.py`
  - [ ] Add imports from `booking.manager`
  - [ ] Replace method bodies with thin wrappers
  - [ ] Update internal calls to use `time_utils`
- [ ] Update `backend/booking_handlers.py`
  - [ ] Import from `booking.time_utils`
- [ ] Run tests: `pytest backend/tests/test_messaging_service.py -v`
- [ ] Smoke test SMS booking flow
- [ ] Smoke test email booking flow

### Phase 2: Voice Integration
- [ ] Update `backend/realtime_client.py`
  - [ ] Add `self.db = SessionLocal()` to `__init__`
  - [ ] Add `db.close()` to cleanup
  - [ ] Implement `_get_or_create_conversation()`
- [ ] Update `handle_function_call()`
  - [ ] `check_availability`: Record offers after success
  - [ ] `book_appointment`: Enforce selection before booking
  - [ ] `book_appointment`: Clear offers after success
- [ ] Add transcript selection capture
  - [ ] Create message records for transcript chunks
  - [ ] Call `SlotSelectionManager.capture_selection()`
- [ ] Update voice response formatting
  - [ ] Use `format_for_display(channel="voice")`
- [ ] Create `tests/test_voice_booking.py`
  - [ ] Test offer recording
  - [ ] Test selection enforcement
  - [ ] Test numeric selection capture
  - [ ] Test natural language selection capture
- [ ] Run voice integration tests
- [ ] End-to-end voice booking smoke test

### Phase 3: Testing & Validation
- [ ] Create `tests/booking/test_slot_selection.py`
  - [ ] Unit tests for all `SlotSelectionCore` methods
- [ ] Create `tests/booking/test_time_utils.py`
  - [ ] Unit tests for timezone utilities
- [ ] Add cross-channel consistency test
- [ ] Run full test suite: `pytest backend/tests/ -v`
- [ ] Smoke test all channels (SMS, email, voice)

### Phase 4: Cleanup (Optional)
- [ ] Update `api_messaging.py` to call `SlotSelectionManager` directly
- [ ] Mark wrappers as `@deprecated`
- [ ] Remove wrappers from `MessagingService`
- [ ] Final test run

---

## Rollback Plan

If issues arise during migration:

### Phase 1 Issues
- Wrappers maintain backward compatibility
- Revert `booking/` package import in `messaging_service.py`
- Fall back to original inline methods

### Phase 2 Issues
- Voice integration is isolated
- Disable `SlotSelectionManager` calls in `realtime_client.py`
- Voice falls back to direct booking (pre-refactor behavior)
- SMS/email unaffected (still using wrappers)

### Critical Failure
- Delete `backend/booking/` package
- Git revert to pre-refactor commit
- All channels return to original behavior

---

## Success Criteria

- [ ] All existing tests pass (6 messaging tests)
- [ ] New unit tests for `booking/` module pass
- [ ] SMS booking works identically to before refactor
- [ ] Email booking works identically to before refactor
- [ ] Voice booking now enforces slot selection (new behavior)
- [ ] Voice booking shows correct timezone in confirmations
- [ ] All channels prevent booking without `check_availability`
- [ ] All channels preserve user selections during re-checks
- [ ] Code is DRY (no duplicated slot-selection logic)

---

## Open Questions

1. **Voice-Conversation Mapping**: Should voice calls create `Conversation` records, or add `custom_metadata` to `CallSession`?
   - **Recommendation**: Create `Conversation` records for consistency with omnichannel architecture.

2. **Transcript Selection Timing**: When should voice transcripts trigger selection capture?
   - **Recommendation**: After each transcript chunk if pending offers exist.

3. **Wrapper Deprecation Timeline**: When to remove legacy wrappers?
   - **Recommendation**: Keep indefinitely (thin wrappers, zero cost) OR deprecate 1 month after voice integration.

4. **Error Message Formatting**: Should error messages be channel-specific?
   - **Recommendation**: Yes. Use `format_error_for_channel(error, channel)` helper.

---

## Notes

- **Timezone Standard**: All internal timestamps use Eastern (`America/New_York`)
- **Database Sessions**: Each channel manages its own session lifecycle
- **Metadata Schema**: `pending_slot_offers` stored in `Conversation.custom_metadata` JSONB column
- **Selection Preservation**: Re-checking availability preserves prior user selections (Bug #2 fix)
- **Stale Object Prevention**: Always `db.refresh(conversation)` after metadata updates (Bug #3 fix)

---

## References

- Original bugs fixed: `BOOKING_REFACTOR_PLAN.md` (this file)
- Test files: `backend/tests/test_messaging_service.py`, `backend/tests/booking/`
- Architecture docs: `CLAUDE.md`, `OMNICHANNEL_MIGRATION.md`
- Timezone normalization: All booking handlers use Eastern time (GPT-5 fix, Nov 16 2025)
