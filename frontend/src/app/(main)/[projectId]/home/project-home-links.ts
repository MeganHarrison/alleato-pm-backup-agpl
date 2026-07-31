import type { Database } from "@/types/database.types";

export type ProjectHomeLinkDocument = Pick<
  Database["public"]["Tables"]["project_documents"]["Row"],
  | "id"
  | "title"
  | "file_name"
  | "category"
  | "created_at"
  | "description"
  | "document_type"
  | "content_type"
  | "file_url"
  | "source_system"
  | "source_web_url"
>;

function isHttpUrl(value: string | null | undefined): value is string {
  return /^https?:\/\//i.test(value ?? "");
}

function searchableDocumentText(doc: ProjectHomeLinkDocument): string {
  return [
    doc.title,
    doc.file_name,
    doc.description,
    doc.category,
    doc.document_type,
    doc.content_type,
    doc.source_system,
    doc.source_web_url,
    doc.file_url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getDateMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function getProjectHomeLinks(
  documents: ProjectHomeLinkDocument[],
): ProjectHomeLinkDocument[] {
  const siteFootageTerms = [
    "drone",
    "flight",
    "footage",
    "video",
    "site walk",
    "walkthrough",
    "jobsite",
    "job site",
    "blocking",
    "in wall",
    "in-wall",
  ];

  return documents
    .filter((doc) => isHttpUrl(doc.source_web_url) || isHttpUrl(doc.file_url))
    .sort((a, b) => {
      const aText = searchableDocumentText(a);
      const bText = searchableDocumentText(b);
      const aPriority = siteFootageTerms.some((term) => aText.includes(term)) ? 1 : 0;
      const bPriority = siteFootageTerms.some((term) => bText.includes(term)) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return getDateMs(b.created_at) - getDateMs(a.created_at);
    });
}

export function getProjectHomeLinkHref(doc: ProjectHomeLinkDocument): string {
  if (isHttpUrl(doc.source_web_url)) return doc.source_web_url;
  if (isHttpUrl(doc.file_url)) return doc.file_url;
  return "#";
}

export function getProjectHomeLinkKind(
  doc: ProjectHomeLinkDocument,
): "video" | "link" {
  const text = searchableDocumentText(doc);
  return /\b(video|drone|flight|footage|walkthrough)\b/.test(text)
    ? "video"
    : "link";
}
