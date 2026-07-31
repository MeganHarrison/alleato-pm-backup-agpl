// Parses the standalone Alleato Training Platform's data/resources.js — a
// browser global assignment (`window.ALLEATO_RESOURCES = {...}`), not an ES
// module — into a plain JS object, then normalizes it to the DB-locked shape
// in resources.schema.json.

export function extractWindowAssignedObject(sourceText, globalName) {
  const assignmentMarker = `window.${globalName} =`;
  const assignmentIndex = sourceText.indexOf(assignmentMarker);
  if (assignmentIndex === -1) {
    throw new Error(`Global 'window.${globalName}' not found in source text.`);
  }

  const braceStart = sourceText.indexOf("{", assignmentIndex);
  if (braceStart === -1) {
    throw new Error(`Global 'window.${globalName}' has no object literal after its assignment.`);
  }

  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;
  let braceEnd = -1;

  for (let index = braceStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        braceEnd = index + 1;
        break;
      }
    }
  }

  if (braceEnd === -1) {
    throw new Error(`Global 'window.${globalName}' object literal is not balanced (unterminated braces).`);
  }

  return JSON.parse(sourceText.slice(braceStart, braceEnd));
}

const TYPE_MAP = {
  video: "video",
  course: "course",
  doc: "doc",
  // The DB enum (training_resource_type) is locked to video|course|doc.
  // These three raw source types are all non-video, non-course written/audio
  // content, so they fold into 'doc'.
  article: "doc",
  reference: "doc",
  podcast: "doc",
};

export function mapResourceType(raw) {
  const mapped = TYPE_MAP[raw];
  if (!mapped) {
    throw new Error(`Unrecognized resource type '${raw}' — no mapping to the locked video|course|doc contract.`);
  }
  return mapped;
}

const LEVEL_MAP = {
  // The DB enum (training_resource_level) is locked to intro|deep-dive.
  all: "intro",
  deep: "deep-dive",
};

export function mapResourceLevel(raw) {
  const mapped = LEVEL_MAP[raw];
  if (!mapped) {
    throw new Error(`Unrecognized resource level '${raw}' — no mapping to the locked intro|deep-dive contract.`);
  }
  return mapped;
}

function normalizeItem(item) {
  const status = item.status;
  if (status !== "published" && status !== "review" && status !== "archived") {
    throw new Error(`Resource '${item.title}' (${item.id}) has unrecognized status '${status}'.`);
  }

  return {
    sourceId: item.id,
    title: item.title,
    description: item.note && item.note.trim() ? item.note.trim() : null,
    url: item.url,
    provider: item.source ?? null,
    topicSlug: item.topicId,
    roleSlugs: [...item.roles],
    type: mapResourceType(item.type),
    level: mapResourceLevel(item.level),
    track: item.track,
    status,
    publishedAt: status === "published" ? new Date(`${item.dateAdded}T00:00:00.000Z`).toISOString() : null,
    dateAdded: item.dateAdded,
  };
}

function countByStatus(resources) {
  return {
    total: resources.length,
    published: resources.filter((resource) => resource.status === "published").length,
    review: resources.filter((resource) => resource.status === "review").length,
    archived: resources.filter((resource) => resource.status === "archived").length,
  };
}

// training_resource.url is the unique/dedup boundary (see the ALL-17 "idempotent,
// keyed on URL" requirement). The real source turned out to contain one genuine
// duplicate (a re-added video with re-punctuated title). Silently keeping both
// would violate the DB's unique constraint; silently dropping one via a bare
// ON CONFLICT would hide it. So: dedupe here, keep the first occurrence, and
// report every drop in meta.duplicatesDropped instead.
function dedupeByUrl(resources) {
  const kept = [];
  const droppedByUrl = new Map();
  const seenUrls = new Map();

  for (const resource of resources) {
    const existing = seenUrls.get(resource.url);
    if (existing) {
      droppedByUrl.set(resource.url, {
        url: resource.url,
        keptSourceId: existing.sourceId,
        droppedSourceId: resource.sourceId,
        droppedTitle: resource.title,
      });
      continue;
    }
    seenUrls.set(resource.url, resource);
    kept.push(resource);
  }

  return { deduped: kept, duplicatesDropped: [...droppedByUrl.values()] };
}

export function buildNormalizedLibrary(parsedSource, { sourceFile = "unknown" } = {}) {
  const roles = parsedSource.roles.map((role) => ({ slug: role.id, name: role.name }));
  const topics = parsedSource.topics.map((topic) => ({ slug: topic.id, name: topic.name }));
  const rawResources = parsedSource.items.map(normalizeItem);
  const { deduped: resources, duplicatesDropped } = dedupeByUrl(rawResources);

  const counts = { ...countByStatus(resources), roles: roles.length, topics: topics.length };
  const rawCounts = countByStatus(rawResources);

  return {
    meta: { generatedAt: new Date(0).toISOString(), sourceFile, counts, rawCounts, duplicatesDropped },
    roles,
    topics,
    resources,
  };
}

