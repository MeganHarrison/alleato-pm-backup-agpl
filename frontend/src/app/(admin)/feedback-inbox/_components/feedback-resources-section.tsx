"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  FileText,
  Image,
  Link2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Input } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { ADMIN_FEEDBACK_BUCKET } from "@/lib/admin-feedback/constants";
import { apiFetch } from "@/lib/api-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";

import type { FeedbackItem, FeedbackResource } from "../types";

type UploadSlot = {
  path: string;
  token: string;
  contentType: string;
  maxBytes: number;
  resource: FeedbackResource;
};

function resourcesFromMetadata(metadata: Record<string, unknown>): FeedbackResource[] {
  const resources = metadata.resources;
  if (!Array.isArray(resources)) return [];

  return resources.flatMap((resource) => {
    if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
      return [];
    }
    const row = resource as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      (row.kind !== "file" && row.kind !== "link") ||
      typeof row.label !== "string" ||
      typeof row.url !== "string" ||
      typeof row.createdAt !== "string"
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        kind: row.kind,
        label: row.label,
        url: row.url,
        path: typeof row.path === "string" ? row.path : null,
        fileName: typeof row.fileName === "string" ? row.fileName : null,
        mimeType: typeof row.mimeType === "string" ? row.mimeType : null,
        sizeBytes: typeof row.sizeBytes === "number" ? row.sizeBytes : null,
        createdAt: row.createdAt,
        createdBy: typeof row.createdBy === "string" ? row.createdBy : null,
      },
    ];
  });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function defaultLabelForUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Related link";
  }
}

function resourceIcon(resource: FeedbackResource) {
  if (resource.kind === "link") return Link2;
  if (resource.mimeType?.startsWith("image/")) return Image;
  return FileText;
}

export function FeedbackResourcesSection({
  item,
  onResourcesChanged,
}: {
  item: FeedbackItem;
  onResourcesChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const resources = useMemo(
    () => resourcesFromMetadata(item.metadata),
    [item.metadata],
  );

  async function addFiles(files: FileList | File[]) {
    const fileList = Array.from(files).filter((file) => file.size > 0);
    if (fileList.length === 0) return;

    setIsUploading(true);
    const failures: string[] = [];
    try {
      const supabase = createSupabaseClient();
      for (const file of fileList) {
        try {
          const slot = await apiFetch<UploadSlot>(
            `/api/admin/feedback/${item.id}/resources`,
            {
              method: "POST",
              body: JSON.stringify({
                action: "create-upload",
                fileName: file.name,
                contentType: file.type || "application/octet-stream",
                sizeBytes: file.size,
              }),
            },
          );
          const { error } = await supabase.storage
            .from(ADMIN_FEEDBACK_BUCKET)
            .uploadToSignedUrl(slot.path, slot.token, file, {
              contentType: slot.contentType,
              upsert: false,
            });
          if (error) {
            throw new Error(error.message);
          }

          await apiFetch<{ resources: FeedbackResource[] }>(
            `/api/admin/feedback/${item.id}/resources`,
            {
              method: "POST",
              body: JSON.stringify({
                action: "commit-upload",
                resource: {
                  ...slot.resource,
                  label: file.name,
                },
              }),
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          failures.push(`${file.name}: ${message}`);
        }
      }

      if (failures.length > 0) {
        toast.error(`Some resources were not attached: ${failures.join("; ")}`);
      } else {
        toast.success(fileList.length === 1 ? "Resource attached" : "Resources attached");
      }
      onResourcesChanged();
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function addLink() {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) return;
    let normalizedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      await apiFetch<{ resources: FeedbackResource[] }>(
        `/api/admin/feedback/${item.id}/resources`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "add-link",
            label: linkLabel.trim() || defaultLabelForUrl(normalizedUrl),
            url: normalizedUrl,
          }),
        },
      );
      setLinkUrl("");
      setLinkLabel("");
      toast.success("Resource link added");
      onResourcesChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add resource link");
    }
  }

  async function removeResource(resourceId: string) {
    setDeletingId(resourceId);
    try {
      const result = await apiFetch<{ warning?: string | null }>(
        `/api/admin/feedback/${item.id}/resources`,
        {
          method: "DELETE",
          body: JSON.stringify({ resourceId }),
        },
      );
      if (result.warning) {
        toast.error(`Resource removed, but storage cleanup failed: ${result.warning}`);
      } else {
        toast.success("Resource removed");
      }
      onResourcesChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove resource");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  return (
    <section className="space-y-3">
      <SectionRuleHeading label="Resources" className="mb-0 pb-0" />

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="Paste URL"
          className="h-8 text-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addLink();
            }
          }}
        />
        <Input
          value={linkLabel}
          onChange={(event) => setLinkLabel(event.target.value)}
          placeholder="Label"
          className="h-8 text-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addLink();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => void addLink()}
          disabled={!linkUrl.trim()}
        >
          <Link2 className="h-3.5 w-3.5" />
          Add link
        </Button>
      </div>

      <div
        className={cn(
          "rounded-md border border-dashed border-border/80 px-3 py-3 transition-colors",
          isDragging && "border-primary/60 bg-primary/5",
        )}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">Drop files here or choose files</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Uploading" : "Choose files"}
          </Button>
        </div>
      </div>

      {resources.length > 0 ? (
        <div className="divide-y divide-border/60">
          {resources.map((resource) => {
            const Icon = resourceIcon(resource);
            const size = formatBytes(resource.sizeBytes);
            return (
              <div
                key={resource.id}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-foreground hover:text-primary hover:underline"
                  title={resource.url}
                >
                  {resource.label}
                </a>
                {size ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {size}
                  </span>
                ) : null}
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-status-error"
                  onClick={() => void removeResource(resource.id)}
                  disabled={deletingId === resource.id}
                  aria-label={`Remove ${resource.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
