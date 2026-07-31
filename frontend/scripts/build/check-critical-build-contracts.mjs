import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const exportedModuleContracts = [
  {
    modulePath: "src/hooks/use-comment-activity.ts",
    exports: ["buildCommentActivityItems", "useCommentActivity"],
  },
  {
    modulePath: "src/lib/collaboration/notification-links.ts",
    exports: ["getCollaborationNotificationHref", "getCommentDiscussionHref"],
  },
];

const importContracts = [
  // The first-party notification inbox owns notification rendering. The legacy
  // comment-activity hook still owns comment-to-discussion link construction.
  {
    importerPath: "src/hooks/use-comment-activity.ts",
    expectedImports: [
      {
        from: "@/lib/collaboration/notification-links",
        names: ["getCommentDiscussionHref"],
      },
    ],
  },
];

function absolutePath(relativePath) {
  return path.join(frontendRoot, relativePath);
}

function readSource(relativePath) {
  const sourcePath = absolutePath(relativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`[build-contracts] Missing required file: ${relativePath}`);
  }

  return readFileSync(sourcePath, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNamedExport(source, exportName) {
  const patterns = [
    new RegExp(`export\\s+function\\s+${escapeRegExp(exportName)}\\b`),
    new RegExp(`export\\s+(?:const|let|var)\\s+${escapeRegExp(exportName)}\\b`),
    new RegExp(
      `export\\s+(?:class|interface|type|enum)\\s+${escapeRegExp(exportName)}\\b`,
    ),
    new RegExp(`export\\s*\\{[^}]*\\b${escapeRegExp(exportName)}\\b[^}]*\\}`),
  ];

  return patterns.some((pattern) => pattern.test(source));
}

function hasNamedImport(source, modulePath, importName) {
  const importPattern = new RegExp(
    `import\\s*\\{[\\s\\S]*?\\b${escapeRegExp(importName)}\\b[\\s\\S]*?\\}\\s*from\\s*[\"']${escapeRegExp(modulePath)}[\"']`,
    "m",
  );

  return importPattern.test(source);
}

function verifyExportedModuleContracts() {
  for (const contract of exportedModuleContracts) {
    const source = readSource(contract.modulePath);

    for (const exportName of contract.exports) {
      if (!hasNamedExport(source, exportName)) {
        throw new Error(
          `[build-contracts] ${contract.modulePath} must export ${exportName} for notifications/comment activity build contracts.`,
        );
      }
    }
  }
}

function verifyImportContracts() {
  for (const contract of importContracts) {
    const source = readSource(contract.importerPath);

    for (const expectedImport of contract.expectedImports) {
      for (const expectedName of expectedImport.names) {
        if (!hasNamedImport(source, expectedImport.from, expectedName)) {
          throw new Error(
            `[build-contracts] ${contract.importerPath} must import ${expectedName} from ${expectedImport.from}.`,
          );
        }
      }
    }
  }
}

function main() {
  verifyExportedModuleContracts();
  verifyImportContracts();
  console.log(
    "[build-contracts] Verified notifications/comment activity import and export contracts",
  );
}

main();
