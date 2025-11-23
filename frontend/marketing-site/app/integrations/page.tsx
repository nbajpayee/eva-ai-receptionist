import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import IntegrationsViz from "@/components/ui/IntegrationsViz";
import CTASection from "@/components/sections/CTASection";
import { Check, ArrowRight, Calendar, MessageSquare, Mail, Shield, Database, Server } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integrations - Connect Eva AI with Your Medical Spa Software",
  description: "Eva AI integrates seamlessly with Boulevard, Zenoti, Google Calendar, Twilio, SendGrid, Vagaro, and more. Two-way sync for appointments, client profiles, and automated communications.",
  keywords: [
    "medical spa integrations",
    "Boulevard integration",
    "Zenoti integration",
    "Google Calendar integration",
    "medical spa software integrations",
    "AI receptionist integrations",
    "healthcare software API",
  ],
  openGraph: {
    title: "Eva AI Integrations - Seamless Medical Spa Software Connections",
    description: "Connect Eva AI with Boulevard, Zenoti, Google Calendar, and your entire tech stack. Setup takes less than an hour.",
    url: "https://getevaai.com/integrations",
  },
  alternates: {
    canonical: "https://getevaai.com/integrations",
  },
};

const INTEGRATIONS = [
  {
    name: "Boulevard",
    description: "Two-way sync for appointments, client profiles, and service menus.",
    status: "Live",
    icon: Calendar,
    color: "bg-purple-100 text-purple-600",
  },
  {
    name: "Zenoti",
    description: "Enterprise-grade integration for multi-location booking and inventory.",
    status: "Live",
    icon: Database,
    color: "bg-orange-100 text-orange-600",
  },
  {
    name: "Google Calendar",
    description: "Perfect for solo practitioners. Real-time availability checks and event creation.",
    status: "Live",
    icon: Calendar,
    color: "bg-blue-100 text-blue-600",
  },
  {
    name: "Twilio",
    description: "Powering our SMS and voice infrastructure with carrier-grade reliability.",
    status: "Live",
    icon: MessageSquare,
    color: "bg-red-100 text-red-600",
  },
  {
    name: "SendGrid",
    description: "Transactional email delivery for appointment confirmations and follow-ups.",
    status: "Live",
    icon: Mail,
    color: "bg-blue-100 text-blue-600",
  },
  {
    name: "Vagaro",
    description: "Seamless booking integration for beauty and wellness professionals.",
    status: "Beta",
    icon: Calendar,
    color: "bg-red-100 text-red-600",
  },
  {
    name: "Jane App",
    description: "EHR and scheduling integration for allied health clinics.",
    status: "Coming Soon",
    icon: Shield,
    color: "bg-teal-100 text-teal-600",
  },
  {
    name: "Mindbody",
    description: "Connect with the leading wellness business management software.",
    status: "Coming Soon",
    icon: Server,
    color: "bg-orange-100 text-orange-600",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="section-spacing pt-32 bg-slate-950 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
        
        <div className="container-wide relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeInUp className="text-left">
              <h1 className="heading-xl text-white mb-6">
                The Hub of Your <br />
                <span className="text-primary-400">Digital Practice</span>
              </h1>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed max-w-xl">
                Eva doesn&apos;t work in a silo. She connects directly with your existing EHR, scheduling, and communication tools to create a unified workflow.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="#book-demo" className="btn-primary">
                  Request New Integration
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
                <Link
                  href="#directory"
                  className="btn-secondary bg-white/10 text-white border-white/30 hover:bg-white/20"
                >
                  View Directory
                </Link>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.2} className="h-[500px] flex items-center justify-center">
              <IntegrationsViz />
            </FadeInUp>
          </div>
        </div>
      </section>

      {/* Integration Directory */}
      <section id="directory" className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="heading-lg text-gray-900 mb-4">
              Supported Platforms
            </h2>
            <p className="text-xl text-gray-600">
              We&apos;re constantly adding new integrations. Don&apos;t see yours? Let us know.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {INTEGRATIONS.map((integration, index) => {
              const Icon = integration.icon;
              return (
                <FadeInUp key={index} delay={index * 0.1}>
                  <div className="group p-8 rounded-2xl border border-gray-200 bg-white hover:shadow-xl hover:border-primary-100 transition-all duration-300 h-full flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`w-14 h-14 rounded-xl ${integration.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${
                        integration.status === 'Live' ? 'bg-green-100 text-green-700' :
                        integration.status === 'Beta' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {integration.status}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {integration.name}
                    </h3>
                    <p className="text-gray-600 leading-relaxed mb-6 flex-1">
                      {integration.description}
                    </p>

                    <div className="flex items-center text-primary-600 font-semibold text-sm group-hover:translate-x-1 transition-transform cursor-pointer">
                      Learn more <ArrowRight className="ml-1 w-4 h-4" />
                    </div>
                  </div>
                </FadeInUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* Developer API Teaser */}
      <section className="section-spacing bg-gray-50 border-y border-gray-200">
        <div className="container-wide">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-500/10 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <h2 className="heading-md mb-6">Building something custom?</h2>
                <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                  Use our REST API to build custom workflows, extract conversation data, or trigger outbound calls programmatically.
                </p>
                <ul className="space-y-4 mb-8">
                  {[
                    "Webhooks for call completion events",
                    "Programmatic outbound calling",
                    "Raw audio and transcript access",
                    "Custom context injection"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center mr-3">
                        <Check className="w-3 h-3 text-primary-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="btn-secondary bg-white/10 text-white border-white/30 hover:bg-white/20">
                  Read Documentation
                </button>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 font-mono text-sm text-slate-300 shadow-2xl">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-slate-500">POST /v1/calls/outbound</span>
                </div>
                <pre className="overflow-x-auto">
                  <code className="language-json">
{`{
  "phone_number": "+15550123456",
  "prompt_context": {
    "patient_name": "Sarah",
    "appointment_time": "2023-10-24T14:00:00Z",
    "type": "confirmation"
  },
  "webhook_url": "https://api.yoursite.com/hooks"
}`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

