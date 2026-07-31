"use client";

import * as React from "react";
import { FormField } from "./FormField";
import type { FormFieldBaseProps } from "./FormField";
import { cn } from "@/lib/utils";
import { Bold, Italic, Underline, List, ListOrdered, RemoveFormatting } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface RichTextFieldProps extends FormFieldBaseProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Sanitize HTML: strip inline styles, classes, and non-semantic attributes
 * while preserving basic formatting tags (b, i, u, ul, ol, li, p, br).
 */
function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Create a temporary element to parse
  if (typeof document === "undefined") return html;
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Allowed tags (lowercase)
  const allowedTags = new Set([
    "b", "strong", "i", "em", "u", "ul", "ol", "li", "p", "br", "div",
  ]);

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode();
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    // If it's not an allowed tag, just return its children's content
    if (!allowedTags.has(tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(el.childNodes)) {
        const cleaned = cleanNode(child);
        if (cleaned) fragment.appendChild(cleaned);
      }
      return fragment;
    }

    // Create a clean version of the element (no attributes)
    const cleanEl = document.createElement(tagName);
    for (const child of Array.from(el.childNodes)) {
      const cleaned = cleanNode(child);
      if (cleaned) cleanEl.appendChild(cleaned);
    }
    return cleanEl;
  }

  const result = document.createElement("div");
  for (const child of Array.from(temp.childNodes)) {
    const cleaned = cleanNode(child);
    if (cleaned) result.appendChild(cleaned);
  }

  return result.innerHTML;
}

export function RichTextField({
  label,
  value = "",
  onChange,
  error,
  hint,
  required = false,
  fullWidth = false,
  className,
  disabled = false,
  placeholder,
}: RichTextFieldProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const isUserEditing = React.useRef(false);
  const lastValueFromParent = React.useRef(value);

  const execCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    // Sync after toolbar action
    if (editorRef.current) {
      onChange?.(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      isUserEditing.current = true;
      const html = editorRef.current.innerHTML;
      lastValueFromParent.current = html;
      onChange?.(html);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleClearFormatting = () => {
    if (editorRef.current) {
      // Get plain text, re-insert it
      const plainText = editorRef.current.innerText;
      editorRef.current.innerHTML = "";
      editorRef.current.textContent = plainText;
      const html = editorRef.current.innerHTML;
      lastValueFromParent.current = html;
      onChange?.(html);
    }
  };

  // Only set innerHTML from parent when the value actually changed externally
  // (not from our own handleInput call)
  React.useEffect(() => {
    if (editorRef.current && value !== lastValueFromParent.current) {
      // Value changed from outside (initial load, form reset, etc.)
      const sanitized = sanitizeHtml(value);
      editorRef.current.innerHTML = sanitized;
      lastValueFromParent.current = value;

      // If sanitized version differs, notify parent of cleaned HTML
      if (sanitized !== value) {
        onChange?.(sanitized);
        lastValueFromParent.current = sanitized;
      }
    }
  }, [value, onChange]);

  // Initial mount: sanitize and set
  React.useEffect(() => {
    if (editorRef.current) {
      const sanitized = sanitizeHtml(value);
      editorRef.current.innerHTML = sanitized;
      lastValueFromParent.current = sanitized;
      if (sanitized !== value) {
        onChange?.(sanitized);
      }
    }
    // Only on mount
     
  }, []);

  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      required={required}
      fullWidth={fullWidth}
    >
      <div
        className={cn(
          "rounded-md border",
          error && "border-destructive",
          disabled && "opacity-50",
          className,
        )}
      >
        <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => execCommand("bold")}
            disabled={disabled}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <Bold />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => execCommand("italic")}
            disabled={disabled}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <Italic />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => execCommand("underline")}
            disabled={disabled}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <Underline />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => execCommand("insertUnorderedList")}
            disabled={disabled}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <List />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => execCommand("insertOrderedList")}
            disabled={disabled}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <ListOrdered />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={handleClearFormatting}
            disabled={disabled}
            className="h-7 w-7 p-0 text-muted-foreground"
            title="Clear formatting"
          >
            <RemoveFormatting />
          </Button>
        </div>
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onPaste={handlePaste}
          className="min-h-30 max-h-80 overflow-y-auto px-3 py-2.5 focus:outline-none [&_p]:my-0"
          data-placeholder={placeholder}
          suppressContentEditableWarning={true}
        />
      </div>
    </FormField>
  );
}
