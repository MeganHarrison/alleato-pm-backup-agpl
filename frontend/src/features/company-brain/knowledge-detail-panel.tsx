"use client";

import { ArrowUpRight, Sparkles, X } from "lucide-react";

import { Heading } from "@/components/ds";
import { CATEGORY_BY_TYPE, relationshipLabel } from "./lib/graph-colors";
import { aiInterpretation } from "./lib/mock-knowledge-data";
import type { KnowledgeNode } from "./lib/graph-types";
import type { KnowledgeGraphIndex } from "./hooks/use-knowledge-graph";
import styles from "./company-brain.module.css";

interface Props {
  node: KnowledgeNode | null;
  index: KnowledgeGraphIndex;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

function Clickable({ className, onActivate, children, label }: {
  className: string; onActivate: () => void; children: React.ReactNode; label?: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      className={className}
      onClick={onActivate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(); } }}
    >
      {children}
    </span>
  );
}

export function KnowledgeDetailPanel({ node, index, onClose, onSelectNode }: Props) {
  const cat = node ? CATEGORY_BY_TYPE[node.type] : null;
  const related = node
    ? (index.relationshipsByNode.get(node.id) ?? []).slice(0, 6).map((r) => {
        const otherId = r.sourceNodeId === node.id ? r.targetNodeId : r.sourceNodeId;
        return { other: index.nodeById.get(otherId), type: r.type };
      }).filter((x) => x.other)
    : [];

  return (
    <aside
      className={`${styles.drawer} ${node ? styles.drawerOpen : ""}`}
      aria-hidden={node ? "false" : "true"}
      aria-label="Record details"
    >
      {node && cat ? (
        <>
          <Clickable className={styles.close} onActivate={onClose} label="Close details">
            <X className="size-4" />
          </Clickable>
          <div className={styles.drawerPad}>
            <div className={styles.drawerType} style={{ color: `var(${cat.cssVar})` }}>
              <span className={styles.labelDot} style={{ background: `var(${cat.cssVar})`, color: `var(${cat.cssVar})` }} />
              {cat.singular}
            </div>
            <Heading level={4} as="h3" className={styles.drawerTitle}>{node.title}</Heading>
            <div className={styles.meta}>
              <span className={styles.metaLabel}>Source</span><span className={styles.metaVal}>{node.sourceSystem ?? "—"}</span>
              <span className={styles.metaLabel}>Project</span><span className={styles.metaVal}>{node.projectName ?? "—"}</span>
              <span className={styles.metaLabel}>Created</span><span className={styles.metaVal}>{formatDate(node.createdAt)}</span>
              <span className={styles.metaLabel}>Connections</span><span className={styles.metaVal}>{node.relationshipCount} records</span>
            </div>

            <div className={styles.sec}>
              <div className={styles.secLabel}>Overview</div>
              <p>{node.summary ?? "No summary available."}</p>
            </div>

            <div className={styles.sec}>
              <div className={styles.secLabel}>Connected knowledge</div>
              {related.length ? (
                <div className={styles.rel}>
                  {related.map(({ other, type }) => other ? (
                    <Clickable
                      key={other.id}
                      className={styles.relItem}
                      onActivate={() => onSelectNode(other.id)}
                      label={`Open ${other.title}`}
                    >
                      <span className={styles.relDot} style={{ background: `var(${CATEGORY_BY_TYPE[other.type].cssVar})` }} />
                      <span>{other.title}</span>
                      <span className={styles.relKind}>{relationshipLabel(type)}</span>
                    </Clickable>
                  ) : null)}
                </div>
              ) : (
                <p>No linked records yet.</p>
              )}
            </div>

            <div className={styles.sec}>
              <div className={styles.ai}>
                <div className={styles.aiHead}><Sparkles className="size-3.5" /> AI interpretation</div>
                <p>{aiInterpretation(node.type)}</p>
              </div>
            </div>

            <span
              className={styles.openPending}
              aria-disabled="true"
              title={`Opens in ${node.sourceSystem ?? "the source system"} once live data is connected`}
            >
              Open in {node.sourceSystem ?? "source"} <ArrowUpRight className="size-3.5" />
              <span className={styles.pendingNote}>· live data pending</span>
            </span>
          </div>
        </>
      ) : null}
    </aside>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
