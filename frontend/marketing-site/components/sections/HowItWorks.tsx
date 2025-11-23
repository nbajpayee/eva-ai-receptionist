"use client";

import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import { Phone, ClipboardCheck, CalendarSearch, CheckCircle2, MessageSquare } from "lucide-react";

const STEPS = [
  {
    title: "Patient Calls",
    description: "Patient calls your practice. Eva answers instantly, day or night, with your custom greeting.",
    icon: Phone,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Smart Qualification",
    description: "Eva asks screening questions to ensure the patient is eligible for treatment before proceeding.",
    icon: ClipboardCheck,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Real-time Check",
    description: "She checks your live calendar for availability, ensuring no double-bookings ever occur.",
    icon: CalendarSearch,
    color: "bg-amber-100 text-amber-600",
  },
  {
    title: "Instant Booking",
    description: "The appointment is secured directly in your schedule (Google, Boulevard, Zenoti, etc.).",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Omnichannel Follow-up",
    description: "Eva immediately sends a confirmation SMS and an email with prep instructions.",
    icon: MessageSquare,
    color: "bg-pink-100 text-pink-600",
  },
];

export default function HowItWorks() {
  return (
    <section className="section-spacing bg-gray-50 relative overflow-hidden">
      {/* Connecting Line (Desktop) */}
      <div className="hidden lg:block absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-12 z-0" />

      <div className="container-wide relative z-10">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="heading-lg text-gray-900 mb-4">
            How Eva Handles the Perfect Booking
          </h2>
          <p className="text-xl text-gray-600">
            From the first &ldquo;Hello&rdquo; to the final confirmation, the entire process is automated, seamless, and reliable. Learn more about our <Link href="/features" className="text-primary-600 hover:text-primary-700 font-semibold underline underline-offset-2">HIPAA-compliant features</Link> and <Link href="/integrations" className="text-primary-600 hover:text-primary-700 font-semibold underline underline-offset-2">scheduling integrations</Link>.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-5 gap-8 relative">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <FadeInUp key={index} delay={index * 0.1} className="relative group">
                {/* Step Number */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-sm font-bold text-gray-400 group-hover:border-primary-500 group-hover:text-primary-500 transition-colors z-10">
                  {index + 1}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 h-full hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                  <div className={`w-14 h-14 rounded-xl ${step.color} flex items-center justify-center mb-6 mx-auto`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Arrow (Mobile only) */}
                {index < STEPS.length - 1 && (
                  <div className="md:hidden flex justify-center py-4">
                    <div className="w-0.5 h-8 bg-gray-200" />
                  </div>
                )}
              </FadeInUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

