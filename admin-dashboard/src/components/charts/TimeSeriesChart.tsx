"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";

type DataPoint = {
  timestamp: string;
  [key: string]: string | number;
};

type TimeSeriesChartProps = {
  data: DataPoint[];
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
};

export function TimeSeriesChart({
  data,
  lines,
  height = 300,
  xAxisFormatter,
  yAxisFormatter,
  tooltipFormatter,
}: TimeSeriesChartProps) {
  const defaultXAxisFormatter = (value: string) => {
    try {
      const date = new Date(value);
      return format(date, "MMM d, h:mm a");
    } catch {
      return value;
    }
  };

  const defaultYAxisFormatter = (value: number) => {
    return value.toLocaleString();
  };

  const defaultTooltipFormatter = (value: number) => {
    return value.toLocaleString();
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={xAxisFormatter || defaultXAxisFormatter}
          stroke="#71717a"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          tickFormatter={yAxisFormatter || defaultYAxisFormatter}
          stroke="#71717a"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={tooltipFormatter || defaultTooltipFormatter}
          labelFormatter={(label: string) =>
            (xAxisFormatter || defaultXAxisFormatter)(label)
          }
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e5e5",
            borderRadius: "6px",
            padding: "8px 12px",
          }}
        />
        <Legend
          wrapperStyle={{
            paddingTop: "20px",
          }}
        />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
