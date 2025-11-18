import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import CTASection from "@/components/sections/CTASection";
import { Target, Users, Lightbulb, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Eva AI—built by med spa operators, for med spa operators. Our mission is to empower aesthetic practices with intelligent automation.",
};

export default function AboutPage() {
  const values = [
    {
      icon: Target,
      title: "Patient-First Design",
      description: "Every feature is built with the patient experience in mind, ensuring warm, professional interactions.",
    },
    {
      icon: Shield,
      title: "Reliability & Trust",
      description: "Medical spas rely on us for their most critical patient touchpoint—we deliver 99.8% uptime.",
    },
    {
      icon: Lightbulb,
      title: "Continuous Innovation",
      description: "We're constantly improving Eva with the latest AI advancements and customer feedback.",
    },
    {
      icon: Users,
      title: "Healthcare Compliance",
      description: "Built from the ground up with HIPAA compliance and healthcare privacy standards.",
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto">
            <h1 className="heading-xl text-gray-900 mb-6">
              Built by Med Spa Operators, For Med Spa Operators
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              We understand the pain of missed calls and inefficient scheduling because we've lived it. Eva was born from a simple question: What if your front desk never missed a call?
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Origin Story */}
      <section className="section-spacing bg-white">
        <div className="container-narrow">
          <FadeInUp>
            <div className="prose prose-lg max-w-none">
              <h2 className="heading-md text-gray-900 mb-6">Our Story</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Eva AI was founded in 2024 after our founding team experienced firsthand the frustration of running a medical spa with limited staff. Despite offering world-class treatments, we were losing thousands of dollars per month to unanswered calls during peak hours.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                We tried traditional answering services, but they lacked the medical spa knowledge to properly screen patients or book appointments. We needed something smarter—something that could understand nuanced questions about Botox, dermal fillers, and laser treatments without sounding robotic.
              </p>
              <p className="text-gray-600 leading-relaxed">
                That's when we built Eva. Using OpenAI's cutting-edge Realtime API, we created an AI receptionist that speaks naturally, understands patient needs, and books appointments with 100% reliability. Within two months of deploying Eva at our own clinic, our booking rate increased by 40%. We knew we had to share this with the industry.
              </p>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* Mission */}
      <section className="section-spacing bg-gray-50">
        <div className="container-narrow">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-md text-gray-900 mb-4">
              Our Mission
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              To empower aesthetic practices with AI that elevates patient experience and operational efficiency.
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Values */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-md text-gray-900 mb-4">
              Our Values
            </h2>
          </FadeInUp>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {values.map((value, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                    <value.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {value.title}
                    </h3>
                    <p className="text-gray-600">
                      {value.description}
                    </p>
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section-spacing bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { value: "2024", label: "Founded" },
              { value: "200+", label: "Medical Spas Served" },
              { value: "10,000+", label: "Calls Handled" },
              { value: "99.8%", label: "Uptime" },
            ].map((stat, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="text-center">
                  <div className="text-4xl font-bold text-white mb-2">
                    {stat.value}
                  </div>
                  <div className="text-primary-100">{stat.label}</div>
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
