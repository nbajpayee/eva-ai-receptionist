import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color?: "blue" | "purple" | "green" | "orange" | "rose";
  delay?: number;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = "vs last period",
  icon: Icon,
  trend,
  color = "blue",
  delay = 0,
}: KPICardProps) {
  const colors = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
    green: "text-emerald-600 bg-emerald-50 border-emerald-100",
    orange: "text-amber-600 bg-amber-50 border-amber-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
  };

  const iconColors = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-emerald-600",
    orange: "text-amber-600",
    rose: "text-rose-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Card className="overflow-hidden border-zinc-200/60 shadow-sm transition-all hover:shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-500">{title}</p>
              <div className="flex items-baseline gap-2">
                <motion.h3 
                  className="text-3xl font-bold text-zinc-900"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: delay + 0.2 }}
                >
                  {value}
                </motion.h3>
              </div>
            </div>
            {Icon && (
              <div className={cn("rounded-lg p-2 ring-1 ring-inset", colors[color])}>
                <Icon className={cn("h-5 w-5", iconColors[color])} />
              </div>
            )}
          </div>

          {change !== undefined && (
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "flex items-center gap-0.5 font-medium",
                  trend === "up" && "text-emerald-600",
                  trend === "down" && "text-rose-600",
                  trend === "neutral" && "text-zinc-500"
                )}
              >
                {trend === "up" && <ArrowUp className="h-3 w-3" />}
                {trend === "down" && <ArrowDown className="h-3 w-3" />}
                {trend === "neutral" && <Minus className="h-3 w-3" />}
                {Math.abs(change)}%
              </span>
              <span className="text-zinc-400">{changeLabel}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}


