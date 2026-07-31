"use client";
import { BudgetOverlay } from "@/components/ui/budget-overlay";
import { BudgetLineItemForm } from "./budget-line-item-form";

interface BudgetLineItemModalAnimatedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

function ModalController({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: BudgetLineItemModalAnimatedProps) {
  return (
    <BudgetOverlay
      open={open}
      onOpenChange={onOpenChange}
      variant="dialog"
      size="xl"
      className="flex flex-col"
    >
      <BudgetLineItemForm
        projectId={projectId}
        onSuccess={() => {
          onSuccess?.();
          onOpenChange(false);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </BudgetOverlay>
  );
}

export function BudgetLineItemModalAnimated(
  props: BudgetLineItemModalAnimatedProps,
) {
  return <ModalController {...props} />;
}
