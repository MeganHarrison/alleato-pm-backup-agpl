"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "warning" | "success" | "error";

interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BannerVariant, string> = {
  info:    "bg-primary/8 border-primary/20 text-primary",
  warning: "bg-warning/10 border-warning/30 text-warning",
  success: "bg-success/10 border-success/30 text-success",
  error:   "bg-destructive/8 border-destructive/20 text-destructive",
};

const defaultIcons: Record<BannerVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4 shrink-0 mt-0.5" />,
  warning: <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />,
  error: <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />,
};

export function Banner({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  className,
  icon,
}: BannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full items-start gap-3 border px-4 py-3 text-sm",
        variantStyles[variant],
        className,
      )}
    >
      {icon ?? defaultIcons[variant]}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn("leading-relaxed", title && "mt-0.5 opacity-90")}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
