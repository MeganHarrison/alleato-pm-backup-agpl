interface DateDividerProps {
  label: string;
}

export function DateDivider({ label }: DateDividerProps) {
  return (
    <div className="flex items-center gap-3 my-6 px-4">
      <div className="h-px flex-1 bg-border/50" />
      <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground/60">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}
