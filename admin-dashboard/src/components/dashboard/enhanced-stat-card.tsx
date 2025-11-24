"use client";

import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number; // percentage
    label: string;
    direction: "up" | "down" | "neutral";
  };
  sparklineData?: { value: number }[];
  description?: string;
  color?: "default" | "primary" | "success" | "warning" | "info";
  className?: string;
  onClick?: () => void;
}

const colorMap = {
  default: "bg-white border-zinc-200",
  primary: "bg-gradient-to-br from-violet-50 to-white border-violet-100",
  success: "bg-gradient-to-br from-emerald-50 to-white border-emerald-100",
  warning: "bg-gradient-to-br from-amber-50 to-white border-amber-100",
  info: "bg-gradient-to-br from-sky-50 to-white border-sky-100",
};

const trendColorMap = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-rose-600 bg-rose-50",
  neutral: "text-zinc-600 bg-zinc-50",
};

export function EnhancedStatCard({
  title,
  value,
  icon,
  trend,
  sparklineData,
  description,
  color = "default",
  className,
  onClick,
}: EnhancedStatCardProps) {
  // Parsing the numeric part of the value for animation if possible
  const numericValue = typeof value === "string" ? parseFloat(value.replace(/[^0-9.]/g, "")) : value;
  const isNumeric = !isNaN(numericValue);
  
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    // Always return a string so this is a MotionValue<string>, which
    // can be safely used inside motion.span
    return Math.round(latest).toLocaleString();
  });

  const [displayValue, setDisplayValue] = useState(isNumeric ? "0" : value);

  useEffect(() => {
    if (isNumeric) {
      const controls = animate(count, numericValue, { duration: 1, ease: "easeOut" });
      return controls.stop;
    }
  }, [numericValue, isNumeric, count]);

  // If value has non-numeric prefix/suffix, we might need to handle it.
  // For this MVP, we will rely on the passed value if not strictly numeric for animation simplicity,
  // or wrap the animated number with the original suffix/prefix if we parsed it.
  // Actually, let's keep it simple: if it's a number, animate it. If string, just show it.
  // To properly animate "24%" or "$500", we'd need more complex parsing. 
  // Let's assume value passed might be formatted. We'll animate the number and append the rest.

  return (
    <motion.div
      whileHover={{
        y: -4,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all cursor-pointer",
        colorMap[color],
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-zinc-900 tracking-tight">
              {/* Simple animation for pure numbers, direct render for others for now */}
               {isNumeric && typeof value === 'number' ? <motion.span>{rounded}</motion.span> : value}
            </h3>
          </div>
        </div>
        <div className={cn("rounded-lg p-2", "bg-white shadow-sm ring-1 ring-zinc-900/5")}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {trend && (
            <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit", trendColorMap[trend.direction])}>
              {trend.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
              {trend.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
              {trend.direction === "neutral" && <Minus className="h-3 w-3" />}
              {trend.value}% {trend.label}
            </div>
          )}
          {description && (
            <p className="text-xs text-zinc-500">{description}</p>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={trend?.direction === "down" ? "#EF4444" : "#10B981"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
