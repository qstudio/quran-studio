// Dependencies: (none beyond React)
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#1F1F1F]", className)}
      {...props}
    />
  );
}

export { Skeleton };
