export const DRAWING_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const DRAWING_MAX_UPLOAD_LABEL = "200MB";

export const ALLOWED_DRAWING_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/tif",
  "image/svg+xml",
  "image/webp",
  "application/acad",
  "application/dxf",
] as const;

const ALLOWED_DRAWING_EXTENSIONS = [".dwg", ".dxf"] as const;

export function isAllowedDrawingFileType(file: Pick<File, "name" | "type">): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    ALLOWED_DRAWING_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_DRAWING_MIME_TYPES)[number],
    ) ||
    ALLOWED_DRAWING_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  );
}

export function getDrawingUploadFileError(file: Pick<File, "name" | "size" | "type">): string | null {
  if (file.size > DRAWING_MAX_UPLOAD_BYTES) {
    return `File is too large. Drawings must be ${DRAWING_MAX_UPLOAD_LABEL} or smaller.`;
  }

  if (!isAllowedDrawingFileType(file)) {
    return "File type not allowed. Please upload PDF, PNG, JPEG, TIFF, SVG, WEBP, DWG, or DXF files.";
  }

  return null;
}
