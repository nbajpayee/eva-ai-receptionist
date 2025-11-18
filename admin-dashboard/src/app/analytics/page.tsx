"use client";

import { useEffect, useState } from "react";
import { CallVolumeChart } from "@/components/charts/call-volume-chart";
import { SatisfactionTrendChart } from "@/components/charts/satisfaction-trend-chart";
import { ConversionRateChart } from "@/components/charts/conversion-rate-chart";
import { CallDurationChart } from "@/components/charts/call-duration-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "lucide-react";

interface DailyMetric {
  date: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
  conversion_rate: number;
  avg_call_duration_minutes: number;
}

interface AnalyticsResponse {
  metrics: DailyMetric[];
}

const DATE_RANGES = [
  { label: "7 Days", value: "7", days: 7 },
  { label: "30 Days", value: "30", days: 30 },
  { label: "90 Days", value: "90", days: 90 },
] as const;

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<string>("30");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/analytics/daily?days=${selectedRange}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          console.warn("Failed to fetch daily analytics", response.statusText);
          setMetrics([]);
          return;
        }

        const data = (await response.json()) as AnalyticsResponse;
        setMetrics(data.metrics || []);
      } catch (error) {
        console.error("Error fetching daily analytics", error);
        setMetrics([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedRange]);

  const hasData = metrics.length > 0;
  const selectedRangeLabel = DATE_RANGES.find((r) => r.value === selectedRange)?.label || "30 Days";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-zinc-900">Analytics & Trends</h1>
          <p className="text-sm text-zinc-500">
            Visual insights into call performance, customer satisfaction, and booking trends
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <ToggleGroup
            type="single"
            value={selectedRange}
            onValueChange={(value) => {
              if (value) setSelectedRange(value);
            }}
          >
            {DATE_RANGES.map((range) => (
              <ToggleGroupItem
                key={range.value}
                value={range.value}
                aria-label={`View ${range.label}`}
              >
                {range.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">Loading analytics data...</p>
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">
            No analytics data available for the selected period. Data will appear once calls are recorded.
          </p>
        </div>
      )}

      {!isLoading && hasData && (
        <div className="grid gap-6">
          {/* Top Row: Call Volume */}
          <div className="grid gap-6 md:grid-cols-1">
            <CallVolumeChart data={metrics} />
          </div>

          {/* Second Row: Satisfaction and Conversion */}
          <div className="grid gap-6 md:grid-cols-2">
            <SatisfactionTrendChart data={metrics} />
            <ConversionRateChart data={metrics} />
          </div>

          {/* Third Row: Call Duration */}
          <div className="grid gap-6 md:grid-cols-1">
            <CallDurationChart data={metrics} />
          </div>
        </div>
      )}
    </div>
  );
}
