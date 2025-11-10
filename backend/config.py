"""
Configuration settings for the Med Spa Voice AI application.
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Med Spa Voice AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://ava_user:ava_password@localhost:5432/ava_db"
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-realtime-mini-2025-10-06"
    OPENAI_SENTIMENT_MODEL: str = "gpt-4.1-mini"

    # Google Calendar
    GOOGLE_CALENDAR_ID: str
    GOOGLE_CREDENTIALS_FILE: str = "credentials.json"
    GOOGLE_TOKEN_FILE: str = "token.json"

    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Med Spa Information
    MED_SPA_NAME: str = "Luxury Med Spa"
    MED_SPA_PHONE: str = "+1234567890"
    MED_SPA_ADDRESS: str = "123 Beauty Lane, Beverly Hills, CA 90210"
    MED_SPA_HOURS: str = "Monday-Friday: 9am-7pm, Saturday: 10am-5pm, Sunday: Closed"

    # AI Assistant
    AI_ASSISTANT_NAME: str = "Ava"

    class Config:
        # Look for .env in parent directory (project root)
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Med Spa Services Configuration
SERVICES = {
    "botox": {
        "name": "Botox",
        "duration_minutes": 30,
        "price_range": "$300-$600",
        "description": "Botulinum toxin injections to reduce fine lines and wrinkles",
        "prep_instructions": "Avoid alcohol and blood thinners 24 hours before treatment",
        "aftercare": "No rubbing the treated area for 24 hours, avoid lying down for 4 hours"
    },
    "dermal_fillers": {
        "name": "Dermal Fillers",
        "duration_minutes": 45,
        "price_range": "$600-$1200 per syringe",
        "description": "Injectable hyaluronic acid for volume restoration and enhancement",
        "prep_instructions": "Avoid alcohol and blood thinners 24-48 hours before",
        "aftercare": "Avoid strenuous exercise for 24 hours, ice as needed for swelling"
    },
    "laser_hair_removal": {
        "name": "Laser Hair Removal",
        "duration_minutes": 30,
        "price_range": "$100-$500 per session",
        "description": "Permanent hair reduction using advanced laser technology",
        "prep_instructions": "Shave area 24 hours before, avoid sun exposure for 2 weeks",
        "aftercare": "Avoid sun exposure, use SPF 30+, no hot showers for 24 hours"
    },
    "hydrafacial": {
        "name": "HydraFacial",
        "duration_minutes": 60,
        "price_range": "$200-$300",
        "description": "Deep cleansing, exfoliation, and hydration facial treatment",
        "prep_instructions": "Come with clean face, no makeup",
        "aftercare": "Avoid sun exposure for 24 hours, use gentle skincare"
    },
    "chemical_peel": {
        "name": "Chemical Peel",
        "duration_minutes": 45,
        "price_range": "$150-$400",
        "description": "Exfoliating treatment to improve skin texture and tone",
        "prep_instructions": "Discontinue retinoids 3 days before, avoid sun exposure",
        "aftercare": "No picking at peeling skin, use gentle cleanser and moisturizer, SPF required"
    },
    "microneedling": {
        "name": "Microneedling",
        "duration_minutes": 60,
        "price_range": "$300-$500",
        "description": "Collagen induction therapy for skin rejuvenation",
        "prep_instructions": "Come with clean face, avoid blood thinners",
        "aftercare": "Avoid makeup for 24 hours, gentle skincare only, avoid sun"
    },
    "coolsculpting": {
        "name": "CoolSculpting",
        "duration_minutes": 60,
        "price_range": "$750-$1500 per area",
        "description": "Non-invasive fat reduction through controlled cooling",
        "prep_instructions": "Wear comfortable clothing, eat normally",
        "aftercare": "Massage treated area as directed, maintain healthy lifestyle"
    },
    "prp_facial": {
        "name": "PRP Facial (Vampire Facial)",
        "duration_minutes": 90,
        "price_range": "$700-$1200",
        "description": "Platelet-rich plasma therapy for skin rejuvenation",
        "prep_instructions": "Hydrate well, avoid alcohol 24 hours before",
        "aftercare": "No makeup for 24 hours, gentle skincare, avoid sun exposure"
    },
    "consultation": {
        "name": "Consultation",
        "duration_minutes": 30,
        "price_range": "Complimentary",
        "description": "Free consultation with our expert providers",
        "prep_instructions": "Bring list of current medications and skincare products",
        "aftercare": "N/A"
    }
}

# Providers
PROVIDERS = {
    "dr_smith": {
        "name": "Dr. Sarah Smith",
        "title": "Medical Director",
        "specialties": ["Botox", "Dermal Fillers", "PRP Facial"],
        "credentials": "MD, Board Certified Dermatologist"
    },
    "nurse_johnson": {
        "name": "Nurse Emily Johnson",
        "title": "Nurse Injector",
        "specialties": ["Botox", "Dermal Fillers", "Microneedling"],
        "credentials": "RN, Certified Aesthetic Nurse"
    },
    "esthetician_lee": {
        "name": "Lisa Lee",
        "title": "Lead Esthetician",
        "specialties": ["HydraFacial", "Chemical Peel", "Laser Hair Removal"],
        "credentials": "Licensed Esthetician, Laser Certified"
    }
}

# Conversation prompts and templates
OPENING_SCRIPT = """Thank you for calling {med_spa_name}. I'm {assistant_name}, your virtual assistant. I can help you schedule an appointment or answer questions about our services. How may I help you today?"""

SYSTEM_PROMPT = """You are {assistant_name}, a professional and warm virtual receptionist for {med_spa_name}, a luxury medical spa.

Your capabilities:
- Schedule, reschedule, and cancel appointments
- Provide information about our services, pricing, and treatments
- Answer questions about preparation and aftercare
- Share details about our providers and their specialties
- Provide location, hours, and parking information
- Handle first-time client questions

Your personality:
- Professional yet approachable
- Patient and understanding
- Empathetic about aesthetic concerns
- Confident but never condescending
- Discreet about aesthetic procedures

Communication guidelines:
- Keep responses concise (under 30 seconds when possible)
- Use simple language, avoid excessive medical jargon
- Provide specific details (times, prices) rather than vague statements
- Offer alternatives when preferred slots are unavailable
- Confirm critical details before finalizing bookings
- If you don't know something or face a complex medical question, offer to have a staff member call back

Never:
- Provide medical advice or diagnose conditions
- Guarantee specific results from treatments
- Discuss other clients or their treatments
- Rush customers through important decisions

When booking appointments:
1. Determine desired service(s)
2. Ask if new or returning client
3. Collect name, phone, and email
4. Check availability and offer options
5. Ask about provider preference
6. Confirm all details clearly
7. Mention cancellation policy (24-hour notice required)
8. Let them know they'll receive SMS confirmation

Med Spa Details:
- Name: {med_spa_name}
- Address: {address}
- Hours: {hours}
- Phone: {phone}

Identity requirements:
- Never describe yourself as ChatGPT, a chatbot, or an OpenAI model.
- Always introduce yourself as {assistant_name}, the virtual receptionist for {med_spa_name}.
- If a caller asks "Who are you?" or similar, respond with: "I'm {assistant_name}, the virtual receptionist for {med_spa_name}. I'm here to help with appointments or any questions about our treatments." (You may adapt wording slightly but must keep the meaning.)
- Stay in role at all times and keep the focus on med spa services.
"""

# Cancellation policy
CANCELLATION_POLICY = "We require 24-hour notice for cancellations or rescheduling. Late cancellations may be subject to a fee."
