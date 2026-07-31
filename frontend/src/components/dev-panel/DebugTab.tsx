"use client";

import * as React from "react";

import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ConsoleEntry {
  id: number;
  message: string;
  timestamp: number;
  type: "error" | "warning" | "info";
}

export interface NetworkEntry {
  id: number;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
}

interface Props {
  consoleEntries: ConsoleEntry[];
  networkEntries: NetworkEntry[];
  onClearConsole: () => void;
  onClearNetwork: () => void;
}

type Panel = "console" | "network";

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function StatusPill({ status }: { status: number }) {
  const color =
    status === 0 ? "bg-muted text-muted-foreground" :
    status < 300 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
    status < 400 ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
    status < 500 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
    "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-bold", color)}>
      {status === 0 ? "ERR" : status}
    </span>
  );
}

export function DebugTab({ consoleEntries, networkEntries, onClearConsole, onClearNetwork }: Props) {
  const [panel, setPanel] = React.useState<Panel>("console");

  const errorCount = consoleEntries.filter((e) => e.type === "error").length;
  const failCount  = networkEntries.filter((e) => e.status >= 400 || e.status === 0).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab toggle */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3 py-1.5">
        <div className="flex items-center gap-0.5">
          {([
            { id: "console" as Panel, label: "Console", count: errorCount },
            { id: "network" as Panel, label: "Network", count: failCount },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPanel(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                panel === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className="rounded-full bg-red-100 px-1 text-[9px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={panel === "console" ? onClearConsole : onClearNetwork}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Console ── */}
        {panel === "console" && (
          consoleEntries.length === 0 ? (
            <Empty>No console errors captured.</Empty>
          ) : (
            <div className="divide-y divide-border/30">
              {consoleEntries.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    "px-3 py-2",
                    e.type === "error" ? "bg-red-50/50 dark:bg-red-950/20" :
                    e.type === "warning" ? "bg-amber-50/50 dark:bg-amber-950/20" : "",
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold",
                      e.type === "error" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                      e.type === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                      "bg-muted text-muted-foreground",
                    )}>
                      {e.type}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">{timeLabel(e.timestamp)}</span>
                  </div>
                  <p className="font-mono text-[11px] text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                    {e.message}
                  </p>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Network ── */}
        {panel === "network" && (
          networkEntries.length === 0 ? (
            <Empty>No API calls captured yet.</Empty>
          ) : (
            <div className="divide-y divide-border/30">
              {networkEntries.map((e) => (
                <div key={e.id} className={cn("px-3 py-2", (e.status >= 400 || e.status === 0) ? "bg-red-50/50 dark:bg-red-950/20" : "")}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                      {e.method}
                    </span>
                    <StatusPill status={e.status} />
                    <span className="text-[10px] text-muted-foreground">{e.duration}ms</span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">{timeLabel(e.timestamp)}</span>
                  </div>
                  <p className="font-mono text-[11px] text-foreground/80 break-all">{e.url}</p>
                  {e.error && (
                    <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">{e.error}</p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
