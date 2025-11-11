import { ArrowUpRight, Clock3, PhoneCall, Smile } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  CallLogTable,
  type CallRecord,
} from "@/components/call-log-table";

type MetricsResponse = {
  period: string;
  total_calls: number;
  total_talk_time_hours: number;
  avg_call_duration_minutes: number;
  appointments_booked: number;
  conversion_rate: number;
  avg_satisfaction_score: number;
  calls_escalated: number;
  escalation_rate: number;
};

const defaultMetrics: MetricsResponse = {
  period: "today",
  total_calls: 0,
  total_talk_time_hours: 0,
  avg_call_duration_minutes: 0,
  appointments_booked: 0,
  conversion_rate: 0,
  avg_satisfaction_score: 0,
  calls_escalated: 0,
  escalation_rate: 0,
};

function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function resolveInternalUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${getAppOrigin()}${basePath}${path}`;
}

async function fetchMetrics(period: string = "today"): Promise<MetricsResponse> {
  try {
    const url = resolveInternalUrl(`/api/admin/metrics/overview?period=${period}`);

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Failed to fetch metrics", response.statusText);
      return defaultMetrics;
    }

    const data = (await response.json()) as MetricsResponse;
    return data;
  } catch (error) {
    console.error("Error fetching metrics", error);
    return defaultMetrics;
  }
}

async function fetchCallHistory(): Promise<CallRecord[]> {
  try {
    const url = resolveInternalUrl("/api/admin/communications?page_size=20");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.warn("Failed to fetch communications", response.statusText);
      return [];
    }

    const { conversations } = (await response.json()) as {
      conversations: Array<{
        id: string;
        initiated_at: string;
        completed_at: string | null;
        outcome: string | null;
        customer_phone?: string | null;
        satisfaction_score?: number | null;
        customer_name?: string | null;
        channel: string;
        metadata?: { escalated?: boolean; phone_number?: string } | null;
      }>;
    };

    const allowedOutcomes: CallRecord["outcome"][] = [
      "booked",
      "info_only",
      "escalated",
      "abandoned",
      "rescheduled",
    ];

    return conversations.map((conversation) => {
      const normalizedOutcome = (conversation.outcome ?? "info_only").toLowerCase();
      const isEscalated = conversation.metadata?.escalated ?? false;
      const outcome = (
        allowedOutcomes.includes(normalizedOutcome as CallRecord["outcome"])
          ? normalizedOutcome
          : isEscalated
            ? "escalated"
            : "info_only"
      ) as CallRecord["outcome"];

      // Calculate duration from initiated_at and completed_at
      let durationSeconds = 0;
      if (conversation.completed_at) {
        const start = new Date(conversation.initiated_at).getTime();
        const end = new Date(conversation.completed_at).getTime();
        durationSeconds = Math.floor((end - start) / 1000);
      }

      return {
        id: conversation.id,
        startedAt: conversation.initiated_at,
        durationSeconds,
        outcome,
        phoneNumber: conversation.customer_phone ?? conversation.metadata?.phone_number,
        satisfactionScore: conversation.satisfaction_score ?? undefined,
        escalated: isEscalated,
        customerName: conversation.customer_name ?? undefined,
        channel: (conversation.channel as CallRecord["channel"]) ?? undefined,
      } satisfies CallRecord;
    });
  } catch (error) {
    console.error("Error fetching communications", error);
    return [];
  }
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export default async function Home() {
  const [metrics, calls] = await Promise.all([
    fetchMetrics(),
    fetchCallHistory(),
  ]);

  const kpiCards = [
    {
      title: "Total Calls",
      value: metrics.total_calls.toString(),
      description: `Conversion rate ${numberFormatter.format(metrics.conversion_rate)}%`,
      icon: <PhoneCall className="h-5 w-5" />,
      trend: (
        <span className="flex items-center gap-1 text-emerald-600">
          <ArrowUpRight className="h-4 w-4" />
          Tracking daily call momentum
        </span>
      ),
    },
    {
      title: "Appointments Booked",
      value: metrics.appointments_booked.toString(),
      description: "Bookings directly handled by Ava",
      icon: <ArrowUpRight className="h-5 w-5" />,
      trend: (
        <span className="text-xs uppercase tracking-[0.2em] text-emerald-600">
          {numberFormatter.format(metrics.conversion_rate)}% conversion
        </span>
      ),
    },
    {
      title: "Avg Call Duration",
      value: `${numberFormatter.format(metrics.avg_call_duration_minutes)} min`,
      description: `${numberFormatter.format(metrics.total_talk_time_hours)} total hours`,
      icon: <Clock3 className="h-5 w-5" />,
    },
    {
      title: "Satisfaction Score",
      value: `${numberFormatter.format(metrics.avg_satisfaction_score)}/10`,
      description: `${metrics.calls_escalated} escalations (${numberFormatter.format(metrics.escalation_rate)}%)`,
      icon: <Smile className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Operational feed</h2>
          <p className="text-sm text-zinc-500">Monitoring today’s customer traffic.</p>
        </div>
        <CallLogTable calls={calls} />
      </section>
    </div>
  );
}
