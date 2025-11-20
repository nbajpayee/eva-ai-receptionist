"""
Consultation recording service for in-person consultations.

Handles:
- Audio upload and storage
- Transcription via OpenAI Whisper
- Consultation metadata management
- Triggering AI analysis
"""

from __future__ import annotations

import io
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO, Optional

import openai
from sqlalchemy.orm import Session

try:
    from backend.config import get_settings
    from backend.database import Appointment, Customer, InPersonConsultation, Provider
except ModuleNotFoundError:
    from config import get_settings
    from database import Appointment, Customer, InPersonConsultation, Provider

settings = get_settings()
openai.api_key = settings.OPENAI_API_KEY


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
        self, consultation_id: str, audio_file: BinaryIO, filename: str,
    ) -> str:
        """
        Upload audio file to storage.

        In production, this would upload to Supabase Storage or S3.
        For now, we'll save locally and return a local path.
        """
        # Create uploads directory if it doesn't exist
        upload_dir = Path("backend/uploads/consultations")
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

    def transcribe_audio(self, audio_path: str) -> str:
        """Transcribe audio file using OpenAI Whisper API."""
        try:
            with open(audio_path, "rb") as audio_file:
                transcript = openai.audio.transcriptions.create(
                    model="whisper-1", file=audio_file, response_format="text"
                )
            return transcript
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            raise

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
        consultation = (
            self.db.query(InPersonConsultation)
            .filter(InPersonConsultation.id == uuid.UUID(consultation_id))
            .first()
        )

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
                consultation.transcript = self.transcribe_audio(
                    consultation.recording_url
                )
            except Exception as e:
                print(f"Failed to transcribe consultation {consultation_id}: {e}")

        self.db.commit()
        self.db.refresh(consultation)

        # Trigger AI analysis (will be implemented in ai_insights_service)
        # from ai_insights_service import AIInsightsService
        # insights_service = AIInsightsService(self.db)
        # insights_service.analyze_consultation(str(consultation.id))

        return consultation

    def get_consultation(self, consultation_id: str) -> Optional[InPersonConsultation]:
        """Get consultation by ID."""
        return (
            self.db.query(InPersonConsultation)
            .filter(InPersonConsultation.id == uuid.UUID(consultation_id))
            .first()
        )

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
            query = query.filter(
                InPersonConsultation.provider_id == uuid.UUID(provider_id)
            )
        if customer_id:
            query = query.filter(InPersonConsultation.customer_id == customer_id)
        if outcome:
            query = query.filter(InPersonConsultation.outcome == outcome)
        if service_type:
            query = query.filter(InPersonConsultation.service_type == service_type)

        total = query.count()
        consultations = (
            query.order_by(InPersonConsultation.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        return consultations, total

    def get_provider_consultations(
        self, provider_id: str, limit: int = 50
    ) -> list[InPersonConsultation]:
        """Get recent consultations for a specific provider."""
        return (
            self.db.query(InPersonConsultation)
            .filter(InPersonConsultation.provider_id == uuid.UUID(provider_id))
            .order_by(InPersonConsultation.created_at.desc())
            .limit(limit)
            .all()
        )

    def search_consultations(
        self, search_term: str, limit: int = 50
    ) -> list[InPersonConsultation]:
        """Search consultations by transcript content or notes."""
        return (
            self.db.query(InPersonConsultation)
            .filter(
                (InPersonConsultation.transcript.ilike(f"%{search_term}%"))
                | (InPersonConsultation.notes.ilike(f"%{search_term}%"))
                | (InPersonConsultation.ai_summary.ilike(f"%{search_term}%"))
            )
            .order_by(InPersonConsultation.created_at.desc())
            .limit(limit)
            .all()
        )
