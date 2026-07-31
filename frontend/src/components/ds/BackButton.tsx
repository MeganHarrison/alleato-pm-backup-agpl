import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Called when clicked (use instead of href for router.back()) */
  onClick?: () => void;
  /** Navigate to a fixed URL instead */
  href?: string;
  label?: string;
  className?: string;
}

export function BackButton({ onClick, href, label = "Back", className }: BackButtonProps) {
  const inner = (
    <>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </>
  );

  if (href) {
    return (
      <Button asChild variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground hover:text-foreground", className)}>
        <Link href={href}>{inner}</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("gap-1.5 text-muted-foreground hover:text-foreground", className)}
    >
      {inner}
    </Button>
  );
}
