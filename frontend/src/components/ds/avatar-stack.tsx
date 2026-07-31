"use client";

import { cn } from "@/lib/utils";

interface AvatarStackProps {
  avatars: string[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export function AvatarStack({
  avatars,
  max = 3,
  size = "sm",
  className,
}: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  const sizeClasses =
    size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div className={cn("flex -space-x-1.5", className)}>
      {visible.map((initials, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-center rounded-full bg-primary-surface font-medium text-primary ring-2 ring-background",
            sizeClasses
          )}
        >
          {initials}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background",
            sizeClasses
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
