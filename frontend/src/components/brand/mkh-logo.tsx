import Image from "next/image";

import { cn } from "@/lib/utils";

type MkhLogoProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Canonical MKH identity for product chrome and AI surfaces.
 *
 * Keep the original transparent artwork as the single asset owner. Dark mode
 * uses a monochrome inversion so the same source remains legible without
 * maintaining a second, drifting logo file.
 */
export function MkhLogo({
  alt = "MKH",
  className,
  priority = false,
}: MkhLogoProps) {
  return (
    <Image
      src="/brand/mkh-logo-primary.png"
      alt={alt}
      width={268}
      height={226}
      priority={priority}
      className={cn("h-auto w-10 object-contain dark:invert", className)}
    />
  );
}
