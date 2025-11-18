"use client";

import { useEffect, useState, useRef } from "react";
import { useInView } from "react-intersection-observer";

interface CountUpProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}

export default function CountUp({
  end,
  duration = 2000,
  suffix = "",
  prefix = "",
  decimals = 0,
  className = "",
}: CountUpProps) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;

    hasAnimated.current = true;
    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = end * easeOutQuart;

      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(updateCount);
  }, [inView, end, duration]);

  const formatNumber = (num: number) => {
    return num.toFixed(decimals);
  };

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatNumber(count)}
      {suffix}
    </span>
  );
}
