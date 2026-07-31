import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoAlertVariant = "info" | "warning" | "success" | "error";

interface InfoAlertProps {
  children: React.ReactNode;
  variant?: InfoAlertVariant;
  icon?: React.ReactNode;
  className?: string;
  id?: string;
  role?: "note" | "alert" | "status";
}

const variantStyles: Record<InfoAlertVariant, string> = {
  info:    "bg-info/10 text-info border-info/30",
  warning: "bg-warning-surface text-warning border-warning-border",
  success: "bg-success-surface text-success border-success-border",
  error:   "bg-destructive-surface text-destructive border-destructive-border",
};

const defaultIcons: Record<InfoAlertVariant, React.ReactNode> = {
  info:    <Info className="h-4 w-4 shrink-0 mt-px" />,
  warning: <TriangleAlert className="h-4 w-4 shrink-0 mt-px" />,
  success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-px" />,
  error:   <AlertCircle className="h-4 w-4 shrink-0 mt-px" />,
};

export function InfoAlert({
  children,
  variant = "info",
  icon,
  className,
  id,
  role = "note",
}: InfoAlertProps) {
  return (
    <div
      id={id}
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm",
        variantStyles[variant],
        className,
      )}
    >
      {icon ?? defaultIcons[variant]}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
