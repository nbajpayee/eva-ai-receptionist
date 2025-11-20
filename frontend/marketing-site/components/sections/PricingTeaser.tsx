"use client";

import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import { PRICING_TIERS } from "@/lib/constants";
import { Check, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function PricingTeaser() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Plans for Practices of Every Size
          </h2>
          <p className="text-xl text-gray-600">
            Transparent pricing with no hidden fees.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier, index) => (
            <FadeInUp key={index} delay={index * 0.1}>
              <div
                className={`relative rounded-2xl p-8 h-full flex flex-col ${
                  tier.popular
                    ? "bg-gradient-to-b from-primary-50 to-white border-2 border-primary-500 shadow-xl"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
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

                <div className="mb-6">
                  {tier.price ? (
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatCurrency(tier.price)}
                      </span>
                      <span className="text-gray-600 ml-2">/{tier.period}</span>
                    </div>
                  ) : (
                    <div className="text-4xl font-bold text-gray-900">
                      Custom
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-0 flex-1">
                  {tier.features.slice(0, 6).map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInUp>
          ))}
        </div>

        <FadeInUp delay={0.4}>
          <div className="text-center mt-12">
            <Link
              href="/contact"
              className="btn-primary text-lg px-8 py-4 group shadow-lg shadow-primary-500/20 inline-flex items-center"
            >
              Book a Demo
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </FadeInUp>
      </div>
    </section>
  );
}
