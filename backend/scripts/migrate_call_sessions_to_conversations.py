"""Migrate existing call_sessions data to conversations schema.

This script performs the data migration from Phase 1 (call_sessions) to Phase 2
(conversations + communication_messages + voice_call_details). It preserves all
existing data and creates the proper relationships.

Usage:
    # Dry run (preview changes without committing)
    python backend/scripts/migrate_call_sessions_to_conversations.py --dry-run

    # Execute migration
    python backend/scripts/migrate_call_sessions_to_conversations.py

    # Migrate specific session IDs only
    python backend/scripts/migrate_call_sessions_to_conversations.py --session-ids sess_123,sess_456

See OMNICHANNEL_MIGRATION.md for full migration strategy.
"""

from __future__ import annotations

import argparse
import sys
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import func

# Ensure project root is on sys.path before importing application modules
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Load environment variables
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

from config import get_settings  # noqa: E402
from database import (CallEvent, CallSession, CommunicationEvent,  # noqa: E402
                      CommunicationMessage, Conversation, SessionLocal,
                      VoiceCallDetails)


def infer_outcome_from_session(session: CallSession) -> str:
    """
    Infer conversation outcome from call session data.
    Maps to: appointment_scheduled, appointment_rescheduled, appointment_cancelled,
             info_request, complaint, unresolved
    """
    if session.outcome:
        # Map old outcomes to new schema
        outcome_map = {
            "booked": "appointment_scheduled",
            "rescheduled": "appointment_rescheduled",
            "cancelled": "appointment_cancelled",
            "info_only": "info_request",
            "escalated": "complaint",
            "abandoned": "unresolved",
        }
        return outcome_map.get(session.outcome, "unresolved")

    # Infer from function calls if no explicit outcome
    if session.function_calls_made > 0:
        # TODO: Parse actual function_calls JSON if available
        return "appointment_scheduled"

    return "info_request" if session.transcript else "unresolved"


def generate_subject_from_session(session: CallSession) -> str:
    """Generate human-readable subject line from call session."""
    if session.outcome == "booked":
        return "Appointment booking"
    elif session.outcome == "rescheduled":
        return "Appointment rescheduling"
    elif session.outcome == "cancelled":
        return "Appointment cancellation"
    elif session.escalated:
        return "Customer escalation"
    elif session.transcript:
        # Use first 50 characters of transcript
        return (
            session.transcript[:50].strip() + "..."
            if len(session.transcript) > 50
            else session.transcript.strip()
        )
    else:
        return "Voice call"


def parse_transcript_to_segments(transcript: str) -> list:
    """
    Parse plain text transcript into structured segments.
    In Phase 1, transcripts were plain text. We'll do a basic parse.

    Returns: [{"speaker": "customer", "text": "...", "timestamp": 0.0}, ...]
    """
    if not transcript:
        return []

    # Simple heuristic: look for "Customer:" and "Ava:" or "Assistant:" prefixes
    segments = []
    lines = transcript.split("\n")

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        speaker = "unknown"
        text = line

        # Try to extract speaker
        if line.lower().startswith("customer:"):
            speaker = "customer"
            text = line[9:].strip()
        elif line.lower().startswith("ava:") or line.lower().startswith("assistant:"):
            speaker = "assistant"
            text = line.split(":", 1)[1].strip() if ":" in line else text

        segments.append(
            {
                "speaker": speaker,
                "text": text,
                "timestamp": float(i),  # Use line number as approximate timestamp
            }
        )

    return (
        segments
        if segments
        else [{"speaker": "unknown", "text": transcript, "timestamp": 0.0}]
    )


