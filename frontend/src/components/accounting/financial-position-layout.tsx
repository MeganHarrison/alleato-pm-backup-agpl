import type { ReactNode } from "react";

interface FinancialPositionLayoutProps {
  receivables: ReactNode;
  payables: ReactNode;
  cashMovement: ReactNode;
}

export function FinancialPositionLayout({
  receivables,
  payables,
  cashMovement,
}: FinancialPositionLayoutProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
      <div className="grid gap-4 lg:grid-cols-2">
        {receivables}
        {payables}
      </div>
      {cashMovement}
    </div>
  );
}
