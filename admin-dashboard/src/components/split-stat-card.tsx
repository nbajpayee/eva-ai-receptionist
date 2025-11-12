import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SplitStatCardProps {
  title: string;
  leftMetric: {
    label: string;
    value: string;
    icon: ReactNode;
  };
  rightMetric: {
    label: string;
    value: string;
    icon: ReactNode;
  };
  description?: string;
}

export function SplitStatCard({
  title,
  leftMetric,
  rightMetric,
  description,
}: SplitStatCardProps) {
  return (
    <Card className="border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-zinc-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          {/* Left Metric */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-zinc-400">
              {leftMetric.icon}
              <span className="text-xs font-medium uppercase tracking-wide">
                {leftMetric.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {leftMetric.value}
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute left-0 top-0 h-full w-px bg-zinc-200" />

            {/* Right Metric */}
            <div className="flex flex-col gap-1 pl-4">
              <div className="flex items-center gap-2 text-zinc-400">
                {rightMetric.icon}
                <span className="text-xs font-medium uppercase tracking-wide">
                  {rightMetric.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                {rightMetric.value}
              </p>
            </div>
          </div>
        </div>

        {description && (
          <p className="text-xs text-zinc-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
