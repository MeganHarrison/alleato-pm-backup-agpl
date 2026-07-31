import type {
  KnowledgeGraph, KnowledgeNode, KnowledgeNodeType, KnowledgeRelationship,
  KnowledgeRelationshipType,
} from "./graph-types";

/**
 * Deterministic, realistic mock knowledge graph for a construction PM company.
 * Seeded so server and client render identical data (no hydration drift) and so
 * tests are stable. Replaced by `graph-transformers.ts` output once live.
 */

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const NODE_COUNTS: Record<KnowledgeNodeType, number> = {
  meeting: 15, email: 20, teams_message: 14, document: 12, drawing: 10, task: 12,
  rfi: 8, submittal: 6, change_event: 8, decision: 10, risk: 6, opportunity: 5,
};

const PROJECTS = [
  "Meridian Office", "Aurora Cold Storage", "Pinnacle Logistics", "Redstone Fulfillment",
  "Cedar Ridge", "Gateway Distribution", "Northgate DC",
];

const SOURCE: Record<KnowledgeNodeType, string> = {
  meeting: "Fireflies", email: "Outlook", teams_message: "Microsoft Teams", document: "SharePoint",
  drawing: "Bluebeam", task: "Alleato PM", rfi: "Procore", submittal: "Procore",
  change_event: "Procore", decision: "Alleato AI", risk: "Alleato AI", opportunity: "Alleato AI",
};

const BASES: Record<KnowledgeNodeType, string[]> = {
  meeting: ["Owner Coordination", "OAC Weekly", "Preconstruction Kickoff", "Design Review", "Field Coordination", "Budget Review", "MEP Coordination", "Schedule Pull Plan", "Commissioning Kickoff"],
  email: ["ESFR sprinkler submittal", "Switchgear lead time", "RFI-042 response", "Change proposal PCO-018", "Insurance certificate", "Slab pour sequence", "Buyout log update", "Permit status", "Roofing alternate", "Long-lead equipment"],
  teams_message: ["Dock leveler question", "Concrete finish note", "Delivery reschedule", "Punchlist photo", "Inspection heads-up", "Crane pick window", "Submittal reminder", "RFI nudge"],
  document: ["Subcontract Exhibit", "RFP Addendum", "Insurance Certificate", "Buyout Log", "Bid Tabulation", "Geotech Report", "Scope Narrative", "Schedule Narrative"],
  drawing: ["A-201 Floor Plan", "S-500 Details", "FP-100 Sprinkler", "E-300 Power Plan", "M-400 Mechanical", "P-200 Plumbing", "C-100 Civil", "A-401 Sections"],
  task: ["Submit RFI", "Chase COI", "Update schedule", "Route submittal", "Send buyout", "Confirm delivery", "Log change event", "Prep OAC agenda"],
  rfi: ["Dock leveler embed", "Sprinkler head spacing", "Slab depression", "Switchgear clearance", "Roof curb detail", "Door hardware set"],
  submittal: ["ESFR sprinkler heads", "Structural steel", "Switchgear", "Roofing system", "Overhead doors"],
  change_event: ["Added entry canopy", "Switchgear upsize", "ESFR conversion", "Slab phasing revision", "Added dock positions", "Site utility relocation"],
  decision: ["Switch to ESFR", "Phase the slab pour", "Accept alt roofing", "Self-perform concrete", "Approve PCO-018", "Delay switchgear buyout"],
  risk: ["Long-lead switchgear", "Weather delay", "Permit hold", "ESFR water supply"],
  opportunity: ["Add-alt canopy", "Early completion bonus", "Self-perform concrete", "Value-engineer roofing"],
};

const SUMMARY: Record<KnowledgeNodeType, string> = {
  meeting: "Coordination discussion captured and transcribed; action items and decisions extracted automatically.",
  email: "Correspondence parsed for commitments, dates, and change signals, then linked to the relevant project record.",
  teams_message: "Chat thread analyzed for questions, approvals, and field updates worth preserving.",
  document: "Document ingested and embedded; key clauses and references indexed for retrieval.",
  drawing: "Sheet OCR'd and cross-referenced against submittals, RFIs, and prior revisions.",
  task: "Action item generated from source activity and assigned with a due date.",
  rfi: "Request for information tracked against the drawing set and answered scope.",
  submittal: "Submittal logged and monitored for schedule and procurement impact.",
  change_event: "Potential scope/cost/schedule change detected from communications with supporting evidence.",
  decision: "Decision recorded with its rationale and the records it was derived from.",
  risk: "Risk surfaced from patterns across meetings, email, and schedule signals.",
  opportunity: "Opportunity identified where scope, timing, or self-perform could add value.",
};

