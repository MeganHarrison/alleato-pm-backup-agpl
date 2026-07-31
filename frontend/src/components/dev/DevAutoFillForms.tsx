"use client";

import { useEffect } from "react";

const DEV_ONLY = process.env.NODE_ENV !== "production";
const FORM_ENHANCED_ATTR = "data-dev-autofill-enhanced";
const BUTTON_ATTR = "data-dev-autofill-button";
const DISABLED_ATTR = "data-dev-autofill-disabled";
const AUTOFILL_EVENT = "dev-autofill-form";
const DISABLED_PATHS = new Set<string>(["/template/form-standard"]);
const EXCLUDED_FORM_SELECTOR = ".global-ai-widget-panel";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .trim()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function textValueForField(fieldName: string): string {
  const normalized = fieldName.toLowerCase();

  if (normalized.includes("email")) return `dev-${Date.now()}@example.com`;
  if (normalized.includes("phone") || normalized.includes("tel"))
    return "555-010-1234";
  if (normalized.includes("zip") || normalized.includes("postal"))
    return "90210";
  if (normalized.includes("state")) return "CA";
  if (normalized.includes("city")) return "San Francisco";
  if (normalized.includes("country")) return "United States";
  if (normalized.includes("address")) return "123 Market Street";
  if (normalized.includes("company")) return "Atlas Construction LLC";
  if (normalized.includes("project")) return "Downtown Office Renovation";
  if (normalized.includes("title")) return "Test Submission";
  if (normalized.includes("description"))
    return "Development autofill test description.";
  if (normalized.includes("note")) return "Development autofill note.";
  if (normalized.includes("first") && normalized.includes("name"))
    return "Alex";
  if (normalized.includes("last") && normalized.includes("name"))
    return "Rivera";
  if (normalized.includes("name")) return "Test Name";
  if (normalized.includes("number") || normalized.includes("code"))
    return String(randomInt(1000, 9999));

  return toTitleCase(fieldName) || "Test Value";
}

function isSkippableInput(input: HTMLInputElement): boolean {
  const blockedTypes = new Set(["button", "submit", "reset", "image", "file"]);

  return blockedTypes.has(input.type) || input.disabled || input.readOnly;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(input, value);
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );
  descriptor?.set?.call(textarea, value);
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  );
  descriptor?.set?.call(select, value);
}

function setCheckboxValue(input: HTMLInputElement, checked: boolean): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked",
  );
  descriptor?.set?.call(input, checked);
}

function dispatchFieldEvents(element: Element): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function chooseSelectValue(select: HTMLSelectElement): string | null {
  const options = Array.from(select.options);
  const preferred = options.find(
    (option) => !option.disabled && option.value !== "",
  );
  if (preferred) return preferred.value;
  const fallback = options.find((option) => !option.disabled);
  return fallback?.value ?? null;
}

function fillInput(input: HTMLInputElement): boolean {
  if (isSkippableInput(input)) {
    return false;
  }

  if (input.type === "radio") {
    if (!input.name) return false;
    const form = input.form;
    if (!form) return false;
    const sameGroup = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(input.name)}"]`,
      ),
    );
    const candidate = sameGroup.find((item) => !item.disabled) ?? null;
    if (!candidate) return false;
    setCheckboxValue(candidate, true);
    dispatchFieldEvents(candidate);
    return true;
  }

  if (input.type === "checkbox") {
    if (input.checked) return false;
    setCheckboxValue(input, true);
    dispatchFieldEvents(input);
    return true;
  }

  if (input.value.trim() !== "") {
    return false;
  }

  switch (input.type) {
    case "email":
      setInputValue(input, `dev-${Date.now()}@example.com`);
      break;
    case "tel":
      setInputValue(input, "555-010-1234");
      break;
    case "url":
      setInputValue(input, "https://example.com");
      break;
    case "number":
    case "range": {
      const min = Number(input.min || 1);
      const max = Number(input.max || min + 1000);
      const safeMin = Number.isFinite(min) ? min : 1;
      const safeMax = Number.isFinite(max) ? max : safeMin + 1000;
      const value = String(
        randomInt(Math.floor(safeMin), Math.floor(Math.max(safeMin, safeMax))),
      );
      setInputValue(input, value);
      break;
    }
    case "date":
      setInputValue(input, new Date().toISOString().split("T")[0]);
      break;
    case "datetime-local": {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setInputValue(input, iso);
      break;
    }
    case "time":
      setInputValue(input, "09:00");
      break;
    default: {
      const fieldHint = input.name || input.id || input.placeholder || "value";
      setInputValue(input, textValueForField(fieldHint));
      break;
    }
  }

  dispatchFieldEvents(input);
  return true;
}

