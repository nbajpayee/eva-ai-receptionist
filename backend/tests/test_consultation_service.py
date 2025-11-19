"""
Tests for consultation service.

Test coverage:
- Creating consultations
- Uploading audio files
- Transcribing audio
- Ending consultations
- Listing consultations with filters
- Error handling scenarios
"""
import pytest
import uuid
import tempfile
import os
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO

import sys
from pathlib import Path as PathLib

# Add backend to path
backend_path = PathLib(__file__).resolve().parents[1]
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from consultation_service import ConsultationService
from database import InPersonConsultation, Provider, Customer, SessionLocal, Base, engine


@pytest.fixture
def db_session():
    """Create a test database session."""
    # Create all tables
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    yield session

    # Cleanup
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_provider(db_session):
    """Create a sample provider for testing."""
    provider = Provider(
        id=uuid.uuid4(),
        name="Test Provider",
        email="test@example.com",
        phone="555-0100",
        specialties=["Botox", "Fillers"],
        is_active=True
    )
    db_session.add(provider)
    db_session.commit()
    db_session.refresh(provider)
    return provider


@pytest.fixture
def sample_customer(db_session):
    """Create a sample customer for testing."""
    customer = Customer(
        name="Test Customer",
        phone="555-0101",
        email="customer@example.com"
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


@pytest.fixture
def consultation_service(db_session):
    """Create a consultation service instance."""
    return ConsultationService(db_session)


class TestConsultationService:
    """Test suite for ConsultationService."""

    def test_create_consultation_basic(self, consultation_service, sample_provider):
        """Test creating a basic consultation."""
        consultation = consultation_service.create_consultation(
            provider_id=str(sample_provider.id),
            customer_id=None,
            service_type="Botox"
        )

        assert consultation.id is not None
        assert consultation.provider_id == sample_provider.id
        assert consultation.service_type == "Botox"
        assert consultation.customer_id is None
        assert consultation.created_at is not None

    def test_create_consultation_with_customer(self, consultation_service, sample_provider, sample_customer):
        """Test creating a consultation with a customer."""
        consultation = consultation_service.create_consultation(
            provider_id=str(sample_provider.id),
            customer_id=sample_customer.id,
            service_type="Fillers"
        )

        assert consultation.customer_id == sample_customer.id
        assert consultation.service_type == "Fillers"

    def test_upload_audio(self, consultation_service, sample_provider):
        """Test uploading an audio file."""
        # Create consultation
        consultation = consultation_service.create_consultation(
            provider_id=str(sample_provider.id)
        )

        # Create a fake audio file
        audio_content = b"fake audio content"
        audio_file = BytesIO(audio_content)

        # Upload
        file_path = consultation_service.upload_audio(
            consultation_id=str(consultation.id),
            audio_file=audio_file,
            filename="test.webm"
        )

        assert file_path is not None
        assert str(consultation.id) in file_path
        assert file_path.endswith(".webm")

        # Verify file was created
        assert os.path.exists(file_path)

        # Cleanup
        os.remove(file_path)

    @patch('consultation_service.openai.audio.transcriptions.create')
    def test_transcribe_audio(self, mock_openai, consultation_service, tmp_path):
        """Test audio transcription."""
        # Create a temp audio file
        audio_file = tmp_path / "test.webm"
        audio_file.write_bytes(b"fake audio")

        # Mock OpenAI response
        mock_openai.return_value = "This is a transcribed text."

        # Transcribe
        transcript = consultation_service.transcribe_audio(str(audio_file))

        assert transcript == "This is a transcribed text."
        assert mock_openai.called

    @patch('consultation_service.openai.audio.transcriptions.create')
    def test_end_consultation(self, mock_openai, consultation_service, sample_provider, tmp_path):
        """Test ending a consultation."""
        # Create consultation
        consultation = consultation_service.create_consultation(
            provider_id=str(sample_provider.id),
            service_type="Botox"
        )

        # Create fake audio file
        audio_file = tmp_path / f"{consultation.id}.webm"
        audio_file.write_bytes(b"fake audio")

        # Mock transcription
        mock_openai.return_value = "Patient wants Botox treatment."

        # Update consultation with audio path
        consultation.recording_url = str(audio_file)
        consultation_service.db.commit()

        # End consultation
        ended = consultation_service.end_consultation(
            consultation_id=str(consultation.id),
            outcome="booked",
            notes="Great consultation"
        )

        assert ended.ended_at is not None
        assert ended.duration_seconds is not None
        assert ended.outcome == "booked"
        assert ended.notes == "Great consultation"
        assert ended.transcript == "Patient wants Botox treatment."

    def test_list_consultations_no_filters(self, consultation_service, sample_provider):
        """Test listing consultations without filters."""
        # Create multiple consultations
        for i in range(5):
            consultation_service.create_consultation(
                provider_id=str(sample_provider.id),
                service_type=f"Service {i}"
            )

        # List all
        consultations, total = consultation_service.list_consultations()

        assert total == 5
        assert len(consultations) == 5

    def test_list_consultations_by_provider(self, consultation_service, db_session):
        """Test listing consultations filtered by provider."""
        # Create two providers
        provider1 = Provider(id=uuid.uuid4(), name="Provider 1", email="p1@example.com", is_active=True)
        provider2 = Provider(id=uuid.uuid4(), name="Provider 2", email="p2@example.com", is_active=True)
        db_session.add_all([provider1, provider2])
        db_session.commit()

        # Create consultations for each
        for _ in range(3):
            consultation_service.create_consultation(provider_id=str(provider1.id))
        for _ in range(2):
            consultation_service.create_consultation(provider_id=str(provider2.id))

        # Filter by provider1
        consultations, total = consultation_service.list_consultations(
            provider_id=str(provider1.id)
        )

        assert total == 3
        assert all(c.provider_id == provider1.id for c in consultations)

    def test_list_consultations_by_outcome(self, consultation_service, sample_provider, db_session):
        """Test listing consultations filtered by outcome."""
        # Create consultations with different outcomes
        for outcome in ["booked", "declined", "thinking"]:
            for _ in range(2):
                c = consultation_service.create_consultation(provider_id=str(sample_provider.id))
                c.outcome = outcome
                db_session.commit()

        # Filter by outcome
        consultations, total = consultation_service.list_consultations(outcome="booked")

        assert total == 2
        assert all(c.outcome == "booked" for c in consultations)

    def test_list_consultations_pagination(self, consultation_service, sample_provider):
        """Test consultation list pagination."""
        # Create 15 consultations
        for i in range(15):
            consultation_service.create_consultation(provider_id=str(sample_provider.id))

        # Get first page
        consultations_p1, total = consultation_service.list_consultations(limit=5, offset=0)

        assert total == 15
        assert len(consultations_p1) == 5

        # Get second page
        consultations_p2, total = consultation_service.list_consultations(limit=5, offset=5)

        assert total == 15
        assert len(consultations_p2) == 5

        # Ensure no overlap
        ids_p1 = {c.id for c in consultations_p1}
        ids_p2 = {c.id for c in consultations_p2}
        assert len(ids_p1.intersection(ids_p2)) == 0

    def test_get_consultation_by_id(self, consultation_service, sample_provider):
        """Test getting a specific consultation by ID."""
        # Create consultation
        created = consultation_service.create_consultation(provider_id=str(sample_provider.id))

        # Get it back
        retrieved = consultation_service.get_consultation(str(created.id))

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.provider_id == created.provider_id

    def test_get_consultation_nonexistent(self, consultation_service):
        """Test getting a non-existent consultation returns None."""
        fake_id = str(uuid.uuid4())
        consultation = consultation_service.get_consultation(fake_id)

        assert consultation is None

    def test_search_consultations(self, consultation_service, sample_provider, db_session):
        """Test searching consultations by transcript content."""
        # Create consultations with different transcripts
        c1 = consultation_service.create_consultation(provider_id=str(sample_provider.id))
        c1.transcript = "Patient wants Botox for forehead wrinkles"
        c1.ai_summary = "Botox consultation"

        c2 = consultation_service.create_consultation(provider_id=str(sample_provider.id))
        c2.transcript = "Patient interested in dermal fillers"
        c2.ai_summary = "Filler consultation"

        c3 = consultation_service.create_consultation(provider_id=str(sample_provider.id))
        c3.transcript = "General skin care consultation"
        c3.notes = "Patient mentioned Botox as possibility"

        db_session.commit()

        # Search for "Botox"
        results = consultation_service.search_consultations("Botox")

        assert len(results) == 2
        assert c1 in results
        assert c3 in results
        assert c2 not in results

    def test_end_consultation_invalid_id(self, consultation_service):
        """Test ending consultation with invalid ID raises error."""
        with pytest.raises(ValueError, match="not found"):
            consultation_service.end_consultation(
                consultation_id=str(uuid.uuid4()),
                outcome="booked"
            )

    @patch('consultation_service.openai.audio.transcriptions.create')
    def test_transcription_failure_handling(self, mock_openai, consultation_service, tmp_path):
        """Test transcription error handling."""
        # Create a temp audio file
        audio_file = tmp_path / "test.webm"
        audio_file.write_bytes(b"fake audio")

        # Mock OpenAI to raise an exception
        mock_openai.side_effect = Exception("API Error")

        # Should raise exception
        with pytest.raises(Exception, match="API Error"):
            consultation_service.transcribe_audio(str(audio_file))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
