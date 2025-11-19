"""
Agent configuration templates for research and outbound campaigns.
"""

from typing import Any, Dict, List, Tuple

from config import get_settings

settings = get_settings()


class AgentTemplates:
    """Pre-built agent templates for various campaign types."""

    TEMPLATES: Dict[str, Dict[str, Any]] = {
        "booking_abandonment_research": {
            "name": "Why Didn't You Book?",
            "type": "research",
            "description": "Understand why customers showed interest but didn't complete booking",
            "system_prompt": """You are {assistant_name}, an AI assistant from {med_spa_name}.

You're reaching out to {customer_name} who recently inquired about {service_interested} but didn't complete their booking. Your goal is to understand what prevented them from booking and gather feedback.

Be warm, empathetic, and genuinely curious. This is research, not a sales call. Listen more than you speak.

Guidelines:
- Start by acknowledging their previous interest
- Ask open-ended questions
- Don't push for a booking - focus on understanding
- Thank them for their time and feedback
- Keep the conversation brief (2-3 minutes max)

Remember: You're gathering insights to improve the booking experience.""",
            "questions": [
                "What made you interested in {service_interested} initially?",
                "Was there anything that made you hesitate to complete your booking?",
                "Did you find any part of our booking process confusing or difficult?",
                "Is there anything we could do differently to make booking easier?",
            ],
            "voice_settings": {
                "voice": "alloy",
                "temperature": 0.7,
                "max_response_tokens": 150,
            },
            "expected_outcomes": [
                "feedback_gathered",
                "booking_intent_revived",
                "complaint",
            ],
            "success_metrics": ["response_rate", "completion_rate", "sentiment_score"],
        },
        "special_offer_outbound": {
            "name": "Limited Time Offer",
            "type": "outbound_sales",
            "description": "Reach out with a special promotion or limited-time offer",
            "system_prompt": """You are {assistant_name}, an AI assistant from {med_spa_name}.

You're calling {customer_name} to offer them an exclusive promotion on {service_interested}.

Current offer: {offer_details}

Guidelines:
- Be enthusiastic but not pushy
- Clearly explain the offer and its value
- Create urgency (limited time/spots) but be honest
- If interested, guide them through booking
- If not interested, ask if there's a better time or different service
- Always be respectful of their time

Your goal: Convert interest into a booked appointment.""",
            "questions": [
                "Would you like to take advantage of our {offer_details}?",
                "What dates work best for you this month?",
                "Do you have any questions about the treatment or the offer?",
            ],
            "voice_settings": {
                "voice": "alloy",
                "temperature": 0.6,
                "max_response_tokens": 200,
            },
            "expected_outcomes": [
                "appointment_scheduled",
                "callback_requested",
                "not_interested",
            ],
            "success_metrics": [
                "conversion_rate",
                "booking_count",
                "revenue_generated",
            ],
        },
        "feedback_request": {
            "name": "Post-Visit Feedback",
            "type": "research",
            "description": "Gather feedback from recent customers",
            "system_prompt": """You are {assistant_name}, an AI assistant from {med_spa_name}.

You're following up with {customer_name} after their recent {service_type} appointment to gather feedback.

Guidelines:
- Thank them for choosing your spa
- Ask about their experience genuinely
- Listen for both positive feedback and areas for improvement
- Don't be defensive if they have complaints
- Keep it brief and conversational
- End by asking if they'd like to schedule their next visit

Your goal: Gather honest feedback and strengthen the relationship.""",
            "questions": [
                "How was your experience with us?",
                "Did {provider_name} meet your expectations?",
                "Was there anything you particularly enjoyed?",
                "Is there anything we could have done better?",
                "Would you be interested in scheduling a follow-up treatment?",
            ],
            "voice_settings": {
                "voice": "alloy",
                "temperature": 0.7,
                "max_response_tokens": 150,
            },
            "expected_outcomes": [
                "positive_feedback",
                "constructive_criticism",
                "repeat_booking",
            ],
            "success_metrics": [
                "satisfaction_score",
                "response_rate",
                "repeat_booking_rate",
            ],
        },
        "reactivation_campaign": {
            "name": "Win Back Inactive Customers",
            "type": "outbound_sales",
            "description": "Re-engage customers who haven't visited recently",
            "system_prompt": """You are {assistant_name}, an AI assistant from {med_spa_name}.

You're reaching out to {customer_name}, who last visited {days_since_last_visit} days ago. We'd love to welcome them back!

Guidelines:
- Express that you've missed them
- Mention any new services or improvements since their last visit
- Offer an incentive if appropriate (returning customer discount)
- Ask if there's a reason they haven't returned
- Make it easy to book
- Be warm and genuine, not desperate

Your goal: Reactivate the customer relationship and book an appointment.""",
            "questions": [
                "We noticed you haven't been in for a while - is everything okay?",
                "Have you heard about our new {new_service}?",
                "Would you like to schedule an appointment? We have some great availability this month.",
                "Is there anything we could do to make your next visit more convenient?",
            ],
            "voice_settings": {
                "voice": "alloy",
                "temperature": 0.6,
                "max_response_tokens": 180,
            },
            "expected_outcomes": [
                "reactivation_success",
                "scheduling_difficulty",
                "no_longer_interested",
            ],
            "success_metrics": [
                "reactivation_rate",
                "booking_count",
                "customer_lifetime_value",
            ],
        },
        "appointment_reminder_upsell": {
            "name": "Appointment Reminder + Upsell",
            "type": "outbound_sales",
            "description": "Remind about upcoming appointment and suggest add-on services",
            "system_prompt": """You are {assistant_name}, an AI assistant from {med_spa_name}.

You're confirming {customer_name}'s upcoming {service_type} appointment on {appointment_date}.

Guidelines:
- Start with a friendly appointment confirmation
- Ask if they have any questions or concerns
- Suggest complementary services that pair well
- Don't be pushy - focus on enhancing their experience
- Remind them of cancellation policy (24 hours notice)
- Keep it brief and helpful

Your goal: Confirm appointment and potentially upgrade the booking.""",
            "questions": [
                "Just confirming your {service_type} appointment on {appointment_date} - all set?",
                "Do you have any questions before your visit?",
                "Have you considered adding {complementary_service}? It pairs beautifully with {service_type}.",
                "Would you like to extend your appointment time to include this?",
            ],
            "voice_settings": {
                "voice": "alloy",
                "temperature": 0.6,
                "max_response_tokens": 150,
            },
            "expected_outcomes": ["confirmed", "upgraded", "rescheduled", "cancelled"],
            "success_metrics": [
                "confirmation_rate",
                "upsell_rate",
                "no_show_reduction",
            ],
        },
        "referral_request": {
            "name": "Request Referral",
            "type": "outbound_sales",
            "description": "Ask satisfied customers for referrals",
            "system_prompt": """You are {assistant_name}, an AI assistant from {med_spa_name}.

You're reaching out to {customer_name}, a valued customer with high satisfaction scores.

Guidelines:
- Thank them for being a loyal customer
- Mention their positive feedback/satisfaction
- Explain your referral program benefits
- Make it easy to refer (text/email a link)
- Don't be pushy - frame it as helping friends
- Offer a referral bonus if available

Your goal: Get 1-2 referrals from happy customers.""",
            "questions": [
                "We're so glad you've been happy with our services!",
                "Do you have friends who might be interested in {service_type}?",
                "We offer {referral_bonus} when you refer someone. Would you like me to text you a referral link?",
                "Is there anyone you'd like to share your experience with?",
            ],
            "voice_settings": {
                "voice": "alloy",
                "temperature": 0.7,
                "max_response_tokens": 150,
            },
            "expected_outcomes": ["referral_provided", "maybe_later", "not_interested"],
            "success_metrics": [
                "referral_rate",
                "referral_conversion",
                "new_customer_acquisition",
            ],
        },
    }

    @staticmethod
    def get_all_templates() -> Dict[str, Dict[str, Any]]:
        """Get all agent templates."""
        return AgentTemplates.TEMPLATES

    @staticmethod
    def get_template(template_id: str) -> Dict[str, Any]:
        """Get a specific template by ID."""
        return AgentTemplates.TEMPLATES.get(template_id, {})

    @staticmethod
    def get_templates_by_type(campaign_type: str) -> Dict[str, Dict[str, Any]]:
        """Get templates filtered by campaign type (research or outbound_sales)."""
        return {
            key: template
            for key, template in AgentTemplates.TEMPLATES.items()
            if template.get("type") == campaign_type
        }

    @staticmethod
    def interpolate_template(
        template: Dict[str, Any], variables: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Fill in template variables with actual values.

        Args:
            template: Template dictionary
            variables: Dictionary of variable values (customer_name, service_interested, etc.)

        Returns:
            Template with interpolated values
        """
        interpolated = dict(template)

        # Interpolate system prompt
        if "system_prompt" in interpolated:
            interpolated["system_prompt"] = interpolated["system_prompt"].format(
                **variables
            )

        # Interpolate questions
        if "questions" in interpolated:
            interpolated["questions"] = [
                q.format(**variables) for q in interpolated["questions"]
            ]

        return interpolated

    @staticmethod
    def validate_agent_config(config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate agent configuration.

        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []

        # Required fields
        if not config.get("system_prompt") or not config.get("system_prompt").strip():
            errors.append("System prompt is required")

        questions = config.get("questions")
        if not questions or not isinstance(questions, list) or len(questions) == 0:
            errors.append("At least one question is required")
        elif any(not q or not str(q).strip() for q in questions):
            errors.append("All questions must be non-empty strings")

        # Voice settings validation
        voice_settings = config.get("voice_settings", {})
        if "voice" in voice_settings:
            valid_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
            if voice_settings["voice"] not in valid_voices:
                errors.append(
                    f"Invalid voice. Must be one of: {', '.join(valid_voices)}"
                )

        if "temperature" in voice_settings:
            temp = voice_settings["temperature"]
            if not (0 <= temp <= 1):
                errors.append("Temperature must be between 0 and 1")

        return len(errors) == 0, errors

    @staticmethod
    def get_default_config(campaign_type: str) -> Dict[str, Any]:
        """Get a minimal default configuration for a campaign type."""
        settings = get_settings()

        if campaign_type == "research":
            return {
                "system_prompt": f"""You are {settings.AI_ASSISTANT_NAME}, an AI assistant from {settings.MED_SPA_NAME}.
You're conducting research to understand customer needs and improve our services.
Be warm, empathetic, and genuinely curious.""",
                "questions": [
                    "What brought you to us initially?",
                    "How was your experience with our services?",
                    "What could we do to improve?",
                ],
                "voice_settings": {
                    "voice": "alloy",
                    "temperature": 0.7,
                    "max_response_tokens": 150,
                },
            }
        else:  # outbound_sales
            return {
                "system_prompt": f"""You are {settings.AI_ASSISTANT_NAME}, an AI assistant from {settings.MED_SPA_NAME}.
You're reaching out to offer valuable services and help customers book appointments.
Be friendly, professional, and helpful.""",
                "questions": [
                    "Would you be interested in scheduling an appointment?",
                    "What dates work best for you?",
                    "Do you have any questions about our services?",
                ],
                "voice_settings": {
                    "voice": "alloy",
                    "temperature": 0.6,
                    "max_response_tokens": 200,
                },
            }
