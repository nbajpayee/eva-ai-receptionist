import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import { Play, Phone, Volume2, Mic, Settings } from "lucide-react";
import AudioWaveform from "@/components/ui/AudioWaveform";

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
          <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
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
      <section className="section-spacing bg-white pt-0">
        <div className="container-narrow">
          <FadeInUp>
            <div className="bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-800 relative">
              {/* Top Bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-white/90 font-medium text-sm tracking-wide">System Online</span>
                </div>
                <div className="flex items-center space-x-4 text-gray-400">
                  <Settings className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                  <div className="h-4 w-px bg-gray-700" />
                  <span className="text-xs font-mono text-gray-500">v2.4.0-beta</span>
                </div>
              </div>

              {/* Main Interface */}
              <div className="aspect-video flex flex-col items-center justify-center p-12 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black">
                {/* Animated Background */}
                <div className="absolute inset-0 overflow-hidden">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 text-center space-y-8 max-w-md mx-auto">
                  <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 bg-primary-500/30 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                    <div className="w-24 h-24 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full flex items-center justify-center relative shadow-xl border border-white/10 group-hover:scale-105 transition-transform duration-300 mx-auto">
                      <Mic className="w-10 h-10 text-white" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">
                      Tap to Speak
                    </h3>
                    <p className="text-gray-400 text-lg">
                      Try saying: <span className="text-primary-300">&quot;I&apos;d like to book a Botox appointment&quot;</span>
                    </p>
                  </div>

                  <div className="flex justify-center pt-4">
                    <div className="inline-flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm text-gray-300">
                      <Volume2 className="w-4 h-4 text-gray-400" />
                      <span>Microphone access required</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcript Area (Simulated) */}
              <div className="bg-gray-950 p-8 border-t border-gray-800">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Eva AI</p>
                      <span className="text-xs text-gray-500">Now</span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">
                      Hello! Thank you for calling. This is Eva. How can I help you today?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="mt-8 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl flex items-center gap-3 text-sm text-amber-800">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <p>
                This is a frontend demo visualization. To connect to the live WebSocket backend, ensure the server is running on port 8000.
              </p>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* Scenarios Grid */}
      <section className="section-spacing bg-gray-50">
        <div className="container-wide">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-md text-gray-900 mb-4">
              Demo Scenarios
            </h2>
            <p className="text-xl text-gray-600">
              Common conversations Eva handles perfectly every day.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {scenarios.map((scenario, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-primary-200 hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-500 transition-colors duration-300">
                    <Play className="w-5 h-5 text-primary-600 group-hover:text-white transition-colors" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {scenario.title}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4 flex-1">
                    {scenario.description}
                  </p>
                  
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Duration: {scenario.duration}
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