function fillTextarea(textarea: HTMLTextAreaElement): boolean {
  if (textarea.disabled || textarea.readOnly || textarea.value.trim() !== "") {
    return false;
  }

  const fieldHint =
    textarea.name || textarea.id || textarea.placeholder || "notes";
  setTextareaValue(textarea, textValueForField(fieldHint));
  dispatchFieldEvents(textarea);
  return true;
}

function fillSelect(select: HTMLSelectElement): boolean {
  if (select.disabled) {
    return false;
  }

  if (select.multiple) {
    const firstEnabled = Array.from(select.options).find(
      (option) => !option.disabled,
    );
    if (!firstEnabled) return false;
    firstEnabled.selected = true;
    dispatchFieldEvents(select);
    return true;
  }

  const currentValue = select.value;
  const nextValue = chooseSelectValue(select);
  if (!nextValue || currentValue === nextValue) {
    return false;
  }

  setSelectValue(select, nextValue);
  dispatchFieldEvents(select);
  return true;
}

function fillForm(form: HTMLFormElement): number {
  let filledCount = 0;
  const visitedRadioGroups = new Set<string>();

  const elements = Array.from(form.elements) as Element[];
  for (const element of elements) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "radio") {
        const key = element.name || element.id;
        if (!key || visitedRadioGroups.has(key)) {
          continue;
        }
        visitedRadioGroups.add(key);
      }

      if (fillInput(element)) {
        filledCount += 1;
      }
      continue;
    }

    if (element instanceof HTMLTextAreaElement) {
      if (fillTextarea(element)) {
        filledCount += 1;
      }
      continue;
    }

    if (element instanceof HTMLSelectElement) {
      if (fillSelect(element)) {
        filledCount += 1;
      }
    }
  }

  return filledCount;
}

function createButton(form: HTMLFormElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Autofill";
  button.setAttribute(BUTTON_ATTR, "true");
  button.title = "Development only: Fill this form with test data";
  button.className =
    "inline-flex h-8 items-center rounded-md border border-border bg-muted px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground";
  button.addEventListener("click", () => {
    const count = fillForm(form);
    if (DEV_ONLY) {
      console.warn(`[DevAutofill] Filled ${count} fields`);
    }
  });

  return button;
}

function enhanceForm(form: HTMLFormElement): void {
  if (form.hasAttribute(FORM_ENHANCED_ATTR)) {
    return;
  }
  if (form.hasAttribute(DISABLED_ATTR)) {
    return;
  }
  if (form.closest(EXCLUDED_FORM_SELECTOR)) {
    return;
  }

  form.setAttribute(FORM_ENHANCED_ATTR, "true");

  const button = createButton(form);

  // Find the footer button row (Cancel/Save area) using data-slot attributes
  const footerRow =
    form.querySelector(
      '[data-slot="dialog-footer"], [data-slot="sheet-footer"], [data-slot="drawer-footer"], [data-slot="card-footer"]',
    ) ?? form.querySelector("footer");

  if (footerRow) {
    footerRow.insertBefore(button, footerRow.firstChild);
  } else {
    // Fallback: append to end of form
    form.appendChild(button);
  }
}

export function DevAutoFillForms() {
  useEffect(() => {
    if (!DEV_ONLY) {
      return;
    }

    // Delay DOM mutation until after hydration so dev tooling does not create false mismatch errors.
    const enhanceAllForms = () => {
      if (DISABLED_PATHS.has(window.location.pathname)) {
        return;
      }
      const forms = Array.from(document.querySelectorAll("form"));
      for (const form of forms) {
        enhanceForm(form);
      }
    };

    const handleAutoFillRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ selector?: string }>;
      const selector = customEvent.detail?.selector;

      if (selector) {
        const form = document.querySelector<HTMLFormElement>(selector);
        if (form) {
          const count = fillForm(form);
          console.warn(`[DevAutofill] Filled ${count} fields`);
        }
      }
    };

    let observer: MutationObserver | null = null;
    const rafId = window.requestAnimationFrame(() => {
      enhanceAllForms();

      observer = new MutationObserver(() => {
        enhanceAllForms();
      });

      observer.observe(document.body, {
        subtree: true,
        childList: true,
      });
    });

    window.addEventListener(AUTOFILL_EVENT, handleAutoFillRequest);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener(AUTOFILL_EVENT, handleAutoFillRequest);
    };
  }, []);

  return null;
}
