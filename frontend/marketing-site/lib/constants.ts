// Site configuration
export const SITE_CONFIG = {
  name: "Eva AI",
  tagline: "The AI Receptionist That Handles Voice, SMS, & Email",
  description:
    "Eva is the first HIPAA-compliant AI receptionist that manages your entire front desk. She books appointments, answers questions, and follows up via text and email—24/7, without missing a beat.",
  url: "https://eva-ai.com",
  ogImage: "https://eva-ai.com/og-image.png",
  contact: {
    email: "hello@eva-ai.com",
    phone: "(555) 123-4567",
    phoneDisplay: "(555) 123-4567",
  },
  links: {
    twitter: "https://twitter.com/eva-ai",
    linkedin: "https://linkedin.com/company/eva-ai",
    facebook: "https://facebook.com/eva-ai",
  },
};

// Navigation items
export const NAV_ITEMS: { title: string; href: string }[] = [];

// Features
export const FEATURES = [
  {
    title: "True Omnichannel",
    description:
      "Eva doesn't just talk. She follows up with SMS confirmations and email summaries, keeping your patients connected across every channel.",
    icon: "Zap",
  },
  {
    title: "Zero-Fail Booking",
    description:
      "Powered by our Deterministic Booking Engine™, Eva checks availability in real-time and secures appointments without hesitation or double-booking.",
    icon: "Calendar",
  },
  {
    title: "HIPAA Compliant",
    description:
      "Built for healthcare from day one. Enterprise-grade encryption, BAA availability, and secure data handling keep your practice protected.",
    icon: "Shield",
  },
  {
    title: "Natural Conversations",
    description:
      "Advanced voice AI understands medical terminology, handles interruptions gracefully, and sounds so human your patients won't know the difference.",
    icon: "MessageSquare",
  },
  {
    title: "Smart Qualification",
    description:
      "Eva asks the right medical screening questions before booking, ensuring every appointment is qualified and ready for treatment.",
    icon: "CheckCircle",
  },
  {
    title: "Seamless Integration",
    description:
      "Works perfectly with your existing stack: Google Calendar, Boulevard, Zenoti, Twilio, and SendGrid.",
    icon: "Activity",
  },
];

// Pricing tiers
export const PRICING_TIERS = [
  {
    name: "Starter",
    price: 299,
    period: "month",
    description: "Perfect for solo practitioners or small boutique spas.",
    features: [
      "Up to 100 calls/month",
      "Voice-only Booking",
      "Google Calendar integration",
      "Basic Call Transcripts",
      "Email Support",
    ],
    cta: "Book a Demo",
    highlighted: false,
    popular: false,
  },
  {
    name: "Professional",
    price: 599,
    period: "month",
    description: "For growing practices that need comprehensive coverage.",
    features: [
      "Up to 500 calls/month",
      "Voice + SMS + Email Support",
      "Deterministic Booking Engine",
      "HIPAA Compliance BAA",
      "Advanced Analytics & Sentiment",
      "Priority Phone Support",
    ],
    cta: "Book a Demo",
    highlighted: true,
    popular: true,
  },
  {
    name: "Enterprise",
    price: null,
    period: "custom",
    description: "For multi-location networks requiring custom solutions.",
    features: [
      "Unlimited calls & messages",
      "Custom Voice Persona Training",
      "Multi-location Routing",
      "Dedicated Success Manager",
      "Custom EMR Integrations",
      "White-label Options",
    ],
    cta: "Book a Demo",
    highlighted: false,
    popular: false,
  },
];

// Testimonials
export const TESTIMONIALS = [
  {
    role: "Medical Director, multi-location med spa",
    quote:
      "Eva's phone voice is unbelievably natural—patients assume they're speaking with our lead concierge, and we're booking more consults without anyone realizing it's AI.",
  },
  {
    role: "Practice Manager, aesthetics collective",
    quote:
      "I was skeptical about AI handling medical questions, but Eva's qualification flow is perfect. She screens patients exactly how we trained her.",
  },
  {
    role: "Owner, boutique aesthetics studio",
    quote:
      "It's not just an answering service. It's a full front desk team that never sleeps. The deterministic booking means zero errors in our calendar.",
  },
];

// FAQ items
export const FAQ_ITEMS = [
  {
    question: "Is Eva HIPAA compliant?",
    answer:
      "Yes. Eva is built with HIPAA compliance at its core. We sign BAAs (Business Associate Agreements) with our Professional and Enterprise clients, ensuring your patient data is encrypted and handled according to federal standards.",
  },
  {
    question: "How does 'Deterministic Booking' work?",
    answer:
      "Unlike generic AI that 'hallucinates' availability, Eva connects directly to your calendar's API. She checks real-time slots and locks them in instantly, guaranteeing that every booked appointment is valid and confirmed.",
  },
  {
    question: "Can Eva handle SMS and Email too?",
    answer:
      "Absolutely. Eva is an omnichannel assistant. After a call, she can send SMS confirmations, email pre-treatment instructions, or even handle text-based scheduling questions directly.",
  },
  {
    question: "What if a patient asks a medical question?",
    answer:
      "Eva is trained to provide general information about your services but knows her limits. For complex medical advice, she gracefully escalates the call to your clinical staff while capturing the patient's concern.",
  },
  {
    question: "Does it integrate with my current software?",
    answer:
      "We integrate natively with Google Calendar, Boulevard, and other major med spa platforms. Setup takes less than an hour, and we handle the technical configuration for you.",
  },
  {
    question: "How much does it cost compared to a receptionist?",
    answer:
      "Eva costs a fraction of a full-time employee—typically saving practices $30k-$40k annually while providing 24/7 coverage that no single human can match.",
  },
];

// Stats
export const STATS = [
  { label: "Calls Handled", value: "50,000+", suffix: "" },
  { label: "Booking Accuracy", value: "100", suffix: "%" },
  { label: "ROI Average", value: "12", suffix: "x" },
  { label: "Practices Served", value: "200", suffix: "+" },
  { label: "Uptime", value: "99.9", suffix: "%" },
];

// Pain points
export const PAIN_POINTS = [
  {
    title: "The 'Phone Tag' Loop",
    description:
      "65% of patients hang up if they hit voicemail. You call back, they don't answer. It's a vicious cycle that loses revenue.",
    icon: "PhoneMissed",
  },
  {
    title: "Staff Burnout",
    description:
      "Your front desk is overwhelmed juggling check-ins, payments, and ringing phones. Service quality drops when staff is stressed.",
    icon: "UserX",
  },
  {
    title: "After-Hours Leaks",
    description:
      "Most booking decisions happen in the evening. If you aren't answering at 8 PM, your competitors are getting those patients.",
    icon: "Moon",
  },
  {
    title: "Inconsistent Info",
    description:
      "Temp staff or new hires might give wrong pricing or forget prep instructions. Eva gives the perfect answer, every single time.",
    icon: "AlertCircle",
  },
];
