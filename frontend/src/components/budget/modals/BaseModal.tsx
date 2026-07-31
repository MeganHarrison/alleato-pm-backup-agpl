"use client";

import {
  BudgetOverlay,
  BudgetOverlayBody,
  BudgetOverlayFooter,
  BudgetOverlayHeader,
} from "@/components/ui/budget-overlay";
import { cn } from "@/lib/utils";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  showCloseButton?: boolean;
}

/**
 * BaseModal - Standard modal component for budget modals
 *
 * Features:
 * - Wider design (default: max-w-4xl)
 * - Mobile responsive
 * - Dark header with white text
 * - ESC key to close
 * - Overlay click to close
 * - Keyboard navigation support
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "xl",
  className,
  showCloseButton = true,
}: BaseModalProps) {
  const overlaySizeMap = {
    sm: "sm",
    md: "md",
    lg: "lg",
    xl: "xl",
    full: "full",
  } as const;

  return (
    <BudgetOverlay
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="dialog"
      size={overlaySizeMap[size]}
      className={cn("flex h-full flex-col", className)}
    >
      <BudgetOverlayHeader
        title={title}
        description={description}
        showCloseButton={showCloseButton}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </BudgetOverlay>
  );
}

/**
 * ModalFooter - Standard footer for modal actions
 */
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <BudgetOverlayFooter className={className}>{children}</BudgetOverlayFooter>
  );
}

/**
 * ModalBody - Standard body for modal content
 */
interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <BudgetOverlayBody className={cn("px-4 py-4 sm:px-6 sm:py-5", className)}>
      {children}
    </BudgetOverlayBody>
  );
}
