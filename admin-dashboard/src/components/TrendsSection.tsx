"use client";

import { useEffect, useState, useCallback } from "react";
import { ChartCard, TimeSeriesChart } from "./charts";
import { format, formatDistanceToNow } from "date-fns";
import { usePolling } from "@/hooks/usePolling";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type TimeSeriesData = {
  timestamp: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
};

type PeriodType = "today" | "week" | "month";

export function TrendsSection() {
  const [data, setData] = useState<TimeSeriesData[]>([]);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const interval = period === "today" ? "hour" : period === "week" ? "hour" : "day";
      const response = await fetch(
        `/api/admin/analytics/timeseries?period=${period}&interval=${interval}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch trend data");
      }

      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time polling every 30 seconds
  usePolling(fetchData, {
    interval: 30000, // 30 seconds
    enabled: true,
    onVisibilityChange: true,
  });

  const formatXAxis = (value: string) => {
    try {
      const date = new Date(value);
      if (period === "today") {
        return format(date, "h:mm a");
      } else if (period === "week") {
        return format(date, "MMM d, h a");
      } else {
        return format(date, "MMM d");
      }
    } catch {
      return value;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Metrics Trends</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-zinc-500">Track performance over time</p>
            {lastUpdated && (
              <span className="text-xs text-zinc-400">
                • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            )}
          </div>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calls Trend */}
        <ChartCard
          title="Conversation Volume"
          description="Total conversations over time"
          isLoading={isLoading}
          error={error}
        >
          <TimeSeriesChart
            data={data}
            lines={[
              {
                dataKey: "total_calls",
                name: "Conversations",
                color: "#3b82f6", // blue-500
              },
            ]}
            xAxisFormatter={formatXAxis}
          />
        </ChartCard>

        {/* Bookings Trend */}
        <ChartCard
          title="Bookings Over Time"
          description="Appointments scheduled by Ava"
          isLoading={isLoading}
          error={error}
        >
          <TimeSeriesChart
            data={data}
            lines={[
              {
                dataKey: "appointments_booked",
                name: "Bookings",
                color: "#10b981", // emerald-500
              },
            ]}
            xAxisFormatter={formatXAxis}
          />
        </ChartCard>

        {/* Satisfaction Trend */}
        <ChartCard
          title="Customer Satisfaction"
          description="Average satisfaction score (0-10)"
          isLoading={isLoading}
          error={error}
          className="md:col-span-2"
        >
          <TimeSeriesChart
            data={data}
            lines={[
              {
                dataKey: "avg_satisfaction_score",
                name: "Satisfaction Score",
                color: "#f59e0b", // amber-500
              },
            ]}
            xAxisFormatter={formatXAxis}
            yAxisFormatter={(value) => value.toFixed(1)}
            tooltipFormatter={(value) => `${value.toFixed(2)}/10`}
          />
        </ChartCard>
      </div>
    </div>
  );
}
