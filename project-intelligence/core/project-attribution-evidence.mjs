const SHAREPOINT_FOLDER_PATTERN = /\/(?:04\s*-\s*Estimate|05\s*-\s*Proposal)(?:\/|$)/i;
const JOB_FOLDER_PATTERN = /(?:^|\/)(\d{2})\s*-\s*(\d{3})\s*(?:-\s*)?([^/()]+?)\s*\(([^,()]+),\s*([A-Za-z]{2})\)(?=\/|$)/;
const PROJECT_ENTITY_PATTERN = /\b([A-Z][A-Za-z0-9&'.-]+(?:\s+[A-Z][A-Za-z0-9&'.-]+){0,4}\s+(?:Town\s+Center|Town\s+Centre|Collective|Development|Village|Commons|Campus|Warehouse|Apartments))\b/g;

const STATE_NAMES = new Map([
  ["AL", "alabama"], ["AK", "alaska"], ["AZ", "arizona"], ["AR", "arkansas"],
  ["CA", "california"], ["CO", "colorado"], ["CT", "connecticut"], ["DE", "delaware"],
  ["FL", "florida"], ["GA", "georgia"], ["HI", "hawaii"], ["ID", "idaho"],
  ["IL", "illinois"], ["IN", "indiana"], ["IA", "iowa"], ["KS", "kansas"],
  ["KY", "kentucky"], ["LA", "louisiana"], ["ME", "maine"], ["MD", "maryland"],
  ["MA", "massachusetts"], ["MI", "michigan"], ["MN", "minnesota"], ["MS", "mississippi"],
  ["MO", "missouri"], ["MT", "montana"], ["NE", "nebraska"], ["NV", "nevada"],
  ["NH", "new hampshire"], ["NJ", "new jersey"], ["NM", "new mexico"], ["NY", "new york"],
  ["NC", "north carolina"], ["ND", "north dakota"], ["OH", "ohio"], ["OK", "oklahoma"],
  ["OR", "oregon"], ["PA", "pennsylvania"], ["RI", "rhode island"], ["SC", "south carolina"],
  ["SD", "south dakota"], ["TN", "tennessee"], ["TX", "texas"], ["UT", "utah"],
  ["VT", "vermont"], ["VA", "virginia"], ["WA", "washington"], ["WV", "west virginia"],
  ["WI", "wisconsin"], ["WY", "wyoming"],
]);

