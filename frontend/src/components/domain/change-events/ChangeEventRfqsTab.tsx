"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge, EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeEventRfq } from "@/types/change-events";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

type RfqWithResponseCount = ChangeEventRfq & { response_count?: number };
type RfqLineItemOption = {
  id: string;
  description: string | null;
  quantity?: number | null;
};

interface ChangeEventRfqsTabProps {
  projectId: number;
  changeEventId: string;
  lineItems?: RfqLineItemOption[];
  onSendRfq?: () => void;
  onResponseRecorded?: () => void;
}

function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-primary/10 text-primary",
  Responded: "bg-green-100 text-green-800",
  Closed: "bg-muted text-muted-foreground",
};

export function ChangeEventRfqsTab({
  projectId,
  changeEventId,
  lineItems = [],
  onSendRfq,
  onResponseRecorded,
}: ChangeEventRfqsTabProps) {
  const [rfqs, setRfqs] = useState<RfqWithResponseCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [responseRfq, setResponseRfq] = useState<RfqWithResponseCount | null>(null);
  const [responseLineItemId, setResponseLineItemId] = useState("");
  const [responseUnitPrice, setResponseUnitPrice] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [isRecordingResponse, setIsRecordingResponse] = useState(false);

  const firstLineItemId = lineItems[0]?.id ?? "";

  const fetchRfqs = useCallback(async () => {
    try {
      setIsLoading(true);
      const json = await apiFetch<RfqWithResponseCount[] | { data?: RfqWithResponseCount[] }>(
        `/api/projects/${projectId}/change-events/rfqs?changeEventId=${changeEventId}`,
      );
      const data: RfqWithResponseCount[] = Array.isArray(json)
        ? json
        : (json.data ?? []);
      setRfqs(data);
    } catch (error) {
      reportNonCriticalFailure({
        area: "change-event-rfqs",
        operation: "load-rfqs",
        error,
        userVisibleFallback: "RFQs could not be loaded for this change event.",
        metadata: { projectId, changeEventId },
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, changeEventId]);

  useEffect(() => {
    void fetchRfqs();
  }, [fetchRfqs]);

  const selectedLineItem = useMemo(
    () => lineItems.find((item) => item.id === responseLineItemId),
    [lineItems, responseLineItemId],
  );

  const openResponseDialog = (rfq: RfqWithResponseCount) => {
    setResponseRfq(rfq);
    setResponseLineItemId(firstLineItemId);
    setResponseUnitPrice("");
    setResponseNotes("");
  };

  const handleRecordResponse = async () => {
    if (!responseRfq) return;
    const unitPrice = Number(responseUnitPrice);
    if (!responseLineItemId || !Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Select a line item and enter a valid unit price.");
      return;
    }

    setIsRecordingResponse(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/change-events/rfqs/${responseRfq.id}/responses`,
        {
          method: "POST",
          body: JSON.stringify({
            lineItemId: responseLineItemId,
            unitPrice,
            notes: responseNotes.trim() || undefined,
          }),
        },
      );
      toast.success("RFQ response recorded");
      setResponseRfq(null);
      await fetchRfqs();
      onResponseRecorded?.();
    } catch (err) {
      toast.error("Failed to record response");
    } finally {
      setIsRecordingResponse(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (rfqs.length === 0) {
    return (
      <EmptyState
        icon={<Send />}
        title="No RFQs"
        description="Send a Request for Quote to vendors for this change event."
        action={
          onSendRfq ? (
            <Button size="sm" variant="outline" onClick={onSendRfq}>
              <Plus />
              Send RFQ
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm text-muted-foreground">
          {rfqs.length} RFQ{rfqs.length !== 1 ? "s" : ""}
        </p>
        {onSendRfq && (
          <Button size="sm" variant="outline" onClick={onSendRfq}>
            <Send className="mr-2 h-4 w-4" />
            New RFQ
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">RFQ #</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Due Date</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Est. Total</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Responses</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rfqs.map((rfq) => (
              <tr key={rfq.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                  {rfq.rfq_number}
                </td>
                <td className="px-4 py-3 font-medium">{rfq.title}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={rfq.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(rfq.due_date)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(rfq.estimated_total_amount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {rfq.response_count ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openResponseDialog(rfq)}
                    disabled={lineItems.length === 0}
                  >
                    Record Response
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <Dialog open={!!responseRfq} onOpenChange={(open) => !open && setResponseRfq(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record RFQ Response</DialogTitle>
          <DialogDescription>
            Enter vendor pricing for this request for quote.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rfq-response-line-item">Line item</Label>
            <Select value={responseLineItemId} onValueChange={setResponseLineItemId}>
              <SelectTrigger id="rfq-response-line-item">
                <SelectValue placeholder="Select line item" />
              </SelectTrigger>
              <SelectContent>
                {lineItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.description || "Untitled line item"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rfq-response-unit-price">Unit price</Label>
            <Input
              id="rfq-response-unit-price"
              type="number"
              min="0"
              step="0.01"
              value={responseUnitPrice}
              onChange={(event) => setResponseUnitPrice(event.target.value)}
            />
            {selectedLineItem?.quantity != null ? (
              <p className="text-xs text-muted-foreground">
                Quantity: {selectedLineItem.quantity}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rfq-response-notes">Notes</Label>
            <Textarea
              id="rfq-response-notes"
              value={responseNotes}
              onChange={(event) => setResponseNotes(event.target.value)}
              placeholder="Optional response notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setResponseRfq(null)}
            disabled={isRecordingResponse}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleRecordResponse} disabled={isRecordingResponse}>
            {isRecordingResponse ? "Recording..." : "Record Response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
