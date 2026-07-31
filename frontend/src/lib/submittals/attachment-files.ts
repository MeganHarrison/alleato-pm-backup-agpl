export type PendingAttachmentFileInfo = {
  name: string;
  size: number;
  type: string;
};

export type PendingAttachmentEntry = {
  file: File;
  info: PendingAttachmentFileInfo;
};

export function toPendingAttachmentInfo(file: File): PendingAttachmentFileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export function toPendingAttachmentEntry(file: File): PendingAttachmentEntry {
  return {
    file,
    info: toPendingAttachmentInfo(file),
  };
}

export function getPendingAttachmentKey(info: PendingAttachmentFileInfo): string {
  return `${info.name}:${info.size}:${info.type}`;
}

export function reconcilePendingAttachmentEntries(
  currentEntries: PendingAttachmentEntry[],
  nextInfos: PendingAttachmentFileInfo[],
): PendingAttachmentEntry[] {
  const remainingByKey = new Map<string, number>();

  nextInfos.forEach((info) => {
    const key = getPendingAttachmentKey(info);
    remainingByKey.set(key, (remainingByKey.get(key) ?? 0) + 1);
  });

  return currentEntries.filter((entry) => {
    const key = getPendingAttachmentKey(entry.info);
    const remaining = remainingByKey.get(key) ?? 0;
    if (remaining <= 0) {
      return false;
    }
    remainingByKey.set(key, remaining - 1);
    return true;
  });
}
