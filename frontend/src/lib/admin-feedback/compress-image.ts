/**
 * Browser-side image compression for admin feedback screenshots.
 *
 * Why this exists: feedback screenshots are sent to /api/admin/feedback as
 * base64 data URLs inside the JSON body. Vercel serverless functions reject
 * request bodies larger than 4.5MB, so an un-capped full-page PNG (common on
 * data-heavy pages like Budget) silently fails the entire submission with a
 * generic "Could not submit feedback" toast.
 *
 * compressImageDataUrl downscales + re-encodes to JPEG until the resulting
 * data URL fits within a byte budget, so the POST body can never exceed the
 * platform limit. Pure canvas — no dependencies, client-only.
 */

// base64 inflates bytes by ~1.37x; keep the data URL well under the 4.5MB
// Vercel body limit so the rest of the JSON payload still fits comfortably.
const DEFAULT_MAX_BYTES = 3_000_000;
const DEFAULT_MAX_DIMENSION = 2000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode screenshot image"));
    img.src = src;
  });
}

export async function compressImageDataUrl(
  dataUrl: string,
  options: { maxBytes?: number; maxDimension?: number } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;

  // Already a JPEG within budget — nothing to do.
  if (dataUrl.startsWith("data:image/jpeg") && dataUrl.length <= maxBytes) {
    return dataUrl;
  }

  const img = await loadImage(dataUrl);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (!width || !height) {
    return dataUrl;
  }

  const initialScale = Math.min(1, maxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }

  const renderAt = (renderWidth: number, renderHeight: number, quality: number) => {
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, renderWidth, renderHeight);
    ctx.drawImage(img, 0, 0, renderWidth, renderHeight);
    return canvas.toDataURL("image/jpeg", quality);
  };

  let quality = 0.85;
  let out = renderAt(width, height, quality);

  // Drop quality first (cheap), then dimensions if still over budget.
  while (out.length > maxBytes && quality > 0.4) {
    quality -= 0.15;
    out = renderAt(width, height, quality);
  }

  while (out.length > maxBytes && Math.max(width, height) > 640) {
    width = Math.max(1, Math.round(width * 0.8));
    height = Math.max(1, Math.round(height * 0.8));
    out = renderAt(width, height, 0.6);
  }

  return out;
}
