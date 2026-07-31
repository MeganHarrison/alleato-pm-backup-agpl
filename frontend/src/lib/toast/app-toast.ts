"use client";

import type { ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

export type AlleatoToastType =
  | "default"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading"
  | "message"
  | "promise"
  | "custom";

export interface AlleatoToastLogEntry {
  id: string;
  toastId?: string | number;
  type: AlleatoToastType;
  message: string;
  description?: string;
  route: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  source?: string;
  riskLabels: string[];
}

type ToastMessage = ReactNode | (() => ReactNode);
type ToastMetadata = {
  id?: string | number;
  description?: unknown;
};
type ToastMethod = (message: ToastMessage, data?: ExternalToast) => string | number;
type ToastMethodName = "success" | "info" | "warning" | "error" | "loading" | "message";
type ToastPromiseMethod = <ToastData>(
  promise: Parameters<typeof sonnerToast.promise<ToastData>>[0],
  data?: Parameters<typeof sonnerToast.promise<ToastData>>[1],
) => ReturnType<typeof sonnerToast.promise<ToastData>>;
type ToastCustomMethod = typeof sonnerToast.custom;
type ToastListener = (entries: AlleatoToastLogEntry[]) => void;

const LOG_LIMIT = 250;
const LISTENER_LIMIT = 50;
const TOAST_LOG_EVENT = "alleato:toast-log-updated";
const INSTRUMENTED_MARKER = "__alleatoToastInstrumented";

type InstrumentableToast = typeof sonnerToast &
  Record<ToastMethodName, ToastMethod> & {
    promise: ToastPromiseMethod;
    custom: ToastCustomMethod;
    [INSTRUMENTED_MARKER]?: true;
  };

declare global {
  interface Window {
    __ALLEATO_TOAST_LOG__?: AlleatoToastLogEntry[];
    __ALLEATO_TOAST_LISTENERS__?: ToastListener[];
  }
}

function getRoute() {
  if (typeof window === "undefined") return "server";
  return `${window.location.pathname}${window.location.search}`;
}

function stringifyToastValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return "[function message]";
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((item) => stringifyToastValue(item)).filter(Boolean).join(" ");
  }
  return "[non-text message]";
}

function getRiskLabels(type: AlleatoToastType, message: string, description?: string): string[] {
  const text = `${message} ${description ?? ""}`.toLowerCase();
  const labels = new Set<string>();

  if (/\b(coming soon|not connected yet|not implemented|placeholder)\b/.test(text)) {
    labels.add("placeholder");
  }
  if (type === "error" && /\b(failed to|failed|unable to|could not)\b/.test(text) && !description) {
    labels.add("generic-error");
  }
  if (type === "error" && /\b(load|loading|fetch|fetching)\b/.test(text)) {
    labels.add("load-error");
  }
  if ((type === "success" || type === "message") && /^(saved|updated|created|deleted|copied)!?$/i.test(message.trim())) {
    labels.add("success-no-context");
  }

  return [...labels];
}

function emitToastLogUpdate(entries: AlleatoToastLogEntry[]) {
  window.dispatchEvent(new CustomEvent(TOAST_LOG_EVENT, { detail: entries }));
  for (const listener of window.__ALLEATO_TOAST_LISTENERS__ ?? []) {
    listener(entries);
  }
}

export function recordAppToast(
  type: AlleatoToastType,
  messageValue: ToastMessage,
  data?: ToastMetadata,
  source?: string,
): AlleatoToastLogEntry | null {
  if (typeof window === "undefined") return null;

  const message = stringifyToastValue(messageValue) || "[empty toast message]";
  const description = stringifyToastValue(data?.description) || undefined;
  const route = getRoute();
  const now = Date.now();
  const stableKey = [
    type,
    route,
    source ?? "",
    String(data?.id ?? ""),
    message,
    description ?? "",
  ].join("|");

  const log = window.__ALLEATO_TOAST_LOG__ ?? [];
  const existing = log.find((entry) => entry.id === stableKey);

  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = now;
    existing.toastId = data?.id ?? existing.toastId;
    emitToastLogUpdate([...log]);
    return existing;
  }

  const entry: AlleatoToastLogEntry = {
    id: stableKey,
    toastId: data?.id,
    type,
    message,
    description,
    route,
    count: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    source,
    riskLabels: getRiskLabels(type, message, description),
  };

  const nextLog = [entry, ...log].slice(0, LOG_LIMIT);
  window.__ALLEATO_TOAST_LOG__ = nextLog;
  emitToastLogUpdate(nextLog);
  return entry;
}

function wrapToastMethod(type: ToastMethodName, original: ToastMethod): ToastMethod {
  return (message, data) => {
    recordAppToast(type, message, data);
    return original(message, data);
  };
}

function getToastMetadata(data: unknown): ToastMetadata | undefined {
  if (!data || typeof data !== "object") return undefined;
  const candidate = data as Partial<Record<"id" | "description", unknown>>;
  return {
    id: typeof candidate.id === "string" || typeof candidate.id === "number" ? candidate.id : undefined,
    description: candidate.description,
  };
}

