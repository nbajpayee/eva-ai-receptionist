import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentPropsWithoutRef<"div"> & {
  value?: number;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, ...rest }, ref) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  return (
    <div
      ref={ref}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-zinc-200", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedValue)}
      {...rest}
    >
      <div
        className="h-full w-full flex-1 bg-zinc-900 transition-all"
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </div>
  );
});

Progress.displayName = "Progress";

export { Progress };
