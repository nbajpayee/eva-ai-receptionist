"""
Customer Thread Service

Manages the grouping of related conversations into logical threads.
A thread represents a single customer intent or issue that may span
multiple conversations across different channels.

Thread Detection Logic:
1. Time-based: Conversations within 24h are likely related
2. Intent-based: AI analyzes if new message is about same topic
3. Appointment-based: Conversations about same appointment are grouped
4. Explicit: Customer references previous conversation
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from openai import OpenAI
from sqlalchemy import desc
from sqlalchemy.orm import Session

from config import get_settings
from database import Customer, CustomerThread, Conversation, CommunicationMessage

logger = logging.getLogger(__name__)

# Time window for considering conversations as potentially related
THREAD_TIME_WINDOW_HOURS = 24


class ThreadService:
    """Service for managing customer threads."""

    @staticmethod
    def find_or_create_thread(
        db: Session,
        customer: Customer,
        channel: str,
        initial_message: Optional[str] = None,
        intent_hint: Optional[str] = None,
    ) -> CustomerThread:
        """
        Find an existing open thread for the customer or create a new one.
        
        Logic:
        1. Look for open threads updated within the last 24 hours
        2. If found and message seems related, return existing thread
        3. Otherwise, create a new thread
        
        Args:
            db: Database session
            customer: The customer
            channel: Communication channel (voice, sms, email)
            initial_message: First message content (for intent detection)
            intent_hint: Optional hint about the intent (booking, inquiry, etc.)
            
        Returns:
            CustomerThread to use for the conversation
        """
        now = datetime.utcnow()
        time_threshold = now - timedelta(hours=THREAD_TIME_WINDOW_HOURS)
        
        # Find recent open threads for this customer
        recent_threads = (
            db.query(CustomerThread)
            .filter(
                CustomerThread.customer_id == customer.id,
                CustomerThread.status == "open",
                CustomerThread.last_activity_at >= time_threshold,
            )
            .order_by(desc(CustomerThread.last_activity_at))
            .all()
        )
        
        if recent_threads and initial_message:
            # Use AI to determine if this is a continuation or new topic
            existing_thread = ThreadService._find_related_thread(
                db, recent_threads, initial_message, intent_hint
            )
            if existing_thread:
                logger.info(
                    f"Linking to existing thread {existing_thread.id} for customer {customer.id}"
                )
                return existing_thread
        elif recent_threads and not initial_message:
            # No message to analyze, use most recent thread
            return recent_threads[0]
        
        # Create new thread
        intent = intent_hint or ThreadService._detect_intent(initial_message)
        subject = ThreadService._generate_subject(initial_message, intent)
        
        thread = CustomerThread(
            customer_id=customer.id,
            subject=subject,
            intent=intent,
            status="open",
            last_activity_at=now,
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
        
        logger.info(
            f"Created new thread {thread.id} for customer {customer.id}: {subject}"
        )
        return thread

    @staticmethod
    def _find_related_thread(
        db: Session,
        threads: List[CustomerThread],
        message: str,
        intent_hint: Optional[str] = None,
    ) -> Optional[CustomerThread]:
        """
        Use AI to determine if the message relates to an existing thread.
        
        Returns the matching thread or None if this is a new topic.
        """
        if not threads:
            return None
        
        # For simple cases, use heuristics first
        message_lower = message.lower()
        
        # Check for explicit references
        continuation_phrases = [
            "following up", "follow up", "about my appointment",
            "regarding my", "as we discussed", "like i mentioned",
            "you said", "earlier", "last time", "before"
        ]
        
        if any(phrase in message_lower for phrase in continuation_phrases):
            # Likely a continuation - return most recent thread
            return threads[0]
        
        # Check for booking-related keywords
        booking_keywords = ["book", "schedule", "appointment", "available", "slot", "time"]
        is_booking = any(kw in message_lower for kw in booking_keywords)
        
        if is_booking:
            # Look for existing booking thread
            for thread in threads:
                if thread.intent == "booking":
                    return thread
        
        # For more complex cases, could use AI here
        # For now, if within 2 hours, assume continuation
        two_hours_ago = datetime.utcnow() - timedelta(hours=2)
        for thread in threads:
            if thread.last_activity_at >= two_hours_ago:
                return thread
        
        # No clear match - will create new thread
        return None

    @staticmethod
    def _detect_intent(message: Optional[str]) -> Optional[str]:
        """Detect the intent from the message content."""
        if not message:
            return None
        
        message_lower = message.lower()
        
        # Simple keyword-based detection
        if any(kw in message_lower for kw in ["book", "schedule", "appointment", "available"]):
            return "booking"
        if any(kw in message_lower for kw in ["reschedule", "change", "move"]):
            return "reschedule"
        if any(kw in message_lower for kw in ["cancel", "cancellation"]):
            return "cancel"
        if any(kw in message_lower for kw in ["price", "cost", "how much", "pricing"]):
            return "inquiry"
        if any(kw in message_lower for kw in ["complaint", "unhappy", "disappointed", "problem", "issue"]):
            return "complaint"
        if any(kw in message_lower for kw in ["confirm", "confirmation"]):
            return "confirmation"
        if any(kw in message_lower for kw in ["question", "info", "information", "tell me", "what is"]):
            return "inquiry"
        
        return "other"

    @staticmethod
    def _generate_subject(message: Optional[str], intent: Optional[str]) -> str:
        """Generate a subject line for the thread."""
        intent_subjects = {
            "booking": "Appointment Booking",
            "reschedule": "Appointment Reschedule",
            "cancel": "Appointment Cancellation",
            "inquiry": "General Inquiry",
            "complaint": "Customer Concern",
            "confirmation": "Appointment Confirmation",
            "follow_up": "Follow-up",
        }
        
        if intent and intent in intent_subjects:
            return intent_subjects[intent]
        
        if message:
            # Use first 50 chars of message as subject
            clean_message = message.strip()[:50]
            if len(message) > 50:
                clean_message += "..."
            return clean_message
        
        return "New Conversation"

    @staticmethod
    def update_thread_activity(
        db: Session,
        thread: CustomerThread,
        outcome: Optional[str] = None,
        resolve: bool = False,
    ) -> None:
        """Update thread after conversation activity."""
        thread.last_activity_at = datetime.utcnow()
        
        if outcome:
            thread.outcome = outcome
        
        if resolve:
            thread.status = "resolved"
            thread.resolved_at = datetime.utcnow()
        
        db.commit()

    @staticmethod
    def link_conversation_to_thread(
        db: Session,
        conversation: Conversation,
        thread: CustomerThread,
    ) -> None:
        """Link a conversation to a thread."""
        conversation.thread_id = thread.id
        thread.last_activity_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def get_thread_summary(
        db: Session,
        thread_id: UUID,
    ) -> dict:
        """Get a summary of a thread with all its conversations."""
        thread = db.query(CustomerThread).filter(CustomerThread.id == thread_id).first()
        if not thread:
            return {}
        
        conversations = (
            db.query(Conversation)
            .filter(Conversation.thread_id == thread_id)
            .order_by(Conversation.initiated_at)
            .all()
        )
        
        return {
            "id": str(thread.id),
            "customer_id": thread.customer_id,
            "subject": thread.subject,
            "intent": thread.intent,
            "status": thread.status,
            "outcome": thread.outcome,
            "created_at": thread.created_at.isoformat() if thread.created_at else None,
            "last_activity_at": thread.last_activity_at.isoformat() if thread.last_activity_at else None,
            "resolved_at": thread.resolved_at.isoformat() if thread.resolved_at else None,
            "conversation_count": len(conversations),
            "channels_used": list(set(c.channel for c in conversations)),
            "conversations": [
                {
                    "id": str(c.id),
                    "channel": c.channel,
                    "status": c.status,
                    "initiated_at": c.initiated_at.isoformat() if c.initiated_at else None,
                    "outcome": c.outcome,
                    "message_count": len(c.messages) if c.messages else 0,
                }
                for c in conversations
            ],
        }

    @staticmethod
    def get_customer_threads(
        db: Session,
        customer_id: int,
        include_resolved: bool = False,
        limit: int = 10,
    ) -> List[dict]:
        """Get threads for a customer."""
        query = db.query(CustomerThread).filter(CustomerThread.customer_id == customer_id)
        
        if not include_resolved:
            query = query.filter(CustomerThread.status != "resolved")
        
        threads = (
            query.order_by(desc(CustomerThread.last_activity_at))
            .limit(limit)
            .all()
        )
        
        return [
            {
                "id": str(t.id),
                "subject": t.subject,
                "intent": t.intent,
                "status": t.status,
                "outcome": t.outcome,
                "last_activity_at": t.last_activity_at.isoformat() if t.last_activity_at else None,
                "conversation_count": len(t.conversations) if t.conversations else 0,
            }
            for t in threads
        ]
