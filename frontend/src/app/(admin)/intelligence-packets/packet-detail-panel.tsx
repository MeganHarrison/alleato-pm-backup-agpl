"use client";

import * as React from "react";
import { X } from "lucide-react";

import { StatusBadge } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface IntelligencePacket {
  id: string;
  packet_type: string;
  packet_version: string;
  compiler_version: string | null;
  generated_at: string;
  created_at: string;
  executive_summary: string;
  freshness_status: string;
  current_status: string | null;
  target_id: string;
  target_name: string | null;
  target_type: string | null;
  target_slug: string | null;
  project_id: number | null;
  review_queue_count: number;
  stale_item_count: number;
  covered_start_at: string | null;
  covered_end_at: string | null;
  strategic_read: string | null;
  why_it_matters: string | null;
  recommended_next_moves: string[];
  confidence_summary: JsonValue;
  source_coverage: JsonValue;
}

function jsonEntries(value: JsonValue): Array<[string, JsonValue]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).filter(([, v]) => v != null);
}

export function summarizeConfidence(value: JsonValue): string {
  const entries = jsonEntries(value);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => {
      if (typeof v === "number") {
        const pct = v > 0 && v <= 1 ? Math.round(v * 100) : Math.round(v);
        return `${k}: ${pct}${v > 0 && v <= 1 ? "%" : ""}`;
      }
      return `${k}: ${String(v)}`;
    })
    .join(" · ");
}

export function summarizeSourceCoverage(value: JsonValue): string {
  const entries = jsonEntries(value);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "—";
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 text-sm text-foreground">{value}</span>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-sm leading-6 text-foreground">{text}</p>
  );
}

export function PacketDetailPanel({
  packet,
  onClose,
}: {
  packet: IntelligencePacket;
  onClose: () => void;
}) {
  const moves = packet.recommended_next_moves ?? [];
  const confidenceEntries = jsonEntries(packet.confidence_summary);
  const sourceEntries = jsonEntries(packet.source_coverage);
  const hasCoverage = Boolean(packet.covered_start_at || packet.covered_end_at);
  const coverageRange = `${formatDate(packet.covered_start_at)} – ${formatDate(packet.covered_end_at)}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">
            {packet.target_name ?? "Untitled packet"}
          </p>
          <p className="text-sm capitalize text-muted-foreground">
            {packet.target_type ? `${packet.target_type} · ` : ""}
            {humanize(packet.packet_type)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close packet detail"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <StatusBadge status={packet.freshness_status} />
        {packet.current_status ? (
          <StatusBadge status={packet.current_status} />
        ) : null}
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-5 pb-8">
        {packet.executive_summary ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Executive Summary" />
            <Prose text={packet.executive_summary} />
          </section>
        ) : null}

        {packet.why_it_matters ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Why It Matters" />
            <Prose text={packet.why_it_matters} />
          </section>
        ) : null}

        {packet.strategic_read ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Strategic Read" />
            <Prose text={packet.strategic_read} />
          </section>
        ) : null}

        {moves.length > 0 ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Recommended Next Moves" />
            <ul className="space-y-2">
              {moves.map((move, idx) => (
                <li key={idx} className="flex gap-2 text-sm leading-6 text-foreground">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{move}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {confidenceEntries.length > 0 ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Confidence" />
            <dl className="space-y-2">
              {confidenceEntries.map(([key, value]) => {
                const display =
                  typeof value === "number"
                    ? value > 0 && value <= 1
                      ? `${Math.round(value * 100)}%`
                      : String(Math.round(value))
                    : String(value);
                return (
                  <div key={key} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm capitalize text-muted-foreground">
                      {humanize(key)}
                    </dt>
                    <dd className="text-sm font-medium tabular-nums text-foreground">
                      {display}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ) : null}

        {sourceEntries.length > 0 ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Source Coverage" />
            <dl className="space-y-2">
              {sourceEntries.map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm capitalize text-muted-foreground">
                    {humanize(key)}
                  </dt>
                  <dd className="text-sm text-foreground">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionRuleHeading label="Details" />
          <div className="space-y-2">
            <MetaRow label="Generated" value={formatDateTime(packet.generated_at)} />
            {hasCoverage ? (
              <MetaRow label="Coverage" value={coverageRange} />
            ) : null}
            <MetaRow label="Review Queue" value={packet.review_queue_count} />
            <MetaRow label="Stale Items" value={packet.stale_item_count} />
            <MetaRow
              label="Version"
              value={
                <span className="font-mono text-xs">{packet.packet_version}</span>
              }
            />
            {packet.compiler_version ? (
              <MetaRow
                label="Compiler"
                value={
                  <span className="font-mono text-xs">
                    {packet.compiler_version}
                  </span>
                }
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
