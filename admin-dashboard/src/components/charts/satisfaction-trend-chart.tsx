"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface DailyMetric {
  date: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
  conversion_rate: number;
  avg_call_duration_minutes: number;
}

interface SatisfactionTrendChartProps {
  data: DailyMetric[];
}

export function SatisfactionTrendChart({ data }: SatisfactionTrendChartProps) {
  const chartData = data.map((metric) => ({
    date: format(parseISO(metric.date), "MMM dd"),
    score: metric.avg_satisfaction_score,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Satisfaction Score Trend</CardTitle>
        <CardDescription>Average customer satisfaction score over time (0-10 scale)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="satisfactionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: '#71717a' }}
            />
            <YAxis
              domain={[0, 10]}
              className="text-xs"
              tick={{ fill: '#71717a' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
              formatter={(value: number) => [value.toFixed(1), "Score"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#satisfactionGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
