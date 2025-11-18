import type { Metadata } from "next";
import FadeInUp from "@/components/animations/FadeInUp";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
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
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8" id="demo-form">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Schedule a Demo
                </h2>

                <form className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="practiceName" className="block text-sm font-medium text-gray-700 mb-2">
                      Practice Name *
                    </label>
                    <input
                      type="text"
                      id="practiceName"
                      name="practiceName"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="locations" className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Locations
                    </label>
                    <select
                      id="locations"
                      name="locations"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="1">1</option>
                      <option value="2-3">2-3</option>
                      <option value="4-10">4-10</option>
                      <option value="10+">10+</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message (Optional)
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Tell us about your practice and what you're looking for..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full btn-primary py-4 text-base"
                  >
                    Schedule Demo
                  </button>

                  <p className="text-xs text-gray-600 text-center">
                    By submitting this form, you agree to our Privacy Policy and Terms of Service.
                  </p>
                </form>
              </div>
            </FadeInUp>
          </div>
        </div>
      </section>
    </>
  );
}
