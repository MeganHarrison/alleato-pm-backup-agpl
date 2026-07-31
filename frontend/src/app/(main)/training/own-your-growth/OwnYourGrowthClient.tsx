"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";

import {
  CORE,
  HERO_WHEEL_VALUES,
  LEVELS,
  LIBRARY,
  PROMPTS,
  ROLES,
  levelFor,
  type Skill,
} from "./data";
import styles from "./own-your-growth.module.css";

const STORAGE_KEY = "alleato:own-your-growth:wheel";
const ROLE_NAMES = Object.keys(ROLES);
const DEFAULT_ROLE = ROLE_NAMES[0]!;

type SkillWithGroup = Skill & { group: "Core" | "Role" };

function skillsForRole(role: string): SkillWithGroup[] {
  const roleSkills = ROLES[role] ?? [];
  return [
    ...CORE.map((s) => ({ ...s, group: "Core" as const })),
    ...roleSkills.map((s) => ({ ...s, group: "Role" as const })),
  ];
}

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

  return (
    <svg
      id="heroWheel"
      className={styles.heroWheelSvg}
      viewBox="0 0 400 400"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FD5602" />
          <stop offset="1" stopColor="#ff9a5c" />
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
          fill="url(#hA)"
          opacity="0.92"
        />
      ))}
      <circle cx={cx} cy={cy} r={rIn - 4} fill="#0c0b0a" stroke="#FD5602" strokeWidth="1.5" />
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
        fill="#FD5602"
      >
        READINESS
      </text>
    </svg>
  );
}

