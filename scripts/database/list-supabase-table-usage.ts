import { promises as fs } from "fs";
import path from "path";

const ROOT_DIRS = [path.resolve("frontend/src")];
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const OUTPUT_PATH = path.resolve("frontend/src/data/supabase-table-usage.json");

const tableUsage = new Map<string, Set<string>>();
const fileUsage = new Map<string, Set<string>>();

const tableLiteralRegex = /supabase\.from\(\s*(['`"])([^'"`]+)\1/g;

async function walk(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(entryPath);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.includes(path.extname(entry.name))) {
      continue;
    }

    const content = await fs.readFile(entryPath, "utf8");
    let match: RegExpExecArray | null;
    while ((match = tableLiteralRegex.exec(content)) !== null) {
      const tableName = match[2];

      if (!fileUsage.has(entryPath)) {
        fileUsage.set(entryPath, new Set());
      }
      fileUsage.get(entryPath)!.add(tableName);

      if (!tableUsage.has(tableName)) {
        tableUsage.set(tableName, new Set());
      }
      tableUsage.get(tableName)!.add(entryPath);
    }
  }
}

async function main() {
  for (const root of ROOT_DIRS) {
    await walk(root);
  }

  const sortedFiles = [...fileUsage.entries()].sort(([a], [b]) => a.localeCompare(b));
  const sortedTables = [...tableUsage.entries()].sort(([a], [b]) => a.localeCompare(b));

  const result = {
    fileUsage: sortedFiles.map(([file, tables]) => ({
      file: path.relative(process.cwd(), file),
      tables: [...tables].sort(),
    })),
    tableUsage: sortedTables.map(([table, files]) => ({
      table,
      files: [...files]
        .map((file) => path.relative(process.cwd(), file))
        .sort(),
    })),
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2));

  console.log("Supabase table usage by file:");
  for (const entry of result.fileUsage) {
    console.log(`\n${entry.file}`);
    console.log(`  - ${entry.tables.join(", ")}`);
  }

  console.log("\nSummary by table:");
  for (const entry of result.tableUsage) {
    console.log(`\n${entry.table}`);
    console.log(`  - ${entry.files.join("\n  - ")}`);
  }

  console.log(`\nTotal files scanned: ${result.fileUsage.length}`);
  console.log(`Total tables referenced: ${result.tableUsage.length}`);
  console.log(`Written asset: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Failed to gather Supabase table usage:", error);
  process.exit(1);
});
