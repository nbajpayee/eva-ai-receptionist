"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, MessageSquare, Smile, Users, Download, Calendar } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { SplitStatCard } from "@/components/split-stat-card";
import {
  CallLogTable,
  type CallRecord,
} from "@/components/call-log-table";
import { LiveStatus } from "@/components/dashboard/live-status";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";

type MetricsResponse = {
  period: string;
  total_calls: number;
  total_talk_time_hours: number;
  total_talk_time_minutes: number;
  avg_call_duration_minutes: number;
  appointments_booked: number;
  conversion_rate: number;
  avg_satisfaction_score: number;
  calls_escalated: number;
  escalation_rate: number;
  customers_engaged: number;
  total_messages_sent: number;
};

const defaultMetrics: MetricsResponse = {
  period: "today",
  total_calls: 0,
  total_talk_time_hours: 0,
  total_talk_time_minutes: 0,
  avg_call_duration_minutes: 0,
  appointments_booked: 0,
  conversion_rate: 0,
  avg_satisfaction_score: 0,
  calls_escalated: 0,
  escalation_rate: 0,
  customers_engaged: 0,
  total_messages_sent: 0,
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

const PERIODS = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
] as const;

export default function Home() {
  const [metrics, setMetrics] = useState<MetricsResponse>(defaultMetrics);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");

  // Call log filters
  const [outcomeFilter, setOutcomeFilter] = useState<CallRecord["outcome"] | "all">("all");
  const [channelFilter, setChannelFilter] = useState<CallRecord["channel"] | "all">("all");
  const [satisfactionFilter, setSatisfactionFilter] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await fetch(`/api/admin/metrics/overview?period=${selectedPeriod}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          console.warn("Failed to fetch metrics", response.statusText);
          setMetrics(defaultMetrics);
          return;
        }

        const data = (await response.json()) as MetricsResponse;
        setMetrics(data);
      } catch (error) {
        console.error("Error fetching metrics", error);
        setMetrics(defaultMetrics);
      }
    };

    loadMetrics();
  }, [selectedPeriod]);

  useEffect(() => {
    const loadCalls = async () => {
      const callsData = await fetchCallHistory();
      setCalls(callsData);
      setIsLoading(false);
    };

    loadCalls();
  }, []);

  // Filter calls based on selected filters
  const filteredCalls = calls.filter((call) => {
    // Outcome filter
    if (outcomeFilter !== "all" && call.outcome !== outcomeFilter) {
      return false;
    }

    // Channel filter
    if (channelFilter !== "all") {
      const callChannel = call.channel || "voice";
      if (callChannel !== channelFilter) {
        return false;
      }
    }

    // Satisfaction filter
    if (satisfactionFilter !== "all" && call.satisfactionScore != null) {
      if (satisfactionFilter === "high" && call.satisfactionScore < 8) return false;
      if (satisfactionFilter === "medium" && (call.satisfactionScore < 5 || call.satisfactionScore >= 8)) return false;
      if (satisfactionFilter === "low" && call.satisfactionScore >= 5) return false;
    }

    return true;
  });

  const handleExportCalls = () => {
    const exportData = filteredCalls.map((call) => ({
      ID: call.id,
      "Started At": new Date(call.startedAt).toISOString(),
      "Duration (seconds)": call.durationSeconds || 0,
      Outcome: call.outcome || "",
      Phone: call.phoneNumber || "",
      "Customer Name": call.customerName || "",
      Channel: call.channel || "voice",
      "Satisfaction Score": call.satisfactionScore || "",
      Escalated: call.escalated ? "Yes" : "No",
    }));

    exportToCSV(exportData, generateExportFilename("calls"));
  };

  const selectedPeriodLabel = PERIODS.find((p) => p.value === selectedPeriod)?.label || "Today";

  return (
    <div className="space-y-10">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Overview of key metrics and recent activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <ToggleGroup
            type="single"
            value={selectedPeriod}
            onValueChange={(value) => {
              if (value) setSelectedPeriod(value);
            }}
          >
            {PERIODS.map((period) => (
              <ToggleGroupItem
                key={period.value}
                value={period.value}
                aria-label={`View ${period.label}`}
              >
                {period.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Live Status Indicator */}
      <LiveStatus />

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Appointments Booked */}
        <StatCard
          title="Appointments Booked"
          value={metrics.appointments_booked.toString()}
          description="Bookings directly handled by Ava"
          icon={<ArrowUpRight className="h-5 w-5" />}
          trend={
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-600">
              {numberFormatter.format(metrics.conversion_rate)}% conversion
            </span>
          }
        />

        {/* Card 2: Customers Engaged */}
        <StatCard
          title="Customers Engaged"
          value={metrics.customers_engaged.toString()}
          description="Unique customers Ava has assisted"
          icon={<Users className="h-5 w-5" />}
          trend={
            <span className="flex items-center gap-1 text-sky-600">
              <ArrowUpRight className="h-4 w-4" />
              Building relationships
            </span>
          }
        />

        {/* Card 3: Time Spent + Messages Sent (Split) */}
        <SplitStatCard
          title="Communication Activity"
          leftMetric={{
            label: "Time Spent",
            value: `${numberFormatter.format(metrics.total_talk_time_minutes)} min`,
            icon: <Clock3 className="h-4 w-4" />,
          }}
          rightMetric={{
            label: "Messages",
            value: metrics.total_messages_sent.toString(),
            icon: <MessageSquare className="h-4 w-4" />,
          }}
          description="Voice minutes and text/email messages sent"
        />

        {/* Card 4: Satisfaction Score */}
        <StatCard
          title="Satisfaction Score"
          value={`${numberFormatter.format(metrics.avg_satisfaction_score)}/10`}
          description={`${metrics.calls_escalated} escalations (${numberFormatter.format(metrics.escalation_rate)}%)`}
          icon={<Smile className="h-5 w-5" />}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Recent Communications</h2>
            <p className="text-sm text-zinc-500">Latest customer interactions across all channels.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCalls} disabled={filteredCalls.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Calls
          </Button>
        </div>

        {/* Call Log Filters */}
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <span className="text-sm font-medium text-zinc-700">Filter:</span>

          <Select value={outcomeFilter} onValueChange={(value) => setOutcomeFilter(value as CallRecord["outcome"] | "all")}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="info_only">Info Only</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as CallRecord["channel"] | "all")}>
            <SelectTrigger className="w-[130px] bg-white">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="mobile_text">Mobile Text</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>

          <Select value={satisfactionFilter} onValueChange={(value) => setSatisfactionFilter(value as "all" | "high" | "medium" | "low")}>
            <SelectTrigger className="w-[150px] bg-white">
              <SelectValue placeholder="Satisfaction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="high">High (8-10)</SelectItem>
              <SelectItem value="medium">Medium (5-7)</SelectItem>
              <SelectItem value="low">Low (&lt;5)</SelectItem>
            </SelectContent>
          </Select>

          {(outcomeFilter !== "all" || channelFilter !== "all" || satisfactionFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOutcomeFilter("all");
                setChannelFilter("all");
                setSatisfactionFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}

          <span className="ml-auto text-sm text-zinc-500">
            Showing {filteredCalls.length} of {calls.length} calls
          </span>
        </div>

        <CallLogTable calls={filteredCalls} />
      </section>
    </div>
  );
}
