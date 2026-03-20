// Dependencies: (none beyond React)
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
  asChild?: boolean;
}

const buttonVariants = {
  default:
    "bg-white text-black hover:bg-[#e0e0e0] active:bg-[#cccccc]",
  secondary:
    "bg-[#1F1F1F] text-[#FAFAFA] hover:bg-[#2E2E2E] active:bg-[#333333]",
  ghost:
    "bg-transparent text-[#FAFAFA] hover:bg-[#1F1F1F] active:bg-[#2E2E2E]",
  destructive:
    "bg-[#ef4444] text-white hover:bg-[#dc2626] active:bg-[#b91c1c]",
};

const buttonSizes = {
  sm: "h-7 px-3 text-xs rounded-sm",
  default: "h-8 px-4 text-sm rounded-md",
  lg: "h-10 px-6 text-sm rounded-md",
  icon: "h-8 w-8 rounded-md",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-0",
          "disabled:pointer-events-none disabled:opacity-50",
          "select-none cursor-pointer",
          buttonVariants[variant],
          buttonSizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