function AssessmentWheel({
  skills,
  displayScores,
  avg,
}: {
  skills: SkillWithGroup[];
  displayScores: Record<string, number>;
  avg: number;
}) {
  const size = 340;
  const hub = 58;
  const cx = size / 2;
  const cy = size / 2;
  const rIn = hub;
  const rOut = size / 2 - 14;
  const n = skills.length;
  const gap = 0.03;
  const step = (Math.PI * 2) / n;

  return (
    <svg id="wheelSvg" className={styles.wheelSvg} viewBox="0 0 340 340">
      <defs>
        <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FD5602" />
          <stop offset="1" stopColor="#ff8a4a" />
        </linearGradient>
        <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DB802E" />
          <stop offset="1" stopColor="#FD5602" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={rIn + (rOut - rIn) * f}
          fill="none"
          stroke="rgba(0,0,0,.06)"
          strokeWidth="1"
        />
      ))}
      {skills.map((s, i) => {
        const a0 = -Math.PI / 2 + i * step + gap;
        const a1 = -Math.PI / 2 + (i + 1) * step - gap;
        const val = displayScores[s.n] ?? 0;
        const rf = rIn + (rOut - rIn) * (val / 100);
        const grad = i % 2 === 0 ? "url(#gA)" : "url(#gB)";
        return (
          <g key={s.n}>
            <path d={annularPath(cx, cy, rIn, rOut, a0, a1)} fill="rgba(0,0,0,.045)" />
            {val > 0 && <path d={annularPath(cx, cy, rIn, rf, a0, a1)} fill={grad} />}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={rIn - 3} fill="#0c0b0a" />
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        fontFamily="'Work Sans'"
        fontWeight="800"
        fontSize={rIn * 0.62}
        fill="#fff"
      >
        {avg}
      </text>
      <text
        x={cx}
        y={cy + rIn * 0.42}
        textAnchor="middle"
        fontFamily="'JetBrains Mono'"
        fontSize={rIn * 0.2}
        letterSpacing="1.5"
        fill="#FD5602"
      >
        AVG
      </text>
    </svg>
  );
}

export function OwnYourGrowthClient() {
  const [currentRole, setCurrentRole] = useState(DEFAULT_ROLE);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [displayScores, setDisplayScores] = useState<Record<string, number>>({});
  const [hotSkill, setHotSkill] = useState<string | null>(null);
  const [copiedIndices, setCopiedIndices] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: "", visible: false });

  const displayScoresRef = useRef<Record<string, number>>({});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const skills = useMemo(() => skillsForRole(currentRole), [currentRole]);

  useRevealOnScroll(containerRef);

  // Load a previously saved wheel from localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { role?: string; scores?: Record<string, number> };
      if (saved.role && ROLES[saved.role]) {
        setCurrentRole(saved.role);
        setScores(saved.scores ?? {});
      }
    } catch (error) {
      console.error("Own Your Growth: failed to load saved wheel from localStorage", error);
    }
  }, []);

  // Tween the wheel's wedge radii toward the target scores.
  useEffect(() => {
    let frameId: number;
    const tick = () => {
      let moving = false;
      const next = { ...displayScoresRef.current };
      skills.forEach((s) => {
        const target = scores[s.n] || 0;
        const cur = displayScoresRef.current[s.n] ?? 0;
        const diff = target - cur;
        if (Math.abs(diff) > 0.5) {
          next[s.n] = cur + diff * 0.28;
          moving = true;
        } else {
          next[s.n] = target;
        }
      });
      displayScoresRef.current = next;
      setDisplayScores(next);
      if (moving) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [scores, currentRole, skills]);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, visible: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }, []);

  const setScore = useCallback(
    (name: string, v: number) => {
      setScores((prev) => {
        const next = { ...prev };
        next[name] = prev[name] === v ? 0 : v;
        const applied = next[name];
        setHotSkill(applied > 0 ? name : null);
        if (hotTimerRef.current) clearTimeout(hotTimerRef.current);
        hotTimerRef.current = setTimeout(() => setHotSkill(null), 1200);
        return next;
      });
    },
    [],
  );

  const switchRole = useCallback((role: string) => {
    setCurrentRole(role);
    displayScoresRef.current = {};
    setDisplayScores({});
  }, []);

  const resetWheel = useCallback(() => {
    setScores({});
    displayScoresRef.current = {};
    setDisplayScores({});
    showToast("Wheel reset");
  }, [showToast]);

  const saveWheel = useCallback(() => {
    const overall = Math.round(
      skills.reduce((t, s) => t + (scores[s.n] || 0), 0) / skills.length,
    );
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ role: currentRole, scores, overall, saved: new Date().toISOString() }),
      );
      showToast(`Saved — ${currentRole} at ${overall}%`);
    } catch {
      showToast(`Saved for this session — ${currentRole} at ${overall}%`);
    }
  }, [currentRole, scores, skills, showToast]);

  const copyPrompt = useCallback(
    async (i: number) => {
      const text = PROMPTS[i]!.t;
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.warn("Own Your Growth: clipboard write failed, prompt text remains visible to copy manually", error);
      }
      setCopiedIndices((prev) => new Set(prev).add(i));
      showToast("Prompt copied to clipboard");
      setTimeout(() => {
        setCopiedIndices((prev) => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
      }, 1800);
    },
    [showToast],
  );

  const scrollToId = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const overall = Math.round(skills.reduce((t, s) => t + (scores[s.n] || 0), 0) / skills.length);
  const avg = overall;
  const focus = useMemo(
    () =>
      [...skills]
        .map((s) => ({ n: s.n, v: scores[s.n] || 0 }))
        .sort((a, b) => a.v - b.v)
        .slice(0, 3),
    [skills, scores],
  );

  const skillListItems: ReactElement[] = [];
  let lastGroup = "";
  skills.forEach((s) => {
    if (s.group !== lastGroup) {
      skillListItems.push(
        <div key={`grouplbl-${s.group}-${currentRole}`} className={styles.skillGroupLbl}>
          {s.group === "Core" ? "The Alleato Core · Everyone" : `${currentRole} · Role Skills`}
        </div>,
      );
      lastGroup = s.group;
    }
    const v = scores[s.n] || 0;
    const lvl = levelFor(v);
    skillListItems.push(
      <div
        key={s.n}
        className={`${styles.skillRow} ${hotSkill === s.n && v > 0 ? styles.skillRowHot : ""}`}
      >
        <div className={styles.srTop}>
          <div>
            <div className={styles.srName}>{s.n}</div>
            <div className={styles.srDesc}>{s.d}</div>
          </div>
          <div className={styles.srScore}>
            {v}
            <span className={styles.srScoreLvl}>{lvl}</span>
          </div>
        </div>
        <div className={styles.seg}>
          {LEVELS.map((l) => (
            <button
              key={l.v}
              type="button"
              className={`${styles.segButton} ${v === l.v ? styles.segButtonSel : ""}`}
              onClick={() => setScore(s.n, l.v)}
            >
              <b className={styles.segButtonB}>{l.v}</b>
              <span className={styles.segButtonSpan}>{l.name}</span>
            </button>
          ))}
        </div>
      </div>,
    );
  });

  return (
    <div className={styles.page} ref={containerRef}>
      {/* HERO */}
      <section className={styles.hero} id="top">
        <div className={styles.heroGridBg} />
        <div className={styles.heroGlow} />
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <div>
            <span className={styles.tagcap}>Alleato Training Library · Own Your Growth</span>
            <h1 className={styles.heroH1}>
              <span className={styles.heroOwn}>Own</span>
              <span className={styles.heroGrow}>Your Growth</span>
            </h1>
            <p className={styles.heroLead}>
              A learning system built to last. Master your craft one precise rep at a time —
              read it, listen to it, quiz yourself, and chat with it. Your growth, your pace,
              your ownership.
            </p>
            <div className={styles.heroCtas}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => scrollToId("assess")}
              >
                Take the Assessment →
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => scrollToId("library")}
              >
                Browse the Library
              </button>
            </div>
            <div className={styles.heroPartner}>Your partner from the ground up.</div>
          </div>
          <div className={styles.heroVisual}>
            <HeroWheel />
          </div>
        </div>
      </section>

      {/* STAT BAR */}
      <div className={styles.statbar}>
        <div className={`${styles.wrap} ${styles.statbarGrid}`}>
          <div className={styles.stat}>
            <b className={styles.statB}>
              4<span className={styles.statU}> +2</span>
            </b>
            <span className={styles.statSpan}>Core modules + tracks</span>
          </div>
          <div className={styles.stat}>
            <b className={styles.statB}>
              13<span className={styles.statU}> skills</span>
            </b>
            <span className={styles.statSpan}>Mapped to your role</span>
          </div>
          <div className={styles.stat}>
            <b className={styles.statB}>
              0<span className={styles.statU}>–100</span>
            </b>
            <span className={styles.statSpan}>Honest rep-based scoring</span>
          </div>
          <div className={styles.stat}>
            <b className={styles.statB}>
              ~15<span className={styles.statU}> min</span>
            </b>
            <span className={styles.statSpan}>To your first wheel</span>
          </div>
        </div>
      </div>

      {/* METHOD */}
      <section className={`${styles.section} ${styles.method}`} id="method">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>How it works</span>
            <h2 className={styles.hSec}>The method, at a glance</h2>
            <p className={`${styles.sub} ${styles.methodSub}`}>
              Broad goals like &ldquo;get better at construction&rdquo; don&rsquo;t move the
              needle. Precise ones do. Here&rsquo;s the whole loop — no download needed.
            </p>
          </div>
          <div className={styles.loop}>
            {[
              {
                n: "01 / OWN IT",
                h: "Own It",
                p: "Nobody cares about your development more than you. You lead this, not your manager. Open your list, add, remove, or rename until it's the real work you do.",
              },
              {
                n: "02 / HONEST",
                h: "Be Brutally Honest",
                p: "You can only fix a weakness you're willing to name. Score each skill against the rubric — the exact number, not a rounded-up guess.",
              },
              {
                n: "03 / SPECIFIC",
                h: "Get Specific",
                p: '"Read drawings better" is a wish. "30 min/day on civil sheets, RFI one thing per job" is a plan. Break each score into a precise, repeatable rep.',
              },
              {
                n: "04 / FOCUS",
                h: "Focus Your Energy",
                p: "Don't spread thin. Pick a few — where focus goes, energy flows. Your top 2–4 gaps become the target. Re-score on a cadence and watch the wheel fill.",
              },
            ].map((card) => (
              <div key={card.n} className={`${styles.loopCard} ${styles.reveal}`} data-reveal="true">
                <div className={styles.loopCardN}>{card.n}</div>
                <h3>{card.h}</h3>
                <p className={styles.loopCardP}>{card.p}</p>
                <div className={styles.loopCardBar} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIBRARY */}
      <section className={styles.section} id="library">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>Courses · Own Your Growth + Running a Project</span>
            <h2 className={styles.hSec}>The Alleato Training Library</h2>
            <p className={styles.sub}>
              Every module pairs a written how-to guide with curated resources. Start anywhere —
              the library grows as we do.
            </p>
          </div>
          <div className={styles.libGrid}>
            {LIBRARY.map((c) => (
              <div key={c.h} className={`${styles.course} ${styles.reveal}`} data-reveal="true">
                <div className={styles.courseTag}>{c.tag}</div>
                <h3>{c.h}</h3>
                <p className={styles.courseP}>{c.p}</p>
                <div className={styles.chips}>
                  {c.chips.map((ch) => (
                    <span
                      key={ch.label}
                      className={`${styles.chip} ${ch.solid ? styles.chipSolid : ""}`}
                    >
                      {ch.solid ? "▸ " : ""}
                      {ch.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={`${styles.notice} ${styles.reveal}`} data-reveal="true">
            <strong className={styles.noticeStrong}>More coming soon:</strong> Now live — the PM
            Track (12 topics) and Superintendent Track (10 topics), each with written how-to
            guides + curated resources. Next up: trade-specific SOPs, ASRS &amp; fire-protection
            deep dives, and workflows in our own project software.
          </div>
        </div>
      </section>

      {/* ASSESSMENT */}
      <section className={`${styles.section} ${styles.assessBg}`} id="assess">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>Start here · Your role&rsquo;s skill wheel</span>
            <h2 className={styles.hSec}>Score yourself. Watch the wheel.</h2>
            <p className={styles.sub}>
              Don&rsquo;t start from a blank page. Pick your role, then rate each skill honestly
              against the rubric. Your scores draw the wheel automatically and surface your top
              gaps.
            </p>
          </div>

          <div className={styles.assessShell}>
            {/* LEFT: wheel */}
            <div className={styles.wheelPanel}>
              <div className={styles.panel}>
                <div className={styles.wheelHead}>
                  <div>
                    <div className={styles.lbl}>Live Skill Wheel</div>
                  </div>
                  <div className={styles.lbl}>{currentRole}</div>
                </div>
                <AssessmentWheel skills={skills} displayScores={displayScores} avg={avg} />
                <div className={styles.readout}>
                  <div className={styles.readoutBig}>
                    {overall}
                    <span className={styles.readoutPct}>%</span>
                  </div>
                  <div className={styles.readoutCap}>Overall readiness for this role</div>
                </div>
                <div className={styles.focusBox}>
                  <div className={styles.focusBoxTtl}>◆ Focus your energy — biggest gaps</div>
                  <div>
                    {overall === 0 ? (
                      <div className={styles.focusEmpty}>
                        Start scoring skills — your top gaps will appear here.
                      </div>
                    ) : (
                      focus.map((f, i) => (
                        <div key={f.n} className={styles.focusItem}>
                          <div className={styles.focusItemGaprank}>{i + 1}</div>
                          <div className={styles.focusItemFname}>{f.n}</div>
                          <div className={styles.focusItemFgap}>{f.v} → 80</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className={styles.saveRow}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDark}`}
                    onClick={saveWheel}
                  >
                    Save to Dashboard
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnOut}`}
                    onClick={resetWheel}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: skills */}
            <div>
              <div className={styles.roleTabs}>
                {ROLE_NAMES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.rt} ${r === currentRole ? styles.rtActive : ""}`}
                    onClick={() => switchRole(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className={styles.skillsNote}>
                Set each skill to the number that&rsquo;s <b>actually true</b> — the score a fair
                observer watching your work would give. Core skills apply to everyone; role
                skills are specific to your job.
              </div>
              <div>{skillListItems}</div>
            </div>
          </div>
        </div>
      </section>

      {/* SCORE SCALE */}
      <section className={styles.section} id="scale">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>Score honestly</span>
            <h2 className={styles.hSec}>What each score really means</h2>
            <p className={styles.sub}>
              These are reference points, not buckets. Put the exact number that&rsquo;s true
              (23, 71 — whatever a fair observer would give). For each score, name one recent
              example that proves it.
            </p>
          </div>
          <div className={styles.scaleWrap}>
            <div className={styles.scaleList}>
              {LEVELS.map((l) => (
                <div key={l.v} className={styles.scaleItem}>
                  <div className={styles.scaleNum}>{l.v}</div>
                  <div>
                    <h4>{l.name}</h4>
                    <p className={styles.scaleItemP}>{l.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className={`${styles.scaleViz} ${styles.reveal}`} data-reveal="true">
              <div className={styles.scaleVizVh}>The proficiency ladder</div>
              <div className={styles.ladder}>
                {LEVELS.map((l) => (
                  <div key={l.v} className={styles.ladRow}>
                    <div className={styles.ladVal}>{l.v}</div>
                    <div className={styles.ladName}>{l.name}</div>
                    <div className={styles.ladBar} style={{ width: `${l.v * 1.6}px` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI PROMPTS */}
      <section className={`${styles.section} ${styles.assessBg}`} id="prompts">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>Teach yourself faster</span>
            <h2 className={styles.hSec}>AI prompt starters</h2>
            <p className={styles.sub}>
              Launch pads for Claude / Cowork. Copy, paste, and always verify AI output against
              the actual drawings, specs, and our SOPs.
            </p>
          </div>
          <div className={styles.promptGrid}>
            {PROMPTS.map((p, i) => (
              <div key={p.q} className={`${styles.prompt} ${styles.reveal}`} data-reveal="true">
                <div className={styles.promptPq}>◇ {p.q}</div>
                <p className={styles.promptP}>{p.t}</p>
                <button
                  type="button"
                  className={`${styles.copyBtn} ${copiedIndices.has(i) ? styles.copyBtnDone : ""}`}
                  onClick={() => copyPrompt(i)}
                >
                  {copiedIndices.has(i) ? "✓ Copied" : "⧉ Copy prompt"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOOLKIT */}
      <section className={styles.section} id="toolkit">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>Sharpen your habits</span>
            <h2 className={styles.hSec}>Quick toolkit</h2>
          </div>
          <div className={styles.toolkit}>
            {[
              {
                ti: "1·3·1",
                h: "The 1-3-1 Rule",
                p: "When you're stuck, bring one problem, three possible solutions, and your one recommendation. Turns \"I'm stuck\" into leadership.",
              },
              {
                ti: "↗",
                h: "The Learning Ladder",
                p: "1) Try it yourself → 2) Look it up (YouTube, AI, Claude, the drawings, the field) → 3) Bring a specific question → 4) Get coached → 5) Teach someone else.",
              },
              {
                ti: "✕",
                h: 'The "Stop-Doing" List',
                p: "Skill-building needs time. Use the Eisenhower Matrix: important-not-urgent gets scheduled, urgent-not-important gets delegated, the rest gets dropped.",
              },
              {
                ti: "◎",
                h: "Mentor Match",
                p: "For each focus skill, name someone at Alleato near 100% at it — and book a 15-minute \"sharper question\" session.",
              },
            ].map((t) => (
              <div key={t.h} className={`${styles.tool} ${styles.reveal}`} data-reveal="true">
                <div className={styles.toolTi}>{t.ti}</div>
                <h4>{t.h}</h4>
                <p className={styles.toolP}>{t.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* READY */}
      <section className={`${styles.section} ${styles.ready}`} id="ready">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow}>Proficiency before promotion</span>
            <h2 className={styles.hSec}>What &ldquo;ready&rdquo; looks like</h2>
            <p className={`${styles.sub} ${styles.readySub}`}>
              Advancement at Alleato follows capability, not tenure. Use this to see the reps
              between here and the next role.
            </p>
          </div>
          <div className={styles.checkList}>
            {[
              <>
                You&rsquo;ve <b>mastered the core skills</b> of your current role — mostly 80%+
                on your wheel.
              </>,
              <>
                You <b>run your work solo</b>, document decisions, and escalate with a
                recommendation — not just a problem.
              </>,
              <>
                You&rsquo;ve <b>done the reps on real projects</b> (field / superintendent time
                counts) — not just watched.
              </>,
              <>
                You make people around you better and can <b>teach &ldquo;the Alleato way.&rdquo;</b>
              </>,
            ].map((content, i) => (
              <div key={i} className={`${styles.check} ${styles.reveal}`} data-reveal="true">
                <div className={styles.checkIco}>✓</div>
                <p className={styles.checkP}>{content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={`${styles.section} ${styles.final}`}>
        <div className={styles.wrap}>
          <div className={`${styles.finalCard} ${styles.reveal}`} data-reveal="true">
            <span className={styles.eyebrow} style={{ justifyContent: "center" }}>
              My Growth · Self-Assessment
            </span>
            <h2>Take your first assessment</h2>
            <p className={styles.finalCardP}>
              A guided walk-through: pick your role, score yourself honestly, see your wheel,
              confirm your focus, and build your plan. About 15 minutes — and it lives right
              here.
            </p>
            <div className={styles.stepsMini}>
              {[
                ["1", "Pick role"],
                ["2", "Choose skills"],
                ["3", "Score 0–100"],
                ["4", "Read wheel"],
                ["5", "Confirm focus"],
                ["6", "Build plan"],
              ].map(([n, label]) => (
                <span key={n} className={styles.stepPill}>
                  <b className={styles.stepPillB}>{n}</b> {label}
                </span>
              ))}
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.finalCta}`}
              onClick={() => scrollToId("assess")}
            >
              Take the Assessment →
            </button>
          </div>
        </div>
      </section>

      <div className={`${styles.toast} ${toast.visible ? styles.toastShow : ""}`}>
        {toast.msg}
      </div>
    </div>
  );
}
