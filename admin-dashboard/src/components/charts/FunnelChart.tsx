"use client";

type FunnelStage = {
  name: string;
  value: number;
  color: string;
};

type FunnelChartProps = {
  stages: FunnelStage[];
  height?: number;
};

export function FunnelChart({ stages, height = 400 }: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-500">No funnel data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value));
  const totalInitial = stages[0]?.value || 1;

  return (
    <div className="flex flex-col gap-6" style={{ height }}>
      {stages.map((stage, index) => {
        const widthPercent = (stage.value / maxValue) * 100;
        const conversionRate =
          index === 0 ? 100 : (stage.value / totalInitial) * 100;
        const dropOffFromPrevious =
          index > 0
            ? ((stages[index - 1].value - stage.value) /
                stages[index - 1].value) *
              100
            : 0;

        return (
          <div key={stage.name} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: stage.color }}
                ></div>
                <span className="font-medium text-zinc-900">{stage.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-600">
                <span className="font-semibold">{stage.value.toLocaleString()}</span>
                <span className="text-zinc-500">
                  {conversionRate.toFixed(1)}% of total
                </span>
                {index > 0 && dropOffFromPrevious > 0 && (
                  <span className="text-red-600">
                    -{dropOffFromPrevious.toFixed(1)}% drop-off
                  </span>
                )}
              </div>
            </div>

            <div className="relative h-12 w-full">
              <div
                className="absolute left-0 top-0 h-full rounded transition-all duration-300"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: stage.color,
                  opacity: 0.9,
                }}
              >
                <div className="flex h-full items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {stage.value.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {index < stages.length - 1 && (
              <div className="mx-auto flex h-6 w-0.5 bg-zinc-300"></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
