"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { DailyMetric } from "@/types/analytics-extended";

interface SatisfactionTrendChartProps {
  data: DailyMetric[];
}

export function SatisfactionTrendChart({ data }: SatisfactionTrendChartProps) {
  const chartData = data.map((metric) => ({
    date: format(parseISO(metric.date), "MMM dd"),
    score: metric.avg_satisfaction_score,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-md">
          <p className="font-semibold text-zinc-900">{label}</p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Score:</span>
            <span className="font-medium text-zinc-900">{Number(payload[0].value).toFixed(1)} / 10</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-900">Satisfaction Trend</h3>
        <p className="text-sm text-zinc-500">Average customer satisfaction score (0-10)</p>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="satisfactionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
              dy={10}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e4e4e7' }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#8b5cf6" // violet-500
              strokeWidth={3}
              fill="url(#satisfactionGradient)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
