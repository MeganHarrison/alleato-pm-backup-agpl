"use client";
/**
 * DesignViolationOverlay
 *
 * Dev-only design feedback tool. Two ways to flag issues:
 * 1. Right-click any element → context menu with violation types
 * 2. Click the 🎨 widget → panel with free-form feedback + recent violations
 *
 * Usage in layout.tsx (already done):
 *   {process.env.NODE_ENV === "development" && <DesignViolationOverlay />}
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/api-client";

type ViolationType =
  | "wrong_button" | "bg_white" | "card_trap" | "wrong_text_hierarchy"
  | "hardcoded_color" | "arbitrary_spacing" | "missing_token"
  | "wrong_component" | "inconsistent_pattern" | "other";

const VIOLATION_LABELS: Record<ViolationType, string> = {
  wrong_button:          "Wrong button style",
  bg_white:              "bg-card (use bg-card)",
  card_trap:             "Card trap",
  wrong_text_hierarchy:  "Wrong text hierarchy",
  hardcoded_color:       "Hardcoded color",
  arbitrary_spacing:     "Arbitrary spacing",
  missing_token:         "Missing design token",
  wrong_component:       "Wrong component used",
  inconsistent_pattern:  "Inconsistent pattern",
  other:                 "Other",
};

type ContextMenu = { x: number; y: number; selector: string; label: string } | null;
type Stats = { open: number; in_progress: number; fixed: number };
type Position = { x: number; y: number };
type Violation = {
  id: string;
  route: string;
  violation_type: string;
  element_description: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

const POS_KEY = "design-widget-pos";
// Disabled while the design feedback launcher is not part of the active QA workflow.
// Flip this to true to restore the launcher, panel, and right-click reporting.
const DESIGN_VIOLATION_OVERLAY_ENABLED = false;

function loadPos(): Position {
  if (typeof window === "undefined") return { x: 16, y: 700 };
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw) as Position;
  } catch {}
  return { x: 16, y: window.innerHeight - 52 };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DesignViolationOverlay() {
  if (!DESIGN_VIOLATION_OVERLAY_ENABLED) return null;

  return <DesignViolationOverlayContent />;
}

function DesignViolationOverlayContent() {
  const pathname = usePathname()!;
  const isMobile = useIsMobile();
  const [menu, setMenu] = useState<ContextMenu>(null);
  const [selected, setSelected] = useState<ViolationType[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<Stats>({ open: 0, in_progress: 0, fixed: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [pos, setPos] = useState<Position>({ x: 16, y: 700 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [panelNotes, setPanelNotes] = useState("");
  const [panelType, setPanelType] = useState<ViolationType>("other");
  const [panelSubmitting, setPanelSubmitting] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const isDragging = useRef(false);

  // Hydrate position after mount
  useEffect(() => { setPos(loadPos()); }, []);

  // Read viewport only on client to keep server render safe.
  useEffect(() => { setViewportHeight(window.innerHeight); }, []);

  const fetchStats = useCallback(async () => {
    try {
      const result = await apiFetch<{ violations?: Violation[] }>(
        "/api/dev/violations?status=open,in_progress,fixed",
      );
      const data = result?.violations;
      const s = { open: 0, in_progress: 0, fixed: 0 };
      const allViolations: Violation[] = [];
      for (const v of data ?? []) {
        if (v.status === "open") s.open++;
        else if (v.status === "in_progress") s.in_progress++;
        else if (v.status === "fixed") s.fixed++;
        allViolations.push(v);
      }
      setStats(s);
      setViolations(allViolations.slice(0, 20));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Drag handling — click fires on mouseUp if no drag occurred
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
      const newX = Math.max(0, Math.min(window.innerWidth - 40, dragRef.current.origX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.origY + dy));
      setPos({ x: newX, y: newY });
    };

    const onUp = () => {
      if (!isDragging.current) {
        // It was a click, not a drag — toggle panel
        setPanelOpen(prev => !prev);
        fetchStats();
      }
      if (dragRef.current) {
        setPos((p) => {
          try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
          return p;
        });
      }
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos, fetchStats]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!panelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        widgetRef.current && !widgetRef.current.contains(target)
      ) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  // Build a readable CSS selector for the right-clicked element
  function buildSelector(el: Element): string {
    if (el.id) return `#${el.id}`;
    const parts: string[] = [];
    let node: Element | null = el;
    for (let i = 0; i < 4 && node && node !== document.body; i++) {
      let part = node.tagName.toLowerCase();
      if (node.className && typeof node.className === "string") {
        const first = node.className.trim().split(/\s+/)[0];
        if (first) part += `.${first}`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function buildLabel(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim().slice(0, 40) || "";
    const cls = typeof el.className === "string"
      ? el.className.trim().split(/\s+/).slice(0, 2).join(" ")
      : "";
    return `${tag}${text ? ` "${text}"` : ""}${cls ? ` [${cls}]` : ""}`;
  }

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if (isMobile) return;
      const target = e.target as Element;
      if (
        menuRef.current?.contains(target) ||
        widgetRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) return;
      e.preventDefault();
      setPanelOpen(false);
      setMenu({
        x: Math.min(e.clientX, window.innerWidth - 320),
        y: Math.min(e.clientY, window.innerHeight - 420),
        selector: buildSelector(target),
        label: buildLabel(target),
      });
      setSelected([]);
      setNotes("");
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        setPanelOpen(false);
      }
    }
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobile]);

  function toggleType(type: ViolationType) {
    setSelected(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleSubmit() {
    if (selected.length === 0 || !menu) return;
    setSubmitting(true);
    try {
      await Promise.all(selected.map(type =>
        apiFetch("/api/dev/violations", {
          method: "POST",
          body: JSON.stringify({
            route: pathname,
            elementDescription: menu.label,
            elementSelector: menu.selector,
            violationType: type,
            notes: notes.trim() || null,
          }),
        })
      ));
      setMenu(null);
      setToast(`${selected.length} violation${selected.length > 1 ? "s" : ""} flagged`);
      setTimeout(() => setToast(null), 3000);
      fetchStats();
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePanelSubmit() {
    if (!panelNotes.trim()) return;
    setPanelSubmitting(true);
    try {
      await apiFetch("/api/dev/violations", {
        method: "POST",
        body: JSON.stringify({
          route: pathname,
          elementDescription: null,
          elementSelector: null,
          violationType: panelType,
          notes: panelNotes.trim(),
        }),
      });
      setPanelNotes("");
      setPanelType("other");
      setToast("Violation flagged");
      setTimeout(() => setToast(null), 3000);
      fetchStats();
    } catch {
      // Silent — keep user's notes to retry
    } finally {
      setPanelSubmitting(false);
    }
  }

  const totalBadge = stats.open + stats.in_progress;

  if (isMobile) return null;

  // Position panel relative to widget
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    maxHeight: "60vh",
    // Place panel above widget if near bottom, below if near top
    ...(pos.y > 400
      ? { bottom: Math.max(8, viewportHeight - pos.y + 8), left: pos.x }
      : { top: pos.y + 40, left: pos.x }),
  };

  return (
    <>
      {/* Draggable icon widget */}
      <div
        ref={widgetRef}
        className="fixed"
        style={{ left: pos.x, top: pos.y, zIndex: 9998 }}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onMouseDown={handleMouseDown}
          title="Click to open panel, right-click any element to flag violations"
          className="relative rounded-full border-border bg-background text-foreground shadow-sm hover:bg-muted cursor-grab active:cursor-grabbing select-none"
        >
          <span className="text-base leading-none">🎨</span>
          {totalBadge > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </Button>
      </div>

      {/* Panel (opens on click) */}
      {panelOpen && (
        <div
          ref={panelRef}
          className="w-80 bg-background border border-border rounded-xl shadow-sm overflow-hidden flex flex-col"
          style={panelStyle}
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎨</span>
              <span className="text-xs font-semibold text-foreground">Design Violations</span>
              {totalBadge > 0 && (
                <span className="bg-destructive/10 text-destructive text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {totalBadge} open
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPanelOpen(false)}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              ×
            </Button>
          </div>

          {/* Quick flag form */}
          <div className="px-4 py-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono truncate flex-1">
                {pathname}
              </span>
            </div>
            <textarea
              placeholder="Describe the design issue..."
              value={panelNotes}
              onChange={e => setPanelNotes(e.target.value)}
              className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <select
                aria-label="Violation type"
                value={panelType}
                onChange={e => setPanelType(e.target.value as ViolationType)}
                className="flex-1 text-[11px] bg-background border border-input rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:border-ring"
              >
                {(Object.entries(VIOLATION_LABELS) as [ViolationType, string][]).map(([type, label]) => (
                  <option key={type} value={type}>{label}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handlePanelSubmit}
                disabled={!panelNotes.trim() || panelSubmitting}
                className="h-8 px-3 text-xs font-medium disabled:cursor-not-allowed"
              >
                {panelSubmitting ? "..." : "Flag"}
              </Button>
            </div>
          </div>

          {/* Hint */}
          <div className="px-4 py-2 border-b border-border/50">
            <p className="text-[10px] text-muted-foreground">
              Tip: Right-click any element to flag it with its CSS selector auto-captured.
            </p>
          </div>

          {/* Recent violations */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {violations.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No violations flagged yet.
              </div>
            ) : (
              violations.map(v => (
                <div key={v.id} className="px-4 py-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-foreground leading-snug line-clamp-2">
                        {v.notes || v.element_description || v.violation_type}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {v.route}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(v.created_at)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        v.status === "fixed"
                          ? "bg-primary/10 text-primary"
                          : v.status === "in_progress"
                          ? "bg-muted text-muted-foreground"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-sm"
          style={{ zIndex: 9999 }}
        >
          ✓ {toast}
        </div>
      )}

      {/* Right-click context menu */}
      {menu && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setMenu(null)} />
          <div
            ref={menuRef}
            className="fixed w-72 bg-background border border-border rounded-xl shadow-sm overflow-hidden"
            style={{ left: menu.x, top: menu.y, zIndex: 9999 }}
          >
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-border bg-muted/50">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">🎨</span>
                <span className="text-xs font-semibold text-foreground">Flag design violation</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate">{menu.label}</p>
            </div>

            {/* Violation type checkboxes */}
            <div className="px-3 py-2 grid grid-cols-1 gap-0.5 max-h-52 overflow-y-auto">
              {(Object.entries(VIOLATION_LABELS) as [ViolationType, string][]).map(([type, label]) => (
                <label
                  key={type}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(type)}
                    onChange={() => toggleType(type)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <span className="text-xs text-foreground">{label}</span>
                </label>
              ))}
            </div>

            {/* Notes */}
            <div className="px-3 pb-2 border-t border-border pt-2">
              <textarea
                placeholder="Notes (optional)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-[11px] bg-background border border-input rounded-md px-2 py-1.5 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="px-3 pb-3 flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSubmit}
                disabled={selected.length === 0 || submitting}
                className="h-8 flex-1 px-3 text-xs font-medium disabled:cursor-not-allowed"
              >
                {submitting ? "Flagging..." : `Flag${selected.length > 0 ? ` (${selected.length})` : ""}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMenu(null)}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
