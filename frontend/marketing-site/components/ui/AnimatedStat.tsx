"use client";

import CountUp from "./CountUp";

interface AnimatedStatProps {
  value: string;
  label: string;
  className?: string;
}

export default function AnimatedStat({ value, label, className = "" }: AnimatedStatProps) {
  // Parse the value to extract number, suffix, and prefix
  const parseValue = (val: string) => {
    // Handle percentages
    if (val.includes("%")) {
      const num = parseFloat(val.replace("%", ""));
      return { number: num, suffix: "%", prefix: "", decimals: val.includes(".") ? 1 : 0 };
    }

    // Handle numbers with + suffix
    if (val.includes("+")) {
      const cleanVal = val.replace(/[,+]/g, "");
      const num = parseFloat(cleanVal);
      return { number: num, suffix: "+", prefix: "", decimals: 0 };
    }

    // Handle numbers with K suffix (thousands)
    if (val.includes("K")) {
      const num = parseFloat(val.replace("K", "")) * 1000;
      return { number: num, suffix: "+", prefix: "", decimals: 0, displaySuffix: "K+" };
    }

    // Default case
    const num = parseFloat(val.replace(/,/g, ""));
    return { number: num, suffix: "", prefix: "", decimals: 0 };
  };

  const { number, suffix, prefix, decimals, displaySuffix } = parseValue(value);

  // For large numbers, format with commas
  const formatWithCommas = number >= 1000 && !displaySuffix;

  return (
    <div className={`text-center ${className}`}>
      <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
        {formatWithCommas ? (
          <>
            {prefix}
            <CountUp end={number} decimals={decimals} duration={2000} />
            {suffix}
          </>
        ) : displaySuffix ? (
          <>
            {prefix}
            <CountUp end={number / 1000} decimals={decimals} duration={2000} />
            {displaySuffix}
          </>
        ) : (
          <>
            {prefix}
            <CountUp end={number} decimals={decimals} duration={2000} />
            {suffix}
          </>
        )}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
