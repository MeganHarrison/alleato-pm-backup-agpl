import "server-only";

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { inferPageAccessDefaults } from "@/lib/page-access";
import type { InventoryRoute } from "@/app/(admin)/site-map/site-map-client";

/**
 * Reads and shapes the generated app route inventory (`docs/reports/route-inventory.csv`)
 * into `InventoryRoute[]`. Shared by the site map (Page Access) and any curated
 * view that filters the same route set — e.g. the tagged Megan's Dashboard page —
 * so both surfaces stay in sync with a single derivation of page/category/layout.
 */

type InventoryCsvRow = {
  route: string;
  kind: string;
  dynamic: string;
  refCount: string;
  file: string;
  refSample: string;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      value += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value);
  return values;
}

function parseRouteInventoryCsv(csv: string): InventoryCsvRow[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine);
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = parseCsvLine(line);
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = values[index] ?? "";
        return row;
      }, {}) as InventoryCsvRow;
    })
    .filter((row) => row.route);
}

// Tokens that should render fully uppercased instead of title-cased.
const ACRONYMS: Record<string, string> = {
  ai: "AI", rag: "RAG", rfi: "RFI", rfis: "RFIs", rfq: "RFQ", rfqs: "RFQs",
  pco: "PCO", pcos: "PCOs", co: "CO", sov: "SOV", wip: "WIP", qa: "QA",
  psr: "PSR", sop: "SOP", gc: "GC", ap: "AP", ar: "AR", erp: "ERP",
  og: "OG", qr: "QR", pdf: "PDF", db: "DB", api: "API", fm: "FM",
  prp: "PRP", crm: "CRM",
};

// Concrete segments that name an action rather than a resource.
const ACTION_LABELS: Record<string, string> = {
  new: "New",
  edit: "Edit",
  create: "Create",
};

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .map((word) => {
      const lower = word.toLowerCase();
      return ACRONYMS[lower] ?? word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Builds a differentiated, breadcrumb-style page name from the full route path
 * rather than just its last segment. This keeps list, create, and detail pages
 * distinct ("Direct Costs" vs "Direct Costs / New" vs "Direct Costs / Detail")
 * instead of collapsing every create page to "New" and every detail page to its
 * parent's name.
 */
export function toTitle(route: string): string {
  if (route === "/") return "Home";

  let segments = route
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));

  if (segments[0] === "[projectId]") {
    segments = segments.slice(1);
  }

  const parts: string[] = [];
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;

    if (segment.startsWith("[")) {
      if (isLast) parts.push("Detail");
      return;
    }

    const lower = segment.toLowerCase();
    if (ACTION_LABELS[lower]) {
      parts.push(ACTION_LABELS[lower]);
      return;
    }

    parts.push(humanizeSegment(segment));
  });

  return parts.length > 0 ? parts.join(" / ") : "Home";
}

function inferCategory(route: string, file: string): InventoryRoute["category"] {
  const routeLower = route.toLowerCase();
  const fileLower = file.toLowerCase();

  if (routeLower.includes("procore")) {
    return "Procore";
  }
  if (routeLower.includes("rag") || routeLower.includes("embedding") || routeLower.includes("chunk") || routeLower.includes("vector")) {
    return "RAG";
  }
  if (routeLower.includes("acumatica") || routeLower.includes("accounting") || routeLower.includes("ap-bill") || routeLower.includes("job-planner")) {
    return "Accounting";
  }
  if (routeLower.includes("dev-tools") || routeLower.includes("debug") || routeLower.includes("style-guide") || routeLower.includes("tokens") || routeLower.includes("design-system") || fileLower.includes("/(dev)/")) {
    return "Development";
  }
  // Check Emails before AI — "email" contains the substring "ai".
  if (routeLower.includes("email") || routeLower.includes("outlook") || routeLower.includes("inbox")) {
    return "Emails";
  }
  if (routeLower.includes("ai") || routeLower.includes("intelligence")) {
    return "AI Intelligence";
  }
  if (routeLower.includes("admin") || fileLower.includes("/(admin)/")) {
    return "Admin";
  }
  if (routeLower.includes("budget") || routeLower.includes("invoice") || routeLower.includes("contract") || routeLower.includes("change-order") || routeLower.includes("commitment") || routeLower.includes("direct-cost")) {
    return "Financials";
  }
  if (routeLower.includes("document") || routeLower.includes("drawing") || routeLower.includes("specification") || routeLower.includes("photo") || routeLower.includes("file")) {
    return "Documents";
  }
  if (routeLower.includes("directory") || routeLower.includes("team") || routeLower.includes("people") || routeLower.includes("vendor") || routeLower.includes("company") || routeLower.includes("contact")) {
    return "Team / Directory";
  }
  if (routeLower.includes("test") || routeLower.includes("qa") || routeLower.includes("errors")) {
    return "Testing / QA";
  }
  if (routeLower.includes("design") || routeLower.includes("style-guide")) {
    return "Design";
  }
  if (routeLower.includes("settings") || routeLower.includes("auth") || routeLower.includes("api-docs") || routeLower.includes("table-pages")) {
    return "System";
  }
  return "Project Management";
}

