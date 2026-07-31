import type { PipelineDoc } from "@/features/documents/documents-table-config";

export type PreviewKind = "pdf" | "image" | "office" | "text" | "none";

function extensionOf(doc: PipelineDoc): string {
  const source = doc.title ?? doc.file_path ?? doc.url ?? "";
  const match = source.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
  return match ? match[1] : "";
}

export function pipelineDocInlineHref(doc: PipelineDoc): string {
  return `/api/files/${doc.id}/download?disposition=inline`;
}

export function pipelineDocPreviewKind(doc: PipelineDoc): PreviewKind {
  const ext = extensionOf(doc);
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (["txt", "md", "csv"].includes(ext)) return "text";
  return "none";
}

export function pipelineDocIsGraphSourced(doc: PipelineDoc): boolean {
  return doc.source_system === "microsoft_graph";
}
