"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useProjectChangeEvents } from "@/hooks/use-change-events";
import type { ChangeEvent } from "@/types/change-events";

// =============================================================================
// Types
// =============================================================================

export interface PrimeContractCO {
  id: number;
  project_id: number;
  pcco_number: string;
  title: string;
  status: string;
  total_amount: number | null;
  contract_id: number | null;
  prime_contract_id: number | null;
  executed: boolean | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PrimeContractPco {
  id: string;
  project_id: number;
  prime_contract_id: string;
  pco_number: string | null;
  title: string;
  status: string;
  total_amount: number | null;
  promoted_to_co_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CommitmentPco {
  id: string;
  project_id: number;
  commitment_id: string;
  commitment_type: string;
  pco_number: string | null;
  title: string;
  status: string;
  total_amount: number | null;
  promoted_to_co_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export type PipelineStage =
  | "change_event"
  | "potential_change_order"
  | "official_change_order";

export interface StageSummary {
  stage: PipelineStage;
  label: string;
  total: number;
  active: number;
  value: number;
  items: PipelineItem[];
}

export interface PipelineItem {
  id: string;
  stage: PipelineStage;
  kind?: "prime_pco" | "commitment_pco" | "prime_co" | "commitment_co";
  number: string;
  title: string;
  status: string;
  value: number;
  updatedAt: string;
  sourceCount?: number;
  isConverted?: boolean;
}

export interface ChangeManagementMetrics {
  totalCEs: number;
  openCEs: number;
  totalPCOs: number;
  totalOfficialCOs: number;
  totalPrimeCOs: number;
  approvedPrimeCOs: number;
  totalCommitmentCOs: number;
  approvedCommitmentCOs: number;
  netContractImpact: number;
  conversionRate: number;
  avgCycleTimeDays: number | null;
}

interface PrimeContractCOListResponse {
  data?: PrimeContractCO[];
}

interface CommitmentCOListResponse {
  data?: CommitmentCO[];
}

interface PrimePcoListResponse {
  data?: PrimeContractPco[];
}

interface CommitmentPcoListResponse {
  data?: CommitmentPco[];
}

// =============================================================================
// Internal hooks
// =============================================================================

function usePrimeCOs(projectId: string) {
  return useQuery<PrimeContractCO[]>({
    queryKey: ["prime-contract-change-orders", projectId],
    // Normalizes prime CO API responses so dashboard code doesn't depend on route wrapper shape.
    queryFn: async () => {
      const response = await apiFetch<PrimeContractCOListResponse>(
        `/api/projects/${projectId}/prime-contract-change-orders`,
      );
      return response.data ?? [];
    },
    enabled: !!projectId,
  });
}

interface CommitmentCO {
  id: number;
  project_id?: number | null;
  contract_id?: string | null;
  change_order_number?: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
  status: string | null;
  requested_date?: string | null;
  approved_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function useCommitmentCOs(projectId: string) {
  return useQuery<CommitmentCO[]>({
    queryKey: ["commitment-change-orders", projectId],
    // Loads commitment COs through the project API so the client doesn't assume a project_id column exists.
    queryFn: async () => {
      const response = await apiFetch<CommitmentCOListResponse>(
        `/api/projects/${projectId}/commitment-change-orders`,
      );
      return response.data ?? [];
    },
    enabled: !!projectId,
  });
}

function usePrimePcos(projectId: string) {
  return useQuery<PrimeContractPco[]>({
    queryKey: ["prime-contract-pcos", projectId],
    queryFn: async () => {
      const response = await apiFetch<PrimeContractPco[] | PrimePcoListResponse>(
        `/api/projects/${projectId}/prime-contract-pcos`,
      );
      return Array.isArray(response) ? response : response.data ?? [];
    },
    enabled: !!projectId,
  });
}

function useCommitmentPcos(projectId: string) {
  return useQuery<CommitmentPco[]>({
    queryKey: ["commitment-pcos", projectId],
    queryFn: async () => {
      const response = await apiFetch<CommitmentPco[] | CommitmentPcoListResponse>(
        `/api/projects/${projectId}/commitment-pcos`,
      );
      return Array.isArray(response) ? response : response.data ?? [];
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// Helpers
// =============================================================================

function isOpenCE(ce: ChangeEvent): boolean {
  const s = (ce.status ?? "").toLowerCase();
  return s !== "closed" && s !== "converted" && s !== "rejected";
}

function isApprovedPrimeCO(co: PrimeContractCO): boolean {
  const s = (co.status ?? "").toLowerCase();
  return s === "approved" || s === "executed";
}

function isApprovedCommitmentCO(co: CommitmentCO): boolean {
  const s = (co.status ?? "").toLowerCase();
  return s === "approved" || s === "executed";
}

function ceToPipelineItem(ce: ChangeEvent): PipelineItem {
  return {
    id: `ce-${ce.id}`,
    stage: "change_event",
    number: ce.number ?? `CE-${ce.id}`,
    title: ce.title ?? "Untitled",
    status: ce.status ?? "Open",
    value: Number(ce.cost_rom ?? ce.rom ?? ce.total ?? 0),
    updatedAt: ce.updated_at ?? ce.created_at ?? "",
  };
}

function primeCOToPipelineItem(co: PrimeContractCO): PipelineItem {
  return {
    id: `prime-co-${co.id}`,
    stage: "official_change_order",
    kind: "prime_co",
    number: co.pcco_number ?? `PCCO-${co.id}`,
    title: co.title ?? "Untitled",
    status: co.status ?? "Draft",
    value: co.total_amount ?? 0,
    updatedAt: co.updated_at ?? co.created_at,
  };
}

function commitmentCOToPipelineItem(co: CommitmentCO): PipelineItem {
  return {
    id: `commitment-co-${co.id}`,
    stage: "official_change_order",
    kind: "commitment_co",
    number: co.change_order_number ?? `CCO-${co.id}`,
    title: co.title ?? "Untitled",
    status: co.status ?? "draft",
    value: co.amount ?? 0,
    updatedAt: co.updated_at ?? co.created_at ?? "",
  };
}

function primePcoToPipelineItem(pco: PrimeContractPco): PipelineItem {
  return {
    id: `prime-pco-${pco.id}`,
    stage: "potential_change_order",
    kind: "prime_pco",
    number: pco.pco_number ?? "Prime PCO",
    title: pco.title ?? "Untitled",
    status: pco.status ?? "draft",
    value: pco.total_amount ?? 0,
    updatedAt: pco.updated_at ?? pco.created_at ?? "",
    isConverted: Boolean(pco.promoted_to_co_id),
  };
}

function commitmentPcoToPipelineItem(pco: CommitmentPco): PipelineItem {
  return {
    id: `commitment-pco-${pco.id}`,
    stage: "potential_change_order",
    kind: "commitment_pco",
    number: pco.pco_number ?? "Commitment PCO",
    title: pco.title ?? "Untitled",
    status: pco.status ?? "draft",
    value: pco.total_amount ?? 0,
    updatedAt: pco.updated_at ?? pco.created_at ?? "",
    isConverted: Boolean(pco.promoted_to_co_id),
  };
}

function sortByDate(a: { updatedAt: string }, b: { updatedAt: string }) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

// =============================================================================
// Main hook
// =============================================================================

export function useChangeManagement(projectId: string) {
  const numericId = Number(projectId);
  const { changeEvents, isLoading: cesLoading } =
    useProjectChangeEvents(numericId);
  const { data: primeCOs, isLoading: primeCOsLoading } =
    usePrimeCOs(projectId);
  const { data: commitmentCOs, isLoading: commitmentCOsLoading } =
    useCommitmentCOs(projectId);
  const { data: primePcos, isLoading: primePcosLoading } =
    usePrimePcos(projectId);
  const { data: commitmentPcos, isLoading: commitmentPcosLoading } =
    useCommitmentPcos(projectId);

  const isLoading =
    cesLoading ||
    primeCOsLoading ||
    commitmentCOsLoading ||
    primePcosLoading ||
    commitmentPcosLoading;

  const allCEs = changeEvents ?? [];
  const allPrimeCOs = primeCOs ?? [];
  const allCommitmentCOs = commitmentCOs ?? [];
  const allPrimePcos = primePcos ?? [];
  const allCommitmentPcos = commitmentPcos ?? [];

  const metrics: ChangeManagementMetrics = useMemo(() => {
    const openCEs = allCEs.filter(isOpenCE).length;
    const allPcos = [...allPrimePcos, ...allCommitmentPcos];
    const approvedPrime = allPrimeCOs.filter(isApprovedPrimeCO);
    const approvedCommitment = allCommitmentCOs.filter(isApprovedCommitmentCO);
    const netImpact = approvedPrime.reduce(
      (sum, co) => sum + (co.total_amount ?? 0),
      0,
    );

    const convertedCEs = allCEs.filter(
      (ce) => (ce.status ?? "").toLowerCase() === "converted",
    ).length;
    const conversionRate =
      allCEs.length > 0 ? (convertedCEs / allCEs.length) * 100 : 0;

    // Avg cycle time: approved Prime COs with both created_at and approved_at
    const withDates = approvedPrime.filter((co) => co.approved_at);
    const avgCycle =
      withDates.length > 0
        ? withDates.reduce((sum, co) => {
            const created = new Date(co.created_at).getTime();
            const approved = new Date(co.approved_at!).getTime();
            return sum + (approved - created) / (1000 * 60 * 60 * 24);
          }, 0) / withDates.length
        : null;

    return {
      totalCEs: allCEs.length,
      openCEs,
      totalPCOs: allPcos.length,
      totalOfficialCOs: allPrimeCOs.length + allCommitmentCOs.length,
      totalPrimeCOs: allPrimeCOs.length,
      approvedPrimeCOs: approvedPrime.length,
      totalCommitmentCOs: allCommitmentCOs.length,
      approvedCommitmentCOs: approvedCommitment.length,
      netContractImpact: netImpact,
      conversionRate,
      avgCycleTimeDays: avgCycle !== null ? Math.round(avgCycle) : null,
    };
  }, [allCEs, allPrimeCOs, allCommitmentCOs, allPrimePcos, allCommitmentPcos]);

  const stages: StageSummary[] = useMemo(() => {
    const ceItems = allCEs.map(ceToPipelineItem).sort(sortByDate);
    const pcoItems = [
      ...allPrimePcos.map(primePcoToPipelineItem),
      ...allCommitmentPcos.map(commitmentPcoToPipelineItem),
    ].sort(sortByDate);
    const primeItems = allPrimeCOs.map(primeCOToPipelineItem).sort(sortByDate);
    const commitItems = allCommitmentCOs
      .map(commitmentCOToPipelineItem)
      .sort(sortByDate);
    const officialItems = [...primeItems, ...commitItems].sort(sortByDate);

    return [
      {
        stage: "change_event" as const,
        label: "Change Events",
        total: allCEs.length,
        active: allCEs.filter(isOpenCE).length,
        value: ceItems.reduce((s, i) => s + i.value, 0),
        items: ceItems,
      },
      {
        stage: "potential_change_order" as const,
        label: "Potential Change Orders",
        total: pcoItems.length,
        active: pcoItems.filter((item) => !item.isConverted).length,
        value: pcoItems.reduce((s, i) => s + i.value, 0),
        items: pcoItems,
      },
      {
        stage: "official_change_order" as const,
        label: "Official Change Orders",
        total: officialItems.length,
        active:
          allPrimeCOs.filter(isApprovedPrimeCO).length +
          allCommitmentCOs.filter(isApprovedCommitmentCO).length,
        value: officialItems.reduce((s, i) => s + i.value, 0),
        items: officialItems,
      },
    ];
  }, [allCEs, allPrimeCOs, allCommitmentCOs, allPrimePcos, allCommitmentPcos]);

  const recentActivity: PipelineItem[] = useMemo(() => {
    const all = [
      ...allCEs.map(ceToPipelineItem),
      ...allPrimePcos.map(primePcoToPipelineItem),
      ...allCommitmentPcos.map(commitmentPcoToPipelineItem),
      ...allPrimeCOs.map(primeCOToPipelineItem),
      ...allCommitmentCOs.map(commitmentCOToPipelineItem),
    ];
    return all
      .filter((i) => i.updatedAt)
      .sort(sortByDate)
      .slice(0, 10);
  }, [allCEs, allPrimeCOs, allCommitmentCOs, allPrimePcos, allCommitmentPcos]);

  return { isLoading, metrics, stages, recentActivity };
}
