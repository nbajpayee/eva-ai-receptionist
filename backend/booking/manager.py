"""Public façade for slot selection helpers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from database import CommunicationMessage, Conversation

from .slot_selection import SlotSelectionCore, SlotSelectionError


class SlotSelectionManager:
    """Unified API for slot-selection logic across all channels."""

    SlotSelectionError = SlotSelectionError

    # Slot offer lifecycle -------------------------------------------------

    @staticmethod
    def record_offers(
        db: Session,
        conversation: Conversation,
        *,
        tool_call_id: Optional[str],
        arguments: Dict[str, Any],
        output: Dict[str, Any],
    ) -> None:
        SlotSelectionCore.record_offers(
            db,
            conversation,
            tool_call_id=tool_call_id,
            arguments=arguments,
            output=output,
        )

    @staticmethod
    def clear_offers(db: Session, conversation: Conversation) -> None:
        SlotSelectionCore.clear_offers(db, conversation)

    # Selection capture ----------------------------------------------------

    @staticmethod
    def capture_selection(
        db: Session,
        conversation: Conversation,
        message: CommunicationMessage,
    ) -> bool:
        return SlotSelectionCore.capture_selection(db, conversation, message)

    @staticmethod
    def extract_choice(message_text: str, slots: List[Dict[str, Any]]) -> Optional[int]:
        return SlotSelectionCore.extract_choice(message_text, slots)

    # Metadata helpers -----------------------------------------------------

    @staticmethod
    def get_pending_slot_offers(
        db: Session,
        conversation: Conversation,
        *,
        enforce_expiry: bool = True,
    ) -> Optional[Dict[str, Any]]:
        return SlotSelectionCore.get_pending_slot_offers(
            db, conversation, enforce_expiry=enforce_expiry
        )

    @staticmethod
    def pending_slot_summary(
        db: Session, conversation: Conversation
    ) -> List[Dict[str, Any]]:
        return SlotSelectionCore.pending_slot_summary(db, conversation)

    @staticmethod
    def conversation_metadata(conversation: Conversation) -> Dict[str, Any]:
        return SlotSelectionCore.conversation_metadata(conversation)

    @staticmethod
    def persist_conversation_metadata(
        db: Session, conversation: Conversation, metadata: Dict[str, Any]
    ) -> None:
        SlotSelectionCore.persist_conversation_metadata(db, conversation, metadata)

    # Enforcement ----------------------------------------------------------

    @staticmethod
    def enforce_booking(
        db: Session,
        conversation: Conversation,
        arguments: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Optional[str]]]]:
        return SlotSelectionCore.enforce_booking(db, conversation, arguments)

    @staticmethod
    def slot_matches_request(slot: Dict[str, Any], requested_iso: str) -> bool:
        return SlotSelectionCore.slot_matches_request(slot, requested_iso)
