import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import ContactForm from "@/components/sections/ContactForm";
import { Mail, Phone, Clock } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Eva AI. Schedule a demo, ask questions, or learn how Eva can transform your medical spa's front desk.",
};

export default function ContactPage() {
  return (
    <>
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Left Column - Contact Info */}
            <FadeInUp>
              <div>
                <h1 className="heading-xl text-gray-900 mb-6">
                  Let's Talk
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  Schedule a personalized demo to see how Eva can transform your medical spa's front desk operations.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                      <a
                        href={`tel:${SITE_CONFIG.contact.phone}`}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        {SITE_CONFIG.contact.phoneDisplay}
                      </a>
                      <p className="text-sm text-gray-600 mt-1">Mon-Fri, 9am-6pm EST</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
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
                      <p className="text-sm text-gray-600 mt-1">We'll respond within 24 hours</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Business Hours</h3>
                      <p className="text-gray-600">Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                      <p className="text-gray-600">Saturday - Sunday: Closed</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 p-6 bg-primary-50 rounded-xl border border-primary-100">
                  <h3 className="font-semibold text-gray-900 mb-2">Ready to get started?</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Book a 15-minute demo to see Eva in action and learn how we can help your practice.
                  </p>
                  <a
                    href="#demo-form"
                    className="text-primary-600 hover:text-primary-700 font-semibold text-sm"
                  >
                    Schedule Demo →
                  </a>
                </div>
              </div>
            </FadeInUp>

            {/* Right Column - Contact Form */}
            <FadeInUp delay={0.2}>
              <ContactForm />
            </FadeInUp>
          </div>
        </div>
      </section>
    </>
  );
}
