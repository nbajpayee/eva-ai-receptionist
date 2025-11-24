import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface OutcomeMetric {
  name: string;
  count: number;
  color: string;
}

interface OutcomeBreakdownProps {
  data: OutcomeMetric[];
}

export function OutcomeBreakdown({ data }: OutcomeBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-md">
          <p className="font-medium text-zinc-900">{item.name}</p>
          <p className="text-sm text-zinc-500">
            {item.value.toLocaleString()} ({((item.value / total) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

