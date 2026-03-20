// Dependencies: (none beyond React)
import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-white",
        variant === "default" && "bg-[#1F1F1F] text-[#A0A0A0]",
        variant === "secondary" && "bg-[#2E2E2E] text-[#FAFAFA]",
        variant === "outline" && "border border-[#2E2E2E] text-[#A0A0A0]",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
