import { StatusDot } from "@/components/ds";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";

import type {
  EveToolScreenshotStatus,
  EveToolTestRow,
  EveToolTestStatus,
} from "./eve-tool-test-registry";

const STATUS_LABELS: Record<EveToolTestStatus, string> = {
  passed: "Passed",
  needs_retest: "Needs retest",
  blocked: "Blocked",
  not_tested: "Not tested",
};

const STATUS_VARIANTS = {
  passed: "success",
  needs_retest: "warning",
  blocked: "error",
  not_tested: "neutral",
} as const;

const SCREENSHOT_STATUS_LABELS: Record<EveToolScreenshotStatus, string> = {
  verified: "Verified",
  not_verified: "Not verified",
};

const SCREENSHOT_STATUS_VARIANTS = {
  verified: "success",
  not_verified: "neutral",
} as const;

export const eveToolTestingColumnConfig: ColumnConfig[] = [
  { id: "feature", label: "Feature", alwaysVisible: true },
  { id: "description", label: "Description", defaultVisible: false },
  { id: "status", label: "Status", defaultVisible: true },
  {
    id: "screenshot",
    label: "Screenshot verification",
    defaultVisible: true,
  },
  { id: "testedAt", label: "Tested date", defaultVisible: true },
  { id: "family", label: "Family", defaultVisible: true },
  { id: "effect", label: "Effect", defaultVisible: true },
  { id: "scope", label: "Scope", defaultVisible: true },
  { id: "testPrompt", label: "Test prompt", defaultVisible: true },
  { id: "blocker", label: "Blocker", defaultVisible: true },
  { id: "evidence", label: "Evidence", defaultVisible: false },
  { id: "approval", label: "Approval", defaultVisible: false },
  { id: "toolName", label: "Tool name", defaultVisible: false },
];

export const eveToolTestingDefaultVisibleColumns =
  eveToolTestingColumnConfig
    .filter((column) => column.defaultVisible || column.alwaysVisible)
    .map((column) => column.id);

export const eveToolTestingFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "blocked", label: "Blocked" },
      { value: "needs_retest", label: "Needs retest" },
      { value: "not_tested", label: "Not tested" },
      { value: "passed", label: "Passed" },
    ],
  },
  {
    id: "screenshot",
    label: "Screenshot verification",
    type: "select",
    options: [
      { value: "verified", label: "Verified" },
      { value: "not_verified", label: "Not verified" },
    ],
  },
  {
    id: "effect",
    label: "Effect",
    type: "select",
    options: [
      { value: "read", label: "Read" },
      { value: "write", label: "Write" },
      { value: "delivery", label: "Delivery" },
    ],
  },
  {
    id: "scope",
    label: "Scope",
    type: "select",
    options: [
      { value: "Project", label: "Project" },
      { value: "Company", label: "Company" },
    ],
  },
];

export function buildEveToolTestingColumns(): TableColumn<EveToolTestRow>[] {
  return [
    {
      id: "feature",
      label: "Feature",
      alwaysVisible: true,
      sortable: true,
      sortValue: (row) => row.label,
      csvValue: (row) => row.label,
      render: (row) => (
        <span className="block min-w-48 max-w-80 truncate text-sm font-medium text-foreground">
          {row.label}
        </span>
      ),
    },
    {
      id: "screenshot",
      label: "Screenshot verification",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.screenshotStatus,
      csvValue: (row) =>
        row.screenshotPath
          ? `${SCREENSHOT_STATUS_LABELS[row.screenshotStatus]}: ${row.screenshotPath}`
          : SCREENSHOT_STATUS_LABELS[row.screenshotStatus],
      render: (row) =>
        row.screenshotPath ? (
          <a
            href={row.screenshotPath}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Verified
          </a>
        ) : (
          <StatusDot
            status={SCREENSHOT_STATUS_LABELS[row.screenshotStatus]}
            variant={SCREENSHOT_STATUS_VARIANTS[row.screenshotStatus]}
          />
        ),
    },
    {
      id: "description",
      label: "Description",
      csvValue: (row) => row.description,
      render: (row) => (
        <span className="block min-w-64 max-w-96 truncate text-sm text-muted-foreground">
          {row.description}
        </span>
      ),
    },
    {
      id: "testedAt",
      label: "Tested date",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.testedAt ?? "9999-12-31",
      csvValue: (row) => row.testedAt ?? "Not tested",
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {row.testedAt ?? "Not tested"}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.status,
      csvValue: (row) => STATUS_LABELS[row.status],
      render: (row) => (
        <StatusDot
          status={STATUS_LABELS[row.status]}
          variant={STATUS_VARIANTS[row.status]}
        />
      ),
    },
    {
      id: "family",
      label: "Family",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.family,
      csvValue: (row) => row.family,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.family}</span>
      ),
    },
    {
      id: "effect",
      label: "Effect",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.effect,
      csvValue: (row) => row.effect,
      render: (row) => (
        <span className="text-sm capitalize text-muted-foreground">
          {row.effect}
        </span>
      ),
    },
    {
      id: "scope",
      label: "Scope",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.scope,
      csvValue: (row) => row.scope,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.scope}</span>
      ),
    },
    {
      id: "testPrompt",
      label: "Test prompt",
      defaultVisible: true,
      csvValue: (row) => row.testPrompt,
      render: (row) => (
        <span className="block min-w-64 max-w-96 truncate text-sm text-foreground">
          {row.testPrompt}
        </span>
      ),
    },
    {
      id: "blocker",
      label: "Blocker",
      defaultVisible: true,
      csvValue: (row) => row.blocker ?? "",
      render: (row) => (
        <span
          className={
            row.blocker
              ? "block min-w-48 max-w-80 text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {row.blocker ?? "None"}
        </span>
      ),
    },
    {
      id: "evidence",
      label: "Evidence",
      csvValue: (row) => row.evidence ?? "",
      render: (row) => (
        <span className="block max-w-80 text-sm text-muted-foreground">
          {row.evidence ?? "No live evidence recorded"}
        </span>
      ),
    },
    {
      id: "approval",
      label: "Approval",
      csvValue: (row) => row.approval,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.approval}</span>
      ),
    },
    {
      id: "toolName",
      label: "Tool name",
      csvValue: (row) => row.name,
      render: (row) => (
        <code className="text-sm text-muted-foreground">{row.name}</code>
      ),
    },
  ];
}

export function getEveToolTestStatusLabel(
  status: EveToolTestStatus,
): string {
  return STATUS_LABELS[status];
}

export function getEveToolTestStatusVariant(
  status: EveToolTestStatus,
): (typeof STATUS_VARIANTS)[EveToolTestStatus] {
  return STATUS_VARIANTS[status];
}
