"""
AI Insights service for analyzing consultations and generating coaching recommendations.

Uses GPT-4 to:
- Extract conversation patterns
- Identify successful techniques
- Compare provider performance
- Generate personalized coaching recommendations
"""
from __future__ import annotations

import json
import uuid
import logging
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

import openai

try:
    from backend.database import (
        InPersonConsultation, AIInsight, Provider,
        ProviderPerformanceMetric
    )
    from backend.config import get_settings
except ModuleNotFoundError:
    from database import (
        InPersonConsultation, AIInsight, Provider,
        ProviderPerformanceMetric
    )
    from config import get_settings

settings = get_settings()
openai.api_key = settings.OPENAI_API_KEY

# Configure logging
logger = logging.getLogger(__name__)


class AIInsightsService:
    """Service for generating AI-powered coaching insights."""

    def __init__(self, db: Session):
        self.db = db

    def _call_gpt4_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 3,
        model: str = "gpt-4o"
    ) -> Dict[str, Any]:
        """
        Call GPT-4 API with retry logic and exponential backoff.

        Args:
            system_prompt: System message for GPT-4
            user_prompt: User message/prompt
            max_retries: Maximum number of retry attempts
            model: OpenAI model to use

        Returns:
            Parsed JSON response from GPT-4

        Raises:
            Exception: If all retries fail
        """
        last_exception = None

        for attempt in range(max_retries):
            try:
                logger.info(f"Calling GPT-4 (attempt {attempt + 1}/{max_retries})")

                response = openai.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7
                )

                result = json.loads(response.choices[0].message.content)
                logger.info(f"Successfully received GPT-4 response")
                return result

            except openai.RateLimitError as e:
                last_exception = e
                wait_time = (2 ** attempt) * 5  # Exponential backoff: 5s, 10s, 20s
                logger.warning(f"Rate limit hit, waiting {wait_time}s before retry")
                time.sleep(wait_time)

            except openai.APIError as e:
                last_exception = e
                wait_time = (2 ** attempt) * 2  # Exponential backoff: 2s, 4s, 8s
                logger.warning(f"API error: {str(e)}, retrying in {wait_time}s")
                time.sleep(wait_time)

            except openai.APIConnectionError as e:
                last_exception = e
                wait_time = (2 ** attempt) * 3
                logger.warning(f"Connection error: {str(e)}, retrying in {wait_time}s")
                time.sleep(wait_time)

            except json.JSONDecodeError as e:
                # JSON parsing errors are not retryable
                logger.error(f"Failed to parse GPT-4 response as JSON: {str(e)}")
                raise

            except Exception as e:
                logger.error(f"Unexpected error calling GPT-4: {str(e)}", exc_info=True)
                raise

        # All retries exhausted
        logger.error(f"Failed to call GPT-4 after {max_retries} attempts")
        raise last_exception or Exception("GPT-4 call failed after all retries")

    def analyze_consultation(self, consultation_id: str) -> List[AIInsight]:
        """
        Analyze a single consultation and generate insights.

        Extracts:
        - Conversation techniques used
        - Objection handling approaches
        - Strengths and opportunities
        """
        consultation = self.db.query(InPersonConsultation).filter(
            InPersonConsultation.id == uuid.UUID(consultation_id)
        ).first()

        if not consultation or not consultation.transcript:
            return []

        # Call GPT-4 for analysis
        analysis = self._call_gpt4_consultation_analysis(
            transcript=consultation.transcript,
            outcome=consultation.outcome,
            service_type=consultation.service_type
        )

        # Create insight records
        insights = []
        for insight_data in analysis.get("insights", []):
            insight = AIInsight(
                id=uuid.uuid4(),
                insight_type=insight_data.get("type"),
                provider_id=consultation.provider_id,
                consultation_id=consultation.id,
                title=insight_data.get("title"),
                insight_text=insight_data.get("description"),
                supporting_quote=insight_data.get("quote"),
                recommendation=insight_data.get("recommendation"),
                confidence_score=insight_data.get("confidence", 0.7),
                is_positive=insight_data.get("is_positive", True),
            )
            self.db.add(insight)
            insights.append(insight)

        # Update consultation with AI summary and scores
        if analysis.get("summary"):
            consultation.ai_summary = analysis["summary"]
        if analysis.get("satisfaction_score"):
            consultation.satisfaction_score = analysis["satisfaction_score"]
        if analysis.get("sentiment"):
            consultation.sentiment = analysis["sentiment"]

        self.db.commit()
        return insights

    def _call_gpt4_consultation_analysis(
        self,
        transcript: str,
        outcome: Optional[str] = None,
        service_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call GPT-4 to analyze a consultation transcript."""
        prompt = f"""Analyze this in-person consultation transcript between a med spa provider and customer.

Transcript:
{transcript}

Outcome: {outcome or 'Unknown'}
Service: {service_type or 'General consultation'}

Extract the following in JSON format:
{{
  "summary": "Brief 2-3 sentence summary of the consultation",
  "satisfaction_score": 0-10 score based on customer satisfaction signals,
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "insights": [
    {{
      "type": "strength" | "opportunity" | "objection_handling" | "best_practice",
      "title": "Short title (50 chars max)",
      "description": "Detailed description of the insight",
      "quote": "Exact quote from transcript that supports this insight",
      "recommendation": "Actionable coaching tip if type is 'opportunity'",
      "confidence": 0.0-1.0 confidence score,
      "is_positive": true if strength/best_practice, false if opportunity
    }}
  ]
}}

Focus on:
1. How the provider built rapport and trust
2. How objections (price, safety, results) were handled
3. Closing techniques used
4. Areas for improvement
5. What made this conversation successful or unsuccessful

Return only valid JSON, no additional text."""

        try:
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert sales coach for medical aesthetics. Analyze consultations and provide actionable coaching insights."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7
            )

            result = json.loads(response.choices[0].message.content)
            return result

        except Exception as e:
            print(f"Error calling GPT-4 for consultation analysis: {e}")
            return {
                "summary": "Analysis failed",
                "insights": []
            }

    def compare_providers(
        self,
        target_provider_id: str,
        reference_provider_id: str,
        days: int = 30
    ) -> List[AIInsight]:
        """
        Compare two providers and generate coaching insights.

        Identifies what the high-performer does differently.
        """
        # Get recent consultations for both providers
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        target_consultations = self.db.query(InPersonConsultation).filter(
            and_(
                InPersonConsultation.provider_id == uuid.UUID(target_provider_id),
                InPersonConsultation.created_at >= cutoff_date,
                InPersonConsultation.transcript.isnot(None)
            )
        ).limit(10).all()

        reference_consultations = self.db.query(InPersonConsultation).filter(
            and_(
                InPersonConsultation.provider_id == uuid.UUID(reference_provider_id),
                InPersonConsultation.created_at >= cutoff_date,
                InPersonConsultation.transcript.isnot(None)
            )
        ).limit(10).all()

        if not target_consultations or not reference_consultations:
            return []

        # Call GPT-4 for comparison
        comparison = self._call_gpt4_provider_comparison(
            target_consultations=target_consultations,
            reference_consultations=reference_consultations
        )

        # Create comparison insights
        insights = []
        for insight_data in comparison.get("insights", []):
            insight = AIInsight(
                id=uuid.uuid4(),
                insight_type="comparison",
                provider_id=uuid.UUID(target_provider_id),
                title=insight_data.get("title"),
                insight_text=insight_data.get("description"),
                supporting_quote=insight_data.get("target_quote"),
                recommendation=insight_data.get("recommendation"),
                confidence_score=insight_data.get("confidence", 0.7),
                is_positive=False,  # Comparisons are always improvement opportunities
            )
            self.db.add(insight)
            insights.append(insight)

        self.db.commit()
        return insights

    def _call_gpt4_provider_comparison(
        self,
        target_consultations: List[InPersonConsultation],
        reference_consultations: List[InPersonConsultation]
    ) -> Dict[str, Any]:
        """Call GPT-4 to compare provider techniques."""
        # Calculate conversion rates
        target_booked = sum(1 for c in target_consultations if c.outcome == 'booked')
        target_rate = target_booked / len(target_consultations) * 100 if target_consultations else 0

        ref_booked = sum(1 for c in reference_consultations if c.outcome == 'booked')
        ref_rate = ref_booked / len(reference_consultations) * 100 if reference_consultations else 0

        # Sample transcripts (limit length)
        target_excerpts = "\n\n---\n\n".join([
            c.transcript[:1000] for c in target_consultations[:3] if c.transcript
        ])

        reference_excerpts = "\n\n---\n\n".join([
            c.transcript[:1000] for c in reference_consultations[:3] if c.transcript
        ])

        prompt = f"""Compare these two med spa providers' consultation approaches:

Provider A (High Performer - {ref_rate:.1f}% conversion):
{reference_excerpts}

Provider B (Needs Coaching - {target_rate:.1f}% conversion):
{target_excerpts}

Identify what Provider A does differently and provide specific coaching for Provider B.

Return JSON:
{{
  "insights": [
    {{
      "title": "Specific difference identified",
      "description": "Detailed explanation of what Provider A does differently",
      "target_quote": "Example from Provider B showing the gap",
      "recommendation": "Specific actionable advice for Provider B to adopt Provider A's technique",
      "confidence": 0.0-1.0
    }}
  ]
}}

Focus on:
1. Rapport-building techniques
2. Objection handling
3. Closing strategies
4. Educational approach
5. Emotional intelligence

Return only valid JSON."""

        try:
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert sales coach comparing provider techniques to improve performance."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7
            )

            result = json.loads(response.choices[0].message.content)
            return result

        except Exception as e:
            print(f"Error calling GPT-4 for provider comparison: {e}")
            return {"insights": []}

    def extract_best_practices(self, days: int = 30, limit: int = 10) -> List[AIInsight]:
        """
        Extract best practices from all successful consultations.

        Identifies conversation patterns that correlate with bookings.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get successful consultations (outcome = 'booked')
        successful = self.db.query(InPersonConsultation).filter(
            and_(
                InPersonConsultation.outcome == 'booked',
                InPersonConsultation.created_at >= cutoff_date,
                InPersonConsultation.transcript.isnot(None)
            )
        ).order_by(func.random()).limit(limit).all()

        if not successful:
            return []

        # Call GPT-4 for pattern extraction
        patterns = self._call_gpt4_best_practices(successful)

        # Create best practice insights
        insights = []
        for pattern_data in patterns.get("best_practices", []):
            # Create a general insight (not tied to specific provider)
            insight = AIInsight(
                id=uuid.uuid4(),
                insight_type="best_practice",
                provider_id=None,  # Population-level insight
                title=pattern_data.get("title"),
                insight_text=pattern_data.get("description"),
                supporting_quote=pattern_data.get("example_quote"),
                recommendation=pattern_data.get("how_to_apply"),
                confidence_score=pattern_data.get("confidence", 0.8),
                is_positive=True,
            )
            self.db.add(insight)
            insights.append(insight)

        self.db.commit()
        return insights

    def _call_gpt4_best_practices(
        self,
        consultations: List[InPersonConsultation]
    ) -> Dict[str, Any]:
        """Call GPT-4 to extract best practices from successful consultations."""
        excerpts = "\n\n---\n\n".join([
            f"Consultation (Service: {c.service_type}):\n{c.transcript[:1500]}"
            for c in consultations if c.transcript
        ])

        prompt = f"""Analyze these successful consultation transcripts (all resulted in bookings) and extract common patterns and best practices.

Transcripts:
{excerpts}

Identify recurring successful techniques across these conversations.

Return JSON:
{{
  "best_practices": [
    {{
      "title": "Name of technique/pattern",
      "description": "Detailed explanation of why this works",
      "example_quote": "A great example from the transcripts",
      "how_to_apply": "Step-by-step guide for providers to use this technique",
      "confidence": 0.0-1.0 (how often this pattern appears)
    }}
  ]
}}

Focus on finding:
1. Common opening approaches
2. Effective objection handling phrases
3. Trust-building techniques
4. Closing strategies
5. Educational explanations that resonate

Return only valid JSON."""

        try:
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert sales analyst identifying patterns in successful consultations."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7
            )

            result = json.loads(response.choices[0].message.content)
            return result

        except Exception as e:
            print(f"Error calling GPT-4 for best practices: {e}")
            return {"best_practices": []}

    def get_provider_insights(
        self,
        provider_id: str,
        insight_type: Optional[str] = None,
        is_positive: Optional[bool] = None,
        limit: int = 50
    ) -> List[AIInsight]:
        """Get AI insights for a specific provider."""
        query = self.db.query(AIInsight).filter(
            AIInsight.provider_id == uuid.UUID(provider_id)
        )

        if insight_type:
            query = query.filter(AIInsight.insight_type == insight_type)
        if is_positive is not None:
            query = query.filter(AIInsight.is_positive == is_positive)

        return query.order_by(
            AIInsight.created_at.desc()
        ).limit(limit).all()

    def mark_insight_reviewed(self, insight_id: str) -> AIInsight:
        """Mark an insight as reviewed."""
        insight = self.db.query(AIInsight).filter(
            AIInsight.id == uuid.UUID(insight_id)
        ).first()

        if insight:
            insight.is_reviewed = True
            insight.reviewed_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(insight)

        return insight
