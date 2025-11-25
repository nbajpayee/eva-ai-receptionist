import { Phone, Calendar, UserCheck, Activity, DollarSign } from "lucide-react";
import { EnhancedStatCard } from "@/components/dashboard/enhanced-stat-card";
import { DailyMetric } from "@/types/analytics-extended";

interface KPIGridProps {
  metrics: DailyMetric[];
  period: string;
  loading?: boolean;
}

export function KPIGrid({ metrics, period, loading }: KPIGridProps) {
  // Calculate aggregate metrics
  const totalCalls = metrics.reduce((sum, m) => sum + m.total_calls, 0);
  const totalBookings = metrics.reduce((sum, m) => sum + m.appointments_booked, 0);

  // Calculate averages
  const avgSatisfaction = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.avg_satisfaction_score, 0) / metrics.length
    : 0;

  const conversionRate = totalCalls > 0
    ? (totalBookings / totalCalls) * 100
    : 0;

  // Mock revenue (since we don't have it in DailyMetric)
  // Assuming avg booking value $150
  const estimatedRevenue = totalBookings * 150;

  // Mock trends (in a real app, we'd compare with previous period)
  const trends = {
    calls: 12.5,
    bookings: 8.2,
    satisfaction: 2.1,
    revenue: 15.3
  };

  // Generate sparkline data from daily metrics (last 7 days)
  const generateSparkline = (field: keyof DailyMetric) => {
    const last7 = metrics.slice(-7);
    return last7.map(m => ({ value: m[field] as number }));
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <EnhancedStatCard
        title="Total Calls"
        value={totalCalls}
        icon={<Phone className="h-5 w-5 text-primary" />}
        sparklineData={generateSparkline('total_calls')}
        color="primary"
        trend={{ value: trends.calls, label: "vs last period", direction: "up" }}
        description="Voice & SMS communications"
      />
      <EnhancedStatCard
        title="Appointments Booked"
        value={totalBookings}
        icon={<Calendar className="h-5 w-5 text-secondary" />}
        sparklineData={generateSparkline('appointments_booked')}
        color="success"
        trend={{ value: trends.bookings, label: "vs last period", direction: "up" }}
        description="Confirmed bookings"
      />
      <EnhancedStatCard
        title="Conversion Rate"
        value={`${conversionRate.toFixed(1)}%`}
        icon={<UserCheck className="h-5 w-5 text-accent" />}
        sparklineData={metrics.slice(-7).map((m) => ({
          value: m.total_calls > 0 ? (m.appointments_booked / m.total_calls) * 100 : 0
        }))}
        color="success"
        trend={{ value: 2.4, label: "vs last period", direction: "up" }}
        description="Calls to bookings"
      />
      <EnhancedStatCard
        title="Est. Revenue"
        value={`$${(estimatedRevenue / 1000).toFixed(1)}k`}
        icon={<DollarSign className="h-5 w-5 text-amber-600" />}
        sparklineData={generateSparkline('appointments_booked').map(d => ({
          value: d.value * 150 // Convert bookings to revenue
        }))}
        color="warning"
        trend={{ value: trends.revenue, label: "vs last period", direction: "up" }}
        description="From booked appointments"
      />
    </div>
  );
}


