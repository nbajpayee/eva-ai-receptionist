"""Core slot-selection logic shared across booking channels."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pytz
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database import CommunicationMessage, Conversation

from .time_utils import parse_iso_datetime

logger = logging.getLogger(__name__)

UTC = pytz.utc


class SlotSelectionError(Exception):
    """Raised when booking requests do not align with offered slots."""


class SlotSelectionCore:
    """Pure helpers for storing, capturing, and enforcing slot selections."""

    @staticmethod
    def conversation_metadata(conversation: Conversation) -> Dict[str, Any]:
        metadata = conversation.custom_metadata or {}
        if not isinstance(metadata, dict):
            try:
                metadata = json.loads(metadata)
            except Exception:  # noqa: BLE001 - fall back to empty dict
                metadata = {}
        return metadata

    @staticmethod
    def persist_conversation_metadata(
        db: Session,
        conversation: Conversation,
        metadata: Dict[str, Any],
    ) -> None:
        conversation.custom_metadata = metadata
        flag_modified(conversation, "custom_metadata")
        db.commit()
        db.refresh(conversation)

    # ------------------------------------------------------------------
    # Slot offer storage
    # ------------------------------------------------------------------

    @staticmethod
    def record_offers(
        db: Session,
        conversation: Conversation,
        *,
        tool_call_id: Optional[str],
        arguments: Dict[str, Any],
        output: Dict[str, Any],
    ) -> None:
        full_slots = output.get("all_slots") or output.get("available_slots") or []
        # Slots shown to the user as numbered options should align with the
        # subset we actually want them to pick from. Prefer suggested_slots
        # when available, otherwise fall back to the full list.
        #
        # For preemptive availability (tool_call_id == "preemptive_call"), we
        # intentionally expose the full grid in the stored "slots" list so
        # deterministic flows and tests can reason over all options.
        if tool_call_id == "preemptive_call":
            display_slots = full_slots
        else:
            display_slots = output.get("suggested_slots") or full_slots
        metadata = SlotSelectionCore.conversation_metadata(conversation)

        if not full_slots:
            if metadata.pop("pending_slot_offers", None) is not None:
                SlotSelectionCore.persist_conversation_metadata(
                    db, conversation, metadata
                )
            return

        offer_timestamp = datetime.utcnow().replace(tzinfo=UTC)
        offer_payload: Dict[str, Any] = {
            "source_tool_call_id": tool_call_id,
            "service_type": output.get("service_type") or arguments.get("service_type"),
            "date": output.get("date") or arguments.get("date"),
            "offered_at": offer_timestamp.isoformat(),
            "expires_at": (offer_timestamp + timedelta(hours=4)).isoformat(),
            # Slots: the subset actually offered as numbered options
            "slots": [
                {
                    "index": idx + 1,
                    "start": slot.get("start"),
                    "start_time": slot.get("start_time"),
                    "end": slot.get("end"),
                    "end_time": slot.get("end_time"),
                }
                for idx, slot in enumerate(display_slots)
            ],
            # all_slots: the full set of available slots for this date/service,
            # used when matching free-form time expressions like "3:30pm".
            "all_slots": [
                {
                    "start": slot.get("start"),
                    "start_time": slot.get("start_time"),
                    "end": slot.get("end"),
                    "end_time": slot.get("end_time"),
                }
                for slot in full_slots
            ],
        }

        existing_pending = metadata.get("pending_slot_offers", {})
        preserved_selection = False
        matched_slot: Optional[Dict[str, Any]] = None
        matched_index: Optional[int] = None

        if isinstance(existing_pending, dict):
            existing_selected_slot = existing_pending.get("selected_slot")
            candidate_start = None
            if isinstance(existing_selected_slot, dict):
                candidate_start = existing_selected_slot.get("start")

            if candidate_start:
                for idx, slot in enumerate(display_slots, start=1):
                    if slot.get("start") == candidate_start:
                        matched_slot = slot
                        matched_index = idx
                        break

            if matched_slot is None:
                existing_index = existing_pending.get("selected_option_index")
                if isinstance(existing_index, int) and 1 <= existing_index <= len(
                    display_slots
                ):
                    matched_slot = display_slots[existing_index - 1]
                    matched_index = existing_index

            if matched_slot is not None and matched_index is not None:
                offer_payload["selected_option_index"] = matched_index
                offer_payload["selected_slot"] = matched_slot
                preserved_selection = True
                for key in [
                    "selected_by_message_id",
                    "selected_content_preview",
                    "selected_at",
                ]:
                    if key in existing_pending:
                        offer_payload[key] = existing_pending[key]
            elif existing_pending.get("selected_slot") or existing_pending.get(
                "selected_option_index"
            ):
                logger.info(
                    "Clearing stale slot selection for conversation_id=%s after refreshed availability.",
                    conversation.id,
                )

        metadata["pending_slot_offers"] = offer_payload
        SlotSelectionCore.persist_conversation_metadata(db, conversation, metadata)

        slot_times = [
            s.get("start_time", s.get("start")) for s in (display_slots or [])[:3]
        ]
        if preserved_selection:
            logger.info(
                "Re-checked availability and preserved user selection: conversation_id=%s, selected_option=%s, new_slots=%s",
                conversation.id,
                offer_payload.get("selected_option_index"),
                slot_times,
            )
        else:
            logger.info(
                "Stored %d slot offers for conversation_id=%s, date=%s, slots=%s",
                len(display_slots or []),
                conversation.id,
                offer_payload.get("date"),
                slot_times,
            )

    @staticmethod
    def clear_offers(db: Session, conversation: Conversation) -> None:
        metadata = SlotSelectionCore.conversation_metadata(conversation)
        if metadata.pop("pending_slot_offers", None) is not None:
            SlotSelectionCore.persist_conversation_metadata(db, conversation, metadata)

    # ------------------------------------------------------------------
    # Access helpers
    # ------------------------------------------------------------------

    @staticmethod
    def get_pending_slot_offers(
        db: Session,
        conversation: Conversation,
        *,
        enforce_expiry: bool = True,
    ) -> Optional[Dict[str, Any]]:
        metadata = SlotSelectionCore.conversation_metadata(conversation)
        pending = metadata.get("pending_slot_offers")
        if not pending:
            return None

        if enforce_expiry and pending.get("expires_at"):
            try:
                expires_at = parse_iso_datetime(pending["expires_at"])
            except ValueError:
                expires_at = None
            if expires_at and expires_at < datetime.utcnow().replace(tzinfo=UTC):
                metadata.pop("pending_slot_offers", None)
                SlotSelectionCore.persist_conversation_metadata(
                    db, conversation, metadata
                )
                return None
        return pending

    @staticmethod
    def pending_slot_summary(
        db: Session, conversation: Conversation
    ) -> List[Dict[str, Any]]:
        pending = SlotSelectionCore.get_pending_slot_offers(
            db, conversation, enforce_expiry=False
        )
        if not pending:
            return []
        slots = pending.get("slots") or []
        return [
            {
                "index": entry.get("index"),
                "start": entry.get("start"),
                "start_time": entry.get("start_time"),
                "end": entry.get("end"),
                "end_time": entry.get("end_time"),
            }
            for entry in slots
        ]

    # ------------------------------------------------------------------
    # Selection capture
    # ------------------------------------------------------------------

    @staticmethod
    def capture_selection(
        db: Session,
        conversation: Conversation,
        message: CommunicationMessage,
    ) -> bool:
        pending = SlotSelectionCore.get_pending_slot_offers(db, conversation)
        if not pending:
            return False

        slots = pending.get("slots") or []
        all_slots = pending.get("all_slots") or []

        content = (message.content or "").strip()
        if not content:
            return False

        # First, try to interpret the message as a numbered choice or a time
        # that corresponds to one of the displayed slots.
        if slots:
            choice_index = SlotSelectionCore.extract_choice(content, slots)
            if choice_index is not None and 1 <= choice_index <= len(slots):
                metadata = SlotSelectionCore.conversation_metadata(conversation)
                pending = metadata.get("pending_slot_offers", {})
                pending["selected_option_index"] = choice_index
                pending["selected_slot"] = slots[choice_index - 1]
                pending["selected_by_message_id"] = str(message.id)
                pending["selected_content_preview"] = content[:120]
                pending["selected_at"] = datetime.utcnow().replace(tzinfo=UTC).isoformat()
                metadata["pending_slot_offers"] = pending

                logger.info(
                    "Captured slot selection: conversation_id=%s, choice=%d, slot=%s",
                    conversation.id,
                    choice_index,
                    slots[choice_index - 1].get(
                        "start_time", slots[choice_index - 1].get("start")
                    ),
                )

                SlotSelectionCore.persist_conversation_metadata(
                    db, conversation, metadata
                )
                return True

        # If no displayed slot was selected, but the guest mentions a concrete
        # time that exists in the full availability grid (all_slots), capture
        # that as the selected_slot so deterministic booking can proceed.
        if all_slots:
            time_index = SlotSelectionCore.extract_choice(
                content, all_slots, allow_numeric=False
            )
            if time_index is not None and 1 <= time_index <= len(all_slots):
                metadata = SlotSelectionCore.conversation_metadata(conversation)
                pending = metadata.get("pending_slot_offers", {})
                chosen = all_slots[time_index - 1]
                pending["selected_slot"] = chosen
                pending["selected_by_message_id"] = str(message.id)
                pending["selected_content_preview"] = content[:120]
                pending["selected_at"] = datetime.utcnow().replace(tzinfo=UTC).isoformat()
                metadata["pending_slot_offers"] = pending

                logger.info(
                    "Captured slot selection via time in full availability: conversation_id=%s, slot=%s",
                    conversation.id,
                    chosen.get("start_time", chosen.get("start")),
                )

                SlotSelectionCore.persist_conversation_metadata(
                    db, conversation, metadata
                )
                return True

        return False

    @staticmethod
    def extract_choice(
        message_text: str,
        slots: List[Dict[str, Any]],
        *,
        allow_numeric: bool = True,
    ) -> Optional[int]:
        normalized = (message_text or "").strip().lower()
        if not normalized:
            return None

        if allow_numeric:
            for match in re.finditer(r"\b(\d{1,2})\b", normalized):
                try:
                    choice_idx = int(match.group(1))
                except ValueError:  # pragma: no cover - defensive
                    continue

                start_idx, end_idx = match.span()
                prev_char = normalized[start_idx - 1] if start_idx > 0 else ""
                next_char = normalized[end_idx] if end_idx < len(normalized) else ""
                remainder = normalized[end_idx:]
                remainder_stripped = remainder.lstrip()

                looks_like_time = (
                    prev_char == ":"
                    or next_char == ":"
                    or remainder_stripped.startswith(("am", "pm", "a.m", "p.m"))
                )
                if looks_like_time:
                    continue

                if 1 <= choice_idx <= len(slots):
                    return choice_idx

                if 1 <= choice_idx <= 12:
                    hour_matches: List[int] = []
                    for idx, slot in enumerate(slots, start=1):
                        label = (slot.get("start_time") or "").strip().lower()
                        if not label:
                            continue
                        hour_match = re.match(r"(\d{1,2})", label)
                        if not hour_match:
                            continue
                        try:
                            label_hour = int(hour_match.group(1))
                        except ValueError:
                            continue
                        if label_hour == choice_idx:
                            hour_matches.append(idx)
                    if len(hour_matches) == 1:
                        return hour_matches[0]

        def _canonical_time_token(text: str) -> Optional[str]:
            """Return a normalized time token like '3pm' or '3:30pm' from arbitrary text.

            This is intentionally lightweight – it looks for the first HH[:MM] AM/PM
            style phrase and returns a canonical representation for comparison.
            For labels like "02:00 PM", we normalize to "2pm" so that a guest
            message like "2pm" matches the 2:00 slot.
            """
            match = re.search(
                r"(\d{1,2})(?::(\d{2}))?\s*(a\.m\.?|am|p\.m\.?|pm)", text.lower()
            )
            if not match:
                return None
            hour_str, minute_str, ampm_raw = match.groups()
            try:
                hour = int(hour_str)
            except ValueError:
                return None
            ampm = "am" if "a" in ampm_raw else "pm"
            if minute_str and minute_str != "00":
                return f"{hour}:{minute_str}{ampm}"
            return f"{hour}{ampm}"

        # If the message contains a compact time phrase like "3pm" or "3 pm",
        # try to match it against the slot labels.
        message_time_token = _canonical_time_token(normalized)
        if message_time_token:
            for idx, slot in enumerate(slots, start=1):
                label = (slot.get("start_time") or "").strip().lower()
                if not label:
                    continue
                label_time_token = _canonical_time_token(label)
                if label_time_token and label_time_token == message_time_token:
                    return idx

        condensed_text = normalized.replace(" ", "")
        for idx, slot in enumerate(slots, start=1):
            label = (slot.get("start_time") or "").strip().lower()
            if not label:
                continue
            label_condensed = label.replace(" ", "")
            if label in normalized or label_condensed in condensed_text:
                return idx

        for idx, slot in enumerate(slots, start=1):
            start_iso = slot.get("start") or ""
            if start_iso and start_iso.lower() in normalized:
                return idx

        return None

    # ------------------------------------------------------------------
    # Enforcement
    # ------------------------------------------------------------------

    @staticmethod
    def slot_matches_request(slot: Dict[str, Any], requested_iso: str) -> bool:
        slot_iso = slot.get("start")
        if not slot_iso or not requested_iso:
            return False
        try:
            slot_dt = parse_iso_datetime(slot_iso)
            requested_dt = parse_iso_datetime(str(requested_iso))
        except ValueError:
            return slot_iso == requested_iso
        return slot_dt.replace(tzinfo=None) == requested_dt.replace(tzinfo=None)

    @staticmethod
    def enforce_booking(
        db: Session,
        conversation: Conversation,
        arguments: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Optional[str]]]]:
        pending = SlotSelectionCore.get_pending_slot_offers(db, conversation)

        requested_start = arguments.get("start_time") or arguments.get("start")
        if not pending:
            logger.warning(
                "Booking attempt without pending slot offers. conversation_id=%s, requested_start=%s. "
                "AI may have hallucinated availability without calling check_availability.",
                conversation.id,
                requested_start,
            )
            raise SlotSelectionError(
                "You must call check_availability first to verify the requested time is available, "
                "then let the guest choose from the returned slots before booking."
            )

        slots = pending.get("slots") or []
        all_slots = pending.get("all_slots") or slots
        if not slots and not all_slots:
            raise SlotSelectionError("No stored slot offers to validate against.")

        choice_index = pending.get("selected_option_index")
        preselected_slot = (
            pending.get("selected_slot") if isinstance(pending, dict) else None
        )
        selected_slot: Optional[Dict[str, Any]] = None

        if isinstance(choice_index, int) and 1 <= choice_index <= len(slots):
            candidate_slot = slots[choice_index - 1]
            candidate_label = candidate_slot.get(
                "start_time", candidate_slot.get("start")
            )

            # When a user has explicitly selected an option, ALWAYS honor that selection
            # even if the AI passes a different time in the booking arguments.
            # The selection takes precedence over the requested time.
            selected_slot = candidate_slot
            if requested_start and not SlotSelectionCore.slot_matches_request(
                candidate_slot, requested_start
            ):
                logger.info(
                    "Numbered selection takes precedence for conversation_id=%s: choice_index=%d is %s, AI requested %s. Using selection.",
                    conversation.id,
                    choice_index,
                    candidate_label,
                    requested_start,
                )
            else:
                logger.info(
                    "Slot selection via numbered choice: conversation_id=%s, choice_index=%d, slot=%s",
                    conversation.id,
                    choice_index,
                    candidate_label,
                )
        elif isinstance(preselected_slot, dict) and preselected_slot.get("start"):
            # If we have a previously captured selection (for example, the guest
            # said "Let's do 1:30" and capture_selection stored that in
            # selected_slot), honor that choice even if the AI's requested_start
            # does not exactly match. This prevents the AI from drifting to a
            # different time like 1:00 PM when the user clearly chose 1:30 PM.
            selected_slot = preselected_slot
            label = preselected_slot.get("start_time", preselected_slot.get("start"))
            if requested_start and not SlotSelectionCore.slot_matches_request(
                preselected_slot, requested_start
            ):
                logger.info(
                    "Pre-selected slot takes precedence for conversation_id=%s: selected=%s, AI requested=%s. Using pre-selected slot.",
                    conversation.id,
                    label,
                    requested_start,
                )
            else:
                logger.info(
                    "Using pre-selected slot for conversation_id=%s: slot=%s",
                    conversation.id,
                    label,
                )
        elif requested_start:
            # First, try to match within the displayed options (slots)
            for idx, slot in enumerate(slots, start=1):
                if SlotSelectionCore.slot_matches_request(slot, requested_start):
                    selected_slot = slot
                    pending["selected_option_index"] = idx
                    pending["selected_slot"] = slot
                    pending.setdefault(
                        "selected_at", datetime.utcnow().replace(tzinfo=UTC).isoformat()
                    )
                    logger.info(
                        "Slot selection via time match: conversation_id=%s, requested=%s, matched_slot=%s",
                        conversation.id,
                        requested_start,
                        selected_slot.get("start_time", selected_slot.get("start")),
                    )
                    break

            # If not found in the limited suggested slots, fall back to the full
            # availability set so times like "2:30 PM" that are genuinely free
            # but not in the 1-2 suggested options can still be booked.
            if not selected_slot and all_slots:
                for slot in all_slots:
                    if SlotSelectionCore.slot_matches_request(slot, requested_start):
                        selected_slot = slot
                        pending["selected_slot"] = slot
                        pending.setdefault(
                            "selected_at",
                            datetime.utcnow().replace(tzinfo=UTC).isoformat(),
                        )
                        logger.info(
                            "Slot selection via time match in full availability: conversation_id=%s, requested=%s, matched_slot=%s",
                            conversation.id,
                            requested_start,
                            slot.get("start_time", slot.get("start")),
                        )
                        break

        if not selected_slot:
            preview_source = slots or all_slots
            offered_times = [
                s.get("start_time", s.get("start")) for s in (preview_source or [])[:3]
            ]
            logger.warning(
                "Slot selection mismatch: conversation_id=%s, requested=%s, offered_slots=%s",
                conversation.id,
                requested_start,
                offered_times,
            )
            raise SlotSelectionError(
                f"Requested start time is not one of the offered slots ({', '.join(offered_times)}). "
                "Ask the guest to choose from the options before booking."
            )

        slot_iso = selected_slot.get("start")
        if not slot_iso:
            raise SlotSelectionError("Selected slot is missing a start timestamp.")

        original_value = requested_start
        arguments["start_time"] = slot_iso
        arguments["start"] = slot_iso

        if not arguments.get("service_type") and pending.get("service_type"):
            arguments["service_type"] = pending.get("service_type")
        if not arguments.get("date") and pending.get("date"):
            arguments["date"] = pending.get("date")

        adjustments: Dict[str, Dict[str, Optional[str]]] = {}
        if original_value and original_value != slot_iso:
            adjustments["start_time"] = {
                "original": str(original_value),
                "normalized": str(slot_iso),
            }

        metadata = SlotSelectionCore.conversation_metadata(conversation)
        metadata["pending_slot_offers"] = pending
        SlotSelectionCore.persist_conversation_metadata(db, conversation, metadata)

        return arguments, adjustments
