"""
Seed provider analytics data for demonstration and testing.

Creates:
- Sample providers with specialties
- Sample in-person consultations with transcripts
- AI insights for each provider
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from random import choice, randint, uniform

from dotenv import load_dotenv

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Load environment variables
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

from database import (
    SessionLocal, Provider, InPersonConsultation,
    AIInsight, ProviderPerformanceMetric, Customer
)

# Sample data
PROVIDERS = [
    {
        "name": "Dr. Sarah Chen",
        "email": "sarah.chen@example.com",
        "phone": "555-0101",
        "specialties": ["Botox", "Dermal Fillers", "PDO Thread Lift"],
        "bio": "15+ years experience in aesthetic medicine. Board certified dermatologist."
    },
    {
        "name": "Emily Rodriguez",
        "email": "emily.r@example.com",
        "phone": "555-0102",
        "specialties": ["Laser Hair Removal", "Chemical Peels", "Microneedling"],
        "bio": "Licensed aesthetician specializing in laser treatments and skin rejuvenation."
    },
    {
        "name": "Jessica Williams",
        "email": "jessica.w@example.com",
        "phone": "555-0103",
        "specialties": ["Hydrafacial", "Body Contouring", "PRP Facial"],
        "bio": "Passionate about helping clients achieve natural-looking results."
    },
]

SAMPLE_TRANSCRIPTS = {
    "booked_high_quality": [
        """Provider: Hi! Welcome to the spa. What brings you in today?
Customer: I've been thinking about getting Botox for my forehead lines.
Provider: Great choice! Let me explain how Botox works. It's a neurotoxin that temporarily relaxes the muscles that cause wrinkles. The results typically last 3-4 months. Have you had Botox before?
Customer: No, this would be my first time.
Provider: Perfect! I'll walk you through everything. The procedure takes about 10-15 minutes, and most people describe it as feeling like small pinpricks. We can start conservatively and adjust in your follow-up. How does that sound?
Customer: That sounds good. What about side effects?
Provider: Excellent question. Most people experience minor bruising or redness at injection sites, which fades within a day or two. I always recommend avoiding blood thinners like aspirin for a week before to minimize bruising. The cost for forehead lines is typically $300-400 depending on units needed.
Customer: Okay, I'm ready to book. When can we schedule?
Provider: I have availability next Tuesday at 2pm or Thursday at 10am. Which works better?
Customer: Tuesday at 2pm works great!
Provider: Perfect! I'll get you scheduled. You're going to love the results.""",

        """Provider: Thanks for coming in! I see you're interested in dermal fillers. Tell me what areas concern you most?
Customer: I've noticed my cheeks looking more hollow, and I have these lines around my mouth.
Provider: I completely understand. What we can do is use hyaluronic acid fillers to restore volume in your midface, which will also help soften those nasolabial folds. The great thing about HA fillers is they look very natural and last 12-18 months.
Customer: Will it hurt?
Provider: We use a numbing cream beforehand, and the fillers contain lidocaine for comfort. Most clients say it's much easier than they expected. I always start with a conservative approach - we can always add more at your 2-week follow-up.
Customer: How much would this cost?
Provider: For the areas you mentioned, I'd recommend 2 syringes to start. That would be $1,200 total. We also have a membership program that saves 15% on all treatments.
Customer: The membership sounds interesting. Let's do it!
Provider: Excellent decision! I'll get you set up with our membership and we can schedule your first session."""
    ],
    "booked_medium_quality": [
        """Provider: Hello! What can I help you with today?
Customer: I want to do something about these wrinkles.
Provider: Okay, we have a few options. Botox, fillers, or chemical peels. Which interests you?
Customer: Maybe Botox?
Provider: Sure, Botox works well for wrinkles. It's $12 per unit, most people need 20-30 units.
Customer: Okay, when can I come in?
Provider: How about next week?
Customer: Sure, that works.""",
    ],
    "declined": [
        """Provider: Hi there! What brings you in?
Customer: I'm thinking about Botox but I'm really nervous about needles.
Provider: Oh, it's not that bad. Most people get used to it.
Customer: How much does it cost?
Provider: It depends on how many units you need. Could be $300-500.
Customer: That's more than I thought. I need to think about it.
Provider: Okay, well, let us know if you change your mind.
Customer: Thanks, I will.""",

        """Provider: Welcome! Interested in any treatments?
Customer: I saw you do laser hair removal. How does that work?
Provider: We use laser to target hair follicles. It takes multiple sessions.
Customer: How many sessions?
Provider: Usually 6-8 sessions.
Customer: And the cost?
Provider: Depends on the area. Small areas start at $150 per session.
Customer: Oh wow, that adds up. I'm not sure I can afford that right now.
Provider: Yeah, it can be expensive. Maybe look into our financing options?
Customer: I'll think about it and get back to you."""
    ],
    "thinking": [
        """Provider: Thanks for coming in! Tell me about your skincare goals.
Customer: I want to look more refreshed, but I'm not sure what treatment is right for me.
Provider: Well, we could do Botox for wrinkles, fillers for volume, or peels for texture. What's your main concern?
Customer: I think the wrinkles, but also my skin texture isn't great.
Provider: We could combine treatments. Botox for wrinkles and a chemical peel for texture.
Customer: How much would both cost?
Provider: Probably around $800-1000 total.
Customer: That's a lot. Can I just do one for now?
Provider: Sure, which one interests you more?
Customer: I'm not sure. Can I think about it and call you back?
Provider: Of course! Take your time."""
    ]
}

