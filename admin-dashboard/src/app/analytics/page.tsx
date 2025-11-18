"use client";

import { useEffect, useState } from "react";
import { ChartCard, FunnelChart, Heatmap, BarChartComponent } from "@/components/charts";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  downloadCSV,
  formatFunnelDataForCSV,
  formatHeatmapDataForCSV,
  exportChartAsPNG,
} from "@/lib/export-utils";

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

type ChannelData = {
  name: string;
  conversations: number;
  color: string;
};

type OutcomeData = {
  name: string;
  count: number;
  color: string;
};

type PeriodType = "today" | "week" | "month";

export default function AnalyticsPage() {
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [outcomeData, setOutcomeData] = useState<OutcomeData[]>([]);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(true);
  const [outcomeLoading, setOutcomeLoading] = useState(true);
  const [funnelError, setFunnelError] = useState<string | null>(null);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

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

  // Fetch channel distribution data
  useEffect(() => {
    const fetchChannelDistribution = async () => {
      setChannelLoading(true);
      setChannelError(null);

      try {
        const response = await fetch(
          `/api/admin/analytics/channel-distribution?period=${period}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch channel distribution");
        }

        const result = await response.json();
        setChannelData(result);
      } catch (err) {
        setChannelError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setChannelLoading(false);
      }
    };

    fetchChannelDistribution();
  }, [period]);

  // Fetch outcome distribution data
  useEffect(() => {
    const fetchOutcomeDistribution = async () => {
      setOutcomeLoading(true);
      setOutcomeError(null);

      try {
        const response = await fetch(
          `/api/admin/analytics/outcome-distribution?period=${period}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch outcome distribution");
        }

        const result = await response.json();
        setOutcomeData(result);
      } catch (err) {
        setOutcomeError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setOutcomeLoading(false);
      }
    };

    fetchOutcomeDistribution();
  }, [period]);

  // Export handlers
  const handleExportFunnelCSV = () => {
    const csvData = formatFunnelDataForCSV(funnelData);
    downloadCSV(csvData, `conversion-funnel-${period}`);
  };

  const handleExportHeatmapCSV = () => {
    const csvData = formatHeatmapDataForCSV(heatmapData);
    downloadCSV(csvData, `peak-hours-${period}`);
  };

  const handleExportChannelCSV = () => {
    downloadCSV(channelData, `channel-distribution-${period}`);
  };

  const handleExportOutcomeCSV = () => {
    downloadCSV(outcomeData, `outcome-distribution-${period}`);
  };

  const handleExportAllCSV = () => {
    // Export all data as separate CSV files
    handleExportFunnelCSV();
    setTimeout(() => handleExportHeatmapCSV(), 100);
    setTimeout(() => handleExportChannelCSV(), 200);
    setTimeout(() => handleExportOutcomeCSV(), 300);
  };

  const handleExportFunnelPNG = async () => {
    try {
      await exportChartAsPNG("funnel-chart", `conversion-funnel-${period}`);
    } catch (error) {
      console.error("Failed to export funnel chart:", error);
    }
  };

  const handleExportHeatmapPNG = async () => {
    try {
      await exportChartAsPNG("heatmap-chart", `peak-hours-${period}`);
    } catch (error) {
      console.error("Failed to export heatmap:", error);
    }
  };

  const handleExportChannelPNG = async () => {
    try {
      await exportChartAsPNG("channel-chart", `channel-distribution-${period}`);
    } catch (error) {
      console.error("Failed to export channel chart:", error);
    }
  };

  const handleExportOutcomePNG = async () => {
    try {
      await exportChartAsPNG("outcome-chart", `outcome-distribution-${period}`);
    } catch (error) {
      console.error("Failed to export outcome chart:", error);
    }
  };

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
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAllCSV}
            disabled={
              funnelLoading ||
              heatmapLoading ||
              channelLoading ||
              outcomeLoading
            }
          >
            <Download className="h-4 w-4 mr-2" />
            Export All (CSV)
          </Button>
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
      </div>

      {/* Conversion Funnel */}
      <ChartCard
        title="Conversion Funnel"
        description="Track customer journey from inquiry to booking"
        isLoading={funnelLoading}
        error={funnelError}
        id="funnel-chart"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportFunnelCSV}
              disabled={funnelLoading || funnelData.length === 0}
            >
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportFunnelPNG}
              disabled={funnelLoading || funnelData.length === 0}
            >
              PNG
            </Button>
          </>
        }
      >
        <FunnelChart stages={funnelData} height={450} />
      </ChartCard>

      {/* Peak Hours Heatmap */}
      <ChartCard
        title="Peak Hours Heatmap"
        description="Identify high-traffic times to optimize staffing"
        isLoading={heatmapLoading}
        error={heatmapError}
        id="heatmap-chart"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportHeatmapCSV}
              disabled={heatmapLoading || heatmapData.length === 0}
            >
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportHeatmapPNG}
              disabled={heatmapLoading || heatmapData.length === 0}
            >
              PNG
            </Button>
          </>
        }
      >
        <Heatmap data={heatmapData} height={350} />
      </ChartCard>

      {/* Channel Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard
          title="Channel Distribution"
          description="Conversation volume by communication channel"
          isLoading={channelLoading}
          error={channelError}
          id="channel-chart"
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportChannelCSV}
                disabled={channelLoading || channelData.length === 0}
              >
                CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportChannelPNG}
                disabled={channelLoading || channelData.length === 0}
              >
                PNG
              </Button>
            </>
          }
        >
          <BarChartComponent
            data={channelData}
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
          isLoading={outcomeLoading}
          error={outcomeError}
          id="outcome-chart"
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportOutcomeCSV}
                disabled={outcomeLoading || outcomeData.length === 0}
              >
                CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportOutcomePNG}
                disabled={outcomeLoading || outcomeData.length === 0}
              >
                PNG
              </Button>
            </>
          }
        >
          <BarChartComponent
            data={outcomeData}
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
