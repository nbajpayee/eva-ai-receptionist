import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

const LAST_UPDATED = "November 19, 2025";

const SECTIONS = [
  {
    title: "Information We Collect",
    items: [
      "Contact details shared during demos, trials, or support interactions",
      "Practice-level configuration data needed to train Eva on your services, pricing, and availability",
      "Call, SMS, and email transcripts that are required for booking accuracy and quality monitoring",
      "Usage analytics such as feature adoption, response latency, and error rates so we can improve reliability",
    ],
  },
  {
    title: "How We Use Your Data",
    items: [
      "Deliver real-time receptionist services, including appointment booking and follow-up communications",
      "Maintain backups, audit trails, and dispute resolution logs for regulatory purposes",
      "Provide proactive account insights (e.g., staffing recommendations, conversion metrics)",
      "Send critical product updates, security notifications, and billing correspondence",
    ],
  },
  {
    title: "Patient & Customer Privacy",
    items: [
      "All Protected Health Information (PHI) is encrypted in transit (TLS 1.2+) and at rest (AES-256)",
      "Access to PHI is role-based and logged; every retrieval or export requires an authorized user",
      "You maintain full ownership of patient data. We never sell or monetize PHI or communications data",
      "Data retention defaults to 365 days, but Enterprise customers may request custom retention or deletion schedules",
    ],
  },
  {
    title: "Your Controls",
    items: [
      "Download or delete transcripts, call recordings, and analytics exports directly from the admin dashboard",
      "Request a full data inventory or audit log by emailing privacy@eva-ai.com",
      "Designate a privacy contact so we know who to coordinate with for HIPAA or GDPR requests",
      "Update notification preferences (marketing, product, billing) at any time inside Settings → Notifications",
    ],
  },
];

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Eva AI safeguards patient information, protects PHI, and gives you granular control over data retention.",
};

function PolicySection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white/70 p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h2>
      <ul className="space-y-3 text-gray-700 leading-relaxed">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gradient-to-b from-white via-blue-50/40 to-white py-24">
      <div className="container-wide space-y-16">
        <header className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">
            Privacy Policy
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Your patients trust you. You can trust Eva with their data.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-4">
            Eva AI was designed for regulated medical environments. We collect only the data that is
            required to deliver reliable receptionist coverage, and we give you full visibility into how
            it is stored, accessed, and deleted.
          </p>
          <p className="text-sm text-gray-500">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {SECTIONS.map((section) => (
            <PolicySection key={section.title} title={section.title} items={section.items} />)
          )}
        </div>

      </div>
    </div>
  );
}
