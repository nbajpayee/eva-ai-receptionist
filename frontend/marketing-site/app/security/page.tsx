import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, Server, KeyRound, Activity } from "lucide-react";

const SECURITY_PILLARS = [
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    description:
      "Every service undergoes threat modeling, code review, and automated dependency scanning before it hits production.",
  },
  {
    icon: Server,
    title: "Redundant Infrastructure",
    description:
      "Multi-region deployments with automated failover keep Eva available even if a provider, region, or carrier goes down.",
  },
  {
    icon: KeyRound,
    title: "Granular Access Controls",
    description:
      "SSO + MFA, SCIM provisioning, and field-level permissions ensure only the right people see sensitive data.",
  },
  {
    icon: Activity,
    title: "Continuous Monitoring",
    description:
      "Security alerts, anomaly detection, and real-time call health dashboards keep your team ahead of issues.",
  },
];

const PRACTICES = [
  {
    title: "Infrastructure",
    bullets: [
      "SOC 2 Type II hosting with private networking and hardware security modules",
      "Isolated tenants per customer with dedicated encryption keys",
      "Automated backups every 15 minutes with 35-day retention",
      "DDoS protection, WAF rules, and rate-limiting on all public endpoints",
    ],
  },
  {
    title: "Application",
    bullets: [
      "Secret management via AWS KMS + Supabase Vault; no credentials in code",
      "Secure SDLC with static/dynamic analysis, dependency review, and signed releases",
      "Session management with short-lived tokens and refresh rotation",
      "Configurable audit logs exportable to your SIEM or compliance archive",
    ],
  },
  {
    title: "Operational",
    bullets: [
      "24/7 on-call SRE rotation and incident response playbooks",
      "Quarterly tabletop exercises for ransomware, data exfiltration, and carrier outages",
      "Background checks for all employees with production access",
      "Security reviews for every vendor + annual penetration tests",
    ],
  },
];

export const metadata: Metadata = {
  title: "Security",
  description: "Eva AI pairs healthcare-grade encryption with enterprise monitoring, giving med spas confidence to scale.",
};

function PracticeCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white/85 p-8 shadow-sm">
      <h3 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h3>
      <ul className="space-y-3 text-gray-700">
        {bullets.map((bullet, idx) => (
          <li key={idx} className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="bg-gradient-to-b from-white via-slate-50 to-white py-24">
      <div className="container-wide space-y-16">
        <header className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">Security</p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Enterprise security baked into every patient interaction.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
            From the phone call to the SMS follow-up, every byte that touches Eva is encrypted, monitored, and logged. We
            combine HIPAA readiness with enterprise guardrails so your compliance team and your CTO can both sleep at night.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {SECURITY_PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm">
              <pillar.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{pillar.title}</h3>
              <p className="text-gray-600 leading-relaxed">{pillar.description}</p>
            </div>
          ))}
        </div>

        <div className="space-y-8">
          {PRACTICES.map((practice) => (
            <PracticeCard key={practice.title} title={practice.title} bullets={practice.bullets} />
          ))}
        </div>

      </div>
    </div>
  );
}
