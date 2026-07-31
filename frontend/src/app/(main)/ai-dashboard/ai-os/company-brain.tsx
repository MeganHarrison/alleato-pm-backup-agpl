"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";

import { Heading } from "@/components/ds";
import { BRAIN_TYPES } from "./ai-os-data";
import styles from "./ai-os.module.css";

interface BrainNode {
  id: number;
  type: string;
  varName: string;
  color: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ph: number;
}

/**
 * The living company-brain graph. A lightweight canvas force field: typed nodes
 * drift, connect, and highlight their neighborhood on hover. Colors are read
 * from the CSS custom properties on the wrapper so it tracks the theme.
 */
export function CompanyBrain() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<BrainNode[]>([]);
  const edgesRef = useRef<Array<[number, number]>>([]);
  const hoverRef = useRef<number | null>(null);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!wrap || !canvas || !tip) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;

    const cssVar = (name: string, fallback = "") =>
      getComputedStyle(wrap).getPropertyValue(name).trim() || fallback;

    // build nodes + edges
    const nodes: BrainNode[] = [];
    let id = 0;
    for (const t of BRAIN_TYPES) {
      for (let i = 0; i < t.count; i++) {
        const nm = t.names[i % t.names.length] + (i >= t.names.length ? ` ${i + 1}` : "");
        nodes.push({
          id: id++, type: t.key, varName: t.varName, color: t.color, name: nm,
          x: Math.random(), y: Math.random(),
          vx: Math.random() - 0.5, vy: Math.random() - 0.5,
          r: t.key === "project" ? 7 : t.key === "client" ? 6 : 4.2,
          ph: Math.random() * 6.28,
        });
      }
    }
    const byType: Record<string, BrainNode[]> = {};
    nodes.forEach((n) => { (byType[n.type] ||= []).push(n); });
    const edges: Array<[number, number]> = [];
    const pick = (a: BrainNode[]) => a[Math.floor(Math.random() * a.length)];
    const link = (a?: BrainNode, b?: BrainNode) => { if (a && b && a !== b) edges.push([a.id, b.id]); };
    byType.meeting?.forEach((m) => { link(m, pick(byType.project)); link(m, pick(byType.person)); if (Math.random() > 0.5) link(m, pick(byType.person)); });
    byType.task?.forEach((n) => { link(n, pick(byType.project)); link(n, pick(byType.meeting)); });
    byType.risk?.forEach((n) => link(n, pick(byType.project)));
    byType.opportunity?.forEach((n) => link(n, pick(byType.project)));
    byType.decision?.forEach((n) => { link(n, pick(byType.meeting)); link(n, pick(byType.project)); });
    byType.doc?.forEach((n) => link(n, pick(byType.project)));
    byType.drawing?.forEach((n) => link(n, pick(byType.project)));
    byType.person?.forEach((n) => link(n, pick(byType.client)));
    byType.client?.forEach((n) => link(n, pick(byType.project)));

    nodesRef.current = nodes;
    edgesRef.current = edges;
    setNodeCount(nodes.length);

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const nodeXY = (n: BrainNode) => ({ x: 40 + n.x * (width - 80), y: 34 + n.y * (height - 80) });

    const draw = (ts: number) => {
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
      last = ts;
      ctx.clearRect(0, 0, width, height);
      if (!reduce) {
        nodes.forEach((n) => {
          n.x += n.vx * dt * 0.04;
          n.y += n.vy * dt * 0.04;
          if (n.x < 0.02 || n.x > 0.98) n.vx *= -1;
          if (n.y < 0.02 || n.y > 0.98) n.vy *= -1;
          n.x = Math.max(0.02, Math.min(0.98, n.x));
          n.y = Math.max(0.02, Math.min(0.98, n.y));
        });
      }
      const pos = nodes.map(nodeXY);
      const hover = hoverRef.current;
      let hoverSet: Record<number, boolean> | null = null;
      if (hover != null) {
        hoverSet = { [hover]: true };
        edges.forEach((e) => {
          if (e[0] === hover) hoverSet![e[1]] = true;
          if (e[1] === hover) hoverSet![e[0]] = true;
        });
      }
      edges.forEach((e) => {
        const a = pos[e[0]];
        const b = pos[e[1]];
        const on = hoverSet && (e[0] === hover || e[1] === hover);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `hsl(${cssVar("--border", "240 8% 24%")})`;
        ctx.globalAlpha = hoverSet ? (on ? 0.9 : 0.1) : 0.5;
        ctx.lineWidth = on ? 1.4 : 0.8;
        ctx.stroke();
        if (on) {
          const tt = ((ts / 1400) + e[0] * 0.13) % 1;
          const px = a.x + (b.x - a.x) * tt;
          const py = a.y + (b.y - a.y) * tt;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, 6.28);
          ctx.fillStyle = cssVar("--aios-accent", "hsl(215 84% 70%)");
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      nodes.forEach((n, i) => {
        const p = pos[i];
        const dim = hoverSet && !hoverSet[n.id];
        const pr = n.r + (reduce ? 0 : Math.sin(ts / 700 + n.ph) * 0.5);
        const col = cssVar(n.varName, n.color);
        if (!dim) {
          // outer + inner glow so nodes read as a lit neural network
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr + 8, 0, 6.28);
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.1;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr + 4, 0, 6.28);
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.2;
          ctx.fill();
        }
        ctx.globalAlpha = dim ? 0.22 : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, 6.28);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `hsl(${cssVar("--card", "240 6% 8%")})`;
        ctx.stroke();
        if (n.id === hover) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr + 3, 0, 6.28);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.8;
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pos = nodes.map(nodeXY);
      let found: number | null = null;
      let best = 16;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(pos[i].x - mx, pos[i].y - my);
        if (d < best) { best = d; found = nodes[i].id; }
      }
      hoverRef.current = found;
      canvas.style.cursor = found != null ? "pointer" : "default";
      if (found != null) {
        const n = nodes[found];
        const p = nodeXY(n);
        tip.innerHTML = `<b style="font-size:12px">${n.name}</b><br><span style="color:hsl(${cssVar("--muted-foreground", "240 5% 62%")});text-transform:capitalize">${n.type}</span>`;
        tip.style.left = `${p.x}px`;
        tip.style.top = `${p.y}px`;
        tip.classList.add(styles.brainTipShow);
      } else {
        tip.classList.remove(styles.brainTipShow);
      }
      if (reduce) draw(performance.now());
    };
    const onLeave = () => {
      hoverRef.current = null;
      tip.classList.remove(styles.brainTipShow);
      if (reduce) draw(0);
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    // ResizeObserver fires on observe with the current size, so it guarantees a
    // repaint once the canvas actually has layout dimensions — preventing a
    // blank canvas if the effect runs before layout settles (and handles
    // responsive resizes). draw() self-schedules the RAF loop when animating.
    const ro = new ResizeObserver(() => {
      sizeCanvas();
      if (reduce) draw(0);
    });
    ro.observe(canvas);

    sizeCanvas();
    if (reduce) draw(0);
    else draw(typeof performance !== "undefined" ? performance.now() : 0);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.root}>
      <div className={styles.brainWrap}>
        <div className="absolute left-4 top-3.5 z-[2] flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Zap className="size-3" />
          Hover a node to trace connections
        </div>
        <div className="absolute right-4 top-3.5 z-[2] text-right">
          <b className="font-mono text-[15px] text-primary tabular-nums">{nodeCount}</b>
          <span className="block text-[10.5px] text-muted-foreground/70">connected entities</span>
        </div>
        <canvas ref={canvasRef} className={styles.brainCanvas} />
        <div className="absolute bottom-3.5 left-4 flex flex-wrap gap-x-3 gap-y-1.5" style={{ maxWidth: "70%" }}>
          {BRAIN_TYPES.map((t) => (
            <span key={t.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <i className="size-2 rounded-full" style={{ background: `var(${t.varName})` }} />
              {t.label}
            </span>
          ))}
        </div>
        <div ref={tipRef} className={styles.brainTip} />
      </div>
      <Heading level={6} as="h3" className="sr-only">
        Company knowledge graph
      </Heading>
    </div>
  );
}
