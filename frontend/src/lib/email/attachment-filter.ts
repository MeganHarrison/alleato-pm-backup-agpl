const DECORATIVE_IMAGE_EXT = /\.(png|jpe?g|gif|bmp|webp|svg)$/i;

const DECORATIVE_NAME_PATTERNS: RegExp[] = [
  /^image\d*\.(png|jpe?g|gif|bmp|webp)$/i,
  /^outlook-/i,
  /^inky-injection-inliner-/i,
  /^(image|logo|icon|signature|facebook|linkedin|twitter|instagram|youtube)\d*[\W_]*\.(png|jpe?g|gif|bmp|webp|svg)$/i,
  /^[\d_-]+\.(png|jpe?g|gif|bmp|webp)$/,
  /^cid:/i,
];

const SMALL_IMAGE_BYTES = 30_000;

export interface AttachmentFilterInput {
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  checksumSha256: string | null;
  createdAt: string | null;
}

export function isDecorativeAttachment(attachment: AttachmentFilterInput): boolean {
  const contentType = (attachment.contentType ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) return false;

  const name = (attachment.fileName ?? "").trim();

  if (DECORATIVE_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return true;
  }

  const size = attachment.fileSize ?? 0;
  if (size > 0 && size < SMALL_IMAGE_BYTES && DECORATIVE_IMAGE_EXT.test(name)) {
    return true;
  }

  return false;
}

export function dedupeAttachmentsByChecksum<T extends AttachmentFilterInput>(
  attachments: T[],
): T[] {
  const seen = new Map<string, T>();
  const passthrough: T[] = [];

  for (const attachment of attachments) {
    const checksum = attachment.checksumSha256;
    if (!checksum) {
      passthrough.push(attachment);
      continue;
    }
    const existing = seen.get(checksum);
    if (!existing) {
      seen.set(checksum, attachment);
      continue;
    }
    const existingTime = existing.createdAt ? Date.parse(existing.createdAt) : 0;
    const incomingTime = attachment.createdAt ? Date.parse(attachment.createdAt) : 0;
    if (incomingTime > existingTime) {
      seen.set(checksum, attachment);
    }
  }

  return [...seen.values(), ...passthrough];
}

export function filterEmailAttachments<T extends AttachmentFilterInput>(
  attachments: T[],
): T[] {
  const meaningful = attachments.filter((attachment) => !isDecorativeAttachment(attachment));
  return dedupeAttachmentsByChecksum(meaningful);
}
