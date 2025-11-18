import { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
};

export function ChartCard({
  title,
  description,
  children,
  isLoading = false,
  error = null,
  className = "",
}: ChartCardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900"></div>
            <p className="text-sm text-zinc-500">Loading chart data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-red-600">Error loading chart</p>
            <p className="mt-1 text-xs text-zinc-500">{error}</p>
          </div>
        </div>
      ) : (
        <div className="chart-container">{children}</div>
      )}
    </div>
  );
}
