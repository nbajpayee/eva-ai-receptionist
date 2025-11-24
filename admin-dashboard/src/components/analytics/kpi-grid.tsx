import { Phone, Calendar, UserCheck, Activity, DollarSign } from "lucide-react";
import { KPICard } from "./kpi-card";
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

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total Calls"
        value={totalCalls.toLocaleString()}
        change={trends.calls}
        trend="up"
        icon={Phone}
        color="blue"
        delay={0.1}
      />
      <KPICard
        title="Appointments"
        value={totalBookings.toLocaleString()}
        change={trends.bookings}
        trend="up"
        icon={Calendar}
        color="purple"
        delay={0.2}
      />
      <KPICard
        title="Conversion Rate"
        value={`${conversionRate.toFixed(1)}%`}
        change={2.4} // varied mock
        trend="up"
        icon={UserCheck}
        color="green"
        delay={0.3}
      />
      <KPICard
        title="Est. Revenue"
        value={`$${estimatedRevenue.toLocaleString()}`}
        change={trends.revenue}
        trend="up"
        icon={DollarSign}
        color="orange"
        delay={0.4}
      />
    </div>
  );
}

