// Site configuration
export const SITE_CONFIG = {
  name: "Eva AI",
  tagline: "Your AI Receptionist for Medical Spas",
  description:
    "Eva AI is an intelligent AI receptionist platform that handles calls, books appointments, and provides 24/7 customer service for medical spas and aesthetic practices.",
  url: "https://eva-ai.com",
  contact: {
    email: "hello@eva-ai.com",
    phone: "(555) 123-4567",
  },
  links: {
    twitter: "https://twitter.com/eva-ai",
    linkedin: "https://linkedin.com/company/eva-ai",
    facebook: "https://facebook.com/eva-ai",
  },
};

// Navigation items
export const NAV_ITEMS = [
  { title: "Features", href: "/features" },
  { title: "Pricing", href: "/pricing" },
  { title: "Voice Demo", href: "/voice-demo" },
  { title: "Integrations", href: "/integrations" },
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
];

// Features
export const FEATURES = [
  {
    title: "24/7 Availability",
    description:
      "Never miss a call again. Eva answers every call, day or night, ensuring your customers always reach someone.",
    icon: "Phone",
  },
  {
    title: "Natural Conversations",
    description:
      "Advanced AI technology enables Eva to have natural, human-like conversations with your customers.",
    icon: "MessageSquare",
  },
  {
    title: "Smart Booking",
    description:
      "Eva handles appointment scheduling, rescheduling, and cancellations with full calendar integration.",
    icon: "Calendar",
  },
  {
    title: "Customer Insights",
    description:
      "Get detailed analytics on customer interactions, satisfaction scores, and booking patterns.",
    icon: "BarChart3",
  },
  {
    title: "Multi-Channel Support",
    description:
      "Eva works across voice, SMS, and email to provide seamless omnichannel customer service.",
    icon: "Zap",
  },
  {
    title: "Easy Integration",
    description:
      "Connect Eva with your existing tools: Google Calendar, Boulevard, Zenoti, and more.",
    icon: "Activity",
  },
];

// Pricing tiers
export const PRICING_TIERS = [
  {
    name: "Starter",
    price: 299,
    period: "month",
    description: "Perfect for small practices getting started with AI",
    features: [
      "Up to 100 calls/month",
      "Basic appointment booking",
      "Email support",
      "Google Calendar integration",
      "Call transcripts & analytics",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Professional",
    price: 599,
    period: "month",
    description: "For growing practices that need more capacity",
    features: [
      "Up to 500 calls/month",
      "Advanced booking features",
      "Priority phone support",
      "All integrations included",
      "AI satisfaction scoring",
      "Custom voice persona",
      "SMS & email support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: null,
    period: "custom",
    description: "For multi-location practices with custom needs",
    features: [
      "Unlimited calls",
      "White-label solution",
      "Dedicated account manager",
      "Custom integrations",
      "Advanced analytics & reporting",
      "Multi-location support",
      "SLA guarantees",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

// Testimonials
export const TESTIMONIALS = [
  {
    author: "Sarah Chen",
    role: "Owner",
    company: "Radiance Med Spa",
    avatar: "/images/testimonials/sarah.jpg",
    quote:
      "Eva has been a game-changer for our practice. We've seen a 40% increase in bookings and our customers love the 24/7 availability.",
    rating: 5,
  },
  {
    author: "Dr. Michael Rodriguez",
    role: "Medical Director",
    company: "Aesthetic Institute",
    avatar: "/images/testimonials/michael.jpg",
    quote:
      "The AI is incredibly natural. Our patients often don't realize they're talking to an AI assistant. It's saved us thousands in staffing costs.",
    rating: 5,
  },
  {
    author: "Jennifer Park",
    role: "Practice Manager",
    company: "Glow Aesthetics",
    avatar: "/images/testimonials/jennifer.jpg",
    quote:
      "Integration was seamless. Eva syncs perfectly with our existing calendar and the analytics dashboard gives us insights we never had before.",
    rating: 5,
  },
];

// Integration partners
export const INTEGRATIONS = [
  {
    name: "Google Calendar",
    description: "Seamless two-way calendar sync",
    logo: "/images/integrations/google-calendar.svg",
    category: "Scheduling",
    status: "live",
  },
  {
    name: "Boulevard",
    description: "Full appointment management integration",
    logo: "/images/integrations/boulevard.svg",
    category: "Scheduling",
    status: "live",
  },
  {
    name: "Zenoti",
    description: "Complete spa management sync",
    logo: "/images/integrations/zenoti.svg",
    category: "Scheduling",
    status: "coming-soon",
  },
  {
    name: "Twilio",
    description: "Enterprise-grade voice & SMS",
    logo: "/images/integrations/twilio.svg",
    category: "Communication",
    status: "live",
  },
  {
    name: "SendGrid",
    description: "Reliable email delivery",
    logo: "/images/integrations/sendgrid.svg",
    category: "Communication",
    status: "live",
  },
  {
    name: "Stripe",
    description: "Secure payment processing",
    logo: "/images/integrations/stripe.svg",
    category: "Payments",
    status: "coming-soon",
  },
];

// FAQ items
export const FAQ_ITEMS = [
  {
    question: "How does Eva handle complex customer questions?",
    answer:
      "Eva is trained on your specific services, pricing, and policies. For questions she can't answer, she gracefully escalates to a human team member while capturing the customer's information.",
  },
  {
    question: "Can I customize Eva's voice and personality?",
    answer:
      "Absolutely! Professional and Enterprise plans include full customization of Eva's voice, tone, and personality to match your brand. You can make her formal, friendly, or anywhere in between.",
  },
  {
    question: "What happens if Eva makes a booking mistake?",
    answer:
      "Eva has a 99.8% booking accuracy rate. In the rare case of an error, our system sends instant notifications to your team, and we have protocols to quickly resolve any issues. Plus, all calls are recorded for quality assurance.",
  },
  {
    question: "How long does it take to set up?",
    answer:
      "Most practices are up and running within 24-48 hours. Setup involves connecting your calendar, configuring your services, and a brief training call with our team. We handle all the technical details.",
  },
  {
    question: "Is there a contract or can I cancel anytime?",
    answer:
      "We offer month-to-month billing with no long-term contracts. You can cancel anytime with 30 days notice. We're confident you'll love Eva, so we don't lock you in.",
  },
  {
    question: "How does Eva compare to a human receptionist?",
    answer:
      "Eva works 24/7 without breaks, never calls in sick, and costs a fraction of a full-time employee. She handles multiple calls simultaneously and provides consistent service quality. That said, she works best alongside your team, not as a replacement.",
  },
];

// Stats
export const STATS = [
  { label: "Calls Handled", value: "50,000+", suffix: "" },
  { label: "Customer Satisfaction", value: "98", suffix: "%" },
  { label: "Booking Success Rate", value: "94", suffix: "%" },
  { label: "Practices Served", value: "200", suffix: "+" },
];

// Problem points (for homepage)
export const PAIN_POINTS = [
  {
    title: "Missed Calls = Lost Revenue",
    description:
      "Every unanswered call is a potential customer going to your competitor. Studies show 80% of callers won't leave a voicemail.",
  },
  {
    title: "After-Hours Bookings",
    description:
      "Your customers want to book at 8pm on a Sunday. By Monday morning, they've already booked elsewhere.",
  },
  {
    title: "Expensive Staffing",
    description:
      "A full-time receptionist costs $35K-$45K/year plus benefits. And they can only handle one call at a time.",
  },
  {
    title: "Inconsistent Service",
    description:
      "Staff turnover, sick days, and training gaps lead to inconsistent customer experiences and booking errors.",
  },
];
