"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { DailyMetric } from "@/types/analytics-extended";

interface CallVolumeChartProps {
  data: DailyMetric[];
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const chartData = data.map((metric) => ({
    date: format(parseISO(metric.date), "MMM dd"),
    calls: metric.total_calls,
    booked: metric.appointments_booked,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-md">
          <p className="font-semibold text-zinc-900">{label}</p>
          <div className="mt-2 space-y-1">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <div 
                  className="h-2 w-2 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-zinc-500">{entry.name}:</span>
                <span className="font-medium text-zinc-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
            tick={{ fontSize: 12, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e4e4e7' }} />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
          />
          <Line
            type="monotone"
            dataKey="calls"
            stroke="#3b82f6" // blue-500
            strokeWidth={3}
            name="Total Calls"
            dot={false}
            activeDot={{ r: 6, fill: "#3b82f6", strokeWidth: 0 }}
            animationDuration={1500}
          />
          <Line
            type="monotone"
            dataKey="booked"
            stroke="#10b981" // emerald-500
            strokeWidth={3}
            name="Booked"
            dot={false}
            activeDot={{ r: 6, fill: "#10b981", strokeWidth: 0 }}
            animationDuration={1500}
            animationBegin={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