function getPromiseToastMessage(data: unknown): ToastMessage {
  if (!data || typeof data !== "object") return "Promise toast";

  const candidate = data as Partial<Record<"loading" | "success" | "error", unknown>>;
  const success = candidate.success;
  const error = candidate.error;
  const loading = candidate.loading;

  if (typeof loading === "string" || typeof loading === "number" || typeof loading === "boolean") {
    return String(loading);
  }
  if (typeof success === "string") return success;
  if (typeof error === "string") return error;
  return "Promise toast";
}

function wrapPromiseToast(original: ToastPromiseMethod): ToastPromiseMethod {
  return (<ToastData,>(
    promise: Parameters<typeof sonnerToast.promise<ToastData>>[0],
    data?: Parameters<typeof sonnerToast.promise<ToastData>>[1],
  ) => {
    recordAppToast("promise", getPromiseToastMessage(data), getToastMetadata(data));
    return original(promise, data);
  }) as ToastPromiseMethod;
}

function wrapCustomToast(original: ToastCustomMethod): ToastCustomMethod {
  return ((jsx, data) => {
    recordAppToast("custom", "Custom toast", data);
    return original(jsx, data);
  }) as ToastCustomMethod;
}

export function installAppToastInstrumentation() {
  if (typeof window === "undefined") return;

  const mutableToast = sonnerToast as InstrumentableToast;
  if (mutableToast[INSTRUMENTED_MARKER]) return;

  for (const method of ["success", "info", "warning", "error", "loading", "message"] satisfies ToastMethodName[]) {
    mutableToast[method] = wrapToastMethod(method, mutableToast[method]);
  }
  mutableToast.promise = wrapPromiseToast(mutableToast.promise);
  mutableToast.custom = wrapCustomToast(mutableToast.custom);

  mutableToast[INSTRUMENTED_MARKER] = true;
}

function isAppToastInstrumentationInstalled() {
  return typeof window !== "undefined" && Boolean((sonnerToast as InstrumentableToast)[INSTRUMENTED_MARKER]);
}

export function subscribeToAppToastLog(listener: ToastListener) {
  if (typeof window === "undefined") return () => undefined;

  const listeners = window.__ALLEATO_TOAST_LISTENERS__ ?? [];
  window.__ALLEATO_TOAST_LISTENERS__ = [listener, ...listeners].slice(0, LISTENER_LIMIT);

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<AlleatoToastLogEntry[]>;
    listener(customEvent.detail ?? window.__ALLEATO_TOAST_LOG__ ?? []);
  };

  window.addEventListener(TOAST_LOG_EVENT, handleEvent);
  listener(window.__ALLEATO_TOAST_LOG__ ?? []);

  return () => {
    window.removeEventListener(TOAST_LOG_EVENT, handleEvent);
    window.__ALLEATO_TOAST_LISTENERS__ = (window.__ALLEATO_TOAST_LISTENERS__ ?? []).filter(
      (candidate) => candidate !== listener,
    );
  };
}

export function clearAppToastLog() {
  if (typeof window === "undefined") return;
  window.__ALLEATO_TOAST_LOG__ = [];
  emitToastLogUpdate([]);
}

function emitAndShow(type: ToastMethodName, message: ToastMessage, data?: ExternalToast, source?: string) {
  if (!isAppToastInstrumentationInstalled() || source) {
    recordAppToast(type, message, data, source);
  }
  return sonnerToast[type](message, data);
}

const appToastPromise: ToastPromiseMethod = ((promise, data) => {
  if (!isAppToastInstrumentationInstalled()) {
    recordAppToast("promise", getPromiseToastMessage(data), getToastMetadata(data));
  }
  return sonnerToast.promise(promise, data);
}) as ToastPromiseMethod;

const appToastCustom: ToastCustomMethod = ((jsx, data) => {
  if (!isAppToastInstrumentationInstalled()) {
    recordAppToast("custom", "Custom toast", data);
  }
  return sonnerToast.custom(jsx, data);
}) as ToastCustomMethod;

export const appToast = Object.assign(
  (message: ToastMessage, data?: ExternalToast) => {
    recordAppToast("default", message, data);
    return sonnerToast(message, data);
  },
  {
    success: (message: ToastMessage, data?: ExternalToast, source?: string) =>
      emitAndShow("success", message, data, source),
    info: (message: ToastMessage, data?: ExternalToast, source?: string) =>
      emitAndShow("info", message, data, source),
    warning: (message: ToastMessage, data?: ExternalToast, source?: string) =>
      emitAndShow("warning", message, data, source),
    error: (message: ToastMessage, data?: ExternalToast, source?: string) =>
      emitAndShow("error", message, data, source),
    loading: (message: ToastMessage, data?: ExternalToast, source?: string) =>
      emitAndShow("loading", message, data, source),
    message: (message: ToastMessage, data?: ExternalToast, source?: string) =>
      emitAndShow("message", message, data, source),
    promise: appToastPromise,
    custom: appToastCustom,
    dismiss: sonnerToast.dismiss,
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  },
);
