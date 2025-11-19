"""
Campaign management and execution service.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from analytics import AnalyticsService
from database import (
    CommunicationMessage,
    Conversation,
    Customer,
    EmailDetails,
    ResearchCampaign,
    SMSDetails,
    VoiceCallDetails,
)

from .agent_templates import AgentTemplates
from .segmentation_service import SegmentationService


class CampaignService:
    """Service for managing research and outbound campaigns."""

    @staticmethod
    def create_campaign(
        db: Session,
        name: str,
        campaign_type: str,
        segment_criteria: Dict[str, Any],
        agent_config: Dict[str, Any],
        channel: str,
        created_by: Optional[str] = None,
    ) -> ResearchCampaign:
        """
        Create a new campaign.

        Args:
            db: Database session
            name: Campaign name
            campaign_type: 'research' or 'outbound_sales'
            segment_criteria: Customer segmentation criteria
            agent_config: AI agent configuration
            channel: Communication channel (sms, email, voice, multi)
            created_by: Optional admin user identifier

        Returns:
            Created ResearchCampaign object
        """
        # Validate agent config
        is_valid, errors = AgentTemplates.validate_agent_config(agent_config)
        if not is_valid:
            raise ValueError(f"Invalid agent configuration: {', '.join(errors)}")

        # Preview segment to get initial count
        preview = SegmentationService.preview_segment(db, segment_criteria)
        total_targeted = preview["total_count"]

        campaign = ResearchCampaign(
            id=uuid.uuid4(),
            name=name,
            campaign_type=campaign_type,
            segment_criteria=segment_criteria,
            agent_config=agent_config,
            channel=channel,
            status="draft",
            total_targeted=total_targeted,
            total_contacted=0,
            total_responded=0,
            created_by=created_by,
        )

        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def update_campaign(
        db: Session, campaign_id: str, updates: Dict[str, Any]
    ) -> ResearchCampaign:
        """
        Update campaign details.

        Args:
            db: Database session
            campaign_id: Campaign UUID
            updates: Dictionary of fields to update

        Returns:
            Updated ResearchCampaign object
        """
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        # Don't allow editing active or completed campaigns
        if campaign.status in ["active", "completed"]:
            raise ValueError(f"Cannot edit {campaign.status} campaign")

        # Update allowed fields
        allowed_fields = ["name", "segment_criteria", "agent_config", "channel"]
        for field in allowed_fields:
            if field in updates:
                setattr(campaign, field, updates[field])

        # Re-calculate targeted count if segment criteria changed
        if "segment_criteria" in updates:
            preview = SegmentationService.preview_segment(
                db, updates["segment_criteria"]
            )
            campaign.total_targeted = preview["total_count"]

        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def launch_campaign(db: Session, campaign_id: str) -> ResearchCampaign:
        """
        Launch a campaign (change status to active and queue outreach).

        Args:
            db: Database session
            campaign_id: Campaign UUID

        Returns:
            Updated ResearchCampaign object
        """
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        if campaign.status != "draft":
            raise ValueError(
                f"Can only launch draft campaigns. Current status: {campaign.status}"
            )

        # Update campaign status
        campaign.status = "active"
        campaign.launched_at = datetime.utcnow()
        db.commit()
        db.refresh(campaign)

        return campaign

    @staticmethod
    def pause_campaign(db: Session, campaign_id: str) -> ResearchCampaign:
        """Pause an active campaign."""
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        if campaign.status != "active":
            raise ValueError(f"Can only pause active campaigns")

        campaign.status = "paused"
        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def resume_campaign(db: Session, campaign_id: str) -> ResearchCampaign:
        """Resume a paused campaign."""
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        if campaign.status != "paused":
            raise ValueError(f"Can only resume paused campaigns")

        campaign.status = "active"
        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def complete_campaign(db: Session, campaign_id: str) -> ResearchCampaign:
        """Mark a campaign as completed."""
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        campaign.status = "completed"
        campaign.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def delete_campaign(db: Session, campaign_id: str) -> bool:
        """Delete a campaign (only if draft or completed)."""
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            return False

        if campaign.status in ["active", "paused"]:
            raise ValueError(
                "Cannot delete active or paused campaigns. Complete or cancel them first."
            )

        db.delete(campaign)
        db.commit()
        return True

    @staticmethod
    def get_campaign(db: Session, campaign_id: str) -> Optional[ResearchCampaign]:
        """Get a single campaign with details."""
        return (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

    @staticmethod
    def list_campaigns(
        db: Session,
        status: Optional[str] = None,
        campaign_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List campaigns with filtering and pagination.

        Args:
            db: Database session
            status: Optional status filter
            campaign_type: Optional type filter
            limit: Results per page
            offset: Pagination offset

        Returns:
            Dictionary with campaigns and pagination info
        """
        query = db.query(ResearchCampaign)

        if status:
            query = query.filter(ResearchCampaign.status == status)

        if campaign_type:
            query = query.filter(ResearchCampaign.campaign_type == campaign_type)

        total = query.count()

        campaigns = (
            query.order_by(ResearchCampaign.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        return {
            "campaigns": campaigns,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def get_campaign_stats(db: Session, campaign_id: str) -> Dict[str, Any]:
        """
        Get detailed statistics for a campaign.

        Args:
            db: Database session
            campaign_id: Campaign UUID

        Returns:
            Dictionary with campaign statistics
        """
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == uuid.UUID(campaign_id))
            .first()
        )

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        # Get all conversations for this campaign
        conversations = (
            db.query(Conversation)
            .filter(Conversation.campaign_id == uuid.UUID(campaign_id))
            .all()
        )

        # Calculate metrics
        total_conversations = len(conversations)
        completed_conversations = len(
            [c for c in conversations if c.status == "completed"]
        )

        # Response rate (customers who engaged beyond initial message)
        responded = 0
        for conv in conversations:
            msg_count = (
                db.query(CommunicationMessage)
                .filter(
                    CommunicationMessage.conversation_id == conv.id,
                    CommunicationMessage.direction == "inbound",
                )
                .count()
            )
            if msg_count > 0:  # Customer responded at least once
                responded += 1

        # Calculate average satisfaction score
        scores = [c.satisfaction_score for c in conversations if c.satisfaction_score]
        avg_satisfaction = sum(scores) / len(scores) if scores else None

        # Sentiment distribution
        sentiments = {}
        for conv in conversations:
            if conv.sentiment:
                sentiments[conv.sentiment] = sentiments.get(conv.sentiment, 0) + 1

        # Outcome distribution
        outcomes = {}
        for conv in conversations:
            if conv.outcome:
                outcomes[conv.outcome] = outcomes.get(conv.outcome, 0) + 1

        # Channel-specific metrics
        channel_breakdown = {}
        for conv in conversations:
            channel = conv.channel
            if channel not in channel_breakdown:
                channel_breakdown[channel] = {
                    "total": 0,
                    "completed": 0,
                    "responded": 0,
                }
            channel_breakdown[channel]["total"] += 1
            if conv.status == "completed":
                channel_breakdown[channel]["completed"] += 1

            # Check if customer responded
            msg_count = (
                db.query(CommunicationMessage)
                .filter(
                    CommunicationMessage.conversation_id == conv.id,
                    CommunicationMessage.direction == "inbound",
                )
                .count()
            )
            if msg_count > 0:
                channel_breakdown[channel]["responded"] += 1

        return {
            "campaign_id": str(campaign.id),
            "campaign_name": campaign.name,
            "campaign_type": campaign.campaign_type,
            "status": campaign.status,
            "total_targeted": campaign.total_targeted,
            "total_contacted": total_conversations,
            "total_responded": responded,
            "completion_rate": (
                (completed_conversations / total_conversations * 100)
                if total_conversations > 0
                else 0
            ),
            "response_rate": (
                (responded / total_conversations * 100)
                if total_conversations > 0
                else 0
            ),
            "avg_satisfaction_score": (
                round(avg_satisfaction, 2) if avg_satisfaction else None
            ),
            "sentiment_distribution": sentiments,
            "outcome_distribution": outcomes,
            "channel_breakdown": channel_breakdown,
            "launched_at": (
                campaign.launched_at.isoformat() if campaign.launched_at else None
            ),
            "completed_at": (
                campaign.completed_at.isoformat() if campaign.completed_at else None
            ),
        }

    @staticmethod
    def get_campaign_conversations(
        db: Session, campaign_id: str, limit: int = 50, offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get conversations for a campaign.

        Args:
            db: Database session
            campaign_id: Campaign UUID
            limit: Results per page
            offset: Pagination offset

        Returns:
            Dictionary with conversations and pagination
        """
        query = (
            db.query(Conversation)
            .filter(Conversation.campaign_id == uuid.UUID(campaign_id))
            .options(joinedload(Conversation.customer))
        )

        total = query.count()

        conversations = (
            query.order_by(Conversation.initiated_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        return {
            "conversations": [
                {
                    "id": str(conv.id),
                    "customer_id": conv.customer_id,
                    "customer_name": conv.customer.name if conv.customer else None,
                    "customer_phone": conv.customer.phone if conv.customer else None,
                    "channel": conv.channel,
                    "status": conv.status,
                    "initiated_at": (
                        conv.initiated_at.isoformat() if conv.initiated_at else None
                    ),
                    "last_activity_at": (
                        conv.last_activity_at.isoformat()
                        if conv.last_activity_at
                        else None
                    ),
                    "satisfaction_score": conv.satisfaction_score,
                    "sentiment": conv.sentiment,
                    "outcome": conv.outcome,
                    "ai_summary": conv.ai_summary,
                }
                for conv in conversations
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def increment_contacted_count(db: Session, campaign_id: uuid.UUID):
        """Increment the total_contacted counter for a campaign."""
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == campaign_id)
            .first()
        )
        if campaign:
            campaign.total_contacted += 1
            db.commit()

    @staticmethod
    def increment_responded_count(db: Session, campaign_id: uuid.UUID):
        """Increment the total_responded counter for a campaign."""
        campaign = (
            db.query(ResearchCampaign)
            .filter(ResearchCampaign.id == campaign_id)
            .first()
        )
        if campaign:
            campaign.total_responded += 1
            db.commit()
