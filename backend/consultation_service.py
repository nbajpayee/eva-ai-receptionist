"""
Consultation recording service for in-person consultations.

Handles:
- Audio upload and storage
- Transcription via OpenAI Whisper
- Consultation metadata management
- Triggering AI analysis
"""
from __future__ import annotations

import os
import io
import uuid
import logging
import time
from datetime import datetime
from typing import Optional, BinaryIO
from pathlib import Path

from sqlalchemy.orm import Session
import openai

try:
    from backend.database import InPersonConsultation, Provider, Customer, Appointment
    from backend.config import get_settings
except ModuleNotFoundError:
    from database import InPersonConsultation, Provider, Customer, Appointment
    from config import get_settings

settings = get_settings()
openai.api_key = settings.OPENAI_API_KEY

# Configure logging
logger = logging.getLogger(__name__)


class ConsultationService:
    """Service for managing in-person consultation recordings."""

    def __init__(self, db: Session):
        self.db = db

    def create_consultation(
        self,
        provider_id: str,
        customer_id: Optional[int] = None,
        service_type: Optional[str] = None,
    ) -> InPersonConsultation:
        """Create a new consultation record."""
        consultation = InPersonConsultation(
            id=uuid.uuid4(),
            provider_id=uuid.UUID(provider_id),
            customer_id=customer_id,
            service_type=service_type,
            created_at=datetime.utcnow(),
        )
        self.db.add(consultation)
        self.db.commit()
        self.db.refresh(consultation)
        return consultation

    def upload_audio(
        self,
        consultation_id: str,
        audio_file: BinaryIO,
        filename: str,
    ) -> str:
        """
        Upload audio file to storage.

        In production, this would upload to Supabase Storage or S3.
        For now, we'll save locally and return a local path.
        """
        # Create uploads directory if it doesn't exist
        # Use path relative to this file's location
        current_dir = Path(__file__).parent
        upload_dir = current_dir / "uploads" / "consultations"
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        file_ext = Path(filename).suffix
        unique_filename = f"{consultation_id}{file_ext}"
        file_path = upload_dir / unique_filename

        # Save file
        with open(file_path, "wb") as f:
            f.write(audio_file.read())

        # Return relative path (in production, return full URL)
        return str(file_path)

    def transcribe_audio(self, audio_path: str, max_retries: int = 3) -> str:
        """
        Transcribe audio file using OpenAI Whisper API with retry logic.

        Args:
            audio_path: Path to audio file
            max_retries: Maximum number of retry attempts (default: 3)

        Returns:
            Transcribed text

        Raises:
            Exception: If transcription fails after all retries
        """
        last_exception = None

        for attempt in range(max_retries):
            try:
                logger.info(f"Transcribing audio (attempt {attempt + 1}/{max_retries}): {audio_path}")

                with open(audio_path, "rb") as audio_file:
                    transcript = openai.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )

                logger.info(f"Successfully transcribed audio: {len(transcript)} characters")
                return transcript

            except openai.RateLimitError as e:
                last_exception = e
                wait_time = (2 ** attempt) * 2  # Exponential backoff: 2s, 4s, 8s
                logger.warning(f"Rate limit hit, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                time.sleep(wait_time)

            except openai.APIError as e:
                last_exception = e
                wait_time = (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                logger.warning(f"API error, retrying in {wait_time}s: {str(e)}")
                time.sleep(wait_time)

            except openai.APIConnectionError as e:
                last_exception = e
                wait_time = (2 ** attempt) * 3  # Longer backoff for connection issues
                logger.warning(f"Connection error, retrying in {wait_time}s: {str(e)}")
                time.sleep(wait_time)

            except Exception as e:
                # Non-retryable errors (file not found, invalid format, etc.)
                logger.error(f"Non-retryable error transcribing audio: {str(e)}", exc_info=True)
                raise

        # All retries exhausted
        logger.error(f"Failed to transcribe audio after {max_retries} attempts")
        raise last_exception or Exception("Transcription failed after all retries")

    def end_consultation(
        self,
        consultation_id: str,
        outcome: str,
        appointment_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> InPersonConsultation:
        """
        End a consultation and trigger analysis.

        Args:
            consultation_id: UUID of consultation
            outcome: 'booked', 'declined', 'thinking', 'follow_up_needed'
            appointment_id: Optional appointment ID if booked
            notes: Optional manual notes from provider
        """
        consultation = self.db.query(InPersonConsultation).filter(
            InPersonConsultation.id == uuid.UUID(consultation_id)
        ).first()

        if not consultation:
            raise ValueError(f"Consultation {consultation_id} not found")

        # Calculate duration if created_at exists
        if consultation.created_at:
            duration = (datetime.utcnow() - consultation.created_at).total_seconds()
            consultation.duration_seconds = int(duration)

        consultation.ended_at = datetime.utcnow()
        consultation.outcome = outcome
        consultation.appointment_id = appointment_id
        consultation.notes = notes

        # Transcribe if recording exists
        if consultation.recording_url and not consultation.transcript:
            try:
                consultation.transcript = self.transcribe_audio(consultation.recording_url)
            except Exception as e:
                logger.error(f"Failed to transcribe consultation {consultation_id}: {str(e)}", exc_info=True)
                # Don't fail the entire consultation if transcription fails
                # Consultation can still be saved without transcript

        self.db.commit()
        self.db.refresh(consultation)

        # Trigger AI analysis (will be implemented in ai_insights_service)
        # from ai_insights_service import AIInsightsService
        # insights_service = AIInsightsService(self.db)
        # insights_service.analyze_consultation(str(consultation.id))

        return consultation

    def get_consultation(self, consultation_id: str) -> Optional[InPersonConsultation]:
        """Get consultation by ID."""
        return self.db.query(InPersonConsultation).filter(
            InPersonConsultation.id == uuid.UUID(consultation_id)
        ).first()

    def list_consultations(
        self,
        provider_id: Optional[str] = None,
        customer_id: Optional[int] = None,
        outcome: Optional[str] = None,
        service_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[InPersonConsultation], int]:
        """
        List consultations with filters.

        Returns:
            Tuple of (consultations, total_count)
        """
        query = self.db.query(InPersonConsultation)

        if provider_id:
            query = query.filter(InPersonConsultation.provider_id == uuid.UUID(provider_id))
        if customer_id:
            query = query.filter(InPersonConsultation.customer_id == customer_id)
        if outcome:
            query = query.filter(InPersonConsultation.outcome == outcome)
        if service_type:
            query = query.filter(InPersonConsultation.service_type == service_type)

        total = query.count()
        consultations = query.order_by(
            InPersonConsultation.created_at.desc()
        ).limit(limit).offset(offset).all()

        return consultations, total

    def get_provider_consultations(
        self,
        provider_id: str,
        limit: int = 50
    ) -> list[InPersonConsultation]:
        """Get recent consultations for a specific provider."""
        return self.db.query(InPersonConsultation).filter(
            InPersonConsultation.provider_id == uuid.UUID(provider_id)
        ).order_by(
            InPersonConsultation.created_at.desc()
        ).limit(limit).all()

    def search_consultations(
        self,
        search_term: str,
        limit: int = 50
    ) -> list[InPersonConsultation]:
        """Search consultations by transcript content or notes."""
        return self.db.query(InPersonConsultation).filter(
            (InPersonConsultation.transcript.ilike(f"%{search_term}%")) |
            (InPersonConsultation.notes.ilike(f"%{search_term}%")) |
            (InPersonConsultation.ai_summary.ilike(f"%{search_term}%"))
        ).order_by(
            InPersonConsultation.created_at.desc()
        ).limit(limit).all()
