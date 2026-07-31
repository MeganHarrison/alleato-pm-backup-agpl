"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type FormDensity = "comfortable" | "default" | "compact";

const FormDensityContext = React.createContext<FormDensity>("comfortable");

export function useFormDensity() {
  return React.useContext(FormDensityContext);
}

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  density?: FormDensity;
}

export function Form({
  children,
  className,
  onSubmit,
  density = "comfortable",
  ...props
}: FormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (onSubmit) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const formSpacingClass =
    density === "compact"
      ? "space-y-4"
      : density === "default"
        ? "space-y-6"
        : "space-y-8";

  return (
    <FormDensityContext.Provider value={density}>
      <form
        className={cn(formSpacingClass, className)}
        onSubmit={handleSubmit}
        {...props}
      >
        {children}
      </form>
    </FormDensityContext.Provider>
  );
}
