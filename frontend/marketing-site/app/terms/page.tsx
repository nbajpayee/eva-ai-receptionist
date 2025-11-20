import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

const LAST_UPDATED = "November 19, 2025";

const TERMS = [
  {
    title: "Account Eligibility & Access",
    items: [
      "You must be legally authorized to bind your practice or organization to these Terms and be at least 18 years old.",
      "Login credentials are issued per user and may not be shared. You are responsible for any activity performed with your credentials.",
      "Eva AI may suspend access if suspicious activity, credential compromise, or unpaid invoices are detected.",
    ],
  },
  {
    title: "Use of the Service",
    items: [
      "You agree to follow all applicable healthcare, privacy, and telemarketing laws when using Eva AI.",
      "Recorded calls, transcripts, and analytics may only be used for internal operations, training, and compliance documentation.",
      "You may not attempt to copy, reverse engineer, or bypass security safeguards built into the platform.",
    ],
  },
  {
    title: "Billing & Subscription",
    items: [
      "Subscriptions renew automatically unless canceled with at least 15 days notice before the next billing cycle.",
      "Upgrades, add-on seats, or above-plan usage will be prorated on the next invoice.",
      "All fees are non-refundable except where required by law or explicitly noted in an Order Form.",
    ],
  },
  {
    title: "Service Commitments",
    items: [
      "Eva AI provides a 99.8% uptime SLA for Professional and Enterprise plans. Credits are available if uptime falls below the SLA.",
      "We reserve the right to roll out updates, new AI models, or workflow changes that improve reliability, security, or compliance.",
      "In the unlikely event of a critical defect, we will communicate status updates via email and status.eva-ai.com.",
    ],
  },
  {
    title: "Data Ownership & Termination",
    items: [
      "You own your data. Upon termination, you may export transcripts, analytics, and recordings for 30 days.",
      "After the export window, data is securely deleted from production backups according to our retention schedule.",
      "Sections covering confidentiality, data ownership, disclaimers, and liability survive termination.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the Terms of Service that govern your use of the Eva AI platform, billing policies, and data ownership commitments.",
};

function TermsSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white/80 p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h2>
      <ul className="space-y-3 text-gray-700 leading-relaxed">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-3">
            <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="bg-gradient-to-b from-white via-primary-50/20 to-white py-24">
      <div className="container-wide space-y-16">
        <header className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">
            Terms of Service
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Clear, modern terms built for fast-moving practices.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-4">
            These Terms describe your responsibilities, how billing works, and what you can expect from Eva AI. Our goal is
            to be transparent so you can trust the platform that greets your patients.
          </p>
          <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {TERMS.map((section) => (
            <TermsSection key={section.title} title={section.title} items={section.items} />
          ))}
        </div>

      </div>
    </div>
  );
}
