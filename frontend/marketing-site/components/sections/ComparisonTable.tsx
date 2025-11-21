"use client";

import FadeInUp from "@/components/animations/FadeInUp";
import { Check, X, Minus, HelpCircle } from "lucide-react";

const COMPARISON_DATA = [
  {
    feature: "Annual Cost",
    eva: "Customized Pricing",
    human: "$35,000 - $45,000",
    center: "$12,000+",
    highlight: true,
  },
  {
    feature: "Availability",
    eva: "24/7/365",
    human: "40 hours/week",
    center: "24/7 (usually extra)",
  },
  {
    feature: "Concurrent Calls",
    eva: "Unlimited",
    human: "1 at a time",
    center: "Limited by staff",
  },
  {
    feature: "Booking Accuracy",
    eva: "100% (Deterministic)",
    human: "Prone to errors",
    center: "Often messes up calendar",
  },
  {
    feature: "Medical Knowledge",
    eva: "Trained on your services",
    human: "Requires training",
    center: "Generic scripts only",
  },
  {
    feature: "Response Time",
    eva: "Instant",
    human: "Missed calls / Voicemail",
    center: "Long hold times",
  },
  {
    feature: "Follow-up (SMS/Email)",
    eva: "Automatic & Instant",
    human: "Manual (often forgotten)",
    center: "Rarely included",
  },
];

export default function ComparisonTable() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Why Practices Are Switching to Eva
          </h2>
          <p className="text-xl text-gray-600">
            Stop overpaying for coverage. Get better results for a fraction of the cost.
          </p>
        </FadeInUp>

        <FadeInUp delay={0.2}>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-lg">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-6 bg-gray-50 border-b border-gray-200 text-gray-500 font-medium w-1/4">
                    Comparison
                  </th>
                  <th className="p-6 bg-primary-50/50 border-b border-primary-100 text-primary-700 font-bold text-xl w-1/4">
                    <div className="flex items-center gap-2">
                      <span>Eva AI</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold uppercase tracking-wide">
                        Winner
                      </span>
                    </div>
                  </th>
                  <th className="p-6 bg-white border-b border-gray-200 text-gray-900 font-semibold w-1/4">
                    Front Desk Staff
                  </th>
                  <th className="p-6 bg-white border-b border-gray-200 text-gray-900 font-semibold w-1/4">
                    Call Center
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_DATA.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="p-6 border-b border-gray-100 font-medium text-gray-700">
                      {row.feature}
                    </td>
                    <td className="p-6 border-b border-primary-100 bg-primary-50/30 text-primary-900 font-semibold">
                      {row.highlight ? (
                        <span className="text-green-600 font-bold">{row.eva}</span>
                      ) : (
                        row.eva
                      )}
                    </td>
                    <td className="p-6 border-b border-gray-100 text-gray-600">
                      {row.human}
                    </td>
                    <td className="p-6 border-b border-gray-100 text-gray-600">
                      {row.center}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeInUp>
      </div>
    </section>
  );
}

