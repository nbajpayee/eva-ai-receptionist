import type { Metadata } from "next";
import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import { ChevronDown } from "lucide-react";
import Script from "next/script";
import { getFAQSchema } from "@/lib/structured-data";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing - AI Receptionist for Medical Spas",
  description: "Flexible AI receptionist pricing for medical spas. Save $30k-$40k annually vs hiring staff. No setup fees, month-to-month terms. HIPAA compliant. Book a free demo today.",
  openGraph: {
    title: "Eva AI Pricing - Affordable AI Receptionist for Medical Spas",
    description: "Flexible pricing tailored to your practice size. Save thousands annually with Eva AI's 24/7 receptionist service.",
    url: `${SITE_CONFIG.url}/pricing`,
  },
  alternates: {
    canonical: `${SITE_CONFIG.url}/pricing`,
  },
};

const FAQ_ITEMS = [
  {
    question: "How is Eva AI priced?",
    answer: "We offer flexible pricing based on your practice size, call volume, and specific needs. Schedule a demo to discuss a custom plan that fits your budget and requirements."
  },
  {
    question: "Is there a setup fee?",
    answer: "No setup fees. We handle all the configuration and training to get Eva integrated with your existing systems."
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, we offer month-to-month agreements with no long-term contracts. You can adjust or cancel your service at any time."
  },
  {
    question: "What's included in the service?",
    answer: "All plans include: 24/7 AI receptionist, appointment scheduling, Google Calendar integration, SMS confirmations, call analytics, and ongoing support. Advanced features like multi-location support and custom training are available based on your needs."
  },
  {
    question: "How long does implementation take?",
    answer: "Most practices are up and running within 48 hours. We handle the entire setup process including calendar integration, persona training, and testing."
  },
  {
    question: "Do you offer a free trial?",
    answer: "We offer a personalized demo where you can test Eva with your actual business information. Schedule a call to experience it firsthand."
  },
];

const pricingFaqSchema = getFAQSchema(FAQ_ITEMS);

export default function PricingPage() {
  return (
    <>
      {/* FAQ Structured Data */}
      <Script
        id="pricing-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pricingFaqSchema),
        }}
      />

      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="heading-xl text-gray-900 mb-6">
              Flexible Pricing for Every Practice
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8">
              Every practice is unique. We tailor our pricing to fit your specific needs, call volume, and growth goals.
            </p>
            <Link
              href="/contact"
              className="btn-primary inline-flex items-center text-lg px-8 py-4"
            >
              Talk to Sales
            </Link>
          </FadeInUp>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FadeInUp delay={0.1}>
              <div className="text-center p-8 bg-white rounded-2xl border border-gray-200">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Setup Fees</h3>
                <p className="text-gray-600">Get started with zero upfront costs. We handle all configuration and training.</p>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.2}>
              <div className="text-center p-8 bg-white rounded-2xl border border-gray-200">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Flexible Terms</h3>
                <p className="text-gray-600">Month-to-month agreements with no long-term contracts. Cancel or adjust anytime.</p>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.3}>
              <div className="text-center p-8 bg-white rounded-2xl border border-gray-200">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Scalable Solutions</h3>
                <p className="text-gray-600">Start small and grow. Our pricing scales with your practice as you expand.</p>
              </div>
            </FadeInUp>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">
              What&apos;s Included
            </h2>
            <p className="text-xl text-gray-600">
              Enterprise-grade features, tailored to your needs
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              "24/7 AI voice receptionist",
              "Appointment scheduling & rescheduling",
              "Google Calendar integration",
              "SMS confirmations & reminders",
              "Multi-channel support (Voice, SMS, Email)",
              "Real-time analytics dashboard",
              "AI-powered satisfaction scoring",
              "Customer management & history",
              "Missed call recovery",
              "HIPAA compliance options",
              "Ongoing support & updates",
              "Custom persona training"
            ].map((feature, i) => (
              <FadeInUp key={i} delay={i * 0.05}>
                <div className="flex items-start p-4 bg-gray-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-3 mt-0.5">
                    <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-800 font-medium">{feature}</span>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-spacing bg-gray-50">
        <div className="container-narrow">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </FadeInUp>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, index) => (
              <FadeInUp key={index} delay={index * 0.05}>
                <details className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary-200 hover:shadow-md transition-all cursor-pointer open:bg-gray-50">
                  <summary className="flex justify-between items-center list-none">
                    <span className="font-semibold text-gray-900 text-lg pr-8">
                      {item.question}
                    </span>
                    <span className="p-2 bg-gray-100 rounded-full group-hover:bg-primary-50 transition-colors shrink-0">
                      <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
                    </span>
                  </summary>
                  <p className="mt-4 text-gray-600 leading-relaxed pl-1">
                    {item.answer}
                  </p>
                </details>
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
