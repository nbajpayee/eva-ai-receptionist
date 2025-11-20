"use client";

import FadeInUp from "@/components/animations/FadeInUp";
import { MessageSquare, CalendarCheck, ShieldCheck, ClipboardList, BarChart3, Smartphone } from "lucide-react";

const FEATURES = [
  {
    title: "Omnichannel Support",
    description: "Eva manages voice calls, SMS, and email in one unified thread. She follows up text inquiries with calls and vice versa.",
    icon: Smartphone,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Deterministic Booking",
    description: "Zero hallucinations. Eva checks real-time availability and locks in slots directly in your calendar (Google, Boulevard, Zenoti).",
    icon: CalendarCheck,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "HIPAA Compliant",
    description: "Enterprise-grade security with BAA availability. Your patient data is encrypted at rest and in transit.",
    icon: ShieldCheck,
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    title: "Smart Qualification",
    description: "Eva asks custom medical screening questions to ensure patients are eligible before booking any appointment.",
    icon: ClipboardList,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Analytics & Insights",
    description: "Track call volume, conversion rates, and patient sentiment with our real-time dashboard.",
    icon: BarChart3,
    color: "bg-amber-100 text-amber-600",
  },
  {
    title: "Natural Conversation",
    description: "Eva handles interruptions, understands context, and speaks with a warm, human-like voice.",
    icon: MessageSquare,
    color: "bg-pink-100 text-pink-600",
  },
];

export default function FeatureGrid() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Everything You Need to Run a Modern Front Desk
          </h2>
          <p className="text-xl text-gray-600">
            Eva combines advanced AI with the specific tools medical spas need to grow.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="group p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-xl transition-all duration-300 h-full">
                  <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </FadeInUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

