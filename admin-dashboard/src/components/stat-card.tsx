import { Card } from "@/components/ui/card";
import { type ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  trend?: ReactNode;
}

export function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
          {description ? (
            <p className="mt-2 text-sm text-zinc-500">{description}</p>
          ) : null}
        </div>
        {icon ? (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 p-3 text-zinc-400">
            {icon}
          </span>
        ) : null}
      </div>
      {trend ? <div className="border-t border-zinc-100 px-6 py-4 text-sm">{trend}</div> : null}
    </Card>
  );
}
