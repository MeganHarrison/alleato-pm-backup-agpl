const ALLOWED_HEALTH = new Set(["on_track", "watch", "at_risk", "critical", "unknown"]);
const PROJECT_RECORD_BATCH = 5;

export function groupSourcesByProject(sources) {
  const byProject = new Map();
  for (const source of sources) {
    const projectId = Number(source.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0 || !source.projectName) continue;
    if (!byProject.has(projectId)) {
      byProject.set(projectId, { projectId, projectName: source.projectName });
    }
  }
  return Array.from(byProject.values());
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 8);
}

export function normalizeProjectRecord(raw, projectId, projectName) {
  const health = String(raw?.healthStatus ?? "unknown").toLowerCase().trim();
  return {
    projectId,
    projectName,
    healthStatus: ALLOWED_HEALTH.has(health) ? health : "unknown",
    whatChanged: String(raw?.whatChanged ?? "").trim(),
    needsAttention: normalizeStringArray(raw?.needsAttention),
    openDecisions: normalizeStringArray(raw?.openDecisions),
    activeRisks: normalizeStringArray(raw?.activeRisks),
    financialRead: String(raw?.financialRead ?? "").trim(),
    scheduleRead: String(raw?.scheduleRead ?? "").trim(),
    fieldRead: String(raw?.fieldRead ?? "").trim(),
    confidence: typeof raw?.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : null,
  };
}

function parseProjectRecordsJson(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function extractProjectRecords({
  sources,
  detailedReport,
  businessDate,
  modelCall,
  batchSize = PROJECT_RECORD_BATCH,
}) {
  if (typeof modelCall !== "function") throw new Error("extractProjectRecords requires modelCall.");
  const grouped = groupSourcesByProject(sources);
  if (!grouped.length) return [];
  const records = [];
  for (let index = 0; index < grouped.length; index += batchSize) {
    const batch = grouped.slice(index, index + batchSize);
    const byName = new Map(batch.map((project) => [project.projectName.toLowerCase(), project]));
    const content = await modelCall(
      [
        {
          role: "system",
          content:
            "You assess construction project operating health from source notes and return STRUCTURED JSON. Return ONLY a JSON object of the form " +
            '{"records":[{"projectName":"...","healthStatus":"on_track|watch|at_risk|critical|unknown","whatChanged":"...","needsAttention":["..."],"openDecisions":["..."],"activeRisks":["..."],"financialRead":"...","scheduleRead":"...","fieldRead":"...","confidence":0.0}]} ' +
            "— one record per project in the input, using the project's EXACT projectName. Ground every field in the provided sources; NEVER invent, and NEVER paste raw email/transcript text — write concise owner-grade phrases. If a dimension has no evidence use an empty string or empty array. Use healthStatus 'unknown' when evidence is too thin to judge. Keep each list item to one short clause.",
        },
        {
          role: "user",
          content: JSON.stringify({ businessDate, projects: batch, detailedExecutiveReport: detailedReport }, null, 2),
        },
      ],
      2600,
    );
    const rawRecords = parseProjectRecordsJson(content)?.records;
    for (const raw of Array.isArray(rawRecords) ? rawRecords : []) {
      const match = byName.get(String(raw?.projectName ?? "").toLowerCase().trim());
      if (match) records.push(normalizeProjectRecord(raw, match.projectId, match.projectName));
    }
  }
  return records;
}

export function assertProjectRecordCoverage(sources, brief, projectRecords) {
  const activeProjects = new Map();
  for (const source of sources) {
    const projectId = Number(source.projectId);
    if (Number.isInteger(projectId) && projectId > 0 && source.projectName) {
      activeProjects.set(projectId, source.projectName);
    }
  }
  const briefNames = new Set((brief?.projects || []).map((project) => String(project?.name || "").trim().toLowerCase()));
  const recordIds = new Set((projectRecords || []).map((record) => Number(record.projectId)));
  const missingRecords = [];
  const missingBriefProjects = [];
  for (const [projectId, projectName] of activeProjects) {
    if (!briefNames.has(String(projectName).trim().toLowerCase())) missingBriefProjects.push({ projectId, projectName });
    if (projectRecords && !recordIds.has(projectId)) missingRecords.push({ projectId, projectName });
  }
  if (missingRecords.length || missingBriefProjects.length) {
    throw new Error(
      `Daily Deep Read project coverage failure: active projects=${activeProjects.size}; ` +
        `missing project records=${JSON.stringify(missingRecords)}; ` +
        `missing brief project blocks=${JSON.stringify(missingBriefProjects)}. ` +
        "Refusing to write a packet until every active project has both outputs.",
    );
  }
  return { activeProjects: activeProjects.size, projectRecords: recordIds.size, briefProjects: briefNames.size };
}

export function assertBriefProjectCoverage(sources, brief) {
  return assertProjectRecordCoverage(sources, brief, null);
}

export { ALLOWED_HEALTH, PROJECT_RECORD_BATCH };
