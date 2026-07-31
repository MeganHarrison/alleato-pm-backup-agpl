"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CATEGORY_BY_TYPE, CATEGORY_META } from "./lib/graph-colors";
import { computeLayout, hash01, type GraphLayout } from "./lib/graph-layout";
import type { KnowledgeNode, KnowledgeNodeType, TimeRange } from "./lib/graph-types";
import type { KnowledgeGraphIndex } from "./hooks/use-knowledge-graph";
import styles from "./company-brain.module.css";

export interface HighlightState {
  nodeIds: Set<string> | null;
  type: KnowledgeNodeType | null;
  searchId: string | null;
}

interface Props {
  index: KnowledgeGraphIndex;
  reduced: boolean;
  timeRange: TimeRange;
  highlight: HighlightState;
  onSelectNode: (id: string) => void;
  onSelectCluster: (type: KnowledgeNodeType) => void;
  onBackground: () => void;
  onIngest: (type: KnowledgeNodeType) => void;
  children?: ReactNode;
}

interface Particle { fx: number; fy: number; t: number; sp: number; bright: boolean; }
interface Pulse { r: number; a: number; }
interface Flash { x: number; y: number; color: string; t: number; }

const RANGE_PARTICLE: Record<TimeRange, number> = { live: 1.35, "24h": 1.1, "7d": 0.9, "30d": 0.7, all: 0.55 };

function resolveColor(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  if (!v) return fallback;
  return v.startsWith("hsl") ? v : `hsl(${v})`;
}
function withAlpha(color: string, alpha: number): string {
  // color is "hsl(H S% L%)" — inject alpha
  if (color.startsWith("hsl(") && color.indexOf("/") === -1) {
    return color.replace(/\)\s*$/, ` / ${alpha})`);
  }
  return color;
}

