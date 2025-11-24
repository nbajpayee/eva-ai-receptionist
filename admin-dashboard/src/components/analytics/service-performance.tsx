import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const mockData = [
  { name: "Botox", bookings: 145, conversion: 85, color: "#8b5cf6" },
  { name: "Fillers", bookings: 120, conversion: 72, color: "#3b82f6" },
  { name: "Facials", bookings: 98, conversion: 65, color: "#10b981" },
  { name: "Consult", bookings: 85, conversion: 90, color: "#f59e0b" },
  { name: "Laser", bookings: 65, conversion: 55, color: "#ef4444" },
];

export function ServicePerformance() {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-md">
          <p className="font-semibold text-zinc-900">{label}</p>
          <p className="text-sm text-zinc-600">Bookings: {payload[0].value}</p>
          <p className="text-sm text-zinc-500">
            Conversion: {payload[0].payload.conversion}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mockData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            tick={{ fontSize: 12, fill: "#71717a" }}
            width={80}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5" }} />
          <Bar 
            dataKey="bookings" 
            radius={[0, 4, 4, 0]} 
            barSize={32}
            animationDuration={1000}
          >
            {mockData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