def migrate_session(session: CallSession, db, dry_run: bool = False) -> dict:
    """
    Migrate a single call session to conversations schema.

    Returns dict with migration details for reporting.
    """
    result = {
        "session_id": session.session_id,
        "customer_id": session.customer_id,
        "success": False,
        "conversation_id": None,
        "message_id": None,
        "events_migrated": 0,
        "error": None,
    }

    try:
        # Check if already migrated (look for legacy_session_id in metadata)
        existing = (
            db.query(Conversation)
            .filter(
                Conversation.custom_metadata["legacy_call_session_id"].astext
                == str(session.id)
            )
            .first()
        )

        if existing:
            result["error"] = "Already migrated"
            return result

        # 1. Create Conversation
        conversation = Conversation(
            id=uuid.uuid4(),
            customer_id=session.customer_id,
            channel="voice",
            status="completed" if session.ended_at else "failed",
            initiated_at=session.started_at,
            last_activity_at=session.ended_at or session.started_at,
            completed_at=session.ended_at,
            satisfaction_score=(
                int(session.satisfaction_score) if session.satisfaction_score else None
            ),
            sentiment=session.sentiment,
            outcome=infer_outcome_from_session(session),
            subject=generate_subject_from_session(session),
            ai_summary=None,  # Will be generated later if needed
            custom_metadata={
                "legacy_call_session_id": str(session.id),
                "legacy_session_id": session.session_id,
                "phone_number": session.phone_number,
                "escalated": session.escalated,
                "escalation_reason": session.escalation_reason,
            },
        )

        if not dry_run:
            db.add(conversation)
            db.flush()  # Get conversation.id

        result["conversation_id"] = str(conversation.id)

        # 2. Create CommunicationMessage (entire call is one message)
        message = CommunicationMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction="inbound",  # Customer called in
            content=session.transcript or "",
            sent_at=session.started_at,
            processed=True,
            custom_metadata={
                "customer_interruptions": session.customer_interruptions,
                "ai_clarifications_needed": session.ai_clarifications_needed,
            },
        )

        if not dry_run:
            db.add(message)
            db.flush()

        result["message_id"] = str(message.id)

        # 3. Create VoiceCallDetails
        voice_details = VoiceCallDetails(
            message_id=message.id,
            duration_seconds=session.duration_seconds or 0,
            recording_url=session.recording_url,
            transcript_segments=parse_transcript_to_segments(session.transcript),
            function_calls=[],  # TODO: Extract from session if stored
            audio_quality_score=None,
            interruption_count=session.customer_interruptions or 0,
        )

        if not dry_run:
            db.add(voice_details)

        # 4. Migrate CallEvents → CommunicationEvents
        events = (
            db.query(CallEvent).filter(CallEvent.call_session_id == session.id).all()
        )
        for event in events:
            comm_event = CommunicationEvent(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                message_id=message.id,
                event_type=event.event_type,
                timestamp=event.timestamp,
                details=event.data or {},
            )

            if not dry_run:
                db.add(comm_event)

        result["events_migrated"] = len(events)

        if not dry_run:
            db.commit()

        result["success"] = True

    except Exception as e:
        if not dry_run:
            db.rollback()
        result["error"] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Migrate call_sessions to conversations schema"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview changes without committing"
    )
    parser.add_argument(
        "--session-ids",
        type=str,
        help="Comma-separated session IDs to migrate (migrates all if not specified)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of sessions to migrate (useful for testing)",
    )
    args = parser.parse_args()

    settings = get_settings()

    if settings.DATABASE_URL.startswith("sqlite"):
        print(
            "[ERROR] DATABASE_URL points to SQLite. This migration requires Supabase/PostgreSQL."
        )
        sys.exit(1)

    db = SessionLocal()

    print("\n🔄 Call Sessions → Conversations Migration")
    print("=" * 70)

    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be committed")
        print("=" * 70)

    # Build query
    query = db.query(CallSession)

    if args.session_ids:
        session_ids = [sid.strip() for sid in args.session_ids.split(",")]
        query = query.filter(CallSession.session_id.in_(session_ids))
        print(f"📋 Migrating specific sessions: {', '.join(session_ids)}")
    else:
        print("📋 Migrating all call sessions")

    if args.limit:
        query = query.limit(args.limit)
        print(f"⚠️  Limited to {args.limit} sessions")

    sessions = query.all()
    total_count = len(sessions)

    if total_count == 0:
        print("\n⚠️  No sessions found to migrate")
        return

    print(f"\n📊 Found {total_count} call sessions to migrate")
    print("=" * 70)

    # Migrate each session
    results = []
    success_count = 0
    skip_count = 0
    error_count = 0

    for i, session in enumerate(sessions, 1):
        print(f"\n[{i}/{total_count}] Migrating session: {session.session_id}")

        result = migrate_session(session, db, dry_run=args.dry_run)
        results.append(result)

        if result["success"]:
            success_count += 1
            print(f"  ✅ Created conversation: {result['conversation_id']}")
            print(f"     - Message ID: {result['message_id']}")
            print(f"     - Events migrated: {result['events_migrated']}")
        elif result["error"] == "Already migrated":
            skip_count += 1
            print(f"  ⏭️  Skipped (already migrated)")
        else:
            error_count += 1
            print(f"  ❌ Error: {result['error']}")

    # Summary
    print("\n" + "=" * 70)
    print("📊 Migration Summary")
    print("=" * 70)
    print(f"Total sessions:     {total_count}")
    print(f"✅ Migrated:        {success_count}")
    print(f"⏭️  Skipped:         {skip_count}")
    print(f"❌ Errors:          {error_count}")

    if args.dry_run:
        print("\n🔍 DRY RUN - No changes were committed")
        print("   Run without --dry-run to execute migration")
    else:
        print("\n✨ Migration complete!")

        if error_count > 0:
            print(
                f"\n⚠️  {error_count} sessions failed to migrate. Review errors above."
            )

        # Verification
        print("\n🔍 Verification:")
        conv_count = db.query(func.count(Conversation.id)).scalar()
        msg_count = db.query(func.count(CommunicationMessage.id)).scalar()
        voice_count = db.query(func.count(VoiceCallDetails.message_id)).scalar()
        print(f"   Conversations created: {conv_count}")
        print(f"   Messages created:      {msg_count}")
        print(f"   Voice details created: {voice_count}")

    db.close()


if __name__ == "__main__":
    main()
