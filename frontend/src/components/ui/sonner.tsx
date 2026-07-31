"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { ToastInstrumentation } from "./toast-instrumentation";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toaster = (
    <>
      <ToastInstrumentation />
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        position="bottom-right"
        offset={{ bottom: 80, right: 16 }}
        mobileOffset={{ bottom: 80, right: 16 }}
        visibleToasts={3}
        style={{ zIndex: 2147483647 }}
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-sm",
            description:
              "group-[.toast]:text-muted-foreground group-[.toast[data-type=error]]:text-white/90",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            success:
              "group-[.toaster]:!bg-[hsl(142_76%_97%)] group-[.toaster]:!text-[hsl(var(--status-success))] group-[.toaster]:!border-[hsl(var(--status-success)/0.3)]",
            error:
              "group-[.toaster]:!bg-[hsl(var(--status-error))] group-[.toaster]:!text-white group-[.toaster]:!border-[hsl(var(--status-error))] [&_[data-description]]:!text-white",
          },
        }}
        {...props}
      />
    </>
  );

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(toaster, document.body);
};

export { Toaster };
