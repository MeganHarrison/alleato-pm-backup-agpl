import { cn } from "@/lib/utils";

interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 12;
  className?: string;
}

export function FormGrid({
  children,
  columns = 1,
  className,
}: FormGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-12 gap-y-6",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-2 xl:grid-cols-3",
        columns === 12 && "md:grid-cols-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