SAMPLE_INSIGHTS = {
    "strengths": [
        {
            "title": "Excellent rapport building",
            "insight_text": "Provider consistently makes clients feel welcome and comfortable from the first moment.",
            "quote": "Hi! Welcome to the spa. What brings you in today?",
            "recommendation": None,
            "confidence": 0.9
        },
        {
            "title": "Clear explanation of procedures",
            "insight_text": "Provider explains treatments in simple terms and addresses safety concerns proactively.",
            "quote": "Let me explain how Botox works. It's a neurotoxin that temporarily relaxes the muscles...",
            "recommendation": None,
            "confidence": 0.85
        },
        {
            "title": "Effective price anchoring",
            "insight_text": "Provider introduces pricing naturally in the context of value and expected results.",
            "quote": "The cost for forehead lines is typically $300-400 depending on units needed.",
            "recommendation": None,
            "confidence": 0.8
        },
    ],
    "opportunities": [
        {
            "title": "Could build more emotional connection",
            "insight_text": "Provider focuses heavily on technical details but could connect more on emotional benefits.",
            "quote": "It depends on how many units you need. Could be $300-500.",
            "recommendation": "Try framing pricing around the confidence and results the client will feel, not just the technical units needed.",
            "confidence": 0.75
        },
        {
            "title": "Improve objection handling for price concerns",
            "insight_text": "When clients express price concerns, provider could better demonstrate value instead of suggesting they 'think about it'.",
            "quote": "Yeah, it can be expensive. Maybe look into our financing options?",
            "recommendation": "When price objections arise, reinforce the long-term value and results. Share success stories from similar clients.",
            "confidence": 0.8
        },
        {
            "title": "Ask more qualifying questions upfront",
            "insight_text": "Provider sometimes jumps to solutions before fully understanding client's primary goals.",
            "quote": "Okay, we have a few options. Botox, fillers, or chemical peels. Which interests you?",
            "recommendation": "Spend more time in discovery. Ask 'What would success look like for you?' before presenting options.",
            "confidence": 0.7
        },
    ]
}


def seed_providers(db):
    """Create sample providers."""
    print("Creating providers...")
    created_providers = []

    for provider_data in PROVIDERS:
        provider = Provider(
            id=uuid.uuid4(),
            name=provider_data["name"],
            email=provider_data["email"],
            phone=provider_data["phone"],
            specialties=provider_data["specialties"],
            bio=provider_data["bio"],
            hire_date=datetime.utcnow() - timedelta(days=randint(365, 1095)),
            is_active=True
        )
        db.add(provider)
        created_providers.append(provider)
        print(f"  ✓ Created provider: {provider.name}")

    db.commit()
    return created_providers


