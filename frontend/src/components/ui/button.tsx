import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-[placeholder-style]:text-[hsl(var(--input-placeholder))] active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/95 active:bg-primary/90",
        action:
          "bg-action text-action-foreground shadow-xs hover:bg-action/90 active:bg-action/80 focus-visible:ring-action/25",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/95 active:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border bg-card text-foreground shadow-none hover:border-foreground/15 hover:bg-muted/80 active:bg-muted dark:bg-input/30 dark:hover:bg-input/50 [&[role=combobox]]:rounded-md [&[role=combobox]]:border [&[role=combobox]]:border-input [&[role=combobox]]:bg-background [&[role=combobox]]:shadow-none [&[role=combobox]]:hover:border-input [&[role=combobox]]:hover:bg-background [&[role=combobox]]:hover:text-foreground [&[role=combobox]]:active:translate-y-0 [&[role=combobox]]:dark:hover:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/90 active:bg-secondary/80",
        ghost:
          "border-0 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground active:bg-muted/80 dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-lg px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonProps }
