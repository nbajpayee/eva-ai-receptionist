"""
Outbound execution service for research and sales campaigns.
Orchestrates multi-channel outreach to customers.
"""
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID
import uuid

from sqlalchemy.orm import Session

from database import (
    ResearchCampaign, Customer, Conversation,
    CommunicationMessage, SMSDetails, EmailDetails, VoiceCallDetails
)
from analytics import AnalyticsService
from messaging_service import MessagingService
from config import get_settings
from .agent_templates import AgentTemplates
from .campaign_service import CampaignService
from .segmentation_service import SegmentationService

logger = logging.getLogger(__name__)
settings = get_settings()


class OutboundService:
    """Service for executing outbound campaigns across multiple channels."""

    def __init__(self, db_session_factory):
        """
        Initialize outbound service.

        Args:
            db_session_factory: Factory function to create database sessions
        """
        self._db_session_factory = db_session_factory
        self.messaging_service = MessagingService(
            db_session_factory=db_session_factory
        )

    def execute_campaign(
        self,
        db: Session,
        campaign_id: UUID,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute a campaign by sending outbound communications to segment.

        Args:
            db: Database session
            campaign_id: Campaign UUID
            limit: Optional limit on number of customers to contact (for testing)

        Returns:
            Dictionary with execution results
        """
        # Get campaign
        campaign = db.query(ResearchCampaign).filter(
            ResearchCampaign.id == campaign_id
        ).first()

        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        if campaign.status != "active":
            raise ValueError(f"Can only execute active campaigns. Current status: {campaign.status}")

        # Get customers in segment
        customers = SegmentationService.execute_segment(
            db=db,
            criteria=campaign.segment_criteria,
            limit=limit
        )

        logger.info(f"Executing campaign {campaign.id} for {len(customers)} customers")

        # Execute outbound for each customer
        results = {
            "campaign_id": str(campaign_id),
            "total_customers": len(customers),
            "successful": 0,
            "failed": 0,
            "errors": []
        }

        for customer in customers:
            try:
                # Execute based on channel
                if campaign.channel == "sms":
                    self._execute_sms_outbound(db, campaign, customer)
                elif campaign.channel == "email":
                    self._execute_email_outbound(db, campaign, customer)
                elif campaign.channel == "voice":
                    self._execute_voice_outbound(db, campaign, customer)
                elif campaign.channel == "multi":
                    # Try channels in order: SMS -> Email -> Voice
                    if customer.phone:
                        self._execute_sms_outbound(db, campaign, customer)
                    elif customer.email:
                        self._execute_email_outbound(db, campaign, customer)
                    else:
                        logger.warning(f"Customer {customer.id} has no contact info for multi-channel")
                        continue

                results["successful"] += 1

                # Update campaign contacted count
                CampaignService.increment_contacted_count(db, campaign_id)

            except Exception as e:
                logger.error(f"Failed to contact customer {customer.id}: {e}", exc_info=True)
                results["failed"] += 1
                results["errors"].append({
                    "customer_id": customer.id,
                    "error": str(e)
                })

        return results

    def _execute_sms_outbound(
        self,
        db: Session,
        campaign: ResearchCampaign,
        customer: Customer
    ):
        """Execute SMS outbound for a customer."""
        if not customer.phone:
            raise ValueError(f"Customer {customer.id} has no phone number")

        # Always create NEW conversation for campaign outbound
        # Don't reuse existing conversations - each campaign gets its own thread
        conversation = MessagingService.create_conversation(
            db=db,
            customer_id=customer.id,
            channel="sms",
            metadata={
                "campaign_id": str(campaign.id),
                "campaign_type": campaign.campaign_type
            }
        )

        # Link to campaign
        conversation.campaign_id = campaign.id
        conversation.conversation_type = campaign.campaign_type
        db.commit()
        db.refresh(conversation)

        # Format initial message from agent config
        initial_message = self._format_initial_message(campaign, customer)

        # Send SMS via Twilio (using existing infrastructure)
        # For now, just add the outbound message to conversation
        # In production, this would call Twilio API
        outbound_msg = MessagingService.add_assistant_message(
            db=db,
            conversation=conversation,
            content=initial_message,
            metadata={}
        )

        # Add SMS details
        AnalyticsService.add_sms_details(
            db=db,
            message_id=outbound_msg.id,
            from_number=settings.MED_SPA_PHONE,
            to_number=customer.phone,
            provider_message_id=f"outbound_{uuid.uuid4()}",
            delivery_status="sent"
        )

        logger.info(f"Sent SMS to {customer.name} ({customer.phone}) for campaign {campaign.id}")

        # TODO: In production, integrate with Twilio:
        # from twilio.rest import Client
        # client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # message = client.messages.create(
        #     body=initial_message,
        #     from_=settings.MED_SPA_PHONE,
        #     to=customer.phone
        # )

    def _execute_email_outbound(
        self,
        db: Session,
        campaign: ResearchCampaign,
        customer: Customer
    ):
        """Execute email outbound for a customer."""
        if not customer.email:
            raise ValueError(f"Customer {customer.id} has no email")

        # Always create NEW conversation for campaign outbound
        # Don't reuse existing conversations - each campaign gets its own thread
        conversation = MessagingService.create_conversation(
            db=db,
            customer_id=customer.id,
            channel="email",
            subject=f"{campaign.name} - {settings.MED_SPA_NAME}",
            metadata={
                "campaign_id": str(campaign.id),
                "campaign_type": campaign.campaign_type
            }
        )

        # Link to campaign
        conversation.campaign_id = campaign.id
        conversation.conversation_type = campaign.campaign_type
        db.commit()
        db.refresh(conversation)

        # Format email message
        subject = f"{campaign.name} - {settings.MED_SPA_NAME}"
        body = self._format_email_body(campaign, customer)

        # Add outbound message
        outbound_msg = MessagingService.add_assistant_message(
            db=db,
            conversation=conversation,
            content=body,
            metadata={}
        )

        # Add email details
        AnalyticsService.add_email_details(
            db=db,
            message_id=outbound_msg.id,
            subject=subject,
            from_address=settings.MED_SPA_EMAIL,
            to_address=customer.email,
            body_text=body,
            body_html=self._format_email_html(body),
            provider_message_id=f"outbound_{uuid.uuid4()}",
            delivery_status="sent"
        )

        logger.info(f"Sent email to {customer.name} ({customer.email}) for campaign {campaign.id}")

        # TODO: In production, integrate with SendGrid:
        # from sendgrid import SendGridAPIClient
        # from sendgrid.helpers.mail import Mail
        # message = Mail(
        #     from_email=settings.MED_SPA_EMAIL,
        #     to_emails=customer.email,
        #     subject=subject,
        #     html_content=self._format_email_html(body)
        # )
        # sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        # response = sg.send(message)

    def _execute_voice_outbound(
        self,
        db: Session,
        campaign: ResearchCampaign,
        customer: Customer
    ):
        """Execute voice outbound for a customer."""
        if not customer.phone:
            raise ValueError(f"Customer {customer.id} has no phone number")

        # Create conversation linked to campaign
        conversation = MessagingService.create_conversation(
            db=db,
            customer_id=customer.id,
            channel="voice",
            metadata={
                "campaign_id": str(campaign.id),
                "campaign_type": campaign.campaign_type,
                "outbound_initiated": True
            }
        )

        # Link to campaign
        conversation.campaign_id = campaign.id
        conversation.conversation_type = campaign.campaign_type
        db.commit()
        db.refresh(conversation)

        logger.info(f"Created voice conversation for {customer.name} ({customer.phone}) - campaign {campaign.id}")

        # TODO: In production, initiate call via Twilio:
        # This would:
        # 1. Use Twilio Programmable Voice to initiate call
        # 2. Set up TwiML to stream audio to/from OpenAI Realtime API
        # 3. Use campaign's agent_config for system prompt and questions
        # 4. Record conversation and save transcript
        #
        # from twilio.rest import Client
        # client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # call = client.calls.create(
        #     url=f"{settings.BACKEND_URL}/api/webhooks/twilio/voice-outbound/{conversation.id}",
        #     to=customer.phone,
        #     from_=settings.MED_SPA_PHONE
        # )

        # For now, just mark as pending outbound
        logger.warning(f"Voice outbound not yet implemented - conversation {conversation.id} created but call not initiated")

    def _format_initial_message(
        self,
        campaign: ResearchCampaign,
        customer: Customer
    ) -> str:
        """
        Format initial outbound message for SMS/Email.

        Uses agent config's system prompt and first question.
        """
        agent_config = campaign.agent_config

        # Get greeting from system prompt or use default
        greeting = f"Hi {customer.name}!"

        # Get first question
        questions = agent_config.get("questions", [])
        first_question = questions[0] if questions else "How can we help you today?"

        # Format message
        message = f"{greeting}\n\nThis is {settings.AI_ASSISTANT_NAME} from {settings.MED_SPA_NAME}. {first_question}"

        return message

    def _format_email_body(
        self,
        campaign: ResearchCampaign,
        customer: Customer
    ) -> str:
        """Format email body text."""
        agent_config = campaign.agent_config
        questions = agent_config.get("questions", [])

        # Build email body
        lines = [
            f"Hi {customer.name},",
            "",
            f"This is {settings.AI_ASSISTANT_NAME} from {settings.MED_SPA_NAME}.",
            "",
        ]

        # Add questions
        for i, question in enumerate(questions, 1):
            lines.append(f"{i}. {question}")

        lines.extend([
            "",
            "We'd love to hear from you! Simply reply to this email.",
            "",
            f"Best regards,",
            f"{settings.AI_ASSISTANT_NAME}",
            f"{settings.MED_SPA_NAME}",
            f"{settings.MED_SPA_PHONE}"
        ])

        return "\n".join(lines)

    def _format_email_html(self, body_text: str) -> str:
        """Format email as HTML."""
        # Simple HTML formatting
        html_body = body_text.replace("\n", "<br>")

        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                    {html_body}
                </div>
            </body>
        </html>
        """

    def check_customer_response(
        self,
        db: Session,
        conversation_id: UUID
    ) -> bool:
        """
        Check if customer has responded to outbound message.
        Updates campaign responded count if this is first response.

        Args:
            db: Database session
            conversation_id: Conversation UUID

        Returns:
            True if customer has responded
        """
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation or not conversation.campaign_id:
            return False

        # Check if there are inbound messages
        inbound_count = db.query(CommunicationMessage).filter(
            CommunicationMessage.conversation_id == conversation_id,
            CommunicationMessage.direction == "inbound"
        ).count()

        if inbound_count > 0:
            # Check if we've already counted this response
            metadata = conversation.custom_metadata or {}
            if not metadata.get("response_counted"):
                # Increment campaign responded count
                CampaignService.increment_responded_count(db, conversation.campaign_id)

                # Mark as counted
                metadata["response_counted"] = True
                conversation.custom_metadata = metadata
                db.commit()

            return True

        return False
