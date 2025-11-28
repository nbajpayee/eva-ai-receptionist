"""
Dual-Write Validation Script

Validates that legacy call_sessions and new conversations tables stay in sync.
Run this daily during the dual-write period (Phase 2 migration).

Usage:
    python backend/scripts/validate_dual_write.py

    # For detailed output:
    python backend/scripts/validate_dual_write.py --verbose

    # Check only recent records (faster):
    python backend/scripts/validate_dual_write.py --days 7
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB

# Add parent directory to path for imports
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal, CallSession, Conversation


def _utcnow() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(timezone.utc)


def validate_counts(db: SessionLocal, days: int = None) -> Tuple[bool, str]:
    """
    Compare total counts between call_sessions and voice conversations.

    Args:
        db: Database session
        days: Only check records from last N days (None = all records)

    Returns:
        Tuple of (passed: bool, message: str)
    """
    print("\n" + "="*70)
    print("COUNT VALIDATION")
    print("="*70)

    # Build queries
    call_query = db.query(CallSession)
    conv_query = db.query(Conversation).filter(Conversation.channel == "voice")

    if days:
        cutoff = _utcnow() - timedelta(days=days)
        call_query = call_query.filter(CallSession.started_at >= cutoff)
        conv_query = conv_query.filter(Conversation.initiated_at >= cutoff)

    total_call_sessions = call_query.count()
    total_voice_conversations = conv_query.count()

    print(f"\nLegacy call_sessions (voice):  {total_call_sessions:,}")
    print(f"New conversations (voice):      {total_voice_conversations:,}")

    if total_call_sessions == total_voice_conversations:
        print("✅ PASS: Counts match")
        return True, "Counts match"
    else:
        diff = abs(total_call_sessions - total_voice_conversations)
        print(f"❌ FAIL: COUNT MISMATCH ({diff:,} difference)")
        return False, f"Count mismatch: {diff} records"


def validate_data_consistency(
    db: SessionLocal,
    sample_size: int = 100,
    verbose: bool = False
) -> Tuple[bool, List[str]]:
    """
    Spot-check data consistency between call_sessions and conversations.

    Args:
        db: Database session
        sample_size: Number of recent records to check
        verbose: Print detailed mismatch info

    Returns:
        Tuple of (passed: bool, mismatches: List[str])
    """
    print("\n" + "="*70)
    print(f"DATA CONSISTENCY CHECK (sampling {sample_size} recent records)")
    print("="*70)

    # Get recent call sessions
    recent_calls = db.query(CallSession).order_by(
        CallSession.started_at.desc()
    ).limit(sample_size).all()

    mismatches = []

    for call in recent_calls:
        # Find matching conversation by session_id in metadata
        try:
            conversation = db.query(Conversation).filter(
                Conversation.channel == "voice",
                func.cast(Conversation.custom_metadata, JSONB)['session_id'].astext == call.session_id
            ).first()
        except Exception as e:
            mismatches.append(
                f"Error querying conversation for call_session {call.id}: {e}"
            )
            continue

        if not conversation:
            mismatches.append(
                f"Missing conversation for call_session {call.id} (session_id: {call.session_id})"
            )
            continue

        # Verify key fields match
        if call.customer_id != conversation.customer_id:
            mismatches.append(
                f"Customer ID mismatch for session {call.session_id}: "
                f"call={call.customer_id}, conv={conversation.customer_id}"
            )

        if call.satisfaction_score != conversation.satisfaction_score:
            mismatches.append(
                f"Satisfaction score mismatch for session {call.session_id}: "
                f"call={call.satisfaction_score}, conv={conversation.satisfaction_score}"
            )

        if call.sentiment != conversation.sentiment:
            mismatches.append(
                f"Sentiment mismatch for session {call.session_id}: "
                f"call={call.sentiment}, conv={conversation.sentiment}"
            )

        if call.outcome != conversation.outcome:
            mismatches.append(
                f"Outcome mismatch for session {call.session_id}: "
                f"call={call.outcome}, conv={conversation.outcome}"
            )

    print(f"\nChecked {len(recent_calls)} call sessions")

    if mismatches:
        print(f"\n❌ FAIL: Found {len(mismatches)} data mismatches:")
        for mismatch in mismatches[:10]:  # Show first 10
            print(f"  - {mismatch}")
        if len(mismatches) > 10:
            print(f"  ... and {len(mismatches) - 10} more")
        return False, mismatches
    else:
        print("✅ PASS: All spot checks passed - data is consistent")
        return True, []


def validate_orphaned_records(db: SessionLocal, days: int = None) -> Tuple[bool, Dict[str, int]]:
    """
    Check for orphaned records (exists in one table but not the other).

    Args:
        db: Database session
        days: Only check records from last N days

    Returns:
        Tuple of (passed: bool, orphan_counts: Dict[str, int])
    """
    print("\n" + "="*70)
    print("ORPHANED RECORDS CHECK")
    print("="*70)

    # Find call_sessions without matching conversations
    call_sessions = db.query(CallSession)
    if days:
        cutoff = _utcnow() - timedelta(days=days)
        call_sessions = call_sessions.filter(CallSession.started_at >= cutoff)

    orphaned_calls = 0
    for call in call_sessions.all():
        try:
            conversation = db.query(Conversation).filter(
                Conversation.channel == "voice",
                func.cast(Conversation.custom_metadata, JSONB)['session_id'].astext == call.session_id
            ).first()
            if not conversation:
                orphaned_calls += 1
        except Exception:
            orphaned_calls += 1

    # Find conversations without matching call_sessions
    conversations = db.query(Conversation).filter(Conversation.channel == "voice")
    if days:
        conversations = conversations.filter(Conversation.initiated_at >= cutoff)

    orphaned_convs = 0
    for conv in conversations.all():
        try:
            metadata = conv.custom_metadata or {}
            if isinstance(metadata, str):
                import json
                metadata = json.loads(metadata)

            session_id = metadata.get("session_id")
            if session_id:
                call = db.query(CallSession).filter(
                    CallSession.session_id == session_id
                ).first()
                if not call:
                    orphaned_convs += 1
        except Exception:
            orphaned_convs += 1

    print(f"\nCall sessions without conversations:  {orphaned_calls}")
    print(f"Conversations without call sessions:  {orphaned_convs}")

    passed = orphaned_calls == 0 and orphaned_convs == 0

    if passed:
        print("✅ PASS: No orphaned records found")
    else:
        print("❌ FAIL: Orphaned records detected")

    return passed, {
        "orphaned_call_sessions": orphaned_calls,
        "orphaned_conversations": orphaned_convs
    }


def main(args):
    """Run all validation checks."""
    print("\n" + "="*70)
    print("DUAL-WRITE VALIDATION SCRIPT")
    print(f"Timestamp: {_utcnow().isoformat()}")
    if args.days:
        print(f"Scope: Last {args.days} days only")
    else:
        print("Scope: All records")
    print("="*70)

    db = SessionLocal()
    all_passed = True

    try:
        # 1. Count validation
        passed, msg = validate_counts(db, args.days)
        if not passed:
            all_passed = False

        # 2. Data consistency check
        passed, mismatches = validate_data_consistency(
            db,
            sample_size=args.sample_size,
            verbose=args.verbose
        )
        if not passed:
            all_passed = False

        # 3. Orphaned records check
        passed, orphan_counts = validate_orphaned_records(db, args.days)
        if not passed:
            all_passed = False

        # Final summary
        print("\n" + "="*70)
        print("FINAL RESULT")
        print("="*70)

        if all_passed:
            print("✅ ALL CHECKS PASSED")
            print("\nDual-write is working correctly. Data is in sync.")
            return 0
        else:
            print("❌ SOME CHECKS FAILED")
            print("\nDual-write has issues. Review failures above.")
            print("\nRecommended actions:")
            print("  1. Check application logs for dual-write errors")
            print("  2. Verify analytics.py create_call_session() is being called")
            print("  3. Verify analytics.py create_conversation() is being called")
            print("  4. Run this script with --verbose for detailed mismatch info")
            return 1

    except Exception as e:
        print(f"\n❌ VALIDATION SCRIPT FAILED WITH ERROR:")
        print(f"   {e}")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Validate dual-write consistency between call_sessions and conversations"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Only check records from last N days (default: all records)"
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=100,
        help="Number of records to spot-check for data consistency (default: 100)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed mismatch information"
    )

    args = parser.parse_args()
    sys.exit(main(args))
