import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import { Phone, Calendar, MessageSquare, BarChart3, Gauge, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Features",
  description: "Discover all the powerful features that make Eva the industry-leading AI receptionist for medical spas and aesthetic practices.",
};

export default function FeaturesPage() {
  const features = [
    {
      icon: Phone,
      title: "Natural Voice AI",
      description: "Eva speaks with a warm, professional voice that puts patients at ease from the first hello.",
      details: [
        "Powered by OpenAI Realtime API for natural, human-like conversations",
        "Handles interruptions gracefully with dual-speed voice activity detection (120ms/300ms)",
        "Persona enforcement ensures Eva always represents your brand consistently",
        "Supports common medical spa FAQs, pricing inquiries, and provider information",
      ],
      image: "/mockups/voice-interface.png",
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
      image: "/mockups/booking-flow.png",
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
      image: "/mockups/omnichannel.png",
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
      image: "/mockups/analytics.png",
    },
    {
      icon: Gauge,
      title: "Admin Dashboard",
      description: "Monitor conversations, track KPIs, and optimize performance in real-time.",
      details: [
        "Live conversation monitoring with full transcript access",
        "Filterable call history by date, provider, service, or outcome",
        "Provider performance metrics and comparison",
        "Exportable reports for stakeholders and team meetings",
      ],
      image: "/mockups/dashboard.png",
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
      image: "/mockups/security.png",
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto">
            <h1 className="heading-xl text-gray-900 mb-6">
              Every Feature Your Front Desk Needs
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              From voice AI to analytics, Eva handles the complexity so you can focus on patients.
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="section-spacing">
        <div className="container-wide">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
              } gap-12 items-center mb-24 last:mb-0`}
            >
              <FadeInUp className="flex-1">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl mb-6">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h2 className="heading-md text-gray-900 mb-4">
                  {feature.title}
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-3">
                  {feature.details.map((detail, i) => (
                    <li key={i} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700">{detail}</span>
                    </li>
                  ))}
                </ul>
              </FadeInUp>

              <FadeInUp delay={0.2} className="flex-1">
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl aspect-video flex items-center justify-center shadow-lg">
                  <p className="text-gray-500 text-sm">Feature Demo Placeholder</p>
                </div>
              </FadeInUp>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
