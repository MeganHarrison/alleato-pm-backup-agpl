import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  variant?: "default" | "inline";
}

function Input({ className, type, variant = "default", ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        "file:text-foreground placeholder:text-[hsl(var(--input-placeholder))] selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 rounded-md px-4 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // Variant-specific styles
        variant === "inline"
          ? "border-0 !bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
          : "border-input border bg-background shadow-none focus-visible:border-input focus-visible:outline-none",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input, type InputProps }
