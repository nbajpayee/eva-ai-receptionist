import type { Metadata } from "next";
import { Check, Shield, FileText, Lock } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Shield,
    title: "Business Associate Agreements",
    description:
      "We execute BAAs with Professional and Enterprise customers and flow HIPAA obligations to every sub-processor.",
  },
  {
    icon: Lock,
    title: "Encryption & Segmentation",
    description:
      "PHI is encrypted with AES-256 at rest and TLS 1.2+ in transit. Customer data lives in isolated tenants with unique keys.",
  },
  {
    icon: FileText,
    title: "Detailed Audit Trails",
    description:
      "Every call, transcript access, and export is logged with timestamp, user, and IP—available for compliance reviews.",
  },
];

const CONTROLS = [
  {
    title: "Administrative Safeguards",
    bullets: [
      "HIPAA training & background checks for all employees with PHI access",
      "Role-based permissions with just-in-time elevation for support engineers",
      "Quarterly access reviews and mandatory MFA across the entire platform",
      "Documented incident response plan with 24/7 on-call escalation",
    ],
  },
  {
    title: "Technical Safeguards",
    bullets: [
      "Zero-trust networking with mutual TLS between services",
      "Automatic redaction of payment details and other sensitive fields in transcripts",
      "Data retention controls configurable per customer (30–365 days)",
      "Continuous vulnerability scanning and third-party penetration tests",
    ],
  },
  {
    title: "Physical Safeguards",
    bullets: [
      "SOC 2 Type II + HIPAA-ready cloud infrastructure (AWS & Supabase)",
      "Encrypted, access-controlled backups replicated across regions",
      "No PHI stored on employee devices; access allowed through managed browsers only",
      "Regular verification of data center compliance certifications",
    ],
  },
];

export const metadata: Metadata = {
  title: "HIPAA Compliance - Enterprise Healthcare Security for Medical Spas",
  description:
    "Eva AI is fully HIPAA-compliant with BAA agreements, AES-256 encryption, detailed audit trails, and SOC 2 Type II certification. Built for regulated medical practices from day one.",
  keywords: [
    "HIPAA compliant AI receptionist",
    "medical spa HIPAA compliance",
    "healthcare AI security",
    "BAA agreement AI",
    "HIPAA compliant medical software",
    "PHI encryption",
    "healthcare data security",
  ],
  openGraph: {
    title: "HIPAA Compliance - Eva AI Meets Healthcare Security Standards",
    description: "Enterprise-grade HIPAA compliance with BAA agreements, encryption, and audit trails for your medical spa.",
    url: "https://getevaai.com/hipaa",
  },
  alternates: {
    canonical: "https://getevaai.com/hipaa",
  },
};

function ControlCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white/80 p-8 shadow-sm">
      <h3 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h3>
      <ul className="space-y-3 text-gray-700">
        {bullets.map((bullet, idx) => (
          <li key={idx} className="flex gap-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
              <Check className="h-3.5 w-3.5 text-green-600" />
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HIPAACompliancePage() {
  return (
    <div className="bg-gradient-to-b from-white via-emerald-50/30 to-white py-24">
      <div className="container-wide space-y-16">
        <header className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 mb-4">
            HIPAA Compliance
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Built for regulated medical practices from day one.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
            Eva AI handles PHI across voice, SMS, and email. Our compliance program combines encryption, process controls,
            and continuous monitoring so your patients stay protected and your team stays audit-ready.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
              <item.icon className="h-10 w-10 text-emerald-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="space-y-8">
          {CONTROLS.map((control) => (
            <ControlCard key={control.title} title={control.title} bullets={control.bullets} />
          ))}
        </div>

      </div>
    </div>
  );
}
