"use client";

import FadeInUp from "@/components/animations/FadeInUp";
import CalendlyEmbed from "@/components/sections/CalendlyEmbed";
import { SITE_CONFIG } from "@/lib/constants";
import { Mail, ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section
      id="book-demo"
      className="section-spacing bg-gradient-to-br from-primary-600 to-primary-800 relative overflow-hidden"
    >
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>
      
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary-500/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container-wide relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Content (5 cols) */}
          <div className="lg:col-span-5 text-white space-y-8">
            <FadeInUp>
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium border border-white/20 backdrop-blur-sm">
                  Accepting New Beta Partners
                </div>
                
                <h2 className="heading-xl text-white">
                  Ready to Transform Your Front Desk?
                </h2>
                
                <p className="text-xl text-primary-50 leading-relaxed font-light">
                  Schedule a personalized walkthrough to see how Eva books deterministically, handles follow-ups, and keeps your patients delighted 24/7.
                </p>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.1}>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl text-white">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-primary-200 text-sm font-medium mb-0.5">Prefer to email?</p>
                    <a
                      href={`mailto:${SITE_CONFIG.contact.email}`}
                      className="text-lg font-semibold hover:text-primary-200 transition-colors flex items-center gap-2 group"
                    >
                      {SITE_CONFIG.contact.email}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            </FadeInUp>
          </div>

          {/* Right Content (7 cols) - Calendly Widget */}
          <div className="lg:col-span-7">
            <FadeInUp delay={0.2}>
               <CalendlyEmbed />
            </FadeInUp>
          </div>
        </div>
      </div>
    </section>
  );
}
