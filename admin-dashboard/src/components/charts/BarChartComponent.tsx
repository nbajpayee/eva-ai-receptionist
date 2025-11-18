"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

type DataPoint = {
  name: string;
  [key: string]: string | number;
};

type BarChartComponentProps = {
  data: DataPoint[];
  bars: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  xAxisKey?: string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  layout?: "horizontal" | "vertical";
};

export function BarChartComponent({
  data,
  bars,
  height = 300,
  xAxisKey = "name",
  yAxisFormatter,
  tooltipFormatter,
  layout = "horizontal",
}: BarChartComponentProps) {
  const defaultYAxisFormatter = (value: number) => {
    return value.toLocaleString();
  };

  const defaultTooltipFormatter = (value: number) => {
    return value.toLocaleString();
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        {layout === "horizontal" ? (
          <>
            <XAxis
              dataKey={xAxisKey}
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
          </>
        ) : (
          <>
            <XAxis
              type="number"
              tickFormatter={yAxisFormatter || defaultYAxisFormatter}
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey={xAxisKey}
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
            />
          </>
        )}
        <Tooltip
          formatter={tooltipFormatter || defaultTooltipFormatter}
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
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
