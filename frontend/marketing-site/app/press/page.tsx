import type { Metadata } from "next";
import { Download, Mail, FileText, Image as ImageIcon, Award } from "lucide-react";
import FadeInUp from "@/components/animations/FadeInUp";
import { SITE_CONFIG, STATS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Press Kit - Media Resources for Eva AI",
  description:
    "Download logos, press releases, company information, and media assets for Eva AI. Contact our press team for interviews and partnership inquiries.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${SITE_CONFIG.url}/press`,
  },
};

const PRESS_RELEASES = [
  {
    title: "Eva AI Launches HIPAA-Compliant AI Receptionist for Medical Spas",
    date: "January 15, 2025",
    excerpt:
      "Eva AI announces the launch of its deterministic booking engine, achieving 100% accuracy in appointment scheduling for medical spas nationwide.",
  },
  {
    title: "Eva AI Reaches 50,000+ Calls Handled with 99.8% Satisfaction",
    date: "December 10, 2024",
    excerpt:
      "Eva AI crosses major milestone, handling over 50,000 patient calls across 200+ medical spas with industry-leading satisfaction scores.",
  },
];

const COMPANY_INFO = {
  name: "Eva AI",
  tagline: "The AI Receptionist That Handles Voice, SMS, & Email",
  founded: "2024",
  headquarters: "United States",
  industry: "Healthcare Technology, AI, Medical Spa Software",
  employees: "10-50",
  website: SITE_CONFIG.url,
  contact: SITE_CONFIG.contact.email,
};

const LOGOS = [
  {
    name: "Eva AI Logo (PNG)",
    description: "High-resolution logo with transparent background",
    size: "2048x2048px",
    format: "PNG",
  },
  {
    name: "Eva AI Logo (SVG)",
    description: "Vector logo for print and scalable usage",
    size: "Vector",
    format: "SVG",
  },
  {
    name: "Eva AI Logo (White)",
    description: "White logo for dark backgrounds",
    size: "2048x2048px",
    format: "PNG",
  },
];

const EXECUTIVES = [
  {
    name: "Neeraj Bajpayee",
    title: "Founder & CEO",
    bio: "Serial entrepreneur with expertise in AI and healthcare automation. Previously founded multiple successful SaaS companies.",
  },
];

const AWARDS = [
  {
    title: "Best Healthcare AI Innovation",
    organization: "Healthcare Tech Awards",
    year: "2024",
  },
  {
    title: "SOC 2 Type II Certified",
    organization: "Independent Auditor",
    year: "2024",
  },
];

export default function PressPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="heading-xl text-gray-900 mb-6">Press Kit</h1>
            <p className="text-xl text-gray-600 mb-8">
              Media resources, company information, and press contacts for Eva AI.
            </p>
            <a
              href={`mailto:press@getevaai.com?subject=Press Inquiry`}
              className="btn-primary inline-flex items-center"
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Press Team
            </a>
          </FadeInUp>
        </div>
      </section>

      {/* Company Overview */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">Company Overview</h2>
            <p className="text-lg text-gray-600 max-w-3xl">
              Eva AI is the first HIPAA-compliant AI receptionist designed specifically for medical spas
              and aesthetic practices. Our deterministic booking engine ensures 100% appointment accuracy
              while handling voice, SMS, and email communications 24/7.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FadeInUp delay={0.1}>
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Founded
                </h3>
                <p className="text-2xl font-bold text-gray-900">{COMPANY_INFO.founded}</p>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.2}>
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Calls Handled
                </h3>
                <p className="text-2xl font-bold text-gray-900">{STATS[0].value}{STATS[0].suffix}</p>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.3}>
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Practices Served
                </h3>
                <p className="text-2xl font-bold text-gray-900">{STATS[3].value}{STATS[3].suffix}</p>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.4}>
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Booking Accuracy
                </h3>
                <p className="text-2xl font-bold text-gray-900">{STATS[1].value}{STATS[1].suffix}</p>
              </div>
            </FadeInUp>
          </div>
        </div>
      </section>

      {/* Boilerplate */}
      <section className="section-spacing bg-gray-50">
        <div className="container-narrow">
          <FadeInUp>
            <h2 className="heading-md text-gray-900 mb-6">Company Boilerplate</h2>
            <div className="p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Eva AI</strong> is a HIPAA-compliant AI receptionist platform built specifically
                for medical spas and aesthetic practices. Founded in 2024, Eva AI combines advanced voice
                AI with deterministic booking technology to deliver 100% accurate appointment scheduling
                across voice, SMS, and email channels.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Unlike generic AI assistants, Eva AI is purpose-built for the unique needs of healthcare
                providers, offering BAA agreements, SOC 2 Type II certification, and enterprise-grade
                security. The platform integrates seamlessly with leading medical spa software including
                Boulevard, Zenoti, and Google Calendar.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Eva AI serves over 200 medical spas and aesthetic practices across the United States,
                handling 50,000+ patient interactions with a 99.8% satisfaction rate. The company is
                headquartered in the United States.
              </p>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <strong>Media Contact:</strong> press@getevaai.com
                </p>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* Press Releases */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">Recent Press Releases</h2>
          </FadeInUp>

          <div className="space-y-6">
            {PRESS_RELEASES.map((release, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <article className="p-8 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-primary-100 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex-1 pr-4">
                      {release.title}
                    </h3>
                    <button className="flex items-center text-primary-600 hover:text-primary-700 font-semibold whitespace-nowrap">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{release.date}</p>
                  <p className="text-gray-700">{release.excerpt}</p>
                </article>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Assets */}
      <section className="section-spacing bg-gray-50">
        <div className="container-wide">
          <FadeInUp className="mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">Brand Assets</h2>
            <p className="text-gray-600">
              Download our logos and brand assets for editorial use. Please review our{" "}
              <a href="/brand-guidelines" className="text-primary-600 hover:underline">
                brand guidelines
              </a>{" "}
              before use.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-3 gap-6">
            {LOGOS.map((logo, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="p-6 bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{logo.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">{logo.description}</p>
                  <p className="text-xs text-gray-500 mb-4">
                    {logo.size} • {logo.format}
                  </p>
                  <button className="btn-secondary text-sm w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </button>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <FadeInUp className="mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">Leadership Team</h2>
          </FadeInUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {EXECUTIVES.map((exec, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-primary-100 to-primary-50 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-4xl font-bold text-primary-600">
                      {exec.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{exec.name}</h3>
                  <p className="text-primary-600 font-semibold mb-3">{exec.title}</p>
                  <p className="text-gray-600 text-sm">{exec.bio}</p>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* Awards */}
      <section className="section-spacing bg-gray-50">
        <div className="container-wide">
          <FadeInUp className="mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">Awards & Certifications</h2>
          </FadeInUp>

          <div className="grid md:grid-cols-2 gap-6">
            {AWARDS.map((award, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-gray-200">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{award.title}</h3>
                    <p className="text-sm text-gray-600">
                      {award.organization} • {award.year}
                    </p>
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
