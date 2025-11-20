import type { Metadata } from "next";
import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import ROICalculator from "@/components/sections/ROICalculator";
import { PRICING_TIERS, FAQ_ITEMS } from "@/lib/constants";
import { Check, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent pricing for every practice size. Book a demo to see how Eva AI can transform your front desk.",
};

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="heading-xl text-gray-900 mb-6">
              Transparent Pricing for Every Practice
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              No setup fees. No long-term contracts. Just simple, scalable pricing that grows with you.
            </p>
          </FadeInUp>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-24">
            {PRICING_TIERS.map((tier, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div
                  className={`relative rounded-3xl p-8 h-full flex flex-col transition-all duration-300 ${
                    tier.popular
                      ? "bg-white ring-2 ring-primary-500 shadow-2xl scale-105 z-10"
                      : "bg-gray-50/50 border border-gray-200 hover:bg-white hover:shadow-xl hover:-translate-y-1"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg tracking-wide">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {tier.name}
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed min-h-[40px]">
                      {tier.description}
                    </p>
                  </div>

                  <div className="mb-8 pb-8 border-b border-gray-100">
                    {tier.price ? (
                      <div className="flex items-baseline">
                        <span className="text-5xl font-bold text-gray-900 tracking-tight">
                          {formatCurrency(tier.price)}
                        </span>
                        <span className="text-gray-500 ml-2 font-medium">/{tier.period}</span>
                      </div>
                    ) : (
                      <div className="text-5xl font-bold text-gray-900 tracking-tight">
                        Custom
                      </div>
                    )}
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start group">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 mr-3 ${tier.popular ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/contact"
                    className={`w-full text-center py-4 px-6 rounded-xl font-bold text-sm tracking-wide transition-all ${
                      tier.popular
                        ? "btn-primary shadow-primary-500/25 hover:shadow-primary-500/40"
                        : "bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="section-spacing bg-white pt-0">
        <div className="container-wide">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">
              Compare Plans
            </h2>
            <p className="text-xl text-gray-600">
              A detailed look at what&apos;s included
            </p>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="overflow-x-auto pb-4">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="text-left p-6 border-b border-gray-200 bg-gray-50/50 rounded-tl-2xl w-1/3">
                      <span className="text-gray-900 font-bold text-lg">Feature</span>
                    </th>
                    <th className="text-center p-6 border-b border-gray-200 w-1/5">
                      <span className="text-gray-900 font-bold block">Starter</span>
                    </th>
                    <th className="text-center p-6 border-b border-primary-100 bg-primary-50/30 w-1/5 relative">
                      <span className="text-primary-700 font-bold block">Professional</span>
                    </th>
                    <th className="text-center p-6 border-b border-gray-200 rounded-tr-2xl w-1/5">
                      <span className="text-gray-900 font-bold block">Enterprise</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { feature: "Monthly calls", starter: "100", pro: "500", enterprise: "Unlimited" },
                    { feature: "Voice AI receptionist", starter: true, pro: true, enterprise: true },
                    { feature: "SMS support", starter: false, pro: true, enterprise: true },
                    { feature: "Email support", starter: true, pro: true, enterprise: true },
                    { feature: "Priority phone support", starter: false, pro: true, enterprise: true },
                    { feature: "Dedicated success manager", starter: false, pro: false, enterprise: true },
                    { feature: "Locations", starter: "1", pro: "3", enterprise: "Unlimited" },
                    { feature: "Advanced Analytics", starter: false, pro: true, enterprise: true },
                    { feature: "AI satisfaction scoring", starter: false, pro: true, enterprise: true },
                    { feature: "Custom persona training", starter: false, pro: "Basic", enterprise: "Advanced" },
                    { feature: "White-label options", starter: false, pro: false, enterprise: true },
                    { feature: "HIPAA BAA", starter: false, pro: true, enterprise: true },
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="p-6 text-gray-700 font-medium">{row.feature}</td>
                      <td className="p-6 text-center">
                        {typeof row.starter === "boolean" ? (
                          row.starter ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <div className="w-4 h-px bg-gray-300 mx-auto" />
                        ) : (
                          <span className="text-gray-900 font-semibold">{row.starter}</span>
                        )}
                      </td>
                      <td className="p-6 text-center bg-primary-50/10">
                        {typeof row.pro === "boolean" ? (
                          row.pro ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <div className="w-4 h-px bg-gray-300 mx-auto" />
                        ) : (
                          <span className="text-primary-700 font-bold">{row.pro}</span>
                        )}
                      </td>
                      <td className="p-6 text-center">
                        {typeof row.enterprise === "boolean" ? (
                          row.enterprise ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <div className="w-4 h-px bg-gray-300 mx-auto" />
                        ) : (
                          <span className="text-gray-900 font-semibold">{row.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="section-spacing bg-gray-50">
        <div className="container-narrow">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">
              See Your Potential Savings
            </h2>
            <p className="text-xl text-gray-600">
              Calculate how much revenue you&apos;re leaving on the table with missed calls
            </p>
          </FadeInUp>

          <ROICalculator />
        </div>
      </section>

      {/* FAQ */}
      <section className="section-spacing bg-white">
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
