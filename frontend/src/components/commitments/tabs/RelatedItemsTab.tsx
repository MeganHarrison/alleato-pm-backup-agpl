"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ds";
import { Text } from "@/components/ds/text";
import { Spinner } from "@/components/ui/spinner";
import { Stack } from "@/components/layout/stack";
import { SectionAction, SectionRuleHeading } from "@/components/layout";
import { StatusBadge } from "@/components/ds/status-badge";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { apiFetch } from "@/lib/api-client";

const RELATED_ITEM_TYPE_OPTIONS = [
  { value: "change_event", label: "Change Events" },
  { value: "rfi", label: "RFIs" },
  { value: "submittal", label: "Submittals" },
  { value: "drawing", label: "Drawings" },
  { value: "specification", label: "Specifications" },
] as const;

type RelatedItemType = (typeof RELATED_ITEM_TYPE_OPTIONS)[number]["value"];

function formatTypeLabel(type: string): string {
  const match = RELATED_ITEM_TYPE_OPTIONS.find((o) => o.value === type);
  if (match) return match.label.replace(/s$/, "");
  return type.replace(/_/g, " ");
}

interface RelatedItem {
  id: string;
  relatedType: string;
  relatedId: string;
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
  relatedUrl: string | null;
}

interface SearchOption {
  id: string;
  relatedNumber: string | null;
  relatedTitle: string;
}

interface RelatedItemsTabProps {
  commitmentId: string;
  projectId: number;
  commitmentType?: string;
  apiBasePath?: string;
  entityLabel?: string;
}

async function fetchSearchOptions(
  projectId: number,
  type: RelatedItemType,
  search: string,
): Promise<SearchOption[]> {
  const endpoints: Record<RelatedItemType, string> = {
    change_event: `/api/projects/${projectId}/change-events`,
    rfi: `/api/projects/${projectId}/rfis`,
    submittal: `/api/projects/${projectId}/submittals`,
    drawing: `/api/projects/${projectId}/drawings`,
    specification: `/api/projects/${projectId}/specifications`,
  };

  const url = `${endpoints[type]}${search ? `?search=${encodeURIComponent(search)}` : ""}`;

  try {
    const payload = await apiFetch<{ data?: unknown[] } | unknown[]>(url);
    const rows = Array.isArray(payload) ? payload : (payload as { data?: unknown[] }).data ?? [];

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ""),
      relatedNumber: row.number != null ? String(row.number) : (row.submittal_number != null ? String(row.submittal_number) : (row.drawing_number != null ? String(row.drawing_number) : (row.section_number != null ? String(row.section_number) : null))),
      relatedTitle: String(row.title ?? row.subject ?? row.section_title ?? ""),
    })).filter((o) => o.id && o.relatedTitle);
  } catch {
    return [];
  }
}

export function RelatedItemsTab({
  commitmentId,
  projectId,
  commitmentType = "subcontract",
  apiBasePath,
  entityLabel = "commitment",
}: RelatedItemsTabProps) {
  const resolvedApiBasePath = apiBasePath ?? `/api/commitments/${commitmentId}/related-items`;
  const [items, setItems] = useState<RelatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [linkType, setLinkType] = useState<RelatedItemType | "">("");
  const [linkSearch, setLinkSearch] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    try {
      const payload = await apiFetch<{ data?: RelatedItem[] }>(resolvedApiBasePath);
      setItems(payload?.data ?? []);
    } catch (error) {
      reportNonCriticalFailure({
        area: "commitment-related-items",
        operation: "load-related-items",
        error,
        userVisibleFallback: "Related items could not be loaded.",
        metadata: { commitmentId },
      });
    } finally {
      setIsLoading(false);
    }
  }, [resolvedApiBasePath]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!showDialog || !linkType) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setIsFetchingOptions(true);

    fetchSearchOptions(projectId, linkType, linkSearch).then((opts) => {
      if (!cancelled) {
        setOptions(opts);
        setIsFetchingOptions(false);
      }
    });

    return () => { cancelled = true; };
  }, [showDialog, linkType, linkSearch, projectId]);

  const resetDialog = useCallback(() => {
    setLinkType("");
    setLinkSearch("");
    setSelectedId("");
    setOptions([]);
  }, []);

  const handleLink = async () => {
    if (!linkType || !selectedId) return;

    setIsLinking(true);
    try {
      await apiFetch(resolvedApiBasePath, {
        method: "POST",
        body: JSON.stringify({
          relatedType: linkType,
          relatedId: selectedId,
          projectId,
          commitmentType,
        }),
      });

      toast.success("Related item linked");
      setShowDialog(false);
      void fetchItems();
    } catch (err) {
      toast.error("Failed to link item");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (itemId: string) => {
    setDeletingIds((prev) => new Set(prev).add(itemId));
    try {
      await apiFetch(`${resolvedApiBasePath}?id=${encodeURIComponent(itemId)}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Related item removed");
    } catch {
      toast.error("Failed to remove related item");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  return (
    <Stack gap="md">
      <SectionRuleHeading
        label="Related Items"
        actions={
          <SectionAction onClick={() => setShowDialog(true)}>
            <Link2 className="h-4 w-4" />
            Link Item
          </SectionAction>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length > 0 ? (
        <div className="divide-y divide-border rounded-md">
          {items.map((item) => {
            const isDeleting = deletingIds.has(item.id);
            const label = item.relatedNumber
              ? `${item.relatedNumber} — ${item.relatedTitle}`
              : item.relatedTitle;

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
              >
                <Badge variant="outline" className="shrink-0">
                  {formatTypeLabel(item.relatedType)}
                </Badge>
                {item.relatedStatus && (
                  <StatusBadge status={item.relatedStatus} />
                )}
                {item.relatedUrl ? (
                  <Link
                    href={item.relatedUrl}
                    className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isDeleting}
                  onClick={() => handleUnlink(item.id)}
                  aria-label="Remove related item"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title="No related items"
          description="Link related records such as RFIs, submittals, drawings, or change events."
        />
      )}

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Related Item</DialogTitle>
            <DialogDescription>
              Search for a record to link to this {entityLabel}.
            </DialogDescription>
          </DialogHeader>

          <Stack gap="md" className="py-2">
            <div>
              <Text size="sm" weight="medium" className="mb-1.5">Item Type</Text>
              <Select
                value={linkType}
                onValueChange={(v) => {
                  setLinkType(v as RelatedItemType);
                  setSelectedId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item type…" />
                </SelectTrigger>
                <SelectContent>
                  {RELATED_ITEM_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {linkType && (
              <div>
                <Text size="sm" weight="medium" className="mb-1.5">Search</Text>
                <Input
                  placeholder="Search by title or number…"
                  value={linkSearch}
                  onChange={(e) => {
                    setLinkSearch(e.target.value);
                    setSelectedId("");
                  }}
                />
              </div>
            )}

            {linkType && (
              <div>
                <Text size="sm" weight="medium" className="mb-1.5">Item</Text>
                <Select
                  value={selectedId}
                  onValueChange={setSelectedId}
                  disabled={isFetchingOptions || options.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isFetchingOptions ? "Loading…" : options.length === 0 ? "No results" : "Select an item…"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.relatedNumber ? `${o.relatedNumber} — ${o.relatedTitle}` : o.relatedTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Stack>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleLink}
              disabled={!linkType || !selectedId || isLinking}
            >
              {isLinking ? "Linking…" : "Link Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
