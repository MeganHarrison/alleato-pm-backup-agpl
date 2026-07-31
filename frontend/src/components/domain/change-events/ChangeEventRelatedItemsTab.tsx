"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ChangeEventRelatedItem,
  ChangeEventRelatedItemOption,
} from "@/types/change-events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Text } from "@/components/ds/text";
import { Stack } from "@/components/layout/stack";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ds";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const RELATED_ITEM_TYPE_OPTIONS = [
  { value: "change_event", label: "Change Events" },
  { value: "document", label: "Documents" },
  { value: "meeting", label: "Meetings" },
  { value: "rfi", label: "RFIs" },
  { value: "submittal", label: "Submittals" },
  { value: "drawing", label: "Drawings" },
  { value: "specification", label: "Specifications" },
  { value: "prime_contract_change_order", label: "Prime Contract Change Orders" },
  { value: "commitment_co", label: "Commitment Change Orders" },
  { value: "commitment", label: "Commitments" },
] as const;

function formatRelatedTypeLabel(type: string): string {
  const match = RELATED_ITEM_TYPE_OPTIONS.find(
    (option) => option.value === type
  );
  if (match) return match.label.replace(/s$/, "");
  return type.replace(/_/g, " ");
}

interface ChangeEventRelatedItemsTabProps {
  relatedItems: ChangeEventRelatedItem[];
  isLoading: boolean;
  onFetchOptions: (
    type: string,
    search: string
  ) => Promise<ChangeEventRelatedItemOption[]>;
  onLink: (type: string, relatedId: string) => Promise<void>;
  onUnlink: (relatedItemId: string) => Promise<void>;
}

export function ChangeEventRelatedItemsTab({
  relatedItems,
  isLoading,
  onFetchOptions,
  onLink,
  onUnlink,
}: ChangeEventRelatedItemsTabProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [linkRelatedType, setLinkRelatedType] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [selectedRelatedItemId, setSelectedRelatedItemId] = useState("");
  const [relatedItemOptions, setRelatedItemOptions] = useState<
    ChangeEventRelatedItemOption[]
  >([]);
  const [isLinking, setIsLinking] = useState(false);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  const resetDialogState = useCallback(() => {
    setLinkRelatedType("");
    setLinkSearch("");
    setSelectedRelatedItemId("");
    setRelatedItemOptions([]);
    setIsLinking(false);
    setIsFetchingOptions(false);
  }, []);

  useEffect(() => {
    if (!showDialog) {
      resetDialogState();
      return;
    }
  }, [showDialog, resetDialogState]);

  useEffect(() => {
    if (!showDialog || !linkRelatedType) {
      setRelatedItemOptions([]);
      return;
    }

    let cancelled = false;
    setIsFetchingOptions(true);

    onFetchOptions(linkRelatedType, linkSearch).then((options) => {
      if (!cancelled) {
        setRelatedItemOptions(options);
        setIsFetchingOptions(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setRelatedItemOptions([]);
        setIsFetchingOptions(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [showDialog, linkRelatedType, linkSearch, onFetchOptions]);

  const handleLink = async () => {
    if (!linkRelatedType || !selectedRelatedItemId) return;

    setIsLinking(true);
    try {
      await onLink(linkRelatedType, selectedRelatedItemId);
      toast.success("Related item linked successfully");
      setShowDialog(false);
    } catch {
      toast.error("Failed to link related item");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (relatedItemId: string) => {
    try {
      await onUnlink(relatedItemId);
      toast.success("Related item unlinked");
    } catch {
      toast.error("Failed to unlink related item");
    }
  };

  return (
    <Stack gap="md">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : relatedItems.length > 0 ? (
        <div className="border border-border rounded-md divide-y divide-border">
          {relatedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
            >
              <Badge variant="outline">
                {formatRelatedTypeLabel(item.relatedType)}
              </Badge>
              {item.relatedStatus && (
                <Badge variant="secondary">{item.relatedStatus}</Badge>
              )}
              <a
                href={item.relatedUrl}
                className="text-sm text-primary hover:underline flex-1 truncate"
              >
                {item.relatedNumber
                  ? `${item.relatedNumber} - ${item.relatedTitle}`
                  : item.relatedTitle}
              </a>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUnlink(item.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Link2 className="h-8 w-8 text-muted-foreground" />}
          title="No related items"
          description="Link related items such as RFIs, submittals, or other change events."
          action={
            <Button
              variant="ghost"
              className="text-primary hover:bg-primary/5 hover:text-primary"
              onClick={() => setShowDialog(true)}
            >
              <Link2 className="h-4 w-4" />
              Link Related Item
            </Button>
          }
        />
      )}

      {/* Link Related Item Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Related Item</DialogTitle>
            <DialogDescription>
              Search for and link a related item to this change event.
            </DialogDescription>
          </DialogHeader>

          <Stack gap="md" className="py-4">
            <div>
              <Text size="sm" weight="medium" className="mb-1.5">
                Item Type
              </Text>
              <Select
                value={linkRelatedType}
                onValueChange={(value) => {
                  setLinkRelatedType(value);
                  setSelectedRelatedItemId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item type..." />
                </SelectTrigger>
                <SelectContent>
                  {RELATED_ITEM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Text size="sm" weight="medium" className="mb-1.5">
                Search
              </Text>
              <Input
                placeholder="Search by title or number..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
              />
            </div>

            <div>
              <Text size="sm" weight="medium" className="mb-1.5">
                Item
              </Text>
              <Select
                value={selectedRelatedItemId}
                onValueChange={setSelectedRelatedItemId}
                disabled={!linkRelatedType || isFetchingOptions}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isFetchingOptions ? "Loading..." : "Select an item..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {relatedItemOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.relatedNumber
                        ? `${option.relatedNumber} - ${option.relatedTitle}`
                        : option.relatedTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Stack>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={!linkRelatedType || !selectedRelatedItemId || isLinking}
            >
              {isLinking ? "Linking..." : "Link Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
