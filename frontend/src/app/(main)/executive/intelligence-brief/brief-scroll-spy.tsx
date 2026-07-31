"use client";

import { useEffect } from "react";

/**
 * Highlights the active section link in the index rail as the reader scrolls.
 * Pure progressive enhancement — the rail works as anchor links without it.
 */
export function BriefScrollSpy() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".exec-brief");
    if (!root) return;

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".rail a[data-target]"));
    const map = new Map<string, HTMLAnchorElement>();
    links.forEach((link) => {
      const target = link.getAttribute("data-target");
      if (target) map.set(target, link);
    });

    const sections = links
      .map((link) => document.getElementById(link.getAttribute("data-target") ?? ""))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!("IntersectionObserver" in window) || sections.length === 0) return;

    let current: HTMLAnchorElement | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const link = map.get(entry.target.id);
          if (!link) return;
          if (current) current.classList.remove("active");
          link.classList.add("active");
          current = link;
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return null;
}
