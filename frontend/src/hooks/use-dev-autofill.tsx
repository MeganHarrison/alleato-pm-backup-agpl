/**
 * React hook for development auto-fill functionality
 *
 * Usage:
 * ```tsx
 * const { autoFill, DevAutoFillButton } = useDevAutoFill('project', form.setValue);
 *
 * return (
 *   <form>
 *     <DevAutoFillButton />
 *     {/* form fields *\/}
 *   </form>
 * );
 * ```
 */

import { useCallback, type ReactNode } from "react";
import {
  getAutoFillData,
  isDevelopment,
  autoFillPresets,
} from "@/lib/dev-autofill";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";

type FormType = keyof typeof autoFillPresets;

interface UseDevAutoFillOptions {
  /**
   * Custom button text (defaults to "Auto-Fill")
   */
  buttonText?: string;
  /**
   * Custom button className
   */
  buttonClassName?: string;
  /**
   * Callback after auto-fill completes
   */
  onAutoFill?: () => void;
}

export function useDevAutoFill<T extends Record<string, unknown>>(
  formType: FormType,
  setValue: (name: keyof T, value: unknown) => void,
  options: UseDevAutoFillOptions = {},
) {
  const { buttonText = "Auto-Fill", buttonClassName, onAutoFill } = options;

  /**
   * Auto-fill the form with fake data
   */
  const autoFill = useCallback(() => {
    if (!isDevelopment) {
      console.warn("Auto-fill is only available in development mode");
      return;
    }

    const data = getAutoFillData(formType);

    // Set each field value
    for (const [key, value] of Object.entries(data)) {
      setValue(key as keyof T, value);
    }

    // Call the callback if provided
    onAutoFill?.();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DevAutoFill] Filled ${Object.keys(data).length} fields for ${formType} form`);
    }
  }, [formType, setValue, onAutoFill]);

  /**
   * Pre-built auto-fill button component
   */
  const DevAutoFillButton = () => {
    if (!isDevelopment) {
      return null;
    }

    return (
      <Button
        type="button"
        onClick={autoFill}
        className={
          buttonClassName ||
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-info/10 text-info hover:bg-info/20 rounded-md transition-colors border border-info/30"
        }
        title="Development only: Fill form with test data"
        variant="ghost"
      >
        <Wand2 className="w-4 h-4" />
        {buttonText}
      </Button>
    );
  };

  return {
    autoFill,
    DevAutoFillButton,
    isAvailable: isDevelopment,
  };
}

/**
 * Standalone auto-fill button component for use without the hook
 */
export function DevAutoFillButton({
  formType,
  onAutoFill,
  className,
  children = "Auto-Fill",
}: {
  formType: FormType;
  onAutoFill: (data: Record<string, unknown>) => void;
  className?: string;
  children?: ReactNode;
}) {
  if (!isDevelopment) {
    return null;
  }

  const handleClick = () => {
    const data = getAutoFillData(formType);
    onAutoFill(data);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DevAutoFill] Generated data for ${formType} form`);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      className={
        className ||
        "inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-info/10 text-info hover:bg-info/20 rounded-md transition-colors border border-info/30"
      }
      title="Development only: Fill form with test data"
      variant="ghost"
    >
      <Wand2 className="w-4 h-4" />
      {children}
    </Button>
  );
}
