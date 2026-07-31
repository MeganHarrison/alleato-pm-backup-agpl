"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import styles from "@/app/(main)/training/hub-theme.module.css";

import { RoleWheel } from "./RoleWheel";
import {
  chapterPairsFor,
  countAtLevel,
  cumulativeValuesAt,
  getRoleById,
  ROLE_WHEEL_EXAMPLES,
  SKILL_WHEEL_STORY,
  wedgeFillD,
} from "./role-wheel-data";

gsap.registerPlugin(ScrollTrigger);

const story = SKILL_WHEEL_STORY;

/**
 * The app shell scrolls an inner container, not the window, so ScrollTrigger
 * must watch that element — otherwise it never fires. Walk up to the nearest
 * ancestor that actually scrolls.
 */
function findScroller(node: HTMLElement): HTMLElement | undefined {
  let el = node.parentElement;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if (
      /(auto|scroll)/.test(overflowY) &&
      el.scrollHeight > el.clientHeight + 2
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return undefined;
}

export function RoleWheelStory() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [roleId, setRoleId] = useState(story.defaultRoleId);
  // Scroll offset to restore after a role change rebuilds the timeline. The
  // rebuild tears down the pin, which removes the pin-spacer's ~2400px from
  // the scroller — without this the page lurches past the whole section.
  const scrollToRestore = useRef<number | null>(null);

  const role = getRoleById(roleId);
  const total = role.skills.length;
  const chapterPairs = chapterPairsFor(role, story);

  useGSAP(
    () => {
      const root = rootRef.current;
      const pin = pinRef.current;
      if (!root || !pin) return;

      const scroller = findScroller(root);

      const select = gsap.utils.selector(root);
      const wedges = select("[data-wedge]") as unknown as SVGPathElement[];
      const groups = select("[data-skill-index]") as unknown as SVGGElement[];
      const chapterEls = select("[data-chapter]") as unknown as HTMLDivElement[];
      const countEl = select("[data-wheel-count]")[0] as
        | SVGTextElement
        | undefined;

      // Live wheel state the timelines mutate; redraw pushes it to the DOM.
      const values = [...role.before];
      const redraw = () => {
        wedges.forEach((path, index) => {
          path.setAttribute("d", wedgeFillD(index, total, values[index]));
        });
        if (countEl) countEl.textContent = String(countAtLevel(values));
      };
      const resetToStart = () => {
        role.before.forEach((value, index) => {
          values[index] = value;
        });
        redraw();
      };

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 1000px)",
          isMobile: "(max-width: 999px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduce } = context.conditions as {
            isDesktop: boolean;
            isMobile: boolean;
            reduce: boolean;
          };

          // Reduced motion: no pin, no scrub. Show every chapter and settle the
          // wheel on the "possible progression" end state as a static picture.
          if (reduce) {
            gsap.set(chapterEls, { opacity: 1, y: 0 });
            gsap.set(groups, { opacity: 1 });
            role.after.forEach((value, index) => {
              values[index] = value;
            });
            redraw();
            return;
          }

          if (isDesktop) {
            resetToStart();
            gsap.set(chapterEls, { opacity: 0, y: 26 });
            gsap.set(chapterEls[0], { opacity: 1, y: 0 });
            gsap.set(groups, { opacity: 1 });

            const tl = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: pin,
                scroller,
                start: "top top",
                end: "+=2400",
                scrub: 0.7,
                pin,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });

            story.chapters.forEach((_chapter, index) => {
              if (index === 0) {
                tl.to({}, { duration: 0.6 });
                return;
              }
              const prev = chapterEls[index - 1];
              const curr = chapterEls[index];
              const pair = chapterPairs[index] ?? [];
              tl.to(prev, { opacity: 0, y: -26, duration: 0.28 });
              tl.to(curr, { opacity: 1, y: 0, duration: 0.36 }, "<0.08");

              // Focus: the active pair stays full strength, the rest recede.
              const isFinal = index === story.chapters.length - 1;
              groups.forEach((group, groupIndex) => {
                const active = pair.includes(groupIndex);
                tl.to(
                  group,
                  {
                    // Receded wedges need to drop further on the dark ground
                    // than they did on the old light section, or the active
                    // pair does not read as the point of the chapter.
                    opacity: isFinal ? 1 : active ? 1 : 0.28,
                    duration: 0.3,
                  },
                  "<",
                );
              });

              pair.forEach((skillIndex) => {
                tl.to(
                  values,
                  {
                    [skillIndex]: role.after[skillIndex],
                    duration: 0.7,
                    onUpdate: redraw,
                  },
                  "<",
                );
              });

              tl.to({}, { duration: 0.35 });
            });

            return;
          }

          // Mobile: sticky wheel, chapters stacked. Each chapter snaps the wheel
          // to its cumulative state as it scrolls into view (no fragile scrub).
          resetToStart();
          gsap.set(chapterEls, { opacity: 1, y: 0 });
          gsap.set(groups, { opacity: 1 });

          const goTo = (chapterIndex: number) => {
            const target = cumulativeValuesAt(role, story, chapterIndex);
            const vars: gsap.TweenVars = {
              duration: 0.5,
              ease: "power2.out",
              onUpdate: redraw,
            };
            target.forEach((value, index) => {
              vars[index] = value;
            });
            gsap.to(values, vars);
          };

          story.chapters.forEach((_chapter, index) => {
            ScrollTrigger.create({
              trigger: chapterEls[index],
              scroller,
              start: "top 70%",
              onEnter: () => goTo(index),
              onEnterBack: () => goTo(index),
            });
          });
        },
      );

      // Put the viewer back where they were reading. refresh() first so the
      // rebuilt pin-spacer has restored the scroller's height, then restore —
      // the new timeline picks its progress up from that same offset, so the
      // role swaps in place instead of throwing you down the page.
      if (scrollToRestore.current !== null) {
        const target = scrollToRestore.current;
        scrollToRestore.current = null;
        ScrollTrigger.refresh();
        if (scroller) scroller.scrollTop = target;
        else window.scrollTo(0, target);
        // Force the scrub to re-evaluate now. Without this the fresh timeline
        // sits at progress 0 until the next scroll event, leaving the opening
        // chapter ghosted behind the one the viewer is actually on.
        ScrollTrigger.update();
      }
    },
    // Switching role rebuilds the timeline against the new skills and derived
    // pairs. revertOnUpdate tears the old one down first so the pin-spacer and
    // inline styles from the previous role do not leak into the new build.
    { scope: rootRef, dependencies: [roleId], revertOnUpdate: true },
  );

  return (
    <div className={styles.story} ref={rootRef}>
      <div className={styles.storyInner} ref={pinRef}>
        <div className={styles.storyNarrative}>
          {story.chapters.map((chapter, index) => {
            const pair = chapterPairs[index] ?? [];
            return (
              <div
                key={chapter.key}
                className={styles.storyChapter}
                data-chapter={index}
              >
                <span className={styles.eyebrow}>{chapter.eyebrow}</span>
                <h3 className={styles.storyChapterTitle}>{chapter.title}</h3>
                <p className={styles.storyChapterBody}>{chapter.body}</p>
                {pair.length > 0 ? (
                  <ul className={styles.storyPair}>
                    {pair.map((skillIndex) => (
                      <li key={skillIndex}>
                        <b>{role.skills[skillIndex].name}</b>
                        <span>{role.skills[skillIndex].hint}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <figure className={styles.storyWheel}>
          <RoleWheel
            role={role}
            values={role.before}
            idPrefix={`story-${role.id}`}
            className={styles.storyWheelSvg}
          />
          <figcaption className={styles.storyProgressLabel}>
            {`Illustrative ${role.name} progression — not live data`}
          </figcaption>
        </figure>

        <div className={styles.storyRoles}>
          <span className={styles.storyRolesLabel}>Your role</span>
          <div
            className={styles.storyRoleTabs}
            role="group"
            aria-label="Choose a role"
          >
            {ROLE_WHEEL_EXAMPLES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.storyRoleTab}
                aria-pressed={option.id === roleId}
                onClick={() => {
                  const root = rootRef.current;
                  const scroller = root ? findScroller(root) : undefined;
                  scrollToRestore.current = scroller
                    ? scroller.scrollTop
                    : window.scrollY;
                  setRoleId(option.id);
                }}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
