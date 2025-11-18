import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import { ArrowRight, Phone } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";

export default function CTASection() {
  return (
    <section className="section-spacing bg-gradient-to-br from-primary-600 to-primary-800 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div className="container-wide relative">
        <div className="max-w-4xl mx-auto text-center">
          <FadeInUp>
            <h2 className="heading-lg text-white mb-6">
              Ready to Transform Your Front Desk?
            </h2>
          </FadeInUp>

          <FadeInUp delay={0.1}>
            <p className="text-xl text-primary-100 mb-10">
              Join 200+ medical spas using Eva to book more appointments and delight patients.
            </p>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
              >
                Schedule Your Demo
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href={`tel:${SITE_CONFIG.contact.phone}`}
                className="inline-flex items-center justify-center bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold text-lg border-2 border-white/20 hover:bg-primary-800 transition-all"
              >
                <Phone className="mr-2 w-5 h-5" />
                {SITE_CONFIG.contact.phoneDisplay}
              </a>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-primary-100 text-sm">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </FadeInUp>
        </div>
      </div>
    </section>
  );
}
