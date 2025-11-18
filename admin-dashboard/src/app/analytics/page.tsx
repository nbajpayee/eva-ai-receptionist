import { CallVolumeChart } from "@/components/charts/call-volume-chart";
import { SatisfactionTrendChart } from "@/components/charts/satisfaction-trend-chart";
import { ConversionRateChart } from "@/components/charts/conversion-rate-chart";
import { CallDurationChart } from "@/components/charts/call-duration-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

async function fetchDailyAnalytics(days: number = 30): Promise<DailyMetric[]> {
  try {
    const url = resolveInternalUrl(`/api/admin/analytics/daily?days=${days}`);

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Failed to fetch daily analytics", response.statusText);
      return [];
    }

    const data = (await response.json()) as AnalyticsResponse;
    return data.metrics || [];
  } catch (error) {
    console.error("Error fetching daily analytics", error);
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  // Fetch 30 days of data by default
  const metrics = await fetchDailyAnalytics(30);

  const hasData = metrics.length > 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-zinc-900">Analytics & Trends</h1>
        <p className="text-sm text-zinc-500">
          Visual insights into call performance, customer satisfaction, and booking trends over the past 30 days
        </p>
      </header>

      {!hasData && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">
            No analytics data available yet. Data will appear once calls are recorded.
          </p>
        </div>
      )}

      {hasData && (
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
