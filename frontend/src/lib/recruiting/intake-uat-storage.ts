type StorageError = { message: string } | null;

type UatStorageBucket = {
  upload: (
    path: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: false },
  ) => Promise<{ error: StorageError }>;
  list: (
    folder: string,
    options: { limit: number; search: string },
  ) => Promise<{ data: Array<{ name: string }> | null; error: StorageError }>;
};

export async function ensureUatResumeObject({
  bucket,
  storagePath,
  bytes,
  contentType,
}: {
  bucket: UatStorageBucket;
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<"uploaded" | "existing"> {
  const upload = await bucket.upload(storagePath, bytes, {
    contentType,
    upsert: false,
  });
  if (!upload.error) return "uploaded";

  const separator = storagePath.lastIndexOf("/");
  const folder = storagePath.slice(0, separator);
  const fileName = storagePath.slice(separator + 1);
  const existing = await bucket.list(folder, { limit: 1, search: fileName });
  if (
    !existing.error &&
    existing.data?.some((item) => item.name === fileName)
  ) {
    return "existing";
  }

  throw new Error("The file could not be placed in quarantine.");
}
