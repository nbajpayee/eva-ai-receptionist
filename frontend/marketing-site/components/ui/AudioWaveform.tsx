"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function AudioWaveform() {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    return () => setIsAnimating(false);
  }, []);

  const bars = 12;
  
  return (
    <div className="flex items-center justify-center gap-1 h-12 w-full max-w-[120px]">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1.5 bg-primary-500 rounded-full"
          animate={{
            height: [
              "20%",
              `${Math.random() * 60 + 40}%`,
              `${Math.random() * 60 + 40}%`,
              "20%"
            ],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.1,
            ease: "easeInOut",
          }}
          style={{
            height: "20%",
          }}
        />
      ))}
    </div>
  );
}