export function normalizeProjectIdentity(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sharePointEvidencePath(row = {}) {
  return String(row.source_path ?? row.file_path ?? "").trim();
}

export function parseSharePointJobPath(value) {
  const sourcePath = String(value ?? "").trim();
  if (!sourcePath || !SHAREPOINT_FOLDER_PATTERN.test(sourcePath)) return null;
  const match = sourcePath.match(JOB_FOLDER_PATTERN);
  const evidenceKind = /\/04\s*-\s*Estimate(?:\/|$)/i.test(sourcePath) ? "estimate" : "proposal";
  if (!match) return { sourcePath, evidenceKind, jobNumber: null, projectName: null, city: null, state: null };
  return {
    sourcePath,
    evidenceKind,
    jobNumber: `${match[1]}-${match[2]}`,
    projectName: match[3].replace(/\s+/g, " ").trim(),
    city: match[4].replace(/\s+/g, " ").trim(),
    state: match[5].toUpperCase(),
  };
}

function addUnique(set, value) {
  const normalized = normalizeProjectIdentity(value);
  if (normalized) set.add(normalized);
}

export function buildSharePointAttributionIndex(rows = [], projects = []) {
  const projectsById = new Map(
    projects
      .map((project) => [Number(project.id), project])
      .filter(([id]) => Number.isInteger(id) && id > 0),
  );
  const profilesByProjectId = new Map();
  const rejected = [];
  const linkageConflicts = [];
  let eligibleRows = 0;

  for (const row of rows) {
    const parsed = parseSharePointJobPath(sharePointEvidencePath(row));
    if (!parsed) continue;
    eligibleRows += 1;
    const folderName = normalizeProjectIdentity(parsed.projectName);
    const folderJobNumber = String(parsed.jobNumber ?? "").toLowerCase();
    const folderMatches = projects.filter((project) => {
      const projectName = normalizeProjectIdentity(project.name);
      const projectNumber = String(project.projectNumber ?? project.project_number ?? "").toLowerCase();
      return (folderName && projectName === folderName) || (folderJobNumber && projectNumber === folderJobNumber);
    });
    const rowProjectId = Number(row.project_id);
    const canonicalProject = folderMatches.length === 1 ? folderMatches[0] : null;
    const projectId = Number(canonicalProject?.id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      rejected.push({
        id: row.id ?? null,
        sourcePath: parsed.sourcePath,
        reason: folderMatches.length > 1
          ? "folder identity ambiguously matches multiple registered projects"
          : "folder identity does not match one registered project",
      });
      continue;
    }
    if (Number.isInteger(rowProjectId) && rowProjectId > 0 && rowProjectId !== projectId) {
      linkageConflicts.push({
        id: row.id ?? null,
        sourcePath: parsed.sourcePath,
        linkedProjectId: rowProjectId,
        folderProjectId: projectId,
      });
    }
    const profile = profilesByProjectId.get(projectId) ?? {
      projectId,
      projectName: canonicalProject?.name ?? row.project ?? parsed.projectName ?? null,
      projectNumber: canonicalProject?.projectNumber ?? canonicalProject?.project_number ?? parsed.jobNumber ?? null,
      aliases: new Set(),
      jobNumbers: new Set(),
      locations: new Map(),
      documents: [],
    };
    addUnique(profile.aliases, profile.projectName);
    addUnique(profile.aliases, row.project);
    addUnique(profile.aliases, parsed.projectName);
    if (parsed.jobNumber) profile.jobNumbers.add(parsed.jobNumber.toLowerCase());
    if (profile.projectNumber) profile.jobNumbers.add(String(profile.projectNumber).toLowerCase());
    if (parsed.city || parsed.state) {
      const key = `${normalizeProjectIdentity(parsed.city)}|${String(parsed.state ?? "").toUpperCase()}`;
      profile.locations.set(key, {
        city: parsed.city,
        state: parsed.state,
        stateName: STATE_NAMES.get(parsed.state) ?? null,
      });
    }
    profile.documents.push({
      id: row.id ?? null,
      title: row.title ?? row.file_name ?? null,
      kind: parsed.evidenceKind,
      sourcePath: parsed.sourcePath,
      sourceUrl: row.source_web_url ?? null,
      sourceLastModifiedAt: row.source_last_modified_at ?? row.created_at ?? null,
    });
    profilesByProjectId.set(projectId, profile);
  }

  if (profilesByProjectId.size === 0) {
    throw new Error(
      `SharePoint attribution evidence unavailable: ${eligibleRows} proposal/estimate rows were found but zero project identity profiles could be built. ` +
        "Restore SharePoint metadata ingestion or project_id linkage before publishing Project Intelligence.",
    );
  }

  const profiles = [...profilesByProjectId.values()].map((profile) => ({
    ...profile,
    aliases: [...profile.aliases],
    jobNumbers: [...profile.jobNumbers],
    locations: [...profile.locations.values()],
    documents: profile.documents.sort((left, right) => String(left.sourcePath).localeCompare(String(right.sourcePath))),
  }));
  return {
    profiles,
    byProjectId: new Map(profiles.map((profile) => [profile.projectId, profile])),
    receipt: {
      status: "complete",
      enumeratedRows: rows.length,
      eligibleRows,
      acceptedRows: profiles.reduce((total, profile) => total + profile.documents.length, 0),
      projectProfiles: profiles.length,
      rejectedRows: rejected.length,
      rejected,
      linkageConflicts,
      profiles: profiles.map((profile) => ({
        projectId: profile.projectId,
        projectName: profile.projectName,
        projectNumber: profile.projectNumber,
        locations: profile.locations,
        documents: profile.documents,
      })),
    },
  };
}

function includesWholeIdentity(haystack, identity) {
  const normalized = ` ${normalizeProjectIdentity(haystack)} `;
  const needle = normalizeProjectIdentity(identity);
  return needle.length >= 5 && normalized.includes(` ${needle} `);
}

function profileNamedInText(profile, text) {
  return profile.aliases.some((alias) => includesWholeIdentity(text, alias)) ||
    profile.jobNumbers.some((jobNumber) => includesWholeIdentity(text, jobNumber));
}

function displayEvidence(profile) {
  if (!profile) return [];
  return profile.documents.map((document) => ({
    kind: document.kind,
    title: document.title,
    sourcePath: document.sourcePath,
    sourceUrl: document.sourceUrl,
  }));
}

export function extractProjectEntities(source = {}) {
  const entities = new Map();
  const lines = `${source.title ?? ""}\n${String(source.text ?? "").slice(0, 120_000)}`.split(/\r?\n/);
  for (const line of lines) {
    for (const match of line.matchAll(PROJECT_ENTITY_PATTERN)) {
      const label = match[1].replace(/\s+/g, " ").trim().replace(/^The\s+/i, "");
      const normalized = normalizeProjectIdentity(label);
      if (!normalized) continue;
      const existing = entities.get(normalized) ?? { label, normalized, count: 0 };
      existing.count += 1;
      entities.set(normalized, existing);
    }
  }
  return [...entities.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function entityStemAppearsInTitle(entity, title) {
  const suffixes = new Set(["town", "center", "centre", "collective", "development", "village", "commons", "campus", "warehouse", "apartments"]);
  const tokens = entity.normalized.split(" ").filter((token) => !suffixes.has(token));
  if (tokens.length === 0) return false;
  const stem = tokens.slice(0, Math.min(2, tokens.length)).join(" ");
  return includesWholeIdentity(title, stem);
}

function profileMatchesEntity(profile, entity) {
  return profile.aliases.some((alias) => alias === entity.normalized) ||
    profile.aliases.some((alias) => alias.includes(entity.normalized) || entity.normalized.includes(alias));
}

function knownProfileNamedInTitle(title, profiles) {
  const matches = profiles.filter((profile) => profileNamedInText(profile, title));
  return matches.length === 1 ? matches[0] : null;
}

export function applySharePointAttributionEvidence(sources = [], index) {
  if (!index?.byProjectId || index.receipt?.status !== "complete") {
    throw new Error("SharePoint attribution evidence unavailable: compiler received no complete evidence index.");
  }
  const corrections = [];
  const unresolvedConflicts = [];
  const unverifiedSources = [];
  const profiles = index.profiles ?? [...index.byProjectId.values()];

  for (const source of sources) {
    const assignedProjectId = Number(source.projectId);
    const assignedProfile = Number.isInteger(assignedProjectId) ? index.byProjectId.get(assignedProjectId) : null;
    const titleMatch = knownProfileNamedInTitle(source.title ?? "", profiles);

    if (titleMatch && titleMatch.projectId !== assignedProjectId) {
      const correction = {
        alias: source.alias,
        title: source.title,
        from: { projectId: source.projectId ?? null, projectName: source.projectName ?? null },
        to: { projectId: titleMatch.projectId, projectName: titleMatch.projectName },
        reason: "SharePoint proposal/estimate identity matches the source title",
        evidence: displayEvidence(titleMatch),
      };
      source.projectId = titleMatch.projectId;
      source.projectName = titleMatch.projectName;
      source.attributionCorrected = true;
      source.attributionStatus = "confirmed_by_sharepoint";
      source.attributionEvidence = correction.evidence;
      corrections.push(correction);
      continue;
    }

    if (!assignedProfile) {
      const entities = extractProjectEntities(source);
      const assignedIdentity = normalizeProjectIdentity(source.projectName);
      const titleSupportsAssignment = assignedIdentity && includesWholeIdentity(source.title ?? "", assignedIdentity);
      const conflictingEntity = entities.find(
        (entity) =>
          entity.normalized !== assignedIdentity &&
          !entity.normalized.includes(assignedIdentity) &&
          !assignedIdentity.includes(entity.normalized) &&
          entityStemAppearsInTitle(entity, source.title ?? ""),
      );
      if (titleSupportsAssignment) {
        source.attributionStatus = "source_title_confirmed_no_sharepoint_profile";
        source.attributionEvidence = [];
      } else if (source.projectId != null && assignedIdentity && conflictingEntity) {
        const conflict = {
          alias: source.alias,
          title: source.title,
          assigned: { projectId: source.projectId, projectName: source.projectName ?? null },
          resolvedLabel: conflictingEntity.label,
          reason: "source names a different development and no SharePoint proposal/estimate profile supports the assigned project",
          evidence: [],
        };
        source.projectId = null;
        source.projectName = conflictingEntity.label;
        source.attributionLabel = conflictingEntity.label;
        source.attributionCorrected = true;
        source.attributionStatus = "unresolved_conflict";
        source.attributionEvidence = [];
        corrections.push({
          alias: conflict.alias,
          title: conflict.title,
          from: conflict.assigned,
          to: { projectId: null, projectName: conflict.resolvedLabel },
          reason: conflict.reason,
          evidence: [],
        });
        unresolvedConflicts.push(conflict);
      } else {
        if (source.projectId == null) {
          const sourceEntity = entities.length === 1 ? entities[0] : null;
          source.projectName = sourceEntity?.label ?? source.projectName ?? null;
          source.attributionLabel = sourceEntity?.label ?? source.attributionLabel ?? null;
          source.attributionStatus = sourceEntity ? "unregistered_entity" : "unassigned";
          source.attributionEvidence = [];
        } else {
          const unverified = {
            alias: source.alias,
            title: source.title,
            assigned: { projectId: source.projectId, projectName: source.projectName ?? null },
            reason: "assigned project has no SharePoint proposal/estimate profile and the source title does not confirm the assignment",
          };
          source.projectId = null;
          source.projectName = null;
          source.attributionCorrected = true;
          source.attributionStatus = "unverified_no_sharepoint_profile";
          source.attributionEvidence = [];
          corrections.push({
            alias: unverified.alias,
            title: unverified.title,
            from: unverified.assigned,
            to: { projectId: null, projectName: null },
            reason: unverified.reason,
            evidence: [],
          });
          unverifiedSources.push(unverified);
        }
      }
      continue;
    }

    const entities = extractProjectEntities(source);
    const sourceText = `${source.title ?? ""}\n${source.text ?? ""}`;
    const sourceSupportsAssignment = profileNamedInText(assignedProfile, sourceText);
    const conflictingEntity = entities.find((entity) =>
      !profileMatchesEntity(assignedProfile, entity) &&
      (entityStemAppearsInTitle(entity, source.title ?? "") || (entities.length === 1 && !sourceSupportsAssignment)),
    );
    const titleSupportsAssignment = profileNamedInText(assignedProfile, source.title ?? "");

    if (!titleSupportsAssignment && conflictingEntity) {
      const evidence = displayEvidence(assignedProfile);
      const conflict = {
        alias: source.alias,
        title: source.title,
        assigned: { projectId: source.projectId, projectName: source.projectName ?? assignedProfile.projectName },
        resolvedLabel: conflictingEntity.label,
        reason: "source names a different development that conflicts with the assigned project's SharePoint proposal/estimate identity",
        evidence,
      };
      source.projectId = null;
      source.projectName = conflictingEntity.label;
      source.attributionLabel = conflictingEntity.label;
      source.attributionCorrected = true;
      source.attributionStatus = "unresolved_conflict";
      source.attributionEvidence = evidence;
      corrections.push({
        alias: conflict.alias,
        title: conflict.title,
        from: conflict.assigned,
        to: { projectId: null, projectName: conflict.resolvedLabel },
        reason: conflict.reason,
        evidence,
      });
      unresolvedConflicts.push(conflict);
      continue;
    }

    if (!sourceSupportsAssignment) {
      const evidence = displayEvidence(assignedProfile);
      const unverified = {
        alias: source.alias,
        title: source.title,
        assigned: { projectId: source.projectId, projectName: source.projectName ?? assignedProfile.projectName },
        reason: "source does not name the assigned project's SharePoint proposal/estimate identity",
        evidence,
      };
      source.projectId = null;
      source.projectName = null;
      source.attributionCorrected = true;
      source.attributionStatus = "unverified_against_sharepoint_profile";
      source.attributionEvidence = evidence;
      corrections.push({
        alias: unverified.alias,
        title: unverified.title,
        from: unverified.assigned,
        to: { projectId: null, projectName: null },
        reason: unverified.reason,
        evidence,
      });
      unverifiedSources.push(unverified);
      continue;
    }

    source.attributionStatus = titleSupportsAssignment ? "confirmed_by_sharepoint" : "sharepoint_profile_available";
    source.attributionEvidence = displayEvidence(assignedProfile);
  }

  const unsafe = sources.filter(
    (source) => source.attributionStatus === "unresolved_conflict" && source.projectId != null,
  );
  if (unsafe.length) {
    throw new Error(
      `Unsafe project attribution remains for ${unsafe.map((source) => source.alias).join(", ")}. ` +
        "Resolve or de-attribute every SharePoint identity conflict before publication.",
    );
  }

  return {
    receipt: {
      ...index.receipt,
      evaluatedSources: sources.length,
      corrections: corrections.length,
      unresolvedConflicts: unresolvedConflicts.length,
      unverifiedSources: unverifiedSources.length,
    },
    corrections,
    unresolvedConflicts,
    unverifiedSources,
  };
}

export async function fetchSharePointAttributionRows(client) {
  if (!client?.query) throw new Error("SharePoint attribution evidence requires a database client.");
  const { rows } = await client.query(`
    select
      id,
      project_id,
      project,
      title,
      file_name,
      source_path,
      file_path,
      source_web_url,
      source_system,
      source_last_modified_at,
      created_at
    from public.document_metadata
    where deleted_at is null
      and (
        coalesce(source_path, file_path, '') ilike '%estimate%'
        or coalesce(source_path, file_path, '') ilike '%proposal%'
      )
    order by project_id asc, coalesce(source_path, file_path, '') asc, id asc
  `);
  return rows;
}
