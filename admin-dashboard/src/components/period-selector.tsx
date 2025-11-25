"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

export const PERIODS = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
] as const;

export type Period = typeof PERIODS[number]["value"];

export interface PeriodOption {
  value: string;
  label: string;
}

interface PeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  periods?: readonly PeriodOption[];
}

export function PeriodSelector({ 
  selectedPeriod, 
  onPeriodChange,
  periods = PERIODS 
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Calendar icon */}
      <Calendar className="h-4 w-4 text-zinc-500" />

      {/* Pill group container */}
      <div className="relative inline-flex items-center gap-1 rounded-lg bg-zinc-100/50 p-0.5 md:p-1 backdrop-blur-sm">
        {periods.map((period) => {
          const isActive = selectedPeriod === period.value;

          return (
            <motion.button
              key={period.value}
              onClick={() => onPeriodChange(period.value)}
              className="relative px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`View ${period.label}`}
              aria-pressed={isActive}
              initial={false}
              whileHover={!isActive ? "hover" : undefined}
            >
              {/* Animated glass background (only renders for active item) */}
              {isActive && (
                <motion.div
                  layoutId="period-selector-active-bg"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5 pointer-events-none"
                  style={{ backdropFilter: "blur(12px)" }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                    mass: 0.8,
                  }}
                />
              )}

              {/* Hover effect (only for inactive items) */}
              {!isActive && (
                <motion.div
                  className="absolute inset-0 rounded-lg bg-white/60 border border-white/40 shadow-sm backdrop-blur-md pointer-events-none"
                  variants={{
                    hover: {
                      opacity: 1,
                      scale: 1,
                    },
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}

              {/* Text label (relative positioning so it sits above backgrounds) */}
              <span
                className={`relative z-10 font-medium transition-colors duration-200 pointer-events-none ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {period.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
