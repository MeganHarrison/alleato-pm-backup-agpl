"use client";

import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";

import { RoleWheelStory, SkillLadder } from "@/features/training";
import type { HubModuleTileProps } from "@/features/training";
import type { MethodPrinciple } from "@/features/training/method-content";

import styles from "./hub-theme.module.css";

const HERO_WHEEL_VALUES = [92, 74, 58, 80, 42, 66, 88, 50, 71, 95, 60, 78, 45];

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function annularPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
): string {
  const [x0o, y0o] = polar(cx, cy, rOut, a0);
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const [x0i, y0i] = polar(cx, cy, rIn, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

function useRevealOnScroll(containerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const els = container.querySelectorAll(`[data-reveal="true"]`);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealIn);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [containerRef]);
}

function HeroWheel() {
  // Wedge paths are computed from Math.cos/Math.sin, which can differ by a
  // ULP between Node's SSR pass and the browser's JS engine — that showed up
  // as a hydration mismatch on the `d` attributes. This is purely decorative,
  // so it renders nothing until mounted on the client rather than disabling
  // SSR for the whole (now Supabase-backed) hub page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const size = 400;
  const cx = 200;
  const cy = 200;
  const rIn = 64;
  const rOut = 182;
  const vals = HERO_WHEEL_VALUES;
  const n = vals.length;
  const gap = 0.028;
  const step = (Math.PI * 2) / n;

  const wedges = useMemo(
    () =>
      vals.map((v, i) => {
        const a0 = -Math.PI / 2 + i * step + gap;
        const a1 = -Math.PI / 2 + (i + 1) * step - gap;
        const rf = rIn + (rOut - rIn) * (v / 100);
        return {
          track: annularPath(cx, cy, rIn, rOut, a0, a1),
          fill: annularPath(cx, cy, rIn, rf, a0, a1),
          delay: i * 70,
        };
      }),
    [vals, step, gap],
  );

  if (!mounted) {
    return (
      <svg
        className={styles.heroWheelSvg}
        viewBox="0 0 400 400"
        aria-hidden="true"
      />
    );
  }

  return (
    <svg
      className={styles.heroWheelSvg}
      viewBox="0 0 400 400"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hubHeroWheelGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--orange)" />
          <stop offset="1" stopColor="var(--orange)" />
        </linearGradient>
      </defs>
      {[0.33, 0.66, 1].map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={rIn + (rOut - rIn) * f}
          fill="none"
          stroke="rgba(255,255,255,.09)"
        />
      ))}
      {wedges.map((w, i) => (
        <path key={`track-${i}`} d={w.track} fill="rgba(255,255,255,.04)" />
      ))}
      {wedges.map((w, i) => (
        <path
          key={`fill-${i}`}
          className={styles.hw}
          style={{ animationDelay: `${w.delay}ms` }}
          d={w.fill}
          fill="url(#hubHeroWheelGrad)"
          opacity="0.92"
        />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={rIn - 4}
        fill="#0c0b0a"
        stroke="var(--orange)"
        strokeWidth="1.5"
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontFamily="'Work Sans'"
        fontWeight="800"
        fontSize="44"
        fill="#fff"
      >
        72
      </text>
      <text
        x={cx}
        y={cy + 26}
        textAnchor="middle"
        fontFamily="'JetBrains Mono'"
        fontSize="11"
        letterSpacing="2"
        fill="var(--orange)"
      >
        READINESS
      </text>
    </svg>
  );
}

export interface TrainingHubClientProps {
  moduleTiles: HubModuleTileProps[];
  methodIntro: string;
  methodPrinciples: MethodPrinciple[];
}

export function TrainingHubClient({
  moduleTiles,
  methodIntro,
  methodPrinciples,
}: TrainingHubClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);
  const methodInView = useInView(methodRef, { amount: 0.3, once: true });
  const reduceMotion = useReducedMotion();

  useRevealOnScroll(containerRef);

  return (
    <div className={styles.page} ref={containerRef}>
      {/* HERO */}
      <section className={styles.hero} id="top">
        <div className={styles.heroGridBg} />
        <div className={styles.heroGlow} />
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <div>
            <h1 className={styles.heroH1}>
              <span className={styles.heroOwn}>Own Your</span>
              <span className={styles.heroGrow}>Growth</span>
            </h1>
            <p className={styles.heroLead}>
              Build capability one focused rep at a time. Learn it, practice it,
              prove it.
            </p>
            <div className={styles.heroCtas}>
              <Link
                href="/training/growth"
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Take the Assessment →
              </Link>
              <Link
                href="/training/library"
                className={`${styles.btn} ${styles.btnGhost}`}
              >
                Browse the Library
              </Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <HeroWheel />
          </div>
        </div>
      </section>

      {/* METHOD */}
      <section className={`${styles.section} ${styles.method}`} id="method">
        <div className={styles.wrap}>
          <div
            className={`${styles.secHead} ${styles.reveal}`}
            data-reveal="true"
          >
            <span className={styles.eyebrow}>How it works</span>
            <h2 className={styles.hSec}>The method, at a glance</h2>
            <p className={`${styles.sub} ${styles.methodSub}`}>{methodIntro}</p>
          </div>
          <div className={styles.loop} ref={methodRef}>
            {methodPrinciples.map((principle, i) => (
              <motion.article
                key={principle.name}
                className={styles.loopCard}
                initial={
                  reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }
                }
                animate={
                  reduceMotion || methodInView
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: 28, scale: 0.98 }
                }
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        y: -4,
                        transition: {
                          duration: 0.18,
                          delay: 0,
                          ease: [0.16, 1, 0.3, 1],
                        },
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.38,
                        delay: i * 0.07,
                        ease: [0.16, 1, 0.3, 1],
                      }
                }
              >
                <motion.span
                  aria-hidden="true"
                  className={styles.loopCardN}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={
                    reduceMotion || methodInView
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 8 }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.32,
                          delay: i * 0.07 + 0.08,
                          ease: [0.16, 1, 0.3, 1],
                        }
                  }
                >
                  Step {i + 1}
                </motion.span>
                <h3>{principle.name}</h3>
                <p className={styles.loopCardP}>{principle.text}</p>
                <motion.span
                  aria-hidden="true"
                  className={styles.loopCardBar}
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: reduceMotion || methodInView ? 1 : 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.46,
                          delay: i * 0.07 + 0.12,
                          ease: [0.16, 1, 0.3, 1],
                        }
                  }
                />
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* SKILL WHEEL STORY — the pinned, scroll-driven act.
          No section heading: the first chapter IS the heading. A static header
          above a pinned narrative just competes with it. */}
      <section
        className={`${styles.section} ${styles.storySection}`}
        id="wheel-demo"
      >
        <div className={styles.wrap}>
          <RoleWheelStory />
        </div>
      </section>

      {/* PROFICIENCY LADDER — what the wheel's scores actually mean. */}
      <section
        className={`${styles.section} ${styles.ladderSection}`}
        id="ladder"
      >
        <div className={styles.wrap}>
          <div
            className={`${styles.ladderIntro} ${styles.reveal}`}
            data-reveal="true"
          >
            <div>
              <span className={styles.eyebrow}>
                One shared definition of growth
              </span>
              <h2 className={styles.hSec}>From awareness to mastery</h2>
            </div>
            <p className={styles.ladderIntroLead}>
              Every skill follows the same five rungs, whatever your role. Open
              a level to see the behavior that demonstrates it — this is the
              same scale your wheel is scored against.
            </p>
          </div>
          <SkillLadder />
        </div>
      </section>

      {/* LIBRARY */}
      <section className={`${styles.section} ${styles.library}`} id="library">
        <div className={styles.wrap}>
          <div
            className={`${styles.libHead} ${styles.reveal}`}
            data-reveal="true"
          >
            <div>
              <span className={styles.eyebrow}>
                Courses · Own Your Growth + Running a Project
              </span>
              <h2 className={styles.hSec}>The Alleato Training Library</h2>
              <p className={styles.sub}>
                Every module pairs a written how-to guide with curated
                resources. Start anywhere — the library grows as we do.
              </p>
            </div>
            <Link href="/training/library" className={styles.libBrowse}>
              Browse all training →
            </Link>
          </div>
          {/* A ranked list, not a card grid: these are things you open one at
              a time, and eight cards made every module look equally urgent. */}
          <ol className={styles.libList}>
            {moduleTiles.map((tile, index) => {
              const number = String(index + 1).padStart(2, "0");
              const body = (
                <>
                  <span className={styles.libNumber}>{number}</span>
                  <span className={styles.libText}>
                    <span className={styles.libTitle}>{tile.title}</span>
                    <span className={styles.libDesc}>{tile.description}</span>
                  </span>
                  <span className={styles.libMeta}>
                    <span className={styles.libTag}>{tile.tag}</span>
                    <span className={styles.libArrow} aria-hidden="true">
                      →
                    </span>
                  </span>
                </>
              );

              return (
                <li
                  key={tile.title}
                  className={`${styles.libItem} ${styles.reveal}`}
                  data-reveal="true"
                >
                  {tile.primaryLink ? (
                    <Link
                      href={tile.primaryLink.href}
                      className={styles.libRow}
                    >
                      {body}
                    </Link>
                  ) : (
                    <span
                      className={styles.libRow}
                      data-unavailable="true"
                      aria-disabled="true"
                    >
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* FINAL CTA — a closing statement, not a card. The centred card read as
          a banner dropped on the page; this is the page's last sentence. */}
      <section className={`${styles.section} ${styles.final}`}>
        <div className={styles.wrap}>
          <div
            className={`${styles.finalRow} ${styles.reveal}`}
            data-reveal="true"
          >
            <div className={styles.finalStatement}>
              <span className={styles.eyebrow}>My Growth</span>
              <h2 className={styles.finalTitle}>
                Fifteen minutes to your first wheel.
              </h2>
              <p className={styles.finalLead}>
                Score eight skills honestly, read the shape, and leave with two
                or three worth attacking. Re-score at 30, 60, and 90 days.
              </p>
            </div>
            <div className={styles.finalActions}>
              <Link
                href="/training/growth"
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Take the assessment →
              </Link>
              <Link href="/training/method" className={styles.finalSecondary}>
                Read the method first
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
