import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface NumberInputProps extends Omit<React.ComponentProps<"input">, "type" | "onFocus" | "onChange"> {
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoSelectOnFocus?: boolean;
  clearZeroOnFocus?: boolean;
  /** Format with thousand separators on blur. Default true. */
  formatOnBlur?: boolean;
  /** Number of decimal places to show on blur. Default 2. Set to 0 for integers. */
  decimals?: number;
}

function isZeroLike(raw: string): boolean {
  return raw === "0" || raw === "0.0" || raw === "0.00";
}

/**
 * Enhanced number input for non-currency numeric data entry (quantities, sq ft, etc.)
 *
 * For currency/money inputs, use MoneyField instead.
 *
 * Features:
 * - Typing: raw numeric string, no formatting mid-keystroke
 * - Blur: thousand separators via Intl.NumberFormat (e.g. 150,000.00)
 * - Focus: raw number for clean editing, auto-select all
 * - Right-aligned, tabular-nums
 * - onChange still fires with e.target.value as a raw numeric string (same contract)
 */
function NumberInput({
  className,
  onFocus,
  onChange,
  autoSelectOnFocus = true,
  clearZeroOnFocus = true,
  formatOnBlur = true,
  decimals = 2,
  onBlur,
  value,
  placeholder = "e.g. 1250",
  step = "0.01",
  ref,
  ...props
}: NumberInputProps & { ref?: React.Ref<HTMLInputElement> }) {
  const [displayValue, setDisplayValue] = React.useState<string>("")
  const isFocusedRef = React.useRef(false)
  const internalRef = React.useRef<HTMLInputElement>(null)
  const replaceOnNextInputRef = React.useRef(false)
  const focusedRawValueRef = React.useRef("")

  // Merge external ref with internal ref
  const setRefs = React.useCallback((node: HTMLInputElement | null) => {
    internalRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
  }, [ref])

  // Strip to valid numeric characters
  const sanitize = (raw: string): string => {
    let cleaned = raw.replace(/[^\d.\-]/g, "")
    // Only one decimal point
    const dotIndex = cleaned.indexOf(".")
    if (dotIndex !== -1) {
      cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, "")
    }
    // Only leading minus
    if (cleaned.includes("-")) {
      const negative = cleaned.startsWith("-")
      cleaned = cleaned.replace(/-/g, "")
      if (negative) cleaned = "-" + cleaned
    }
    return cleaned
  }

  // Format for display with thousand separators
  const formatForDisplay = (raw: string): string => {
    if (!raw || raw === "-") return raw
    const num = parseFloat(raw)
    if (isNaN(num)) return raw
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  // Sync display from prop value (only when not focused)
  React.useEffect(() => {
    if (isFocusedRef.current) return
    const strVal = value === undefined || value === null ? "" : String(value)
    if (clearZeroOnFocus && isZeroLike(strVal)) {
      setDisplayValue("")
      return
    }
    if (formatOnBlur && strVal) {
      setDisplayValue(formatForDisplay(strVal))
    } else {
      setDisplayValue(strVal)
    }
  }, [value, formatOnBlur, decimals])

  // Fire onChange with a synthetic-like event carrying the raw numeric string
  const fireChange = (rawValue: string) => {
    if (!onChange || !internalRef.current) return
    const syntheticEvent = {
      target: { ...internalRef.current, value: rawValue },
      currentTarget: { ...internalRef.current, value: rawValue },
    } as React.ChangeEvent<HTMLInputElement>
    onChange(syntheticEvent)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = sanitize(e.target.value)
    const focusedRaw = focusedRawValueRef.current
    let cleaned = incoming

    if (replaceOnNextInputRef.current) {
      replaceOnNextInputRef.current = false

      if (focusedRaw && incoming.startsWith(focusedRaw) && incoming.length > focusedRaw.length) {
        cleaned = incoming.slice(focusedRaw.length)
      } else if (focusedRaw && incoming.endsWith(focusedRaw) && incoming.length > focusedRaw.length) {
        cleaned = incoming.slice(0, -focusedRaw.length)
      } else if (focusedRaw === "0" && incoming.startsWith("0") && incoming.length > 1) {
        cleaned = incoming.replace(/^0+(?=\d)/, "")
      }
    }

    setDisplayValue(cleaned)
    fireChange(cleaned)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true
    // Switch to raw number for clean editing
    const raw = sanitize(String(value ?? ""))
    const startsAsPlaceholderZero = clearZeroOnFocus && isZeroLike(raw)
    focusedRawValueRef.current = raw
    replaceOnNextInputRef.current = raw.length > 0
    setDisplayValue(startsAsPlaceholderZero ? "" : raw)

    if (autoSelectOnFocus) {
      e.target.setSelectionRange(0, e.target.value.length)
      requestAnimationFrame(() => e.target.select())
    }

    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false
    replaceOnNextInputRef.current = false
    focusedRawValueRef.current = ""
    if (formatOnBlur) {
      const raw = sanitize(e.target.value)
      if (clearZeroOnFocus && isZeroLike(raw)) {
        setDisplayValue("")
        onBlur?.(e)
        return
      }
      setDisplayValue(raw ? formatForDisplay(raw) : "")
    }
    onBlur?.(e)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text")
    const cleaned = sanitize(pasted.replace(/[,\s]/g, ""))
    setDisplayValue(cleaned)
    fireChange(cleaned)
  }

  return (
    <Input
      ref={setRefs}
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onPaste={handlePaste}
      className={cn(
        "min-w-20 tabular-nums text-right !bg-transparent",
        "focus:border-input focus:ring-0",
        "transition-all duration-200",
        className
      )}
      {...props}
    />
  )
}

export { NumberInput, type NumberInputProps }
