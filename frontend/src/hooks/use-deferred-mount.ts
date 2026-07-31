"use client";

import { useEffect, useState } from "react";

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useDeferredMount(delayMs = 1_500) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const browserWindow = window as WindowWithIdleCallback;
    let idleHandle: number | undefined;

    const delayHandle = window.setTimeout(() => {
      if (browserWindow.requestIdleCallback) {
        idleHandle = browserWindow.requestIdleCallback(() => setMounted(true), {
          timeout: 1_000,
        });
        return;
      }

      setMounted(true);
    }, delayMs);

    return () => {
      window.clearTimeout(delayHandle);
      if (idleHandle !== undefined) {
        browserWindow.cancelIdleCallback?.(idleHandle);
      }
    };
  }, [delayMs]);

  return mounted;
}
