"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface DailyMetric {
  date: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
  conversion_rate: number;
  avg_call_duration_minutes: number;
}

interface CallVolumeChartProps {
  data: DailyMetric[];
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const chartData = data.map((metric) => ({
    date: format(parseISO(metric.date), "MMM dd"),
    calls: metric.total_calls,
    booked: metric.appointments_booked,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Volume & Bookings</CardTitle>
        <CardDescription>Daily call activity and appointments booked over time</CardDescription>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="calls"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Total Calls"
              dot={{ fill: '#3b82f6', r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="booked"
              stroke="#10b981"
              strokeWidth={2}
              name="Appointments Booked"
              dot={{ fill: '#10b981', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
