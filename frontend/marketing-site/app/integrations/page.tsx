import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import { INTEGRATIONS } from "@/lib/constants";
import { Check, Clock, Calendar as CalendarIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Eva AI connects seamlessly with your existing tools—Google Calendar, Boulevard, Twilio, and more. Build custom integrations with our API.",
};

export default function IntegrationsPage() {
  const statusColors = {
    live: "bg-green-100 text-green-700 border-green-200",
    "coming-soon": "bg-yellow-100 text-yellow-700 border-yellow-200",
    planned: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const statusIcons = {
    live: Check,
    "coming-soon": Clock,
    planned: CalendarIcon,
  };

  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="heading-xl text-gray-900 mb-6">
              Eva Connects to Your Existing Tools
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              Seamlessly integrate with your calendar, scheduling software, and communication platforms—no disruption to your workflow.
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Integrations Grid */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {INTEGRATIONS.map((integration, index) => {
              const StatusIcon = statusIcons[integration.status as keyof typeof statusIcons];
              return (
                <FadeInUp key={index} delay={index * 0.1}>
                  <div className="card h-full flex flex-col">
                    {/* Logo Placeholder */}
                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                      <span className="text-2xl font-bold text-gray-400">
                        {integration.name.charAt(0)}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {integration.name}
                    </h3>

                    <p className="text-gray-600 mb-4 flex-1">
                      {integration.description}
                    </p>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${
                          statusColors[integration.status as keyof typeof statusColors]
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>
                          {integration.status === "live"
                            ? "Live"
                            : integration.status === "coming-soon"
                            ? "Coming Soon"
                            : "Planned"}
                        </span>
                      </span>
                    </div>
                  </div>
                </FadeInUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* API Section */}
      <section className="section-spacing bg-gray-50">
        <div className="container-narrow">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-md text-gray-900 mb-4">
              Build Custom Integrations
            </h2>
            <p className="text-xl text-gray-600">
              Use our developer API to connect Eva to your proprietary systems and workflows.
            </p>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Developer-Friendly API
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">RESTful API with comprehensive documentation</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Webhook support for real-time events</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">OAuth 2.0 authentication</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Rate limits designed for enterprise use</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-900 rounded-xl p-6 text-green-400 font-mono text-sm overflow-x-auto">
                  <pre>{`// Example: Create a booking
fetch('https://api.eva-ai.com/v1/bookings', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_id: "cust_123",
    service: "Botox",
    datetime: "2024-12-15T14:00:00Z"
  })
})`}</pre>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <a
                  href="/docs"
                  className="inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold"
                >
                  View API Documentation →
                </a>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* Request Integration */}
      <section className="section-spacing bg-white">
        <div className="container-narrow">
          <FadeInUp className="text-center">
            <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-primary-100 p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Don&apos;t See Your Platform?
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                We&apos;re constantly adding new integrations based on customer feedback. Let us know what you need.
              </p>
              <a
                href="/contact"
                className="btn-primary px-8 py-4 text-lg"
              >
                Request Integration
              </a>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
