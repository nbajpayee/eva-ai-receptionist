import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import OmnichannelTimeline from "@/components/ui/OmnichannelTimeline";
import DeterministicBookingViz from "@/components/ui/DeterministicBookingViz";
import AnalyticsViz from "@/components/ui/AnalyticsViz";
import SecurityViz from "@/components/ui/SecurityViz";
import VoiceAIViz from "@/components/ui/VoiceAIViz";
import { Phone, Calendar, MessageSquare, BarChart3, Shield, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Features - AI Receptionist for Medical Spas & Aesthetic Practices",
  description: "Explore Eva AI's powerful features: HIPAA-compliant voice AI, deterministic booking, omnichannel communications, AI analytics, and seamless integrations with Boulevard, Zenoti & Google Calendar.",
  keywords: [
    "AI receptionist features",
    "medical spa AI features",
    "HIPAA compliant AI",
    "deterministic booking",
    "omnichannel healthcare communication",
    "AI voice assistant features",
    "medical spa automation features",
  ],
  openGraph: {
    title: "Eva AI Features - Complete AI Receptionist for Medical Spas",
    description: "Natural voice AI, 100% reliable booking, HIPAA compliance, omnichannel support, and enterprise security for your medical spa.",
    url: "https://getevaai.com/features",
  },
  alternates: {
    canonical: "https://getevaai.com/features",
  },
};

export default function FeaturesPage() {
  const features = [
    {
      icon: Phone,
      title: "Natural Voice AI",
      description: "Eva speaks with a warm, professional voice that puts patients at ease from the first hello.",
      details: [
        "Powered by OpenAI Realtime API for natural, human-like conversations",
        "Handles interruptions gracefully with dual-speed voice activity detection",
        "Persona enforcement ensures Eva always represents your brand consistently",
        "Supports common medical spa FAQs, pricing inquiries, and provider information",
      ],
      Visualization: VoiceAIViz,
    },
    {
      icon: Calendar,
      title: "Deterministic Appointment Booking",
      description: "100% reliable booking execution means every qualified caller gets an appointment—guaranteed.",
      details: [
        "Preemptive availability checking before AI generates responses",
        "Automatic booking execution when patient details are complete",
        "No AI hesitation or retry loops—instant confirmation every time",
        "Seamless integration with Google Calendar and Boulevard scheduling",
      ],
      Visualization: DeterministicBookingViz,
    },
    {
      icon: MessageSquare,
      title: "Omnichannel Communications",
      description: "Manage voice calls, SMS, and email in one unified customer timeline.",
      details: [
        "Single conversation view across all communication channels",
        "Multi-message threading for SMS and email conversations",
        "Cross-channel AI satisfaction scoring for complete patient insights",
        "Automatic context preservation when patients switch channels",
      ],
      Visualization: OmnichannelTimeline,
    },
    {
      icon: BarChart3,
      title: "AI-Powered Analytics",
      description: "Get actionable insights with GPT-4 powered sentiment analysis and satisfaction scoring.",
      details: [
        "Real-time satisfaction scoring (0-10 scale) for every conversation",
        "Sentiment analysis detects frustration, confusion, or satisfaction",
        "Daily, weekly, and monthly metrics aggregation",
        "Identify trends and optimize your patient experience",
      ],
      Visualization: AnalyticsViz,
    },
    {
      icon: Shield,
      title: "Enterprise Security & Compliance",
      description: "Built for healthcare with HIPAA compliance and enterprise-grade security.",
      details: [
        "HIPAA compliance package with Business Associate Agreement (BAA)",
        "End-to-end encrypted data storage and transmission",
        "Detailed audit logs for all patient interactions",
        "99.8% uptime SLA with redundant infrastructure",
      ],
      Visualization: SecurityViz,
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-blue-50/50 via-white to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-white border border-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium shadow-sm mb-8">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              <span>Feature-Rich & HIPAA Compliant</span>
            </div>
            <h1 className="heading-xl text-gray-900 mb-6">
              The Most Complete AI Receptionist for Med Spas
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              From natural voice conversations to instant SMS follow-ups, Eva handles the complexity so you can focus on patient care.
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="section-spacing">
        <div className="container-wide">
          {features.map((feature, index) => {
            const VizComponent = feature.Visualization;
            return (
              <div
                key={index}
                className={`flex flex-col ${
                  index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                } gap-12 lg:gap-20 items-center mb-32 last:mb-0`}
              >
                <FadeInUp className="flex-1 w-full">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl mb-6 shadow-sm">
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h2 className="heading-md text-gray-900 mb-4">
                    {feature.title}
                  </h2>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-4">
                    {feature.details.map((detail, i) => (
                      <li key={i} className="flex items-start">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5 mr-4">
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </div>
                        <span className="text-gray-700 text-lg">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </FadeInUp>

                <FadeInUp delay={0.2} className="flex-1 w-full">
                  <div className="aspect-square lg:aspect-auto lg:min-h-[400px] flex items-center justify-center relative">
                    <VizComponent />
                  </div>
                </FadeInUp>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
