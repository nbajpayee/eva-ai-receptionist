"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface DailyMetric {
  date: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
  conversion_rate: number;
  avg_call_duration_minutes: number;
}

interface CallDurationChartProps {
  data: DailyMetric[];
}

export function CallDurationChart({ data }: CallDurationChartProps) {
  const chartData = data.map((metric) => ({
    date: format(parseISO(metric.date), "MMM dd"),
    duration: metric.avg_call_duration_minutes,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Call Duration</CardTitle>
        <CardDescription>Average time spent per call in minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: '#71717a' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: '#71717a' }}
              tickFormatter={(value) => `${value}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)} min`, "Avg Duration"]}
            />
            <Line
              type="monotone"
              dataKey="duration"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
