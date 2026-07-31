"use client";

import { useEffect, useRef } from "react";

interface UnsavedChangesGuardOptions {
  active: boolean;
  confirmLeave: () => Promise<boolean>;
}

/**
 * Protects a client-side draft across full reloads and ordinary anchor-based
 * App Router navigation. Confirmed link navigation uses a full location change
 * so the browser cannot race a pending client-side transition.
 */
export function useUnsavedChangesGuard({
  active,
  confirmLeave,
}: UnsavedChangesGuardOptions) {
  const allowNextNavigation = useRef(false);

  useEffect(() => {
    if (!active) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (allowNextNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const confirmLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) {
        return;
      }

      const destination = new URL(target.href, window.location.href);
      if (
        destination.href === window.location.href ||
        (destination.origin === window.location.origin &&
          destination.pathname === window.location.pathname &&
          destination.search === window.location.search &&
          destination.hash)
      ) {
        return;
      }

      event.preventDefault();
      void confirmLeave().then((confirmed) => {
        if (!confirmed) return;
        allowNextNavigation.current = true;
        window.location.assign(destination.href);
      });
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [active, confirmLeave]);
}
