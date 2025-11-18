import { ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-zinc-500">{description}</p>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-64 flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-full w-full" />
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
      </CardContent>
    </Card>
  );
}
