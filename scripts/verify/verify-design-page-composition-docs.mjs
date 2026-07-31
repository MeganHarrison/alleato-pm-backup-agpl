import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const requiredFiles = [
  "DESIGN.md",
  "docs/design/README.md",
  "docs/design/DESIGN-PRINCIPLES.md",
  "docs/design/page-archetypes.md",
  "frontend/src/app/(main)/AGENTS.md",
];

const failures = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Missing canonical design reference: ${relativePath}`);
  }
}

if (failures.length === 0) {
  const design = fs.readFileSync(path.join(root, "DESIGN.md"), "utf8");
  const archetypes = fs.readFileSync(
    path.join(root, "docs/design/page-archetypes.md"),
    "utf8",
  );
  const routeRules = fs.readFileSync(
    path.join(root, "frontend/src/app/(main)/AGENTS.md"),
    "utf8",
  );
  const rootAgentRules = fs.readFileSync(
    path.join(root, "AGENTS.md"),
    "utf8",
  );
  const designIndex = fs.readFileSync(
    path.join(root, "docs/design/README.md"),
    "utf8",
  );
  const normalizedDesign = design.replace(/\s+/g, " ");

  const requiredDesignPhrases = [
    "docs/design/page-archetypes.md",
    "Product signature without 3D",
    "operational context anchored to real project artifacts",
    "Mandatory screenshot proof",
  ];

  const requiredArchetypes = [
    "Archetype: resource or knowledge library",
    "Archetype: entity index",
    "Archetype: record detail",
    "Archetype: create or edit form",
    "Archetype: overview or monitoring surface",
    "Archetype: responsive split workspace",
  ];

  const prohibitedRouteRules = [
    "Use PageShell. Always.",
    "Home/overview + KPI cards",
    "Use `<Card>` for: form sections",
  ];

  for (const phrase of requiredDesignPhrases) {
    if (!normalizedDesign.includes(phrase)) {
      failures.push(`DESIGN.md is missing required contract: ${phrase}`);
    }
  }

  for (const archetype of requiredArchetypes) {
    if (!archetypes.includes(archetype)) {
      failures.push(`Page archetypes are missing: ${archetype}`);
    }
  }

  for (const phrase of prohibitedRouteRules) {
    if (routeRules.includes(phrase)) {
      failures.push(`Nested frontend instructions still teach: ${phrase}`);
    }
  }

  const requiredScreenshotContracts = [
    {
      file: "AGENTS.md",
      content: rootAgentRules,
      phrases: [
        "Mandatory screenshot completion gate",
        "Every task that creates, changes, fixes, or restyles user-facing frontend UI",
        "Tests, typechecks, DOM snapshots, accessibility trees, videos, and prose do not replace",
      ],
    },
    {
      file: "frontend/src/app/(main)/AGENTS.md",
      content: routeRules,
      phrases: [
        "Capture mandatory screenshot proof",
        "No user-facing frontend change is complete without screenshots",
        "If valid screenshot proof cannot be captured, report `Blocked/Deferred`",
      ],
    },
  ];

  for (const contract of requiredScreenshotContracts) {
    const normalizedContent = contract.content.replace(/\s+/g, " ");
    for (const phrase of contract.phrases) {
      if (!normalizedContent.includes(phrase)) {
        failures.push(
          `${contract.file} is missing screenshot contract: ${phrase}`,
        );
      }
    }
  }

  if (!designIndex.includes("[Root `DESIGN.md`](../../DESIGN.md)")) {
    failures.push("Design index does not point to root DESIGN.md as canonical.");
  }
}

if (failures.length > 0) {
  console.error("Design page-composition documentation contract failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Design page-composition documentation contract passed: canonical authority, positive archetypes, non-3D signature, mandatory screenshot proof, and nested agent rules agree.",
);
