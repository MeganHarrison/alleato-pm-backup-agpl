import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormActionsProps {
  submitLabel: string;
  cancelLabel?: string;
  /** Visual style for the cancel button. Defaults to "outline". Use "ghost" for a borderless tertiary action. */
  cancelVariant?: "outline" | "ghost" | "secondary";
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  align?: "start" | "end" | "between";
  /** Keep Tier 2 form actions reachable throughout a long form on every viewport. */
  sticky?: boolean;
  stickyOnMobile?: boolean;
  children?: React.ReactNode;
  className?: string;
  submitDataTestId?: string;
  cancelDataTestId?: string;
}

export function FormActions({
  submitLabel,
  cancelLabel = "Cancel",
  cancelVariant = "outline",
  onCancel,
  isSubmitting = false,
  submitDisabled = false,
  cancelDisabled = false,
  align = "end",
  sticky = false,
  stickyOnMobile = false,
  children,
  className,
  submitDataTestId,
  cancelDataTestId,
}: FormActionsProps) {
  const justifyClass =
    align === "start"
      ? "sm:justify-start"
      : align === "between"
        ? "sm:justify-between"
        : "sm:justify-end";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center",
        justifyClass,
        sticky
          ? "sticky bottom-0 z-20 -mx-4 bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:-mx-8 sm:px-8"
          : stickyOnMobile
            ? "sticky bottom-0 z-20 -mx-4 bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none"
            : "pt-5",
        className,
      )}
    >
      {children ? <div className="w-full sm:w-auto">{children}</div> : null}

      <div
        className={cn(
          "flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4",
          align === "between" && "sm:ml-auto",
        )}
      >
        {onCancel ? (
          <Button
            type="button"
            variant={cancelVariant}
            onClick={onCancel}
            disabled={cancelDisabled || isSubmitting}
            className={cn("w-full sm:w-auto", (sticky || stickyOnMobile) && "min-h-11")}
            data-testid={cancelDataTestId}
          >
            {cancelLabel}
          </Button>
        ) : null}

        <Button
          type="submit"
          disabled={submitDisabled || isSubmitting}
          className={cn("w-full sm:w-auto", (sticky || stickyOnMobile) && "min-h-11")}
          data-testid={submitDataTestId}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </div>
  );
}
