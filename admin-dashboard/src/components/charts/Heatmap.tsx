"use client";

type HeatmapCell = {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  value: number;
};

type HeatmapProps = {
  data: HeatmapCell[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function Heatmap({ data }: HeatmapProps) {
  // Find min/max for color scaling
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);

  const getValue = (day: number, hour: number): number => {
    const cell = data.find((d) => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

  const getColor = (value: number): string => {
    if (value === 0) return "#f4f4f5"; // zinc-100

    const intensity = (value - minValue) / (maxValue - minValue);

    if (intensity < 0.2) return "#dcfce7"; // green-100
    if (intensity < 0.4) return "#bbf7d0"; // green-200
    if (intensity < 0.6) return "#86efac"; // green-300
    if (intensity < 0.8) return "#4ade80"; // green-400
    return "#22c55e"; // green-500
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12a";
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return "12p";
    return `${hour - 12}p`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>Peak hours by day of week</span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Low</span>
          <div className="flex gap-1">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity) => (
              <div
                key={intensity}
                className="h-4 w-4 rounded"
                style={{
                  backgroundColor: getColor(minValue + intensity * (maxValue - minValue)),
                }}
              ></div>
            ))}
          </div>
          <span className="text-xs">High</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid gap-1" style={{ gridTemplateColumns: "auto repeat(24, 1fr)" }}>
            {/* Header row with hours */}
            <div className="h-8"></div>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex items-center justify-center text-xs text-zinc-500"
              >
                {hour % 3 === 0 ? formatHour(hour) : ""}
              </div>
            ))}

            {/* Rows for each day */}
            {DAYS.map((day, dayIndex) => (
              <>
                <div
                  key={`label-${day}`}
                  className="flex items-center justify-end pr-2 text-xs font-medium text-zinc-700"
                >
                  {day}
                </div>
                {HOURS.map((hour) => {
                  const value = getValue(dayIndex, hour);
                  const color = getColor(value);

                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className="group relative aspect-square cursor-pointer rounded transition-all hover:ring-2 hover:ring-zinc-400"
                      style={{ backgroundColor: color }}
                      title={`${day} ${formatHour(hour)}: ${value} conversations`}
                    >
                      {/* Tooltip on hover */}
                      <div className="pointer-events-none absolute -top-16 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                        <div className="font-medium">{day} {formatHour(hour)}</div>
                        <div className="text-zinc-300">{value} conversations</div>
                      </div>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
