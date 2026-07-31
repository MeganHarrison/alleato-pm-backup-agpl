"use client";

import * as React from "react";

import { DetailField } from "@/components/ds";
import { formatDate } from "@/lib/format";
import { useCompanies } from "@/hooks/use-companies";
import type { Database } from "@/types/database.types";
import { US_STATE_OPTIONS } from "@/lib/create-project/form";

type Project = Database["public"]["Tables"]["projects"]["Row"];

interface ProjectInfoPanelProps {
  project: Project;
}

type ProjectLegacyFields = {
  "job number"?: string | null;
  "start date"?: string | null;
};

const str = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";

export function ProjectInfoPanel({
  project,
}: ProjectInfoPanelProps): React.ReactElement {
  const { options: companyOptions } = useCompanies();

  const record = project as Project & ProjectLegacyFields;
  const meta =
    (project.summary_metadata as Record<string, unknown> | null) ?? {};

  const companyLabel =
    companyOptions.find((option) => option.value === project.company_id)?.label ??
    "Set client";

  const stateLabel =
    US_STATE_OPTIONS.find((option) => option.value === project.state)?.label ??
    "Set state";

  const city = str(meta.city) || "Set city";
  const startDate = record["start date"] ? formatDate(str(record["start date"])) : "Set date";
  const substantialCompletion = meta.substantial_completion
    ? formatDate(str(meta.substantial_completion))
    : "Set date";

  return (
    <div className="space-y-3">
      <DetailField label="Project Name">{project.name || "—"}</DetailField>
      <DetailField label="Job Number">
        {str(record["job number"]) || str(project.project_number) || "Set job #"}
      </DetailField>
      <DetailField label="Client">{companyLabel}</DetailField>
      <DetailField label="City">{city}</DetailField>
      <DetailField label="State">{stateLabel}</DetailField>
      <DetailField label="Start Date">{startDate}</DetailField>
      <DetailField label="Substantial Completion Date">
        {substantialCompletion}
      </DetailField>
    </div>
  );
}
