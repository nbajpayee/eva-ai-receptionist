"use client";

import FadeInUp from "@/components/animations/FadeInUp";
import CalendlyEmbed from "@/components/sections/CalendlyEmbed";
import { SITE_CONFIG } from "@/lib/constants";
import { CheckCircle2, Clock, Mail } from "lucide-react";

export default function CTASection() {
  return (
    <section
      id="book-demo"
      className="section-spacing bg-gradient-to-br from-primary-600 to-primary-800 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div className="container-wide relative">
        <div className="grid lg:grid-cols-2 gap-10">
          <FadeInUp>
            <div className="bg-white/95 rounded-3xl p-10 shadow-2xl border border-white/40">
              <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-4">
                Book a Live Demo
              </p>
              <h2 className="heading-lg text-gray-900 mb-4">
                Ready to Transform Your Front Desk?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Schedule a personalized walkthrough to see how Eva books deterministically, handles follow-ups, and
                keeps your patients delighted 24/7.
              </p>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                    <a
                      href={`mailto:${SITE_CONFIG.contact.email}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      {SITE_CONFIG.contact.email}
                    </a>
                    <p className="text-sm text-gray-500">We&apos;ll respond within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Business Hours</h3>
                    <p className="text-gray-600">Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                    <p className="text-gray-600">Saturday - Sunday: Closed</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-primary-50 border border-primary-100">
                  <h4 className="font-semibold text-gray-900 mb-2">What to expect</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {[
                      "Personalized walkthrough of your call flow",
                      "See the deterministic booking engine in action",
                      "Q&A with a product specialist",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary-600 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <CalendlyEmbed />
          </FadeInUp>
        </div>
      </div>
    </section>
  );
}
