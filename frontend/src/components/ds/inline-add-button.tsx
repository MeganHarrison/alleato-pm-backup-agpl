"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InlineAddButtonProps = Omit<ButtonProps, "variant" | "size"> & {
  children: React.ReactNode;
};

export function InlineAddButton({
  children,
  className,
  ...props
}: InlineAddButtonProps) {
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className={cn(
        "h-8 gap-1 px-0 font-semibold text-primary underline-offset-4 hover:bg-transparent hover:text-primary/90",
        className,
      )}
      {...props}
    >
      <Plus className="text-primary" />
      {children}
    </Button>
  );
}
