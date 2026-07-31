"use client";

import { useCallback, useMemo, useState } from "react";

import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  WorkspacePageIntro,
  WorkspaceSection,
} from "@/app/(main)/ai-dashboard/workspace-primitives";
import { useKnowledgeGraph } from "./hooks/use-knowledge-graph";
import { useReducedMotion } from "./hooks/use-reduced-motion";
import { KnowledgeGraphCanvas, type HighlightState } from "./knowledge-graph-canvas";
import { KnowledgeDetailPanel } from "./knowledge-detail-panel";
import { TimeRangeFilter } from "./time-range-filter";
import type { KnowledgeNodeType, TimeRange } from "./lib/graph-types";
import styles from "./company-brain.module.css";

type Selection =
  | { kind: "node"; id: string }
  | { kind: "cluster"; type: KnowledgeNodeType }
  | { kind: "none" };

export function CompanyBrainExperience() {
  const reduced = useReducedMotion();

  const [timeRange, setTimeRange] = useState<TimeRange>("live");
  const index = useKnowledgeGraph(undefined, timeRange);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>({ kind: "none" });

  const searchMatchId = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const m = index.graph.nodes.find((n) =>
      `${n.title} ${n.projectName ?? ""} ${n.type}`.toLowerCase().includes(q),
    );
    return m ? m.id : null;
  }, [query, index.graph.nodes]);

  const highlight: HighlightState = useMemo(() => {
    if (selection.kind === "node") {
      const set = index.neighbors(selection.id);
      set.add(selection.id);
      return { nodeIds: set, type: null, searchId: null };
    }
    if (selection.kind === "cluster") return { nodeIds: null, type: selection.type, searchId: null };
    if (searchMatchId) return { nodeIds: null, type: null, searchId: searchMatchId };
    return { nodeIds: null, type: null, searchId: null };
  }, [selection, searchMatchId, index]);

  const drawerNode = selection.kind === "node" ? index.nodeById.get(selection.id) ?? null : null;

  const onSelectNode = useCallback((id: string) => setSelection({ kind: "node", id }), []);
  const onSelectCluster = useCallback((type: KnowledgeNodeType) =>
    setSelection((cur) => (cur.kind === "cluster" && cur.type === type ? { kind: "none" } : { kind: "cluster", type })), []);
  const onBackground = useCallback(() => { setSelection({ kind: "none" }); }, []);
  const onIngest = useCallback(() => undefined, []);

  const rangeDescription =
    timeRange === "live"
      ? "Live sample, counts below reflect the full company corpus."
      : `Showing ${index.graph.nodes.length} sampled records from the last ${timeRange}. Counts below reflect the full company corpus.`;
  const interactionHint = drawerNode
    ? `${drawerNode.title} is selected. Review its source and connected records in the detail panel.`
    : "Select a record or cluster to inspect its source and connected knowledge.";

  return (
    <div className={styles.root}>
      <WorkspacePageIntro
        eyebrow="AI & Intelligence"
        title="Company Brain"
        actions={
          <div className={styles.controls}>
          <ExpandableSearch value={query} onChange={setQuery} placeholder="Search meetings, RFIs, decisions…" />
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          </div>
        }
      >
        A living map of your company’s knowledge, continuously built from meetings,
        messages, documents, decisions, and project activity across every job.
      </WorkspacePageIntro>

      <WorkspaceSection className="mt-8 pt-0" showHeader={false}>
        <KnowledgeGraphCanvas
          index={index}
          reduced={reduced}
          timeRange={timeRange}
          highlight={highlight}
          onSelectNode={onSelectNode}
          onSelectCluster={onSelectCluster}
          onBackground={onBackground}
          onIngest={onIngest}
        >
          <KnowledgeDetailPanel
            node={drawerNode}
            index={index}
            onClose={onBackground}
            onSelectNode={onSelectNode}
          />
        </KnowledgeGraphCanvas>
        <div className={styles.contextLine} role="status">
          <p className={styles.hint}>{rangeDescription}</p>
          <p className={styles.hint}>{interactionHint}</p>
        </div>
        {query.trim() && !searchMatchId ? (
          <p className={styles.searchRecovery} role="status">
            No knowledge record matches that search. Try a project, source, or record type.
          </p>
        ) : null}
      </WorkspaceSection>
    </div>
  );
}