export function KnowledgeGraphCanvas({
  index, reduced, timeRange, highlight, onSelectNode, onSelectCluster, onBackground, onIngest, children,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const graph = index.graph;
  const nodes = graph.nodes;
  const rels = graph.relationships;

  // refs mirror latest props for the imperative loop (no rAF re-subscription)
  const highlightRef = useRef(highlight);
  const timeRangeRef = useRef(timeRange);
  const reducedRef = useRef(reduced);
  useEffect(() => { highlightRef.current = highlight; }, [highlight]);
  useEffect(() => { timeRangeRef.current = timeRange; }, [timeRange]);
  useEffect(() => { reducedRef.current = reduced; }, [reduced]);

  const layoutRef = useRef<GraphLayout | null>(null);
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const hoverRef = useRef<string | null>(null);
  const [clusterLabels, setClusterLabels] = useState<Array<{ type: KnowledgeNodeType; x: number; y: number }>>([]);

  const nodeById = index.nodeById;

  // internal brain lattice (stable)
  const brain = useMemo(() => {
    const pts: Array<{ ix: number; iy: number; ph: number; sp: number }> = [];
    for (let i = 0; i < 20; i++) {
      const a = hash01("brain" + i) * 6.28;
      const rr = Math.sqrt(hash01("brainr" + i)) * 0.82;
      pts.push({ ix: Math.cos(a) * rr, iy: Math.sin(a) * rr * 0.86, ph: hash01("brainp" + i) * 6.28, sp: 0.4 + hash01("brains" + i) * 0.6 });
    }
    const edges: Array<[number, number]> = [];
    for (let a = 0; a < pts.length; a++) {
      let best = -1, bd = 1e9;
      for (let b = 0; b < pts.length; b++) {
        if (a === b) continue;
        const d = Math.hypot(pts[a].ix - pts[b].ix, pts[a].iy - pts[b].iy);
        if (d < bd) { bd = d; best = b; }
      }
      if (best >= 0) edges.push([a, best]);
      if (hash01("be" + a) > 0.5) edges.push([a, (a + 3) % pts.length]);
    }
    return { pts, edges };
  }, []);

  const particles = useRef<Particle[]>([]);
  const pulses = useRef<Pulse[]>([]);
  const flashes = useRef<Flash[]>([]);

  const relayout = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const lay = computeLayout(graph, rect.width, rect.height);
    layoutRef.current = lay;
    setClusterLabels(lay.clusters.map((c) => {
      const outX = c.ax + (c.ax - lay.cx) * 0.06;
      let outY = c.ay + (c.ay - lay.cy) * 0.06 - 2;
      outY = Math.max(96, Math.min(rect.height - 128, outY));
      return { type: c.type, x: outX, y: outY };
    }));
  }, [graph]);

  const nodeAt = useCallback((mx: number, my: number): KnowledgeNode | null => {
    let best: KnowledgeNode | null = null;
    let bd = 15;
    const pos = posRef.current;
    for (const nd of nodes) {
      const p = pos.get(nd.id);
      if (!p) continue;
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bd) { bd = d; best = nd; }
    }
    return best;
  }, [nodes]);

  const showTip = useCallback((nd: KnowledgeNode, mx: number, my: number, stageW: number, stageH: number) => {
    const tip = tipRef.current;
    if (!tip) return;
    const cat = CATEGORY_BY_TYPE[nd.type];
    // Built via DOM + textContent (never innerHTML) so user/vendor-supplied
    // titles/summaries from the future live-data seam can't inject markup.
    const el = (cls: string, text?: string) => {
      const d = document.createElement("div");
      d.className = cls;
      if (text !== undefined) d.textContent = text;
      return d;
    };
    const row = (label: string, value: string) => {
      const r = el(styles.tipRow);
      const l = document.createElement("span"); l.textContent = label;
      const v = document.createElement("span"); v.textContent = value;
      r.append(l, v);
      return r;
    };
    const type = el(styles.tipType, cat.singular);
    type.style.color = `var(${cat.cssVar})`;
    const conn = el(styles.tipConn);
    const count = document.createElement("b");
    count.style.color = `var(${cat.cssVar})`;
    count.textContent = String(nd.relationshipCount);
    conn.append(document.createTextNode("Connected to "), count,
      document.createTextNode(` related record${nd.relationshipCount === 1 ? "" : "s"}`));

    tip.replaceChildren(
      type,
      el(styles.tipTitle, nd.title),
      row("Project", nd.projectName ?? "—"),
      row("Source", nd.sourceSystem ?? "—"),
      row("Date", formatDate(nd.createdAt)),
      conn,
    );
    tip.classList.add(styles.tipShow);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = mx + 16, top = my + 16;
    if (left + tw > stageW - 10) left = mx - tw - 16;
    if (top + th > stageH - 10) top = my - th - 16;
    tip.style.left = Math.max(10, left) + "px";
    tip.style.top = Math.max(10, top) + "px";
  }, []);

  // main render loop
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    relayout();

    let last = 0;
    let simAcc = 0;
    let tabActive = true;
    const onVis = () => { tabActive = !document.hidden; last = 0; };
    document.addEventListener("visibilitychange", onVis);

    const spawnPulse = (strength: number) => pulses.current.push({ r: (layoutRef.current?.brainR ?? 80) * 0.5, a: 0.5 * strength });
    const spawnParticle = (fx: number, fy: number, bright: boolean) => particles.current.push({ fx, fy, t: 0, sp: 0.006 + hash01("sp" + fx + fy + particles.current.length) * 0.007, bright });

    const draw = (ts: number) => {
      const lay = layoutRef.current;
      const rect = { width: stage.clientWidth, height: stage.clientHeight };
      if (!lay) { rafRef.current = requestAnimationFrame(draw); return; }
      const dt = last ? Math.min(ts - last, 60) : 16;
      last = ts;
      const rm = reducedRef.current;
      const hi = highlightRef.current;
      // Resolve CSS custom properties ONCE per frame (they don't change between
      // frames) — avoids ~200+ getComputedStyle style-recalcs per frame.
      const accent = resolveColor(stage, "--cb-accent", "hsl(31 94% 62%)");
      const borderCol = resolveColor(stage, "--border", "hsl(240 8% 20%)");
      const cardCol = resolveColor(stage, "--card", "hsl(240 6% 8%)");
      const catColor: Partial<Record<KnowledgeNodeType, string>> = {};
      CATEGORY_META.forEach((c) => { catColor[c.type] = resolveColor(stage, c.cssVar, c.fallback); });
      const colorOf = (t: KnowledgeNodeType) => catColor[t] ?? CATEGORY_BY_TYPE[t].fallback;
      ctx.clearRect(0, 0, rect.width, rect.height);

      // node positions
      const pos = posRef.current;
      nodes.forEach((nd) => {
        const pl = lay.placement.get(nd.id);
        if (!pl) return;
        const dx = rm ? 0 : Math.sin(ts / 2600 + pl.phase) * 3.2;
        const dy = rm ? 0 : Math.cos(ts / 3100 + pl.phase) * 3.2;
        pos.set(nd.id, { x: pl.bx + dx, y: pl.by + dy });
      });

      const dimAll = !!(hi.nodeIds || hi.type || hi.searchId);
      const nodeActive = (nd: KnowledgeNode): boolean => {
        if (hi.nodeIds) return hi.nodeIds.has(nd.id);
        if (hi.type) return nd.type === hi.type;
        if (hi.searchId) return nd.id === hi.searchId;
        return true;
      };

      // relationship edges
      rels.forEach((r) => {
        const a = pos.get(r.sourceNodeId), b = pos.get(r.targetNodeId);
        if (!a || !b) return;
        const on = hi.nodeIds ? (hi.nodeIds.has(r.sourceNodeId) && hi.nodeIds.has(r.targetNodeId))
          : hi.type ? (nodeById.get(r.sourceNodeId)?.type === hi.type || nodeById.get(r.targetNodeId)?.type === hi.type) : false;
        const alpha = on ? 0.55 : (dimAll ? 0.03 : 0.08);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(a.x - b.x, a.y - b.y) * 0.12;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
        const srcType = nodeById.get(r.sourceNodeId)?.type ?? "meeting";
        ctx.strokeStyle = on ? withAlpha(colorOf(srcType), 0.6) : withAlpha(borderCol, alpha * 6);
        ctx.globalAlpha = alpha; ctx.lineWidth = on ? 1.3 : 0.7; ctx.stroke(); ctx.globalAlpha = 1;
      });

      // intra-cluster edges (anchor spokes)
      lay.clusters.forEach((cl) => {
        const anchor = pos.get(cl.anchorId);
        if (!anchor) return;
        const catCol = colorOf(cl.type);
        const act = hi.type === cl.type;
        cl.nodeIds.forEach((nid, k) => {
          if (k === 0) return;
          const p = pos.get(nid);
          if (!p) return;
          ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = withAlpha(catCol, act ? 0.4 : (dimAll ? 0.05 : 0.14));
          ctx.lineWidth = 0.7; ctx.stroke();
        });
        // ingestion trunk anchor → brain
        const grad = ctx.createLinearGradient(anchor.x, anchor.y, lay.cx, lay.cy);
        grad.addColorStop(0, withAlpha(catCol, act ? 0.5 : 0.14));
        grad.addColorStop(1, withAlpha(accent, act ? 0.4 : 0.06));
        ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y);
        ctx.quadraticCurveTo((anchor.x + lay.cx) / 2, (anchor.y + lay.cy) / 2, lay.cx, lay.cy);
        ctx.strokeStyle = grad; ctx.lineWidth = act ? 1.6 : 0.8; ctx.stroke();
      });

      // ambient ingestion particles
      const pr = RANGE_PARTICLE[timeRangeRef.current];
      if (!rm && tabActive) {
        lay.clusters.forEach((cl) => {
          const rate = 0.02 * pr * (hi.type === cl.type ? 3 : 1);
          if (Math.random() < rate * (dt / 16)) {
            const anchor = pos.get(cl.anchorId);
            if (anchor) spawnParticle(anchor.x, anchor.y, hi.type === cl.type);
          }
        });
      }
      particles.current.forEach((p) => {
        p.t += p.sp * (dt / 16);
        const tt = p.t;
        if (tt > 1) return;
        const qx = (p.fx + lay.cx) / 2, qy = (p.fy + lay.cy) / 2;
        const x = (1 - tt) * (1 - tt) * p.fx + 2 * (1 - tt) * tt * qx + tt * tt * lay.cx;
        const y = (1 - tt) * (1 - tt) * p.fy + 2 * (1 - tt) * tt * qy + tt * tt * lay.cy;
        ctx.beginPath(); ctx.arc(x, y, p.bright ? 2.6 : 1.7, 0, 6.28);
        ctx.fillStyle = p.bright ? accent : withAlpha(accent, 0.7);
        ctx.globalAlpha = 1 - tt * 0.3; ctx.fill(); ctx.globalAlpha = 1;
      });
      particles.current = particles.current.filter((p) => { if (p.t >= 1) { if (p.bright) spawnPulse(0.7); return false; } return true; });

      drawBrain(ctx, lay, ts, rm, accent, brain, pulses.current);

      // flashes (new-data nodes)
      flashes.current.forEach((f) => {
        f.t += dt / 700;
        const s = f.t < 0.3 ? f.t / 0.3 : 1 - (f.t - 0.3) / 0.7;
        ctx.globalAlpha = Math.max(0, s);
        ctx.beginPath(); ctx.arc(f.x, f.y, 3 + s * 3, 0, 6.28); ctx.fillStyle = f.color; ctx.fill();
        ctx.beginPath(); ctx.arc(f.x, f.y, (3 + s * 3) + 5, 0, 6.28); ctx.fillStyle = withAlpha(f.color, 0.12); ctx.fill();
        ctx.globalAlpha = 1;
      });
      flashes.current = flashes.current.filter((f) => f.t < 1);

      // nodes
      const hoverId = hoverRef.current;
      nodes.forEach((nd) => {
        const p = pos.get(nd.id);
        const pl = lay.placement.get(nd.id);
        if (!p || !pl) return;
        const act = nodeActive(nd);
        const isHover = nd.id === hoverId;
        const isSel = nd.id === hi.searchId || (hi.nodeIds && hi.nodeIds.has(nd.id) && hi.nodeIds.size <= 1);
        const baseAlpha = dimAll ? (act ? 1 : 0.16) : 1;
        const rr = pl.r * (isSel ? 1.5 : isHover ? 1.3 : 1);
        const c = colorOf(nd.type);
        ctx.globalAlpha = baseAlpha * (act ? 0.9 : 0.5);
        ctx.beginPath(); ctx.arc(p.x, p.y, rr + (isSel ? 10 : 6), 0, 6.28); ctx.fillStyle = withAlpha(c, 0.14); ctx.fill();
        ctx.globalAlpha = baseAlpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.28); ctx.fillStyle = c; ctx.fill();
        if (pl.anchor || isHover || isSel) { ctx.lineWidth = 1.4; ctx.strokeStyle = cardCol; ctx.stroke(); }
        ctx.globalAlpha = 1;
      });

      // new-data simulation
      if (!rm && tabActive) {
        simAcc += dt;
        if (simAcc > 1600 / pr) {
          simAcc = 0;
          const cl = lay.clusters[Math.floor(Math.random() * lay.clusters.length)];
          const anchor = pos.get(cl.anchorId);
          if (anchor) {
            const blob = Math.min(rect.width, rect.height) * 0.06;
            const fx = cl.ax + (Math.random() * 2 - 1) * blob;
            const fy = cl.ay + (Math.random() * 2 - 1) * blob;
            flashes.current.push({ x: fx, y: fy, color: colorOf(cl.type), t: 0 });
            spawnParticle(fx, fy, true);
            spawnPulse(1.1);
            onIngest(cl.type);
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); document.removeEventListener("visibilitychange", onVis); };
  }, [nodes, rels, brain, nodeById, relayout, onIngest]);

  // resize
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => relayout());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [relayout]);

  // pointer
  const onMove = (e: React.MouseEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const nd = nodeAt(mx, my);
    hoverRef.current = nd ? nd.id : null;
    if (nd) showTip(nd, mx, my, rect.width, rect.height);
    else tipRef.current?.classList.remove(styles.tipShow);
  };
  const onLeave = () => { hoverRef.current = null; tipRef.current?.classList.remove(styles.tipShow); };
  const onClick = (e: React.MouseEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const nd = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (nd) onSelectNode(nd.id); else onBackground();
  };

  if (nodes.length === 0) {
    return (
      <div className={`${styles.stage} ${styles.emptyStage}`} role="status">
        <p className={styles.emptyStageTitle}>No knowledge records in this range.</p>
        <p className={styles.emptyStageDetail}>
          Select a longer time range to inspect earlier company knowledge.
        </p>
      </div>
    );
  }

  return (
    <div ref={stageRef} className={styles.stage}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
        aria-hidden="true"
      />
      {clusterLabels.map((cl) => {
        const cat = CATEGORY_BY_TYPE[cl.type];
        const active = highlight.type === cl.type;
        return (
          <span
            key={cl.type}
            role="button"
            tabIndex={0}
            className={`${styles.label} ${active ? styles.labelOn : ""}`}
            style={{ left: cl.x, top: cl.y }}
            onClick={() => onSelectCluster(cl.type)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectCluster(cl.type); } }}
          >
            <span className={styles.labelDot} style={{ background: `var(${cat.cssVar})`, color: `var(${cat.cssVar})` }} />
            <span className={styles.labelName}>{cat.label}</span>
            <span className={styles.labelCount}>{cat.count.toLocaleString()}</span>
            <span className={styles.labelAdd}>+{cat.today}</span>
          </span>
        );
      })}
      <div ref={tipRef} className={styles.tip} aria-hidden="true" />
      {children}
      {/* accessible mirror of the graph for screen readers */}
      <ul className={styles.srList}>
        {CATEGORY_META.map((c) => (
          <li key={c.type}>{c.label}: {c.count.toLocaleString()} records, {c.today} added today</li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function drawBrain(
  ctx: CanvasRenderingContext2D, lay: GraphLayout, ts: number,
  rm: boolean, accent: string, brain: { pts: Array<{ ix: number; iy: number; ph: number; sp: number }>; edges: Array<[number, number]> },
  pulses: Pulse[],
) {
  const { cx, cy, brainR } = lay;
  const aura = ctx.createRadialGradient(cx, cy, brainR * 0.2, cx, cy, brainR * 2.1);
  aura.addColorStop(0, withAlpha(accent, 0.22));
  aura.addColorStop(0.4, withAlpha(accent, 0.06));
  aura.addColorStop(1, "hsl(0 0% 0% / 0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, brainR * 2.1, 0, 6.28); ctx.fill();

  pulses.forEach((p) => { p.r += rm ? 0 : 1.5; p.a *= 0.975; ctx.beginPath(); ctx.arc(cx, cy, p.r, 0, 6.28); ctx.strokeStyle = withAlpha(accent, Math.max(0, p.a)); ctx.lineWidth = 1.4; ctx.stroke(); });
  for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].a <= 0.02 || pulses[i].r > brainR * 2.4) pulses.splice(i, 1);
  if (!rm && Math.random() < 0.004) pulses.push({ r: brainR * 0.5, a: 0.35 });

  for (let g = 0; g < 3; g++) {
    ctx.beginPath(); ctx.arc(cx, cy, brainR * (0.62 + g * 0.19), 0, 6.28);
    ctx.strokeStyle = withAlpha(accent, 0.1 - g * 0.02); ctx.lineWidth = 1; ctx.stroke();
  }

  const body = ctx.createRadialGradient(cx - brainR * 0.2, cy - brainR * 0.25, brainR * 0.1, cx, cy, brainR);
  body.addColorStop(0, withAlpha(accent, 0.32));
  body.addColorStop(0.55, "hsl(31 60% 20% / 0.35)");
  body.addColorStop(1, "hsl(240 30% 8% / 0.15)");
  ctx.beginPath(); ctx.arc(cx, cy, brainR * 0.94, 0, 6.28); ctx.fillStyle = body; ctx.fill();

  const rot = rm ? 0 : ts / 9000;
  const ipos = (p: { ix: number; iy: number; ph: number }) => {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const x = p.ix * ca - p.iy * sa, y = p.ix * sa + p.iy * ca;
    const breathe = rm ? 1 : 1 + Math.sin(ts / 1400 + p.ph) * 0.03;
    return { x: cx + x * brainR * 0.82 * breathe, y: cy + y * brainR * 0.82 * breathe };
  };
  brain.edges.forEach((e) => {
    const a = ipos(brain.pts[e[0]]), b = ipos(brain.pts[e[1]]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = withAlpha(accent, 0.22); ctx.lineWidth = 0.8; ctx.stroke();
  });
  brain.pts.forEach((p) => {
    const q = ipos(p);
    const tw = rm ? 0.7 : 0.5 + Math.abs(Math.sin((ts / 900) * p.sp + p.ph)) * 0.5;
    ctx.beginPath(); ctx.arc(q.x, q.y, 2 + tw, 0, 6.28); ctx.fillStyle = withAlpha(accent, 0.35 + tw * 0.5); ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, 1.4, 0, 6.28); ctx.fillStyle = `hsl(45 100% 92% / ${0.6 + tw * 0.4})`; ctx.fill();
  });

  const cgrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, brainR * 0.4);
  cgrad.addColorStop(0, `hsl(42 100% 88% / ${rm ? 0.5 : 0.4 + Math.sin(ts / 1000) * 0.12})`);
  cgrad.addColorStop(0.5, withAlpha(accent, 0.3));
  cgrad.addColorStop(1, "hsl(31 94% 62% / 0)");
  ctx.fillStyle = cgrad; ctx.beginPath(); ctx.arc(cx, cy, brainR * 0.4, 0, 6.28); ctx.fill();
}
