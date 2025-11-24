"use client";

import { motion } from "framer-motion";
import { Lightbulb, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  type: "trend" | "alert" | "goal" | "tip";
  title: string;
  description: string;
  metric?: string;
  className?: string;
}

const styleMap = {
  trend: {
    icon: TrendingUp,
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    text: "text-indigo-900",
    iconColor: "text-indigo-600",
  },
  alert: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-900",
    iconColor: "text-amber-600",
  },
  goal: {
    icon: Target,
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-900",
    iconColor: "text-emerald-600",
  },
  tip: {
    icon: Lightbulb,
    bg: "bg-violet-50",
    border: "border-violet-100",
    text: "text-violet-900",
    iconColor: "text-violet-600",
  },
};

export function InsightCard({ type, title, description, metric, className }: InsightCardProps) {
  const style = styleMap[type];
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4 transition-all hover:shadow-md",
        style.bg,
        style.border,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", style.iconColor)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wider", style.iconColor)}>
          {type}
        </span>
      </div>
      
      <div>
        <h4 className={cn("font-semibold", style.text)}>{title}</h4>
        <p className={cn("text-sm mt-1 opacity-80", style.text)}>{description}</p>
      </div>

      {metric && (
        <div className="mt-auto pt-2">
          <span className={cn("text-2xl font-bold tracking-tight", style.text)}>
            {metric}
          </span>
        </div>
      )}
    </motion.div>
  );
}

