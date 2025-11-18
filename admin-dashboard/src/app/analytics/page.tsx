"use client";

import { useEffect, useState } from "react";
import { ChartCard, FunnelChart, Heatmap, BarChartComponent } from "@/components/charts";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type FunnelStage = {
  name: string;
  value: number;
  color: string;
};

type HeatmapCell = {
  day: number;
  hour: number;
  value: number;
};

type PeriodType = "today" | "week" | "month";

export default function AnalyticsPage() {
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [funnelError, setFunnelError] = useState<string | null>(null);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);

  // Fetch funnel data
  useEffect(() => {
    const fetchFunnel = async () => {
      setFunnelLoading(true);
      setFunnelError(null);

      try {
        const response = await fetch(
          `/api/admin/analytics/funnel?period=${period}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch funnel data");
        }

        const result = await response.json();
        setFunnelData(result.stages || []);
      } catch (err) {
        setFunnelError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setFunnelLoading(false);
      }
    };

    fetchFunnel();
  }, [period]);

  // Fetch heatmap data
  useEffect(() => {
    const fetchHeatmap = async () => {
      setHeatmapLoading(true);
      setHeatmapError(null);

      try {
        const heatmapPeriod = period === "today" ? "week" : period;
        const response = await fetch(
          `/api/admin/analytics/peak-hours?period=${heatmapPeriod}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch heatmap data");
        }

        const result = await response.json();
        setHeatmapData(result);
      } catch (err) {
        setHeatmapError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setHeatmapLoading(false);
      }
    };

    fetchHeatmap();
  }, [period]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Deep insights into conversion funnel and peak traffic patterns
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(value) => {
            if (value) setPeriod(value as PeriodType);
          }}
        >
          <ToggleGroupItem value="today">Today</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Conversion Funnel */}
      <ChartCard
        title="Conversion Funnel"
        description="Track customer journey from inquiry to booking"
        isLoading={funnelLoading}
        error={funnelError}
      >
        <FunnelChart stages={funnelData} height={450} />
      </ChartCard>

      {/* Peak Hours Heatmap */}
      <ChartCard
        title="Peak Hours Heatmap"
        description="Identify high-traffic times to optimize staffing"
        isLoading={heatmapLoading}
        error={heatmapError}
      >
        <Heatmap data={heatmapData} height={350} />
      </ChartCard>

      {/* Channel Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard
          title="Channel Distribution"
          description="Conversation volume by communication channel"
          isLoading={false}
        >
          <BarChartComponent
            data={[
              { name: "Voice", conversations: 45, color: "#3b82f6" },
              { name: "SMS", conversations: 28, color: "#8b5cf6" },
              { name: "Email", conversations: 12, color: "#10b981" },
            ]}
            bars={[
              {
                dataKey: "conversations",
                name: "Conversations",
                color: "#3b82f6",
              },
            ]}
            height={250}
          />
        </ChartCard>

        <ChartCard
          title="Outcome Distribution"
          description="Call outcomes across all channels"
          isLoading={false}
        >
          <BarChartComponent
            data={[
              { name: "Booked", count: 32 },
              { name: "Info Only", count: 28 },
              { name: "Browsing", count: 15 },
              { name: "Escalated", count: 8 },
              { name: "Abandoned", count: 2 },
            ]}
            bars={[
              {
                dataKey: "count",
                name: "Conversations",
                color: "#f59e0b",
              },
            ]}
            height={250}
          />
        </ChartCard>
      </div>
    </div>
  );
}
