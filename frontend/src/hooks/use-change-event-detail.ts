"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ChangeEventFormData } from "@/components/domain/change-events/ChangeEventForm";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type {
  ChangeEventAttachment,
  ChangeEventDetail,
  ChangeEventDetailLineItem,
  ChangeEventHistoryEntry,
  ChangeEventRelatedItem,
  ChangeEventRelatedItemOption,
} from "@/types/change-events";

const STATUS_MAP: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  void: "Closed",
  pending: "Pending Approval",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
};

const REASON_MAP: Record<string, string> = {
  allowance: "Allowance",
  backcharge: "Backcharge",
  client_request: "Client Request",
  design_development: "Design Development",
  existing_condition: "Existing Condition",
};

type DetailResponse = ChangeEventDetail & {
  lineItems?: ChangeEventDetailLineItem[];
  attachments?: ChangeEventAttachment[];
  history?: Record<string, unknown>[];
};

function baseUrl(projectId: number, changeEventId: string) {
  return `/api/projects/${projectId}/change-events/${changeEventId}`;
}

function dataArray<T>(payload: T[] | { data?: T[] } | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function reportChangeEventPartialFailure(
  operation: string,
  error: unknown,
  projectId: number,
  changeEventId: string,
  userVisibleFallback: string,
) {
  reportNonCriticalFailure({
    area: "change-event-detail",
    operation,
    error,
    userVisibleFallback,
    metadata: { projectId, changeEventId },
  });
}

function mapHistoryEntry(h: Record<string, unknown>): ChangeEventHistoryEntry {
  return {
    id: (h.id as string) ?? crypto.randomUUID(),
    changeEventId:
      (h.change_event_id as string) ?? (h.changeEventId as string),
    action:
      (h.changeType as string) ??
      (h.change_type as string) ??
      (h.action as string) ??
      "update",
    fieldName: (h.field_name as string) ?? (h.fieldName as string) ?? "",
    oldValue:
      (h.old_value as string | null) ?? (h.oldValue as string | null) ?? null,
    newValue:
      (h.new_value as string | null) ?? (h.newValue as string | null) ?? null,
    changedBy:
      (h.changed_by as string | null) ??
      (h.changedBy as string | null) ??
      null,
    changedAt:
      (h.changed_at as string) ??
      (h.changedAt as string) ??
      new Date().toISOString(),
    description: (h.description as string) ?? undefined,
  };
}

export function useChangeEventDetail(
  projectId: number,
  changeEventId: string,
) {
  const [changeEvent, setChangeEvent] = useState<ChangeEventDetail | null>(
    null,
  );
  const [lineItems, setLineItems] = useState<ChangeEventDetailLineItem[]>([]);
  const [attachments, setAttachments] = useState<ChangeEventAttachment[]>([]);
  const [historyEntries, setHistoryEntries] = useState<
    ChangeEventHistoryEntry[]
  >([]);
  const [relatedItems, setRelatedItems] = useState<ChangeEventRelatedItem[]>(
    [],
  );
  const [rfqCount, setRfqCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChangeEventDetails = useCallback(async () => {
    // Guard: skip if changeEventId is the nil UUID or falsy. The detail page
    // can mount before the real ID is resolved from params, causing spurious
    // 404s for every sub-fetch (line-items, attachments, rfqs, related-items).
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
    if (!changeEventId || changeEventId === NIL_UUID) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<DetailResponse>(
        baseUrl(projectId, changeEventId),
      );
      setChangeEvent(data);

      if (Array.isArray(data.lineItems)) {
        setLineItems(data.lineItems);
      } else {
        try {
          const liData = await apiFetch<
            ChangeEventDetailLineItem[] | { data?: ChangeEventDetailLineItem[] }
          >(`${baseUrl(projectId, changeEventId)}/line-items`);
          setLineItems(dataArray(liData));
        } catch (err) {
          reportChangeEventPartialFailure(
            "fetch-line-items",
            err,
            projectId,
            changeEventId,
            "Line items are temporarily unavailable on this change event.",
          );
        }
      }

      if (Array.isArray(data.history)) {
        setHistoryEntries(data.history.map(mapHistoryEntry));
      }

      if (Array.isArray(data.attachments)) {
        setAttachments(data.attachments);
      } else {
        try {
          const attData = await apiFetch<
            ChangeEventAttachment[] | { data?: ChangeEventAttachment[] }
          >(`${baseUrl(projectId, changeEventId)}/attachments`);
          setAttachments(dataArray(attData));
        } catch (err) {
          reportChangeEventPartialFailure(
            "fetch-attachments",
            err,
            projectId,
            changeEventId,
            "Attachments are temporarily unavailable on this change event.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch change event");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, changeEventId]);

  const fetchRfqCount = useCallback(async () => {
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
    if (!changeEventId || changeEventId === NIL_UUID) return;
    try {
      const json = await apiFetch<unknown[] | { data?: unknown[] }>(
        `/api/projects/${projectId}/change-events/rfqs?changeEventId=${changeEventId}`,
      );
      setRfqCount(dataArray(json).length);
    } catch (err) {
      reportChangeEventPartialFailure(
        "fetch-rfq-count",
        err,
        projectId,
        changeEventId,
        "RFQ count is temporarily unavailable.",
      );
    }
  }, [projectId, changeEventId]);

  const fetchRelatedItems = useCallback(async () => {
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
    if (!changeEventId || changeEventId === NIL_UUID) return;
    try {
      const data = await apiFetch<
        ChangeEventRelatedItem[] | { data?: ChangeEventRelatedItem[] }
      >(`${baseUrl(projectId, changeEventId)}/related-items`);
      setRelatedItems(dataArray(data));
    } catch (err) {
      reportChangeEventPartialFailure(
        "fetch-related-items",
        err,
        projectId,
        changeEventId,
        "Related items are temporarily unavailable on this change event.",
      );
    }
  }, [projectId, changeEventId]);

  useEffect(() => {
    void fetchChangeEventDetails();
  }, [fetchChangeEventDetails]);

  useEffect(() => {
    void fetchRelatedItems();
  }, [fetchRelatedItems]);

  useEffect(() => {
    void fetchRfqCount();
  }, [fetchRfqCount]);

  const refetch = useCallback(async () => {
    await Promise.all([
      fetchChangeEventDetails(),
      fetchRelatedItems(),
      fetchRfqCount(),
    ]);
  }, [fetchChangeEventDetails, fetchRelatedItems, fetchRfqCount]);

  const updateStatus = useCallback(
    async (newStatus: string) => {
      if (!changeEvent) return;

      const normalized = STATUS_MAP[newStatus] ?? newStatus;

      try {
        await apiFetch(baseUrl(projectId, changeEventId), {
          method: "PATCH",
          body: JSON.stringify({
            project_id: projectId,
            title: changeEvent.title,
            status: normalized,
          }),
        });

        setChangeEvent((prev) =>
          prev ? { ...prev, status: normalized } : prev,
        );
        toast.success(`Status updated to ${normalized}`);
      } catch (err) {
        toast.error("Failed to update status");
        throw err;
      }
    },
    [projectId, changeEventId, changeEvent],
  );

  const deleteChangeEvent = useCallback(async () => {
    try {
      await apiFetch(baseUrl(projectId, changeEventId), {
        method: "DELETE",
      });

      toast.success("Change event deleted");
    } catch (err) {
      toast.error("Failed to delete change event");
      throw err;
    }
  }, [projectId, changeEventId]);

  const submitEdit = useCallback(
    async (data: ChangeEventFormData) => {
      try {
        const reason = data.changeReason
          ? REASON_MAP[data.changeReason] ?? data.changeReason
          : undefined;

        await apiFetch(baseUrl(projectId, changeEventId), {
          method: "PATCH",
          body: JSON.stringify({
            title: data.title,
            status: data.status,
            origin: data.origin,
            originId: data.originId || null,
            type: data.type,
            reason,
            scope: data.scope,
            expectingRevenue: data.expectingRevenue,
            lineItemRevenueSource: data.lineItemRevenueSource || undefined,
            primeContractId: data.primeContractId || undefined,
            description: data.description,
          }),
        });

        const lineItemFailures: string[] = [];
        const formItemIds = new Set(
          data.lineItems.filter((item) => item.id).map((item) => item.id),
        );
        const existingItemIds = lineItems
          .filter((item) => item.id)
          .map((item) => item.id);
        const deletedIds = existingItemIds.filter(
          (id) => !formItemIds.has(id),
        );

        for (const deletedId of deletedIds) {
          try {
            await apiFetch(
              `${baseUrl(projectId, changeEventId)}/line-items/${deletedId}`,
              { method: "DELETE" },
            );
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Failed to delete line item";
            lineItemFailures.push(`Deleted line item ${deletedId}: ${msg}`);
            reportNonCriticalFailure({
              area: "change-event-detail",
              operation: "delete-line-item-during-edit",
              error: err,
              userVisibleFallback: `Deleted line item ${deletedId} was not removed.`,
              metadata: { projectId, changeEventId, lineItemId: deletedId },
            });
          }
        }

        for (const [index, item] of data.lineItems.entries()) {
          let commitmentId: string | null = null;
          let commitmentType: string | null = null;
          const contractValue = item.contract;

          if (contractValue && contractValue.startsWith("sub-")) {
            commitmentId = contractValue.replace("sub-", "");
            commitmentType = "subcontract";
          } else if (contractValue && contractValue.startsWith("po-")) {
            commitmentId = contractValue.replace("po-", "");
            commitmentType = "purchase_order";
          }

          const lineItemPayload: Record<string, unknown> = {
            description: item.description,
            sortOrder: index,
          };
          if (item.revenueUnitOfMeasure) {
            lineItemPayload.unitOfMeasure = item.revenueUnitOfMeasure;
          }
          if (item.costQuantity != null) {
            lineItemPayload.quantity = item.costQuantity;
          }
          if (item.costUnitCost != null) {
            lineItemPayload.unitCost = item.costUnitCost;
          }
          if (item.costRom != null) lineItemPayload.costRom = item.costRom;
          if (item.revenueRom != null) {
            lineItemPayload.revenueRom = item.revenueRom;
          }
          if (item.nonCommittedCost != null) {
            lineItemPayload.nonCommittedCost = item.nonCommittedCost;
          }
          if (item.budgetCode) lineItemPayload.budgetCodeId = item.budgetCode;
          if (item.vendor) lineItemPayload.vendorId = item.vendor;
          if (commitmentId) lineItemPayload.commitmentId = commitmentId;
          if (commitmentType) lineItemPayload.commitmentType = commitmentType;
          if (item.commitmentLineItemId) {
            lineItemPayload.commitmentLineItemId = item.commitmentLineItemId;
          }

          const itemLabel = item.description
            ? `"${item.description.slice(0, 40)}"`
            : `#${index + 1}`;
          const itemUrl = item.id
            ? `${baseUrl(projectId, changeEventId)}/line-items/${item.id}`
            : `${baseUrl(projectId, changeEventId)}/line-items`;

          try {
            await apiFetch(itemUrl, {
              method: item.id ? "PATCH" : "POST",
              body: JSON.stringify(lineItemPayload),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            lineItemFailures.push(`Line item ${itemLabel}: ${msg}`);
            reportNonCriticalFailure({
              area: "change-event-detail",
              operation: item.id ? "patch-line-item" : "post-line-item",
              error: err,
              userVisibleFallback: `Line item ${itemLabel} was not saved.`,
              metadata: {
                projectId,
                changeEventId,
                lineItemId: item.id,
              },
            });
          }
        }

        if (lineItemFailures.length > 0) {
          for (const failure of lineItemFailures) {
            toast.error(failure, { duration: 8000 });
          }
        }

        if (data.attachments && data.attachments.length > 0) {
          await Promise.all(
            data.attachments.map((file) => {
              const formData = new FormData();
              formData.append("file", file);
              return apiFetch(`${baseUrl(projectId, changeEventId)}/attachments`, {
                method: "POST",
                body: formData,
              });
            }),
          );
        }

        await fetchChangeEventDetails();
        toast.success("Change event updated");
      } catch (err) {
        toast.error("Failed to save changes");
        throw err;
      }
    },
    [projectId, changeEventId, lineItems, fetchChangeEventDetails],
  );

  const deleteLineItem = useCallback(
    async (lineItemId: string) => {
      try {
        await apiFetch(
          `${baseUrl(projectId, changeEventId)}/line-items/${lineItemId}`,
          { method: "DELETE" },
        );
        setLineItems((prev) => prev.filter((li) => li.id !== lineItemId));
        toast.success("Line item deleted");
      } catch (err) {
        toast.error("Failed to delete line item");
        throw err;
      }
    },
    [projectId, changeEventId],
  );

  const fetchRelatedItemOptions = useCallback(
    async (
      type: string,
      search: string,
    ): Promise<ChangeEventRelatedItemOption[]> => {
      try {
        const params = new URLSearchParams({ type, search });
        const data = await apiFetch<
          ChangeEventRelatedItemOption[] | {
            data?: ChangeEventRelatedItemOption[];
          }
        >(
          `${baseUrl(projectId, changeEventId)}/related-items/options?${params}`,
        );
        return dataArray(data);
      } catch (err) {
        reportChangeEventPartialFailure(
          "fetch-related-item-options",
          err,
          projectId,
          changeEventId,
          "Related item options are temporarily unavailable.",
        );
        return [];
      }
    },
    [projectId, changeEventId],
  );

  const linkRelatedItem = useCallback(
    async (type: string, relatedId: string) => {
      try {
        await apiFetch(`${baseUrl(projectId, changeEventId)}/related-items`, {
          method: "POST",
          body: JSON.stringify({
            relatedType: type,
            relatedId,
          }),
        });

        await fetchRelatedItems();
        toast.success("Related item linked");
      } catch (err) {
        toast.error("Failed to link related item");
        throw err;
      }
    },
    [projectId, changeEventId, fetchRelatedItems],
  );

  const unlinkRelatedItem = useCallback(
    async (relatedItemId: string) => {
      setRelatedItems((prev) =>
        prev.filter((item) => item.id !== relatedItemId),
      );

      try {
        await apiFetch(
          `${baseUrl(projectId, changeEventId)}/related-items/${relatedItemId}`,
          { method: "DELETE" },
        );

        toast.success("Related item removed");
      } catch (err) {
        await fetchRelatedItems();
        toast.error("Failed to unlink related item");
        throw err;
      }
    },
    [projectId, changeEventId, fetchRelatedItems],
  );

  const actions = useMemo(
    () => ({
      refetch,
      updateStatus,
      deleteChangeEvent,
      deleteLineItem,
      submitEdit,
      fetchRelatedItemOptions,
      linkRelatedItem,
      unlinkRelatedItem,
    }),
    [
      refetch,
      updateStatus,
      deleteChangeEvent,
      deleteLineItem,
      submitEdit,
      fetchRelatedItemOptions,
      linkRelatedItem,
      unlinkRelatedItem,
    ],
  );

  return {
    changeEvent,
    lineItems,
    attachments,
    historyEntries,
    relatedItems,
    rfqCount,
    isLoading,
    error,
    actions,
  };
}