def seed_consultations(db, providers, customers):
    """Create sample consultations."""
    print("\nCreating consultations...")

    # Create consultations for the past 30 days
    for provider in providers:
        # Each provider gets different performance based on their "skill level"
        if provider.name == "Dr. Sarah Chen":
            # High performer - 75% conversion rate
            num_consultations = 20
            book_rate = 0.75
        elif provider.name == "Emily Rodriguez":
            # Medium performer - 55% conversion rate
            num_consultations = 15
            book_rate = 0.55
        else:
            # Needs coaching - 35% conversion rate
            num_consultations = 12
            book_rate = 0.35

        for i in range(num_consultations):
            # Determine outcome based on conversion rate
            rand_val = uniform(0, 1)
            if rand_val < book_rate:
                outcome = "booked"
                transcript_pool = SAMPLE_TRANSCRIPTS["booked_high_quality"]
                satisfaction = uniform(8, 10)
                sentiment = "positive"
            elif rand_val < book_rate + 0.15:
                outcome = "thinking"
                transcript_pool = SAMPLE_TRANSCRIPTS["thinking"]
                satisfaction = uniform(6, 8)
                sentiment = "neutral"
            else:
                outcome = "declined"
                transcript_pool = SAMPLE_TRANSCRIPTS["declined"]
                satisfaction = uniform(3, 6)
                sentiment = "negative"

            # Random date in past 30 days
            created_at = datetime.utcnow() - timedelta(
                days=randint(0, 30),
                hours=randint(0, 23),
                minutes=randint(0, 59)
            )

            duration = randint(300, 1200)  # 5-20 minutes

            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=provider.id,
                customer_id=choice(customers).id if customers else None,
                service_type=choice(provider.specialties) if provider.specialties else None,
                duration_seconds=duration,
                transcript=choice(transcript_pool),
                outcome=outcome,
                satisfaction_score=satisfaction,
                sentiment=sentiment,
                ai_summary=f"{'Successful' if outcome == 'booked' else 'Unsuccessful'} consultation for {provider.specialties[0] if provider.specialties else 'treatment'}. Client {'showed strong interest and booked' if outcome == 'booked' else 'expressed concerns about' if outcome == 'thinking' else 'decided not to proceed with'} treatment.",
                created_at=created_at,
                ended_at=created_at + timedelta(seconds=duration)
            )
            db.add(consultation)

        print(f"  ✓ Created {num_consultations} consultations for {provider.name}")

    db.commit()


def seed_insights(db, providers):
    """Create sample AI insights."""
    print("\nCreating AI insights...")

    for provider in providers:
        # High performers get more strengths
        if provider.name == "Dr. Sarah Chen":
            num_strengths = 4
            num_opportunities = 1
        elif provider.name == "Emily Rodriguez":
            num_strengths = 2
            num_opportunities = 2
        else:
            num_strengths = 1
            num_opportunities = 3

        # Add strengths
        for i in range(min(num_strengths, len(SAMPLE_INSIGHTS["strengths"]))):
            insight_data = SAMPLE_INSIGHTS["strengths"][i]
            insight = AIInsight(
                id=uuid.uuid4(),
                insight_type="strength",
                provider_id=provider.id,
                title=insight_data["title"],
                insight_text=insight_data["insight_text"],
                supporting_quote=insight_data["quote"],
                recommendation=insight_data["recommendation"],
                confidence_score=insight_data["confidence"],
                is_positive=True,
                created_at=datetime.utcnow() - timedelta(days=randint(1, 7))
            )
            db.add(insight)

        # Add opportunities
        for i in range(min(num_opportunities, len(SAMPLE_INSIGHTS["opportunities"]))):
            insight_data = SAMPLE_INSIGHTS["opportunities"][i]
            insight = AIInsight(
                id=uuid.uuid4(),
                insight_type="coaching_opportunity",
                provider_id=provider.id,
                title=insight_data["title"],
                insight_text=insight_data["insight_text"],
                supporting_quote=insight_data["quote"],
                recommendation=insight_data["recommendation"],
                confidence_score=insight_data["confidence"],
                is_positive=False,
                created_at=datetime.utcnow() - timedelta(days=randint(1, 7))
            )
            db.add(insight)

        print(f"  ✓ Created {num_strengths} strengths and {num_opportunities} opportunities for {provider.name}")

    db.commit()


def main():
    """Main seeding function."""
    print("=" * 60)
    print("SEEDING PROVIDER ANALYTICS DATA")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Get or create some customers
        customers = db.query(Customer).limit(10).all()
        if not customers:
            print("\nNo customers found. Creating sample customers...")
            for i in range(5):
                customer = Customer(
                    name=f"Sample Customer {i+1}",
                    phone=f"555-010{i}",
                    email=f"customer{i+1}@example.com",
                    is_new_client=True
                )
                db.add(customer)
            db.commit()
            customers = db.query(Customer).all()

        # Seed providers
        providers = seed_providers(db)

        # Seed consultations
        seed_consultations(db, providers, customers)

        # Seed insights
        seed_insights(db, providers)

        print("\n" + "=" * 60)
        print("✓ SEEDING COMPLETE!")
        print("=" * 60)
        print(f"\nCreated:")
        print(f"  - {len(providers)} providers")
        print(f"  - Sample consultations with varied outcomes")
        print(f"  - AI insights for each provider")
        print(f"\nYou can now view the data at:")
        print(f"  - Provider list: http://localhost:3000/providers")
        print(f"  - Consultation page: http://localhost:3000/consultation")

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
