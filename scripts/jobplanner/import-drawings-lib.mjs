export function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeName(value, fallback = "Untitled") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function inferFileType(fileName, contentType = null) {
  const normalizedContentType = String(contentType ?? "").trim().toLowerCase();
  if (normalizedContentType) return normalizedContentType;

  const normalizedFileName = String(fileName ?? "").trim().toLowerCase();
  if (normalizedFileName.endsWith(".pdf")) return "application/pdf";
  if (normalizedFileName.endsWith(".png")) return "image/png";
  if (normalizedFileName.endsWith(".jpg") || normalizedFileName.endsWith(".jpeg")) return "image/jpeg";
  if (normalizedFileName.endsWith(".tif") || normalizedFileName.endsWith(".tiff")) return "image/tiff";

  return "application/octet-stream";
}

export function normalizeRevisionName(version) {
  const normalized = String(version?.name ?? "").trim();
  if (normalized) return normalized;
  if (version?.versionId != null) return `Version ${version.versionId}`;
  return "Version";
}

export function normalizeRevisionCode(version) {
  const versionId = Number(version?.versionId);
  if (Number.isInteger(versionId) && versionId > 0) {
    return `JP${versionId}`;
  }

  const normalized = String(version?.name ?? "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 10);

  return normalized || "JPREV";
}

export function buildDrawingSetKey(version) {
  return `${normalizeRevisionName(version)}::${normalizeDate(version?.issuedOn) ?? ""}`;
}

export function buildDrawingNaturalKey(drawingNumber) {
  return String(drawingNumber ?? "").trim().toLowerCase();
}

export function getRevisionSortValue(version, drawing) {
  const issuedAt = Date.parse(drawing?.issuedOn ?? version?.issuedOn ?? "");
  if (!Number.isNaN(issuedAt)) return issuedAt;

  const createdAt = Date.parse(drawing?.createdOn ?? version?.createdOn ?? "");
  if (!Number.isNaN(createdAt)) return createdAt;

  return Number(version?.versionId ?? 0);
}

export function pickCurrentRevision(versions, drawingNumber) {
  const candidates = [];

  for (const version of versions) {
    for (const drawing of version?.drawings ?? []) {
      if (buildDrawingNaturalKey(drawing?.name) !== buildDrawingNaturalKey(drawingNumber)) continue;
      candidates.push({
        version,
        drawing,
        sortValue: getRevisionSortValue(version, drawing),
      });
    }
  }

  candidates.sort((a, b) => b.sortValue - a.sortValue);
  return candidates[0] ?? null;
}
