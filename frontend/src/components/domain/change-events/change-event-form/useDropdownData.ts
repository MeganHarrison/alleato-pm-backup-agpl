"use client";

import * as React from "react";

import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type {
  PrimeContractOption,
  VendorOption,
  ContractOption,
  BudgetCodeOption,
} from "./types";

// Commitments in these statuses have not been awarded yet and should not appear
// in the Change Event vendor or commitment dropdowns.
const EXCLUDED_COMMITMENT_STATUSES = new Set(["Draft", "Out for Bid"]);

interface UseDropdownDataOptions {
  projectId: number;
}

interface CommitmentApiRecord {
  id: string | number;
  contract_number?: string | null;
  number?: string | null;
  title?: string | null;
  status?: string | null;
  deleted_at?: string | null;
  contract_company_id?: string | null;
  company_name?: string | null;
}

export function useDropdownData({ projectId }: UseDropdownDataOptions) {
  const [primeContractOptions, setPrimeContractOptions] = React.useState<
    PrimeContractOption[]
  >([]);
  const [vendors, setVendors] = React.useState<VendorOption[]>([]);
  const [contracts, setContracts] = React.useState<ContractOption[]>([]);
  const [budgetCodes, setBudgetCodes] = React.useState<BudgetCodeOption[]>([]);

  const fetchBudgetCodes = React.useCallback(async () => {
    try {
      const payload = await apiFetch<{
        budgetCodes?: Array<{
          id: string;
          code: string;
          costCodeId?: string | null;
          description?: string;
          costType?: string | null;
          costTypeId?: string | null;
          fullLabel?: string;
        }>;
        data?: Array<{
          id: string;
          code: string;
          costCodeId?: string | null;
          description?: string;
          costType?: string | null;
          costTypeId?: string | null;
          fullLabel?: string;
        }>;
      }>(`/api/projects/${projectId}/budget-codes`);
      const codes = (payload.budgetCodes || payload.data || []) as Array<{
        id: string;
        code: string;
        costCodeId?: string | null;
        description?: string;
        costType?: string | null;
        costTypeId?: string | null;
        fullLabel?: string;
      }>;
      setBudgetCodes(
        codes.map((bc) => ({
          id: bc.id,
          code: bc.code,
          costCodeId: bc.costCodeId || null,
          description: bc.description || "",
          costType: bc.costType || null,
          costTypeId: bc.costTypeId || null,
          fullLabel:
            bc.fullLabel || `${bc.code}${bc.description ? ` - ${bc.description}` : ""}`,
        })),
      );
    } catch (error) {
      reportNonCriticalFailure({
        area: "change-event-dropdown-data",
        operation: "load-budget-codes",
        error,
        userVisibleFallback:
          "Budget code options could not be loaded for change event line items.",
        metadata: { projectId },
      });
      setBudgetCodes([]);
    }
  }, [projectId]);

  React.useEffect(() => {
    const fetchAll = async () => {
      // Prime contracts
      try {
        const payload = await apiFetch<
          | Array<{
              id: number | string;
              contract_number?: string;
              number?: string;
              title?: string;
              description?: string;
            }>
          | {
              data?: Array<{
                id: number | string;
                contract_number?: string;
                number?: string;
                title?: string;
                description?: string;
              }>;
              contracts?: Array<{
                id: number | string;
                contract_number?: string;
                number?: string;
                title?: string;
                description?: string;
              }>;
            }
        >(`/api/projects/${projectId}/contracts`);
        const records = (
          Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.contracts)
                ? payload.contracts
                : []
        );
        setPrimeContractOptions(
          records
            .filter((record) => record.id !== undefined && record.id !== null)
            .map((record) => ({
              value: String(record.id),
              label: `${record.contract_number || record.number || "PC"} - ${record.title || record.description || "Untitled"}`,
            })),
        );
      } catch (error) {
        reportNonCriticalFailure({
          area: "change-event-dropdown-data",
          operation: "load-prime-contracts",
          error,
          userVisibleFallback:
            "Prime contract options could not be loaded for change event fields.",
          metadata: { projectId },
        });
        setPrimeContractOptions([]);
      }

      // Purchase orders + subcontracts.
      // Only commitments that have been issued (not Draft/Out for Bid) are eligible
      // for Change Events. The vendor list is derived from these commitments so that
      // only vendors with an active contract on this project appear in the dropdown.
      try {
        const [poPayload, subPayload] = await Promise.all([
          apiFetch<{ data?: CommitmentApiRecord[] } | CommitmentApiRecord[]>(
            `/api/projects/${projectId}/purchase-orders`,
          ),
          apiFetch<{ data?: CommitmentApiRecord[] } | CommitmentApiRecord[]>(
            `/api/projects/${projectId}/subcontracts`,
          ),
        ]);

        const contractList: ContractOption[] = [];

        const poData = Array.isArray(poPayload) ? poPayload : poPayload.data || [];
        for (const po of poData) {
          if (
            po.deleted_at ||
            po.status === "Void" ||
            (po.status && EXCLUDED_COMMITMENT_STATUSES.has(po.status))
          ) {
            continue;
          }
          const companyLabel = po.company_name ? ` (${po.company_name})` : "";
          contractList.push({
            id: `po-${po.id}`,
            label: `${po.contract_number || po.number || "PO"} - ${po.title || "Untitled"}${companyLabel}`,
            type: "purchase_order",
            vendorId: po.contract_company_id || null,
            vendorName: po.company_name || null,
            title: po.title || null,
            status: po.status || null,
          });
        }

        const subData = Array.isArray(subPayload) ? subPayload : subPayload.data || [];
        for (const sub of subData) {
          if (
            sub.deleted_at ||
            sub.status === "Void" ||
            (sub.status && EXCLUDED_COMMITMENT_STATUSES.has(sub.status))
          ) {
            continue;
          }
          const companyLabel = sub.company_name ? ` (${sub.company_name})` : "";
          contractList.push({
            id: `sub-${sub.id}`,
            label: `${sub.contract_number || sub.number || "SC"} - ${sub.title || "Untitled"}${companyLabel}`,
            type: "subcontract",
            vendorId: sub.contract_company_id || null,
            vendorName: sub.company_name || null,
            title: sub.title || null,
            status: sub.status || null,
          });
        }

        setContracts(contractList);

        // Derive vendor list from active commitments only — vendors without a
        // commitment on this project must not appear in the dropdown.
        // Include vendors even if company_name is null so that commitment-based
        // auto-fill always has a visible entry in the dropdown.
        const vendorMap = new Map<string, VendorOption>();
        for (const c of contractList) {
          if (c.vendorId && !vendorMap.has(c.vendorId)) {
            vendorMap.set(c.vendorId, {
              id: c.vendorId,
              vendor_name: c.vendorName || "Unknown Vendor",
            });
          }
        }
        setVendors(Array.from(vendorMap.values()));
      } catch (error) {
        reportNonCriticalFailure({
          area: "change-event-dropdown-data",
          operation: "load-commitments-and-derived-vendors",
          error,
          userVisibleFallback:
            "Commitment options could not be loaded for change event line items.",
          metadata: { projectId },
        });
        setContracts([]);
      }

      // Budget codes
      await fetchBudgetCodes();
    };

    fetchAll();
  }, [projectId, fetchBudgetCodes]);

  const primeContractSelectOptions = React.useMemo(
    () =>
      primeContractOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [primeContractOptions],
  );

  return {
    vendors,
    setVendors,
    contracts,
    budgetCodes,
    primeContractOptions,
    primeContractSelectOptions,
    fetchBudgetCodes,
  };
}
