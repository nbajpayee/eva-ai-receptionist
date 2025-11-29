"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, MessageSquare, Smile, Users, Download, Calendar as CalendarIcon } from "lucide-react";

import { EnhancedStatCard } from "@/components/dashboard/enhanced-stat-card";
import { PeriodSelector } from "@/components/period-selector";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CallLogTable, type CallRecord } from "@/components/call-log-table";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";

// Types
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

// Utils
function resolveInternalUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}${path}`;
}

// Mock Data Generators
const generateSparklineData = (points: number = 7, min: number = 10, max: number = 50) => {
  return Array.from({ length: points }, () => ({
    value: Math.floor(Math.random() * (max - min + 1)) + min,
  }));
};


export default function Home() {
  const [metrics, setMetrics] = useState<MetricsResponse>(defaultMetrics);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");
  
  // Call log filters
  const [outcomeFilter, setOutcomeFilter] = useState<CallRecord["outcome"] | "all">("all");
  const [channelFilter, setChannelFilter] = useState<CallRecord["channel"] | "all">("all");
  const [satisfactionFilter, setSatisfactionFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Fetch Data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Parallel fetching
        const [metricsRes, callsRes] = await Promise.all([
          fetch(`/api/admin/metrics/overview?period=${selectedPeriod}`, { cache: "no-store" }),
          fetch(resolveInternalUrl("/api/admin/communications?page_size=20"), { cache: "no-store" }),
        ]);

        // Handle Metrics
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data);
        }

        // Handle Calls
        if (callsRes.ok) {
          const data = await callsRes.json();
          
          // Map backend outcomes to frontend display outcomes
          const outcomeMap: Record<string, CallRecord["outcome"]> = {
            "appointment_scheduled": "booked",
            "appointment_rescheduled": "rescheduled",
            "appointment_cancelled": "abandoned",
            "info_request": "info_only",
            "complaint": "escalated",
            "unresolved": "info_only",
            // Also support direct frontend values
            "booked": "booked",
            "info_only": "info_only",
            "escalated": "escalated",
            "abandoned": "abandoned",
            "rescheduled": "rescheduled",
          };
          
          const transformedCalls: CallRecord[] = data.conversations.map((c: any) => {
             const rawOutcome = (c.outcome ?? "").toLowerCase();
             const outcome = outcomeMap[rawOutcome] ?? (c.metadata?.escalated ? "escalated" : "info_only");

             return {
              id: c.id,
              startedAt: c.initiated_at,
              durationSeconds: c.completed_at ? Math.floor((new Date(c.completed_at).getTime() - new Date(c.initiated_at).getTime()) / 1000) : 0,
              outcome,
              phoneNumber: c.customer_phone,
              satisfactionScore: c.satisfaction_score,
              escalated: c.metadata?.escalated ?? false,
              customerName: c.customer_name,
              channel: c.channel as CallRecord["channel"],
            };
          });
          setCalls(transformedCalls);
        }
      } catch (error) {
        console.error("Error loading dashboard data", error);
      }
    };

    loadData();
  }, [selectedPeriod]);

  // Filter calls
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

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500">Overview of your practice's performance</p>
        </div>
        <PeriodSelector
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <EnhancedStatCard
          title="Appointments Booked"
          value={metrics.appointments_booked}
          icon={<CalendarIcon className="h-5 w-5 text-primary" />}
          sparklineData={generateSparklineData(7, 2, 15)}
          color="primary"
          description={`${metrics.conversion_rate.toFixed(1)}% conversion rate`}
        />
        <EnhancedStatCard
          title="Customers Engaged"
          value={metrics.customers_engaged}
          icon={<Users className="h-5 w-5 text-secondary" />}
          sparklineData={generateSparklineData(7, 10, 50)}
          color="success"
          description="New and returning"
        />
        <EnhancedStatCard
          title="Call Minutes"
          value={metrics.total_talk_time_minutes}
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          sparklineData={generateSparklineData(7, 20, 80)}
          color="warning"
          description="minutes saved"
        />
        <EnhancedStatCard
          title="Messages Sent"
          value={metrics.total_messages_sent}
          icon={<MessageSquare className="h-5 w-5 text-accent" />}
          sparklineData={generateSparklineData(7, 8, 10)}
          color="info"
          description="SMS and Email"
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Recent Communications</h2>
            <p className="text-sm text-zinc-500">Latest customer interactions across all channels.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCalls} 
            disabled={filteredCalls.length === 0}
            className="border-secondary/20 text-secondary hover:bg-secondary/10 hover:text-secondary hover:border-secondary/30 transition-all shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Calls
          </Button>
        </div>

        {/* Call Log Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white/50 p-4 shadow-sm backdrop-blur-sm">
          <span className="text-sm font-semibold text-secondary">Filter:</span>
          <Select
            value={outcomeFilter}
            onValueChange={(value: CallRecord["outcome"] | "all") => setOutcomeFilter(value)}
          >
            <SelectTrigger className="w-[140px] bg-white border-input hover:border-primary/50 focus:ring-primary/20 transition-colors rounded-lg">
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

          <Select
            value={channelFilter}
            onValueChange={(value) => setChannelFilter(value as CallRecord["channel"] | "all")}
          >
            <SelectTrigger className="w-[130px] bg-white border-input hover:border-primary/50 focus:ring-primary/20 transition-colors rounded-lg">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={satisfactionFilter}
            onValueChange={(value: "all" | "high" | "medium" | "low") => setSatisfactionFilter(value)}
          >
            <SelectTrigger className="w-[150px] bg-white border-input hover:border-primary/50 focus:ring-primary/20 transition-colors rounded-lg">
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

          <span className="ml-auto text-sm text-zinc-500 hidden sm:inline-block">
            Showing {filteredCalls.length} of {calls.length} conversations
          </span>
        </div>

        <CallLogTable calls={filteredCalls} />
      </section>
    </div>
  );
}
