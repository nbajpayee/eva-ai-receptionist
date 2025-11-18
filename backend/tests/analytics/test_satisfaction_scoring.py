"""
Tests for AI analytics and satisfaction scoring.

These tests verify:
- Satisfaction score calculation
- Sentiment detection
- Outcome classification
- GPT-4 integration
"""

from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import Mock, patch

import pytest

from analytics import AnalyticsService
from database import Conversation


@pytest.mark.integration
@pytest.mark.slow
class TestSatisfactionScoring:
    """Test AI-powered satisfaction scoring."""

    @patch("analytics.openai_client.chat.completions.create")
    def test_satisfaction_score_positive(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test positive satisfaction scoring."""
        # Add positive transcript
        AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="Thank you so much! The appointment was perfect.",
            metadata={"source": "voice_transcript"},
        )

        # Mock GPT-4 response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 9,
                "sentiment": "positive",
                "outcome": "booked",
                "summary": "Customer very satisfied with booking process",
            }
        )
        mock_openai.return_value = mock_response

        # Score conversation
        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        assert result.get("satisfaction_score") >= 8
        assert result.get("sentiment") == "positive"

    @patch("analytics.openai_client.chat.completions.create")
    def test_satisfaction_score_negative(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test negative satisfaction scoring."""
        import json

        # Add negative transcript
        AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="This is frustrating. I can't get an appointment.",
            metadata={"source": "voice_transcript"},
        )

        # Mock GPT-4 response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 3,
                "sentiment": "negative",
                "outcome": "abandoned",
                "summary": "Customer frustrated, unable to book",
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        assert result.get("satisfaction_score") <= 5
        assert result.get("sentiment") == "negative"

    @patch("analytics.openai_client.chat.completions.create")
    def test_satisfaction_score_neutral(
        self, mock_openai, db_session, sms_conversation
    ):
        """Test neutral satisfaction scoring."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="What are your hours?",
            metadata={"source": "sms"},
        )

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="outbound",
            content="We're open 9am-6pm Monday-Friday.",
            metadata={"source": "ai_response"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 6,
                "sentiment": "neutral",
                "outcome": "info_only",
                "summary": "Simple inquiry, no booking",
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=sms_conversation.id,
        )

        assert 5 <= result.get("satisfaction_score", 0) <= 7
        assert result.get("sentiment") == "neutral"

    @patch("analytics.openai_client.chat.completions.create")
    def test_sentiment_detection_frustrated(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test detection of customer frustration."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="I've been waiting for 10 minutes! This is ridiculous.",
            metadata={"source": "voice_transcript"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 2,
                "sentiment": "frustrated",
                "outcome": "escalated",
                "frustration_indicators": ["waiting", "ridiculous"],
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        sentiment = result.get("sentiment", "").lower()
        assert "frustrat" in sentiment or "negative" in sentiment

    @patch("analytics.openai_client.chat.completions.create")
    def test_sentiment_detection_happy(self, mock_openai, db_session, sms_conversation):
        """Test detection of happy customer."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="Perfect! You've been so helpful!",
            metadata={"source": "sms"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 10,
                "sentiment": "very_positive",
                "outcome": "booked",
                "positive_indicators": ["perfect", "helpful"],
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=sms_conversation.id,
        )

        assert result.get("satisfaction_score") >= 9
        assert "positive" in result.get("sentiment", "").lower()

    @patch("analytics.openai_client.chat.completions.create")
    def test_sentiment_mixed_emotions(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test detection of mixed emotions."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="I'm frustrated with the wait, but you've been very helpful.",
            metadata={"source": "voice_transcript"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 7,
                "sentiment": "mixed",
                "outcome": "resolved",
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        assert result.get("sentiment") == "mixed"

    @patch("analytics.openai_client.chat.completions.create")
    def test_outcome_detection_booked(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test detection of successful booking outcome."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="outbound",
            content="Your Botox appointment is confirmed for tomorrow at 2 PM.",
            metadata={"source": "ai_response"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 9,
                "sentiment": "positive",
                "outcome": "booked",
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        assert result.get("outcome") == "booked"

    @patch("analytics.openai_client.chat.completions.create")
    def test_outcome_detection_info_only(
        self, mock_openai, db_session, sms_conversation
    ):
        """Test detection of information-only outcome."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="How much does Botox cost?",
            metadata={"source": "sms"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 7,
                "sentiment": "neutral",
                "outcome": "info_only",
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=sms_conversation.id,
        )

        assert result.get("outcome") == "info_only"

    @patch("analytics.openai_client.chat.completions.create")
    def test_outcome_detection_escalated(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test detection of escalation outcome."""
        import json

        AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="I need to speak with a manager immediately.",
            metadata={"source": "voice_transcript"},
        )

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 4,
                "sentiment": "negative",
                "outcome": "escalated",
            }
        )
        mock_openai.return_value = mock_response

        result = AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        assert result.get("outcome") == "escalated"

    @patch("analytics.openai_client.chat.completions.create")
    def test_gpt4_satisfaction_call_count(
        self, mock_openai, db_session, voice_conversation
    ):
        """Test GPT-4 is called exactly once per scoring."""
        import json

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "satisfaction_score": 8,
                "sentiment": "positive",
                "outcome": "booked",
            }
        )
        mock_openai.return_value = mock_response

        AnalyticsService.score_conversation_satisfaction(
            db=db_session,
            conversation_id=voice_conversation.id,
        )

        # Should call GPT-4 exactly once
        assert mock_openai.call_count == 1
