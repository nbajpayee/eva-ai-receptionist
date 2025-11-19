import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import { Play, Phone, Volume2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Voice Demo",
  description: "Experience Eva AI yourself. Try our interactive voice demo to hear how Eva handles real medical spa booking scenarios.",
};

export default function VoiceDemoPage() {
  const scenarios = [
    {
      title: "Book a Botox Appointment",
      description: "See how Eva collects patient information and schedules an appointment",
      duration: "~2 min",
    },
    {
      title: "Pricing & Hours Inquiry",
      description: "Watch Eva answer common questions about services and availability",
      duration: "~1 min",
    },
    {
      title: "Treatment Recommendations",
      description: "Hear Eva provide helpful information about different aesthetic services",
      duration: "~2 min",
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="heading-xl text-gray-900 mb-6">
              Experience Eva Yourself
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              Try our interactive voice demo to see how Eva handles real booking scenarios with natural, empathetic conversations.
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="section-spacing bg-white">
        <div className="container-narrow">
          <FadeInUp>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Demo Interface */}
              <div className="aspect-video flex flex-col items-center justify-center p-12 relative">
                {/* Waveform Placeholder */}
                <div className="absolute inset-0 opacity-10">
                  <div className="flex items-center justify-center h-full space-x-2">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-white rounded-full"
                        style={{
                          height: `${Math.random() * 100}%`,
                          animation: `pulse ${Math.random() * 2 + 1}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative z-10 text-center">
                  <div className="w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-8 hover:bg-primary-600 transition-all hover:scale-110 cursor-pointer shadow-2xl">
                    <Play className="w-12 h-12 text-white ml-2" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-4">
                    Click to Start Voice Demo
                  </h3>

                  <p className="text-gray-400 mb-8">
                    Try saying: &quot;I&apos;d like to book a Botox appointment for next Tuesday&quot;
                  </p>

                  <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20">
                    <Volume2 className="w-5 h-5 text-white" />
                    <span className="text-white text-sm">Make sure your microphone is enabled</span>
                  </div>
                </div>
              </div>

              {/* Transcript Area */}
              <div className="bg-gray-100 p-8 border-t border-gray-700">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Eva AI</p>
                    <p className="text-gray-700">
                      Hello! Thank you for calling. This is Eva. How can I help you today?
                    </p>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-500 mt-6">
                  Real-time transcript will appear here during the conversation
                </div>
              </div>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> This is a placeholder for the interactive voice demo. To enable the full demo experience, connect this page to the Eva AI backend WebSocket endpoint at <code className="bg-yellow-100 px-2 py-1 rounded">/ws/voice/&#123;session_id&#125;</code>.
              </p>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* Pre-recorded Scenarios */}
      <section className="section-spacing bg-gray-50">
        <div className="container-wide">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-md text-gray-900 mb-4">
              Or Watch These Scenarios
            </h2>
            <p className="text-xl text-gray-600">
              See how Eva handles different types of patient conversations
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {scenarios.map((scenario, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="card hover:border-primary-200 cursor-pointer group">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl mb-6 group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {scenario.title}
                  </h3>

                  <p className="text-gray-600 text-sm mb-4">
                    {scenario.description}
                  </p>

                  <div className="text-xs text-gray-500">
                    Duration: {scenario.duration}
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-spacing bg-white">
        <div className="container-narrow">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-md text-gray-900 mb-4">
              How Eva&apos;s Voice AI Works
            </h2>
          </FadeInUp>

          <div className="space-y-8">
            <FadeInUp delay={0.1}>
              <div className="flex items-start space-x-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Real-Time Speech Recognition
                  </h3>
                  <p className="text-gray-600">
                    Powered by OpenAI&apos;s Realtime API, Eva converts speech to text instantly with 120ms latency for natural conversation flow.
                  </p>
                </div>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.2}>
              <div className="flex items-start space-x-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Natural Language Understanding
                  </h3>
                  <p className="text-gray-600">
                    Eva comprehends patient intent, handles interruptions gracefully, and asks clarifying questions when needed.
                  </p>
                </div>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.3}>
              <div className="flex items-start space-x-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Deterministic Action Execution
                  </h3>
                  <p className="text-gray-600">
                    When booking details are complete, Eva automatically schedules the appointment—no hesitation, no retry loops, 100% reliability.
                  </p>
                </div>
              </div>
            </FadeInUp>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