export function aiInterpretation(type: KnowledgeNodeType): string {
  const map: Partial<Record<KnowledgeNodeType, string>> = {
    meeting: "This meeting is the origin of several decisions and downstream tasks. The AI connected it to an open RFI mentioned verbally but never logged — closing a knowledge gap.",
    decision: "This decision was derived from an owner meeting and an email thread, and it generated two tasks. It also impacts a change event with cost exposure.",
    rfi: "This RFI references a drawing and, once answered, drove a change event. The AI linked it to the meeting where it was first raised.",
    drawing: "A revision to this sheet caused a change event and is referenced by two RFIs. The AI flagged a downstream schedule impact.",
    change_event: "This change event traces back to a drawing revision and an owner decision. The AI connected it to a cost-exposure risk.",
    risk: "This risk was inferred from repeated mentions across email and meetings before it was formally logged — the kind of pattern humans miss.",
    email: "This email supports a decision and hints at a schedule change. The AI linked it to the meeting and the affected submittal.",
  };
  return map[type] ?? "The AI connected this record to related activity across projects, preserving context that would otherwise be lost.";
}

const REL_RULES: Array<[KnowledgeNodeType, KnowledgeNodeType, KnowledgeRelationshipType, number]> = [
  ["meeting", "decision", "generated", 12],
  ["decision", "task", "generated", 12],
  ["email", "decision", "supports", 9],
  ["rfi", "drawing", "references", 8],
  ["drawing", "change_event", "caused", 6],
  ["change_event", "risk", "impacts", 6],
  ["submittal", "change_event", "impacts", 4],
  ["meeting", "rfi", "resolved", 5],
  ["task", "meeting", "derived_from", 6],
  ["email", "risk", "related_to", 5],
  ["change_event", "opportunity", "related_to", 3],
  ["document", "decision", "supports", 5],
  ["teams_message", "task", "generated", 6],
  ["risk", "meeting", "related_to", 4],
];

export function buildMockKnowledgeGraph(seed = 20260718): KnowledgeGraph {
  const rng = makeRng(seed);
  const referenceDate = new Date();
  referenceDate.setUTCHours(12, 0, 0, 0);
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];

  const nodes: KnowledgeNode[] = [];
  const byType: Record<string, KnowledgeNode[]> = {};
  let n = 0;

  (Object.keys(NODE_COUNTS) as KnowledgeNodeType[]).forEach((type, ci) => {
    byType[type] = [];
    for (let i = 0; i < NODE_COUNTS[type]; i++) {
      const base = BASES[type][i % BASES[type].length];
      const project = PROJECTS[(i + ci) % PROJECTS.length];
      const createdAt = new Date(referenceDate);
      createdAt.setUTCDate(createdAt.getUTCDate() - ((i * 3 + ci) % 21));
      const node: KnowledgeNode = {
        id: `${type}-${i}`,
        type,
        title: `${base} — ${project}`,
        summary: SUMMARY[type],
        projectId: `p-${(i + ci) % PROJECTS.length}`,
        projectName: project,
        sourceSystem: SOURCE[type],
        sourceRecordId: `${type.toUpperCase()}-${1000 + n}`,
        createdAt: createdAt.toISOString(),
        relationshipCount: 0,
        importance: 0.4 + rng() * 0.6,
        confidence: 0.7 + rng() * 0.3,
      };
      nodes.push(node);
      byType[type].push(node);
      n++;
    }
  });

  const nodeById: Record<string, KnowledgeNode> = {};
  nodes.forEach((nd) => { nodeById[nd.id] = nd; });

  const relationships: KnowledgeRelationship[] = [];
  let r = 0;
  const addRel = (a: KnowledgeNode, b: KnowledgeNode, type: KnowledgeRelationshipType) => {
    if (a.id === b.id) return;
    relationships.push({
      id: `rel-${r++}`, sourceNodeId: a.id, targetNodeId: b.id, type,
      strength: 0.4 + rng() * 0.6, confidence: 0.6 + rng() * 0.4, createdAt: a.createdAt,
    });
    a.relationshipCount++; b.relationshipCount++;
  };

  REL_RULES.forEach(([from, to, type, count]) => {
    const src = byType[from]; const dst = byType[to];
    if (!src?.length || !dst?.length) return;
    for (let k = 0; k < count; k++) addRel(pick(src), pick(dst), type);
  });

  // guarantee every node has at least one relationship
  nodes.forEach((nd) => {
    if (nd.relationshipCount === 0) {
      const other = pick(nodes.filter((x) => x.type !== nd.type));
      addRel(nd, other, "related_to");
    }
  });

  return { nodes, relationships };
}
