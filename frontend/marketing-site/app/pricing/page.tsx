import type { Metadata } from "next";
import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import ROICalculator from "@/components/sections/ROICalculator";
import { PRICING_TIERS, FAQ_ITEMS } from "@/lib/constants";
import { Check, X, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent pricing for every practice size. Start your free 14-day trial of Eva AI today—no credit card required.",
};

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="heading-xl text-gray-900 mb-6">
              Transparent Pricing for Every Practice Size
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              No hidden fees. No setup costs. Start your free 14-day trial today.
            </p>
          </FadeInUp>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {PRICING_TIERS.map((tier, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div
                  className={`relative rounded-2xl p-8 h-full flex flex-col ${
                    tier.popular
                      ? "bg-gradient-to-b from-primary-50 to-white border-2 border-primary-500 shadow-2xl scale-105"
                      : "bg-white border border-gray-200 shadow-sm"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {tier.name}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {tier.description}
                    </p>
                  </div>

                  <div className="mb-8">
                    {tier.price ? (
                      <div className="flex items-baseline">
                        <span className="text-5xl font-bold text-gray-900">
                          {formatCurrency(tier.price)}
                        </span>
                        <span className="text-gray-600 ml-2">/{tier.period}</span>
                      </div>
                    ) : (
                      <div className="text-5xl font-bold text-gray-900">
                        Custom
                      </div>
                    )}
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/contact"
                    className={`w-full text-center py-4 px-6 rounded-lg font-semibold transition-all ${
                      tier.popular
                        ? "bg-primary-500 text-white hover:bg-primary-600 shadow-md hover:shadow-lg"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200"
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
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">
              Compare Plans
            </h2>
            <p className="text-xl text-gray-600">
              See exactly what's included in each plan
            </p>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-xl">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-900">Feature</th>
                    <th className="text-center p-4 font-semibold text-gray-900">Starter</th>
                    <th className="text-center p-4 font-semibold text-gray-900 bg-primary-50">Professional</th>
                    <th className="text-center p-4 font-semibold text-gray-900">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    { feature: "Monthly calls", starter: "500", pro: "Unlimited", enterprise: "Unlimited" },
                    { feature: "Voice AI receptionist", starter: true, pro: true, enterprise: true },
                    { feature: "SMS support", starter: false, pro: true, enterprise: true },
                    { feature: "Email support (ticket)", starter: true, pro: false, enterprise: false },
                    { feature: "Priority support", starter: false, pro: true, enterprise: true },
                    { feature: "Dedicated account manager", starter: false, pro: false, enterprise: true },
                    { feature: "Locations", starter: "1", pro: "3", enterprise: "Unlimited" },
                    { feature: "Analytics & reporting", starter: "Basic", pro: "Advanced", enterprise: "Enterprise" },
                    { feature: "AI satisfaction scoring", starter: false, pro: true, enterprise: true },
                    { feature: "Custom persona training", starter: false, pro: true, enterprise: true },
                    { feature: "White-label options", starter: false, pro: false, enterprise: true },
                    { feature: "HIPAA compliance package", starter: false, pro: false, enterprise: true },
                    { feature: "SLA guarantees", starter: false, pro: false, enterprise: true },
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-700">{row.feature}</td>
                      <td className="p-4 text-center">
                        {typeof row.starter === "boolean" ? (
                          row.starter ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700">{row.starter}</span>
                        )}
                      </td>
                      <td className="p-4 text-center bg-primary-50/30">
                        {typeof row.pro === "boolean" ? (
                          row.pro ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700 font-medium">{row.pro}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {typeof row.enterprise === "boolean" ? (
                          row.enterprise ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700">{row.enterprise}</span>
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
              Calculate how much revenue you're leaving on the table with missed calls
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
                <details className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-primary-300 transition-colors">
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <span className="font-semibold text-gray-900 text-lg">
                      {item.question}
                    </span>
                    <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-4 text-gray-600 leading-relaxed">
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