export function validateResourceLibrary(library, { expectedCounts } = {}) {
  const errors = [];
  const topicSlugs = new Set((library.topics ?? []).map((topic) => topic.slug));
  const roleSlugs = new Set((library.roles ?? []).map((role) => role.slug));
  const seenUrls = new Map();

  for (const resource of library.resources ?? []) {
    if (!resource.url) {
      errors.push(`Resource '${resource.title ?? resource.sourceId ?? "?"}' has no url.`);
      continue;
    }
    if (seenUrls.has(resource.url)) {
      errors.push(`Duplicate url '${resource.url}' (first seen on '${seenUrls.get(resource.url)}', repeated on '${resource.title}').`);
    } else {
      seenUrls.set(resource.url, resource.title);
    }

    if (!topicSlugs.has(resource.topicSlug)) {
      errors.push(`Resource '${resource.title}' references unknown topic slug '${resource.topicSlug}'.`);
    }

    for (const roleSlug of resource.roleSlugs ?? []) {
      if (!roleSlugs.has(roleSlug)) {
        errors.push(`Resource '${resource.title}' references unknown role slug '${roleSlug}'.`);
      }
    }
  }

  const actualCounts = {
    ...countByStatus(library.resources ?? []),
    roles: (library.roles ?? []).length,
    topics: (library.topics ?? []).length,
  };

  if (expectedCounts) {
    for (const key of Object.keys(expectedCounts)) {
      if (actualCounts[key] !== expectedCounts[key]) {
        errors.push(`Count mismatch for '${key}': expected ${expectedCounts[key]}, got ${actualCounts[key]}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, counts: actualCounts };
}

function sqlJsonLiteral(value) {
  // Dollar-quoted so embedded quotes/backslashes in titles/descriptions never
  // need escaping; JSON itself never contains a literal '$seed_json$' token.
  return `$seed_json$${JSON.stringify(value)}$seed_json$`;
}

export function buildSeedMigrationSql(library) {
  const validation = validateResourceLibrary(library);
  if (!validation.valid) {
    throw new Error(`Cannot build seed migration from an invalid library: ${validation.errors.join("; ")}`);
  }

  const rolesJson = library.roles.map((role, index) => ({ slug: role.slug, name: role.name, sort_order: index }));
  const topicsJson = library.topics.map((topic, index) => ({ slug: topic.slug, name: topic.name, sort_order: index }));
  const resourcesJson = library.resources.map((resource) => ({
    topic_slug: resource.topicSlug,
    title: resource.title,
    description: resource.description,
    url: resource.url,
    provider: resource.provider,
    resource_type: resource.type,
    level: resource.level,
    track: resource.track,
    status: resource.status,
    published_at: resource.publishedAt,
    metadata: { sourceId: resource.sourceId, dateAdded: resource.dateAdded },
  }));
  const resourceRoleLinksJson = library.resources.flatMap((resource) =>
    resource.roleSlugs.map((roleSlug) => ({ url: resource.url, role_slug: roleSlug })),
  );

  return `-- Seed the learner-facing training resource library from the recovered
-- standalone Alleato Training Platform export (training-source/resources.js).
-- Idempotent: keyed on training_role.slug / training_topic.slug /
-- training_resource.url — safe to re-run.
--
-- Source counts: ${library.meta.counts.total} resources
-- (${library.meta.counts.published} published, ${library.meta.counts.review} review),
-- ${library.meta.counts.topics} topics, ${library.meta.counts.roles} roles.

begin;

insert into public.training_role (slug, name, sort_order)
select r.slug, r.name, r.sort_order
from jsonb_to_recordset(${sqlJsonLiteral(rolesJson)}::jsonb) as r(slug text, name text, sort_order integer)
on conflict (slug) do nothing;

insert into public.training_topic (slug, name, sort_order)
select t.slug, t.name, t.sort_order
from jsonb_to_recordset(${sqlJsonLiteral(topicsJson)}::jsonb) as t(slug text, name text, sort_order integer)
on conflict (slug) do nothing;

insert into public.training_resource (
  topic_id, title, description, url, provider, resource_type, level, track, status, published_at, cost, metadata
)
select
  topic.id,
  r.title,
  r.description,
  r.url,
  r.provider,
  r.resource_type::public.training_resource_type,
  r.level::public.training_resource_level,
  r.track,
  r.status::public.training_resource_status,
  r.published_at,
  'free',
  r.metadata
from jsonb_to_recordset(${sqlJsonLiteral(resourcesJson)}::jsonb) as r(
  topic_slug text, title text, description text, url text, provider text,
  resource_type text, level text, track text, status text,
  published_at timestamptz, metadata jsonb
)
join public.training_topic topic on topic.slug = r.topic_slug
on conflict (url) do nothing;

insert into public.training_resource_role (resource_id, role_id)
select resource.id, role.id
from jsonb_to_recordset(${sqlJsonLiteral(resourceRoleLinksJson)}::jsonb) as link(url text, role_slug text)
join public.training_resource resource on resource.url = link.url
join public.training_role role on role.slug = link.role_slug
on conflict (resource_id, role_id) do nothing;

commit;
`;
}
