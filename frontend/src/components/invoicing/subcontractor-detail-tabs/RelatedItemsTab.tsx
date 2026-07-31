"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/ds";
import { SectionAction, SectionRuleHeading } from "@/components/layout/spacing";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const RELATED_ITEM_TYPE_OPTIONS = [
  { value: "change_event", label: "Change Event" },
  { value: "change_order_request", label: "Change Order Request" },
  { value: "commitment", label: "Commitment (Subcontract / PO)" },
  { value: "contract", label: "Prime Contract" },
  { value: "company", label: "Company" },
  { value: "contact", label: "Contact" },
  { value: "cost_code", label: "Cost Code" },
  { value: "direct_cost", label: "Direct Cost" },
  { value: "document", label: "Document" },
  { value: "drawing", label: "Drawing" },
  { value: "drawing_revision", label: "Drawing Revision" },
  { value: "rfi", label: "RFI" },
  { value: "punch_list", label: "Punch List Item" },
  { value: "specification", label: "Specification" },
  { value: "submittal", label: "Submittal" },
] as const;

type RelatedItemType = (typeof RELATED_ITEM_TYPE_OPTIONS)[number]["value"];

function typeLabel(type: string): string {
  return (
    RELATED_ITEM_TYPE_OPTIONS.find((o) => o.value === type)?.label ??
    type.replace(/_/g, " ")
  );
}

interface RelatedItem {
  id: number;
  related_type: string;
  related_id: string;
  description: string | null;
  linked_at: string;
}

interface RelatedItemOption {
  id: string;
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
}

export function RelatedItemsTab({
  projectId,
  invoiceId,
}: {
  projectId: string;
  invoiceId: number;
}) {
  const baseUrl = useMemo(
    () =>
      `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/related-items`,
    [projectId, invoiceId],
  );

  const [items, setItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // dialog state
  const [open, setOpen] = useState(false);
  const [linkType, setLinkType] = useState<RelatedItemType | "">("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [options, setOptions] = useState<RelatedItemOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl);
      const body = await res.json();
      if (res.ok) setItems(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const resetDialog = useCallback(() => {
    setLinkType("");
    setSearch("");
    setSelectedId("");
    setOptions([]);
    setOptionsLoading(false);
    setLinking(false);
  }, []);

  useEffect(() => {
    if (!open) resetDialog();
  }, [open, resetDialog]);

  // fetch options whenever type or search changes
  useEffect(() => {
    if (!open || !linkType) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setOptionsLoading(true);
    setSelectedId("");

    fetch(
      `${baseUrl}/options?type=${linkType}&search=${encodeURIComponent(search)}&limit=50`,
    )
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setOptions(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, linkType, search, baseUrl]);

  async function handleLink() {
    if (!linkType || !selectedId) return;
    setLinking(true);
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ related_type: linkType, related_id: selectedId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Item linked");
      setOpen(false);
      await loadItems();
    } catch {
      toast.error("Failed to link item");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(id: number) {
    const res = await fetch(`${baseUrl}?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Unlinked");
      await loadItems();
    } else {
      toast.error("Failed to unlink");
    }
  }

  return (
    <div className="space-y-4">
      <SectionRuleHeading
        label="Related Items"
        actions={
          <SectionAction onClick={() => setOpen(true)}>
            <Link2 className="h-4 w-4" />
            Link Item
          </SectionAction>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title="No related items"
          description="Link change events, RFIs, drawings, submittals, and more to this invoice."
        />
      ) : (
        <div className="rounded-md border border-border divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
            >
              <Badge variant="outline" className="shrink-0 capitalize">
                {typeLabel(item.related_type)}
              </Badge>
              <span className="flex-1 text-sm text-muted-foreground font-mono tabular-nums truncate">
                {item.related_id}
              </span>
              {item.description && (
                <span className="text-sm text-foreground truncate max-w-xs">
                  {item.description}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUnlink(item.id)}
                aria-label="Unlink"
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Related Item</DialogTitle>
            <DialogDescription>
              Choose a type, then search and select the record to link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label htmlFor="link-type">Item Type</Label>
              <Select
                value={linkType}
                onValueChange={(v) => setLinkType(v as RelatedItemType)}
              >
                <SelectTrigger id="link-type">
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {RELATED_ITEM_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            {linkType && (
              <div className="space-y-1.5">
                <Label htmlFor="link-search">Search</Label>
                <Input
                  id="link-search"
                  placeholder="Search by title or number…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            {/* Item picker */}
            {linkType && (
              <div className="space-y-1.5">
                <Label htmlFor="link-item">Item</Label>
                <Select
                  value={selectedId}
                  onValueChange={setSelectedId}
                  disabled={optionsLoading || options.length === 0}
                >
                  <SelectTrigger id="link-item">
                    <SelectValue
                      placeholder={
                        optionsLoading
                          ? "Loading…"
                          : options.length === 0
                            ? "No results"
                            : "Select an item…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-2">
                          {o.relatedNumber && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {o.relatedNumber}
                            </span>
                          )}
                          <span className="truncate">{o.relatedTitle}</span>
                          {o.relatedStatus && (
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground capitalize">
                              {o.relatedStatus}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={!linkType || !selectedId || linking}
            >
              {linking ? "Linking…" : "Link Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
