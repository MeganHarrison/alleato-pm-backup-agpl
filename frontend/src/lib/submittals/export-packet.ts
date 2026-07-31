import { PDFDocument, PageSizes } from "pdf-lib";

export const COVER_SHEET_EXPORT_ITEM = "cover-sheet";

type PacketKind = "pdf" | "png" | "jpeg";

export interface SubmittalExportPacketPart {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
}

function normalizePacketItemId(value: string): string {
  return value.trim();
}

export function parseSelectedSubmittalExportItems(
  searchParams: URLSearchParams,
): string[] {
  const seen = new Set<string>();
  const selected = searchParams
    .getAll("item")
    .map(normalizePacketItemId)
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });

  return selected.length > 0 ? selected : [COVER_SHEET_EXPORT_ITEM];
}

function inferPacketKind({
  fileName,
  mimeType,
}: Pick<SubmittalExportPacketPart, "fileName" | "mimeType">): PacketKind | null {
  const normalizedMime = mimeType?.toLowerCase().trim() ?? "";
  if (normalizedMime === "application/pdf") return "pdf";
  if (normalizedMime === "image/png") return "png";
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") {
    return "jpeg";
  }

  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith(".pdf")) return "pdf";
  if (normalizedName.endsWith(".png")) return "png";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "jpeg";
  }

  return null;
}

export function isPdfPacketPartSupported(
  part: Pick<SubmittalExportPacketPart, "fileName" | "mimeType">,
): boolean {
  return inferPacketKind(part) !== null;
}

export function buildSubmittalExportFilename({
  submittalNumber,
  title,
}: {
  submittalNumber: string | number | null | undefined;
  title: string | null | undefined;
}): string {
  const numberPart = String(submittalNumber ?? "submittal")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const titlePart = (title ?? "export")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${numberPart || "submittal"}-${titlePart || "export"}.pdf`;
}

async function appendPdfPart(
  merged: PDFDocument,
  bytes: Uint8Array,
): Promise<void> {
  const source = await PDFDocument.load(bytes);
  const pages = await merged.copyPages(source, source.getPageIndices());
  for (const page of pages) {
    merged.addPage(page);
  }
}

async function appendImagePart(
  merged: PDFDocument,
  part: SubmittalExportPacketPart,
  kind: Extract<PacketKind, "png" | "jpeg">,
): Promise<void> {
  const page = merged.addPage(PageSizes.Letter);
  const image =
    kind === "png"
      ? await merged.embedPng(part.bytes)
      : await merged.embedJpg(part.bytes);

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const margin = 24;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(
    maxWidth / image.width,
    maxHeight / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  });
}

export async function mergeSubmittalExportPacket(
  parts: SubmittalExportPacketPart[],
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  for (const part of parts) {
    const kind = inferPacketKind(part);
    if (!kind) {
      throw new Error(
        `Attachment "${part.fileName}" cannot be included in a PDF packet. Supported types: PDF, PNG, JPG, JPEG.`,
      );
    }

    if (kind === "pdf") {
      await appendPdfPart(merged, part.bytes);
      continue;
    }

    await appendImagePart(merged, part, kind);
  }

  return merged.save();
}
