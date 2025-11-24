"use client";

import { motion } from "framer-motion";

interface GoalProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function GoalProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#8B5CF6", // Purple
  trackColor = "#E4E4E7", // Zinc 200
  label,
  sublabel,
}: GoalProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {label && <span className="text-2xl font-bold tabular-nums text-zinc-900">{label}</span>}
          {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

