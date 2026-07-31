"use client";

import { Button } from "@/components/ui/button";

export function InteractiveStatesSection() {
  const states = [
    {
      label: "DEFAULT",
      className:
        "bg-card text-muted-foreground border border-border shadow-sm",
    },
    {
      label: "HOVER",
      className:
        "bg-muted text-foreground border border-border shadow-xs",
    },
    {
      label: "ACTIVE",
      className:
        "bg-primary text-primary-foreground border border-transparent shadow-xs",
    },
    {
      label: "FOCUS",
      className:
        "bg-card text-foreground border border-primary ring-2 ring-primary/20 ring-offset-1",
    },
    {
      label: "DISABLED",
      className:
        "bg-muted/50 text-muted-foreground/40 border border-border opacity-60 cursor-not-allowed",
    },
  ];

  return (
    <section id="states">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">14</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Interactive States — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            Hover elevates the shadow. Focus uses a colored ring. Active fills with accent.
          </p>
        </div>
      </div>

      {/* States grid */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {states.map((state) => (
          <div key={state.label} className="text-center">
            <Button
              variant="ghost"
              size="sm"
              className={`block w-full px-3 py-2 rounded-md text-xs font-medium mb-2 transition-all ${state.className}`}
              disabled={state.label === "DISABLED"}
            >
              Button
            </Button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/40">
              {state.label}
            </span>
          </div>
        ))}
      </div>

      {/* Code block */}
      <div className="bg-foreground border border-foreground/10 rounded-lg p-5 px-6 overflow-x-auto shadow-sm mt-4">
        <pre className="font-mono text-xs text-white/60 leading-[1.7] whitespace-pre">
          <span className="text-white/30">{"/* Light mode: hover increases shadow, not just background */"}</span>
          {"\n"}
          <span className="text-purple-300">{".btn"}</span>
          {" {\n"}
          {"  "}
          <span className="text-sky-300">{"background"}</span>
          {": "}
          <span className="text-green-300">{"var(--surface-1)"}</span>
          {"         "}
          <span className="text-white/30">{"/* white */"}</span>
          {"\n"}
          {"  "}
          <span className="text-sky-300">{"border"}</span>
          {": "}
          <span className="text-green-300">{"1px solid var(--border-strong)"}</span>
          {";\n"}
          {"  "}
          <span className="text-sky-300">{"box-shadow"}</span>
          {": "}
          <span className="text-green-300">{"var(--shadow-sm)"}</span>
          {"        "}
          <span className="text-white/30">{"/* always present */"}</span>
          {"\n}\n"}
          <span className="text-purple-300">{".btn:hover"}</span>
          {" {\n"}
          {"  "}
          <span className="text-sky-300">{"background"}</span>
          {": "}
          <span className="text-green-300">{"var(--surface-3)"}</span>
          {"         "}
          <span className="text-white/30">{"/* #ededf0 */"}</span>
          {"\n"}
          {"  "}
          <span className="text-sky-300">{"box-shadow"}</span>
          {": "}
          <span className="text-green-300">{"0 2px 4px rgba(0,0,0,.08)"}</span>
          {";\n}\n"}
          <span className="text-purple-300">{".btn:focus-visible"}</span>
          {" {\n"}
          {"  "}
          <span className="text-sky-300">{"border-color"}</span>
          {": "}
          <span className="text-green-300">{"var(--accent-mid)"}</span>
          {";\n"}
          {"  "}
          <span className="text-sky-300">{"box-shadow"}</span>
          {": "}
          <span className="text-green-300">{"0 0 0 3px rgba(91,33,182,.12), var(--shadow-sm)"}</span>
          {";\n}"}
        </pre>
      </div>
    </section>
  );
}
