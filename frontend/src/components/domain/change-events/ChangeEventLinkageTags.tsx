"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import type { ChangeEventDetailLineItem } from "@/types/change-events";

/**
 * Compact, clickable pills shown directly under the change-event title that make
 * it obvious — at a glance — which commitment(s) and change order(s) this change
 * event is linked to. The same relationships live deeper in the Line Items,
 * Prime/Commitment PCO sections, and the Lineage tab; this row just surfaces
 * them where the user lands first.
 */

interface LineageRow {
  pco_type: "prime" | "commitment";
  pco: {
    id: string;
    number: string | null;
    title: string | null;
    record_type?: "pco" | "change_order";
  };
}

interface LinkageTag {
  key: string;
  typeLabel: string;
  value: string;
  title: string;
  href: string;
}

interface ChangeEventLinkageTagsProps {
  projectId: number;
  changeEventId: string;
  lineItems: ChangeEventDetailLineItem[];
}

export function ChangeEventLinkageTags({
  projectId,
  changeEventId,
  lineItems,
}: ChangeEventLinkageTagsProps) {
  const [lineageRows, setLineageRows] = useState<LineageRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchLineage = async () => {
      try {
        const payload = await apiFetch<{ data?: LineageRow[] }>(
          `/api/projects/${projectId}/change-events/${changeEventId}/lineage`,
          { cache: "no-store" as RequestCache },
        );
        if (!cancelled) setLineageRows(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (!cancelled) setLineageRows([]);
      }
    };
    void fetchLineage();
    return () => {
      cancelled = true;
    };
  }, [projectId, changeEventId]);

  const commitmentTags = useMemo<LinkageTag[]>(() => {
    const seen = new Set<string>();
    const tags: LinkageTag[] = [];
    for (const li of lineItems) {
      const id = li.commitment?.id ?? li.commitmentId;
      if (!id || seen.has(String(id))) continue;
      seen.add(String(id));
      const value =
        li.commitment?.contract_number ||
        li.commitment?.display_name ||
        li.commitment?.title ||
        li.commitment?.company_name ||
        `Commitment ${id}`;
      tags.push({
        key: `commitment-${id}`,
        typeLabel:
          li.commitmentType === "purchase_order" ? "Purchase order" : "Commitment",
        value,
        title:
          li.commitment?.display_name ||
          li.commitment?.title ||
          li.commitment?.company_name ||
          value,
        href: `/${projectId}/commitments/${id}`,
      });
    }
    return tags;
  }, [lineItems, projectId]);

  const changeOrderTags = useMemo<LinkageTag[]>(
    () =>
      lineageRows.map((row) => {
        const isChangeOrder = row.pco.record_type === "change_order";
        const href =
          row.pco_type === "prime"
            ? `/${projectId}/prime-contract-pcos/${row.pco.id}`
            : isChangeOrder
              ? `/${projectId}/change-orders/commitment/${row.pco.id}`
              : `/${projectId}/commitment-pcos/${row.pco.id}`;
        const typeLabel =
          row.pco_type === "prime"
            ? isChangeOrder
              ? "Prime CO"
              : "Prime PCO"
            : isChangeOrder
              ? "Commitment CO"
              : "Commitment PCO";
        return {
          key: `${row.pco_type}-${row.pco.id}`,
          typeLabel,
          value: row.pco.number || "—",
          title: row.pco.title || typeLabel,
          href,
        };
      }),
    [lineageRows, projectId],
  );

  const tags = [...commitmentTags, ...changeOrderTags];
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Badge
          key={tag.key}
          asChild
          variant="outline"
          className="gap-1.5 px-2.5 py-1 text-xs font-normal"
        >
          <Link href={tag.href} title={tag.title}>
            <span className="text-muted-foreground">{tag.typeLabel}</span>
            <span className="font-medium text-foreground">{tag.value}</span>
          </Link>
        </Badge>
      ))}
    </div>
  );
}
