"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface DailyMetric {
  date: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
  conversion_rate: number;
  avg_call_duration_minutes: number;
}

interface ConversionRateChartProps {
  data: DailyMetric[];
}

export function ConversionRateChart({ data }: ConversionRateChartProps) {
  const chartData = data.map((metric) => ({
    date: format(parseISO(metric.date), "MMM dd"),
    rate: metric.conversion_rate,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Rate</CardTitle>
        <CardDescription>Percentage of calls resulting in booked appointments</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: '#71717a' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: '#71717a' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Conversion Rate"]}
            />
            <Bar
              dataKey="rate"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