function inferType(route: string, file: string): InventoryRoute["type"] {
  const routeLower = route.toLowerCase();
  const fileLower = file.toLowerCase();

  if (route.includes("[projectId]")) return "Project Page";
  if (fileLower.includes("/(admin)/") || routeLower.includes("/admin")) return "Admin Page";
  if (routeLower.includes("report") || routeLower.includes("wip") || routeLower.includes("insight")) return "Report";
  if (routeLower.includes("ai") || routeLower.includes("rag") || routeLower.includes("intelligence")) return "AI / Intelligence";
  if (routeLower.includes("settings") || routeLower.includes("auth")) return "Settings";
  if (fileLower.includes("/(tables)/") || routeLower.includes("table")) return "Database / Table";
  if (routeLower.includes("/new") || routeLower.includes("/edit") || routeLower.includes("/create") || routeLower.includes("workflow")) return "Workflow";
  return "Utility";
}

function inferLayout(route: string, file: string, kind: string): InventoryRoute["layout"] {
  if (kind === "api") return "Other";

  const routeLower = route.toLowerCase();
  const fileLower = file.toLowerCase();
  const segments = route.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "";

  if (routeLower.endsWith("/edit")) {
    return "Edit";
  }
  if (routeLower.endsWith("/new") || routeLower.endsWith("/create") || routeLower.includes("/form")) {
    return "Form";
  }
  if (/^\[.+Id\]$/.test(lastSegment) && lastSegment !== "[projectId]") {
    return "Detail";
  }
  if (fileLower.includes("/(tables)/") || routeLower.includes("table")) {
    return "Table";
  }
  if (
    route === "/" ||
    lastSegment === "[projectId]" ||
    routeLower.endsWith("/home") ||
    routeLower.includes("dashboard") ||
    routeLower.includes("overview") ||
    routeLower.includes("command-center") ||
    routeLower.includes("intelligence")
  ) {
    return "Dashboard";
  }
  if (
    routeLower.includes("settings") ||
    routeLower.includes("docs") ||
    routeLower.includes("guide") ||
    routeLower.includes("design") ||
    routeLower.includes("readme")
  ) {
    return "Content";
  }
  return "Other";
}

export function readRouteInventory(): InventoryRoute[] {
  const candidates = [
    join(process.cwd(), "docs", "reports", "route-inventory.csv"),
    join(process.cwd(), "..", "docs", "reports", "route-inventory.csv"),
  ];
  const inventoryPath = candidates.find((candidate) => existsSync(candidate));

  if (!inventoryPath) return [];

  const csv = readFileSync(inventoryPath, "utf8");
  return parseRouteInventoryCsv(csv).map((row) => {
    const category = inferCategory(row.route, row.file);
    const access = inferPageAccessDefaults({
      route: row.route,
      file: row.file,
      category,
    });

    return {
      route: row.route,
      page: toTitle(row.route),
      category,
      type: inferType(row.route, row.file),
      layout: inferLayout(row.route, row.file, row.kind),
      status: "Needs Review",
      notes: "",
      lastReviewed: "",
      dynamic: row.dynamic === "true",
      kind: row.kind,
      refCount: Number(row.refCount) || 0,
      file: row.file,
      refSample: row.refSample,
      accessLevel: access.accessLevel,
      permissionModule: access.permissionModule,
      accessUpdatedAt: null,
      accessIsExplicit: false,
      roleAccessMode: "inherit_requirement",
      allowedPermissionTemplateIds: [],
      roleAccessUpdatedAt: null,
      roleAccessIsExplicit: false,
      tags: [],
    } satisfies InventoryRoute;
  });
}
