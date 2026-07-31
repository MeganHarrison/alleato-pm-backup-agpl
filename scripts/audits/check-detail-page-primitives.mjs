#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const explicitFiles = process.argv.slice(2);

const detailPageInventory = [
  {
    route: "frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/change-orders/prime/[primeCoId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/commitment-pcos/[pcoId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/invoices/[invoiceId]/page.tsx",
    implementationFiles: [
      "frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx",
    ],
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx",
  },
  {
    route: "frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx",
  },
  {
    route: "frontend/src/app/(main)/[projectId]/documents/[documentId]/page.tsx",
    implementationFiles: [
      "frontend/src/features/documents/project-document-preview-client.tsx",
    ],
  },
  {
    route: "frontend/src/app/(main)/[projectId]/drawings/[drawingId]/page.tsx",
  },
  {
    route: "frontend/src/app/(main)/[projectId]/estimates/[estimateId]/page.tsx",
    implementationFiles: [
      "frontend/src/app/(main)/[projectId]/estimates/[estimateId]/estimate-detail-client-v2.tsx",
    ],
  },
  {
    route: "frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/invoicing/subcontractor/[invoiceId]/page.tsx",
    implementationFiles: [
      "frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx",
    ],
  },
  {
    route: "frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx",
    implementationFiles: [
      "frontend/src/components/meetings/meeting-detail-content.tsx",
    ],
  },
  {
    route: "frontend/src/app/(main)/[projectId]/pcos/[pcoId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/change-orders/pcos/[pcoId]/page.tsx",
    implementationFiles: [
      "frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx",
    ],
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/invoices/[invoiceId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/progress-reports/[reportId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/punch-list/[punchItemId]/page.tsx",
  },
  {
    route: "frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/specifications/[sectionId]/page.tsx",
  },
  {
    route:
      "frontend/src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx",
    implementationFiles: [
      "frontend/src/features/submittals/submittal-detail-client.tsx",
    ],
  },
];

const inventoryByRoute = new Map(
  detailPageInventory.map((entry) => [path.normalize(entry.route), entry]),
);

function changedFiles() {
  try {
    const output = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        "HEAD",
        "--",
        "frontend/src/app",
        "frontend/src/components",
        "frontend/src/features",
      ],
      { encoding: "utf8" },
    );
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function routeFilesFor(files) {
  return files
    .map((file) => path.normalize(file))
    .filter((file) => file.endsWith("/page.tsx"))
    .filter((file) => file.includes("/["))
    .filter((file) => !file.includes("/new/page.tsx"))
    .filter((file) => !file.includes("/edit/page.tsx"));
}

function filesToScan() {
  const inventoryRoutes = detailPageInventory.map((entry) =>
    path.normalize(entry.route),
  );
  const requestedRoutes = routeFilesFor(explicitFiles);
  const changedRoutes = routeFilesFor(changedFiles());
  const selectedRoutes = new Set([
    ...inventoryRoutes,
    ...requestedRoutes,
    ...changedRoutes,
  ]);
  const selectedFiles = new Set();

  for (const route of selectedRoutes) {
    selectedFiles.add(route);
    const inventoryEntry = inventoryByRoute.get(route);
    for (const implementationFile of inventoryEntry?.implementationFiles ?? []) {
      selectedFiles.add(path.normalize(implementationFile));
    }
  }

  for (const explicitFile of explicitFiles) {
    const normalized = path.normalize(explicitFile);
    if (!normalized.endsWith("/page.tsx")) {
      selectedFiles.add(normalized);
    }
  }

  return [...selectedFiles].filter((file) => existsSync(file));
}

const scanFiles = filesToScan();
const files = scanFiles
  .filter((file) => file.endsWith("/page.tsx"))
  .filter((file) => file.includes("/["));

const supportingFiles = scanFiles.filter((file) => !files.includes(file));

const bannedPatterns = [
  {
    pattern: /<PageShell\b[^>]*variant=["']dashboard["']/,
    message:
      "record detail pages must use a detail PageShell variant, not dashboard",
  },
  {
    pattern: /from ["']@\/components\/ui\/tabs["']/,
    message:
      "record detail pages must use PageTabs instead of raw ui tab primitives",
  },
  {
    pattern: /<Tabs(?:List|Trigger|Content)\b/,
    message:
      "record detail pages must use PageTabs instead of raw TabsList/TabsTrigger/TabsContent",
  },
  {
    pattern: /rounded-md\s+border\s+border-border\s+bg-muted\s+p-6/,
    message:
      "record detail summary panels must use DetailPanel instead of page-local rounded/border/bg-muted shells",
  },
  {
    // General metadata should use shared DetailField/DetailFieldGrid. Compact
    // financial, key-date, and side-panel ledgers may still use LabelValueRow.
    pattern: /\b(?:function|const)\s+DetailField\b/,
    message:
      "record detail pages must use the shared DetailField primitive instead of page-local DetailField helpers",
  },
];

const failures = [];

for (const inventoryEntry of detailPageInventory) {
  const route = path.normalize(inventoryEntry.route);
  if (!existsSync(route)) {
    failures.push(`${route}: audited detail route is missing`);
  }
  for (const implementationFile of inventoryEntry.implementationFiles ?? []) {
    const normalized = path.normalize(implementationFile);
    if (!existsSync(normalized)) {
      failures.push(`${route}: implementation file is missing: ${normalized}`);
    }
  }
}

for (const file of [...files, ...supportingFiles]) {
  const source = readFileSync(file, "utf8");

  for (const rule of bannedPatterns) {
    if (rule.pattern.test(source)) {
      failures.push(`${file}: ${rule.message}`);
    }
  }
}

for (const inventoryEntry of detailPageInventory) {
  const ownedFiles = [
    path.normalize(inventoryEntry.route),
    ...(inventoryEntry.implementationFiles ?? []).map((file) =>
      path.normalize(file),
    ),
  ].filter((file) => existsSync(file));
  const hasSharedShell = ownedFiles.some((file) =>
    readFileSync(file, "utf8").includes("<PageShell"),
  );

  if (!hasSharedShell) {
    failures.push(
      `${inventoryEntry.route}: audited detail page must use PageShell in the route or delegated implementation`,
    );
  }
}

if (failures.length > 0) {
  console.error("Detail page primitive guardrail failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const scanned = files.map((file) => path.relative(process.cwd(), file));
const inventoryRouteCount = detailPageInventory.length;
const extraRouteCount = Math.max(scanned.length - inventoryRouteCount, 0);
console.log(
  `Detail page primitive guardrail passed for ${inventoryRouteCount} audited route(s)${
    extraRouteCount ? ` plus ${extraRouteCount} changed dynamic route(s)` : ""
  }.`,
);
