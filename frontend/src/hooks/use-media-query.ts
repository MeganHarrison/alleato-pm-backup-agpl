"use client";

import { useEffect, useState } from "react";

/**
 * Shared reactive media-query hook for structural responsive behavior that
 * cannot be expressed by CSS alone, such as switching a docked inspector to a
 * focus-trapped Sheet.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
