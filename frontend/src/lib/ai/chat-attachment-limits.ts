export const MAX_CHAT_FILE_PARTS = 12;
export const MAX_CHAT_IMAGE_PARTS = 8;

const SUPPORTED_CHAT_IMAGE_MEDIA_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Vercel Functions reject request bodies above 4.5 MB before application code
// runs. Three million decoded bytes become four million base64 characters,
// leaving transport headroom for JSON, text, and message metadata.
export const MAX_CHAT_INLINE_FILE_BYTES = 3_000_000;
export const MAX_CHAT_REQUEST_BYTES = 4_400_000;

export function isSupportedChatImageMediaType(
  mediaType: string | undefined,
): boolean {
  return (
    typeof mediaType === "string" &&
    SUPPORTED_CHAT_IMAGE_MEDIA_TYPES.has(mediaType.toLowerCase())
  );
}

export function estimateBase64PayloadBytes(payload: string): number {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function estimateBase64DataUrlBytes(url: string): number {
  const marker = ";base64,";
  const markerIndex = url.indexOf(marker);
  if (!url.startsWith("data:") || markerIndex === -1) return 0;
  return estimateBase64PayloadBytes(url.slice(markerIndex + marker.length));
}