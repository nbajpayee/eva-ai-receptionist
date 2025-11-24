import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelMetric {
  name: string;
  conversations: number;
  color: string;
}

interface ChannelBreakdownProps {
  data: ChannelMetric[];
}

export function ChannelBreakdown({ data }: ChannelBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.conversations, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-md">
          <p className="font-medium text-zinc-900">{item.name}</p>
          <p className="text-sm text-zinc-500">
            {item.value.toLocaleString()} calls ({((item.value / total) * 100).toFixed(1)}%)
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
            paddingAngle={5}
            dataKey="conversations"
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
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

