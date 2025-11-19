"""
Tests for AI insights service.

Test coverage:
- Analyzing individual consultations with GPT-4
- Comparing providers (high performer vs needs coaching)
- Extracting best practices from successful consultations
- Filtering and retrieving insights
- Marking insights as reviewed
- Error handling for OpenAI API failures
"""
import pytest
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).resolve().parents[1]
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from ai_insights_service import AIInsightsService
from database import (
    Provider, InPersonConsultation, AIInsight, SessionLocal, Base, engine
)


@pytest.fixture
def db_session():
    """Create a test database session."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def ai_service(db_session):
    """Create AI insights service instance."""
    return AIInsightsService(db_session)


@pytest.fixture
def sample_provider(db_session):
    """Create a sample provider."""
    provider = Provider(
        id=uuid.uuid4(),
        name="Test Provider",
        email="provider@example.com",
        specialties=["Botox", "Fillers"],
        is_active=True
    )
    db_session.add(provider)
    db_session.commit()
    db_session.refresh(provider)
    return provider


@pytest.fixture
def sample_consultation(db_session, sample_provider):
    """Create a sample consultation with transcript."""
    consultation = InPersonConsultation(
        id=uuid.uuid4(),
        provider_id=sample_provider.id,
        service_type="Botox",
        outcome="booked",
        transcript="""
        Provider: Hi! Welcome to our med spa. What brings you in today?
        Customer: I'm interested in Botox for my forehead wrinkles.
        Provider: Great choice! Let me explain how Botox works and what results you can expect.
        Customer: I'm a bit worried about looking frozen.
        Provider: That's a very common concern. We use a natural approach that preserves your expressions.
        Customer: That sounds good. I'd like to book an appointment.
        """,
        created_at=datetime.utcnow()
    )
    db_session.add(consultation)
    db_session.commit()
    db_session.refresh(consultation)
    return consultation


class TestAIInsightsService:
    """Test suite for AIInsightsService."""

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_analyze_consultation_success(self, mock_openai, ai_service, sample_consultation):
        """Test successful consultation analysis."""
        # Mock GPT-4 response
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "summary": "Successful Botox consultation with effective objection handling",
                        "satisfaction_score": 9.0,
                        "sentiment": "positive",
                        "insights": [
                            {
                                "type": "strength",
                                "title": "Natural Approach Reassurance",
                                "description": "Provider effectively addressed frozen face concern",
                                "quote": "We use a natural approach that preserves your expressions",
                                "recommendation": None,
                                "confidence": 0.9,
                                "is_positive": True
                            },
                            {
                                "type": "best_practice",
                                "title": "Educational Explanation",
                                "description": "Provider explained treatment before addressing concerns",
                                "quote": "Let me explain how Botox works",
                                "recommendation": "Continue this educational approach",
                                "confidence": 0.85,
                                "is_positive": True
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        # Analyze consultation
        insights = ai_service.analyze_consultation(str(sample_consultation.id))

        # Verify results
        assert len(insights) == 2
        assert insights[0].insight_type == "strength"
        assert insights[0].title == "Natural Approach Reassurance"
        assert insights[0].is_positive is True
        assert insights[0].provider_id == sample_consultation.provider_id
        assert insights[0].consultation_id == sample_consultation.id

        # Verify consultation was updated
        ai_service.db.refresh(sample_consultation)
        assert sample_consultation.ai_summary == "Successful Botox consultation with effective objection handling"
        assert sample_consultation.satisfaction_score == 9.0
        assert sample_consultation.sentiment == "positive"

        # Verify OpenAI was called correctly
        assert mock_openai.called
        call_args = mock_openai.call_args
        assert call_args.kwargs["model"] == "gpt-4o"
        assert call_args.kwargs["response_format"] == {"type": "json_object"}

    def test_analyze_consultation_no_transcript(self, ai_service, db_session, sample_provider):
        """Test analyzing consultation without transcript returns empty list."""
        consultation = InPersonConsultation(
            id=uuid.uuid4(),
            provider_id=sample_provider.id,
            outcome="booked",
            transcript=None  # No transcript
        )
        db_session.add(consultation)
        db_session.commit()

        insights = ai_service.analyze_consultation(str(consultation.id))

        assert insights == []

    def test_analyze_consultation_nonexistent(self, ai_service):
        """Test analyzing non-existent consultation returns empty list."""
        fake_id = str(uuid.uuid4())
        insights = ai_service.analyze_consultation(fake_id)

        assert insights == []

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_analyze_consultation_openai_error(self, mock_openai, ai_service, sample_consultation):
        """Test handling of OpenAI API errors."""
        # Mock API error
        mock_openai.side_effect = Exception("API rate limit exceeded")

        insights = ai_service.analyze_consultation(str(sample_consultation.id))

        # Should return empty list but not crash
        assert insights == []

        # Consultation should still exist
        ai_service.db.refresh(sample_consultation)
        assert sample_consultation.id is not None

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_compare_providers(self, mock_openai, ai_service, db_session):
        """Test comparing two providers."""
        # Create two providers
        high_performer = Provider(
            id=uuid.uuid4(),
            name="High Performer",
            email="high@example.com",
            is_active=True
        )
        needs_coaching = Provider(
            id=uuid.uuid4(),
            name="Needs Coaching",
            email="coaching@example.com",
            is_active=True
        )
        db_session.add_all([high_performer, needs_coaching])
        db_session.commit()

        # Create consultations for high performer (all booked)
        for i in range(5):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=high_performer.id,
                outcome="booked",
                transcript="Great consultation with confident closing technique.",
                created_at=datetime.utcnow()
            )
            db_session.add(consultation)

        # Create consultations for needs coaching (mixed outcomes)
        for i in range(5):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=needs_coaching.id,
                outcome="booked" if i < 2 else "declined",
                transcript="Consultation with some hesitation in closing.",
                created_at=datetime.utcnow()
            )
            db_session.add(consultation)

        db_session.commit()

        # Mock GPT-4 comparison response
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "insights": [
                            {
                                "title": "Confident Closing Technique",
                                "description": "High performer uses assumptive close vs asking if customer wants to book",
                                "target_quote": "Would you like to schedule?",
                                "recommendation": "Use assumptive language: 'Let's get you scheduled' instead of asking",
                                "confidence": 0.85
                            },
                            {
                                "title": "Price Discussion Timing",
                                "description": "High performer discusses value before price",
                                "target_quote": "How much does this cost?",
                                "recommendation": "Establish value and results before discussing investment",
                                "confidence": 0.8
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        # Compare providers
        insights = ai_service.compare_providers(
            target_provider_id=str(needs_coaching.id),
            reference_provider_id=str(high_performer.id),
            days=30
        )

        # Verify results
        assert len(insights) == 2
        assert insights[0].insight_type == "comparison"
        assert insights[0].provider_id == needs_coaching.id
        assert insights[0].is_positive is False  # Comparisons are improvement opportunities
        assert "assumptive" in insights[0].recommendation.lower()

        # Verify GPT-4 was called with conversion rate context
        call_args = mock_openai.call_args
        prompt = call_args.kwargs["messages"][1]["content"]
        assert "conversion" in prompt.lower()
        assert "High Performer" in prompt

    def test_compare_providers_no_consultations(self, ai_service, db_session):
        """Test comparing providers when one has no consultations."""
        provider1 = Provider(id=uuid.uuid4(), name="Provider 1", email="p1@example.com", is_active=True)
        provider2 = Provider(id=uuid.uuid4(), name="Provider 2", email="p2@example.com", is_active=True)
        db_session.add_all([provider1, provider2])
        db_session.commit()

        # No consultations created
        insights = ai_service.compare_providers(
            target_provider_id=str(provider1.id),
            reference_provider_id=str(provider2.id)
        )

        assert insights == []

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_extract_best_practices(self, mock_openai, ai_service, db_session, sample_provider):
        """Test extracting best practices from successful consultations."""
        # Create multiple successful consultations
        for i in range(10):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=sample_provider.id,
                service_type=["Botox", "Fillers"][i % 2],
                outcome="booked",
                transcript=f"Successful consultation {i} with effective rapport building.",
                created_at=datetime.utcnow()
            )
            db_session.add(consultation)

        db_session.commit()

        # Mock GPT-4 best practices response
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "best_practices": [
                            {
                                "title": "Start with Open Questions",
                                "description": "Successful providers always ask 'What brings you in today?' to understand goals",
                                "example_quote": "What are your main concerns you'd like to address?",
                                "how_to_apply": "1. Start with open question 2. Listen actively 3. Reflect back their goals",
                                "confidence": 0.95
                            },
                            {
                                "title": "Address Objections Proactively",
                                "description": "High performers bring up common concerns before customers do",
                                "example_quote": "A common question is about naturalness...",
                                "how_to_apply": "List 3 common objections and address them during education phase",
                                "confidence": 0.88
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        # Extract best practices
        insights = ai_service.extract_best_practices(days=30, limit=10)

        # Verify results
        assert len(insights) == 2
        assert insights[0].insight_type == "best_practice"
        assert insights[0].provider_id is None  # Population-level insight
        assert insights[0].is_positive is True
        assert "Open Questions" in insights[0].title
        assert insights[0].confidence_score == 0.95

        # Verify GPT-4 was called
        assert mock_openai.called

    def test_extract_best_practices_no_successful_consultations(self, ai_service, db_session, sample_provider):
        """Test extracting best practices when no successful consultations exist."""
        # Create only declined consultations
        for i in range(5):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=sample_provider.id,
                outcome="declined",
                transcript="Consultation that didn't convert.",
                created_at=datetime.utcnow()
            )
            db_session.add(consultation)

        db_session.commit()

        insights = ai_service.extract_best_practices(days=30)

        assert insights == []

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_get_provider_insights_no_filters(self, mock_openai, ai_service, sample_consultation):
        """Test getting all insights for a provider without filters."""
        # First create some insights
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "summary": "Test summary",
                        "satisfaction_score": 8.0,
                        "sentiment": "positive",
                        "insights": [
                            {
                                "type": "strength",
                                "title": "Strength 1",
                                "description": "Good technique",
                                "quote": "Quote 1",
                                "recommendation": None,
                                "confidence": 0.9,
                                "is_positive": True
                            },
                            {
                                "type": "opportunity",
                                "title": "Opportunity 1",
                                "description": "Area to improve",
                                "quote": "Quote 2",
                                "recommendation": "Do this better",
                                "confidence": 0.8,
                                "is_positive": False
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        ai_service.analyze_consultation(str(sample_consultation.id))

        # Get all insights
        insights = ai_service.get_provider_insights(
            provider_id=str(sample_consultation.provider_id)
        )

        assert len(insights) == 2
        assert any(i.insight_type == "strength" for i in insights)
        assert any(i.insight_type == "opportunity" for i in insights)

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_get_provider_insights_filter_by_type(self, mock_openai, ai_service, sample_consultation):
        """Test filtering insights by type."""
        # Create insights
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "summary": "Test",
                        "satisfaction_score": 8.0,
                        "sentiment": "positive",
                        "insights": [
                            {
                                "type": "strength",
                                "title": "Strength",
                                "description": "Good",
                                "quote": "Q1",
                                "recommendation": None,
                                "confidence": 0.9,
                                "is_positive": True
                            },
                            {
                                "type": "opportunity",
                                "title": "Opportunity",
                                "description": "Improve",
                                "quote": "Q2",
                                "recommendation": "Fix",
                                "confidence": 0.8,
                                "is_positive": False
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        ai_service.analyze_consultation(str(sample_consultation.id))

        # Filter by strength type only
        strengths = ai_service.get_provider_insights(
            provider_id=str(sample_consultation.provider_id),
            insight_type="strength"
        )

        assert len(strengths) == 1
        assert strengths[0].insight_type == "strength"

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_get_provider_insights_filter_by_positive(self, mock_openai, ai_service, sample_consultation):
        """Test filtering insights by is_positive flag."""
        # Create insights
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "summary": "Test",
                        "satisfaction_score": 8.0,
                        "sentiment": "positive",
                        "insights": [
                            {
                                "type": "strength",
                                "title": "Strength",
                                "description": "Good",
                                "quote": "Q1",
                                "recommendation": None,
                                "confidence": 0.9,
                                "is_positive": True
                            },
                            {
                                "type": "opportunity",
                                "title": "Opportunity",
                                "description": "Improve",
                                "quote": "Q2",
                                "recommendation": "Fix",
                                "confidence": 0.8,
                                "is_positive": False
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        ai_service.analyze_consultation(str(sample_consultation.id))

        # Filter by positive only
        positive_insights = ai_service.get_provider_insights(
            provider_id=str(sample_consultation.provider_id),
            is_positive=True
        )

        assert len(positive_insights) == 1
        assert positive_insights[0].is_positive is True

        # Filter by negative only
        negative_insights = ai_service.get_provider_insights(
            provider_id=str(sample_consultation.provider_id),
            is_positive=False
        )

        assert len(negative_insights) == 1
        assert negative_insights[0].is_positive is False

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_mark_insight_reviewed(self, mock_openai, ai_service, sample_consultation):
        """Test marking an insight as reviewed."""
        # Create insights
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "summary": "Test",
                        "satisfaction_score": 8.0,
                        "sentiment": "positive",
                        "insights": [
                            {
                                "type": "strength",
                                "title": "Strength",
                                "description": "Good",
                                "quote": "Q1",
                                "recommendation": None,
                                "confidence": 0.9,
                                "is_positive": True
                            }
                        ]
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        insights = ai_service.analyze_consultation(str(sample_consultation.id))
        insight = insights[0]

        # Initially not reviewed
        assert insight.is_reviewed is False
        assert insight.reviewed_at is None

        # Mark as reviewed
        reviewed = ai_service.mark_insight_reviewed(str(insight.id))

        assert reviewed.is_reviewed is True
        assert reviewed.reviewed_at is not None
        assert isinstance(reviewed.reviewed_at, datetime)

    def test_mark_insight_reviewed_nonexistent(self, ai_service):
        """Test marking non-existent insight returns None."""
        fake_id = str(uuid.uuid4())
        result = ai_service.mark_insight_reviewed(fake_id)

        assert result is None

    @patch('ai_insights_service.openai.chat.completions.create')
    def test_gpt4_prompt_includes_context(self, mock_openai, ai_service, sample_consultation):
        """Test that GPT-4 prompts include proper context."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "summary": "Test",
                        "satisfaction_score": 8.0,
                        "sentiment": "positive",
                        "insights": []
                    })
                )
            )
        ]
        mock_openai.return_value = mock_response

        ai_service.analyze_consultation(str(sample_consultation.id))

        # Verify GPT-4 was called with proper context
        call_args = mock_openai.call_args
        user_message = call_args.kwargs["messages"][1]["content"]

        # Should include transcript
        assert sample_consultation.transcript in user_message
        # Should include outcome
        assert sample_consultation.outcome in user_message
        # Should include service type
        assert sample_consultation.service_type in user_message
        # Should have structured JSON instructions
        assert "JSON" in user_message


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
