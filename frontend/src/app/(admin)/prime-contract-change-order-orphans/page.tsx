"use client";

import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiError } from "@/lib/api-client";

type OrphanCategory = "ambiguous" | "no_prime_contract";

type PrimeContractCandidate = {
  id: string;
  contractNumber: string | null;
  title: string | null;
  createdAt: string;
};

type OrphanItem = {
  id: number;
  projectId: number;
  projectName: string | null;
  projectNumber: string | null;
  pccoNumber: string | null;
  title: string | null;
  status: string | null;
  totalAmount: number | null;
  createdAt: string;
  createdBy: string | null;
  acumaticaExternalKey: string | null;
  candidates: PrimeContractCandidate[];
  category: OrphanCategory;
};

type OrphanResponse = {
  items: OrphanItem[];
  total: number;
  totalByCategory: {
    ambiguous: number;
    no_prime_contract: number;
  };
};

const CATEGORY_OPTIONS: Array<{ value: "all" | OrphanCategory; label: string }> = [
  { value: "all", label: "All Orphans" },
  { value: "ambiguous", label: "Ambiguous" },
  { value: "no_prime_contract", label: "No Prime Contract" },
];

function formatMoney(value: number | null): string {
  if (value === null) return "--";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function labelForCandidate(candidate: PrimeContractCandidate): string {
  const contractNumber = candidate.contractNumber ?? "(no number)";
  const title = candidate.title?.trim() ? ` — ${candidate.title}` : "";
  return `${contractNumber}${title}`;
}

function shortId(value: string | null | undefined): string {
  if (!value) return "--";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

export default function PrimeContractChangeOrderOrphansPage() {
  const [category, setCategory] = useState<"all" | OrphanCategory>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<OrphanItem[]>([]);
  const [totals, setTotals] = useState({ ambiguous: 0, no_prime_contract: 0 });
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedContractByRow, setSelectedContractByRow] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("category", category);
      params.set("perPage", "200");
      if (search.trim()) params.set("search", search.trim());

      const response = await apiFetch<OrphanResponse>(
        `/api/admin/prime-contract-change-order-orphans?${params.toString()}`,
      );

      setRows(response.items);
      setTotals(response.totalByCategory);
      setSelectedContractByRow((prev) => {
        const next = { ...prev };
        for (const row of response.items) {
          if (!row.candidates?.length) {
            delete next[row.id];
          }
          if (!(row.id in next) && row.candidates.length > 0) {
            next[row.id] = row.candidates[0].id;
          }
        }
        return next;
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load orphan rows.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
  }, [category]);

  const ambiguousCount = totals.ambiguous;
  const noPrimeContractCount = totals.no_prime_contract;

  const onAssign = async (rowId: number, primeContractId: string) => {
    setAssigningId(rowId);
    setMessage(null);
    setError(null);

    try {
      const response = await apiFetch<{ success: boolean; message: string }>(
        "/api/admin/prime-contract-change-order-orphans",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "assign_prime_contract",
            ids: [rowId],
            primeContractId,
          }),
        },
      );

      setMessage(response.message || `Assigned prime contract to PCCO #${rowId}.`);
      await fetchRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign prime contract.");
    } finally {
      setAssigningId(null);
    }
  };

  const filteredRows = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return rows;

    return rows.filter((row) => {
      const haystack = [
        String(row.id),
        String(row.projectId),
        row.projectName ?? "",
        row.projectNumber ?? "",
        row.pccoNumber ?? "",
        row.title ?? "",
        row.status ?? "",
        row.createdBy ?? "",
        row.acumaticaExternalKey ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchLower);
    });
  }, [rows, search]);

  const noRows = !loading && filteredRows.length === 0;

  return (
    <PageShell
      variant="table"
      title="Prime Change Order Orphans"
      description="Repair prime change orders that are missing both parent links."
    >
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-80"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by project, PCCO, Acumatica key, title..."
              aria-label="Search orphan prime contract change orders"
            />
            <Select value={category} onValueChange={(value) => setCategory(value as "all" | OrphanCategory)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={() => void fetchRows()}>
              Refresh
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Ambiguous: <strong>{ambiguousCount}</strong> · No prime contract: <strong>{noPrimeContractCount}</strong>
          </div>
        </div>

        {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading orphan rows...</p>
        ) : noRows ? (
          <p className="text-sm text-muted-foreground">No rows match this filter.</p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const contractSelectValue = selectedContractByRow[row.id] ?? row.candidates[0]?.id ?? "";
              return (
                <div key={row.id} className="border rounded-md p-4 space-y-2">
                  <div className="grid gap-1 text-sm">
                    <div className="font-semibold">PCCO #{row.pccoNumber ?? `#${row.id}`}</div>
                    <div>
                      Project {row.projectName || row.projectNumber || row.projectId} (#{row.projectId}) • Status: {row.status || "—"}
                    </div>
                    <div>
                      Created: {formatDate(row.createdAt)} • Amount: {formatMoney(row.totalAmount)} • Category: {row.category}
                    </div>
                    <div>Title: {row.title || "(not set)"}</div>
                    <div>Created by: {shortId(row.createdBy)} • Acumatica key: {shortId(row.acumaticaExternalKey)}</div>
                    {row.title ? <div className="text-xs text-muted-foreground">Row ID: {row.id}</div> : null}
                  </div>

                  {row.category === "ambiguous" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`prime-contract-${row.id}`}>
                        Prime contract
                      </label>
                      <Select
                        value={contractSelectValue}
                        onValueChange={(nextContractId) =>
                          setSelectedContractByRow((current) => ({ ...current, [row.id]: nextContractId }))
                        }
                      >
                        <SelectTrigger id={`prime-contract-${row.id}`} className="w-96">
                          <SelectValue placeholder="Pick prime contract" />
                        </SelectTrigger>
                        <SelectContent>
                          {row.candidates.map((candidate) => (
                            <SelectItem key={candidate.id} value={candidate.id}>
                              {labelForCandidate(candidate)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!contractSelectValue || assigningId === row.id}
                        onClick={() => onAssign(row.id, contractSelectValue)}
                      >
                        {assigningId === row.id ? "Assigning..." : "Assign prime contract"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No prime-contract candidates exist for this project.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
