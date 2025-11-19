import * as React from "react";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & {
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
  }
>(({ className, orientation = "horizontal", decorative = false, role = "separator", ...props }, ref) => {
  const ariaRole = decorative ? "presentation" : role;
  const ariaOrientation = orientation === "vertical" ? orientation : undefined;

  return (
    <div
      ref={ref}
      role={ariaRole}
      aria-orientation={ariaOrientation}
      className={cn(
        "bg-border",
        orientation === "vertical" ? "w-px h-full" : "h-px w-full",
        className
      )}
      {...props}
    />
  );
});
Separator.displayName = "Separator";

export { Separator };
