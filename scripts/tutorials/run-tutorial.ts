import path from "node:path";
import { pathToFileURL } from "node:url";

import { runTutorial, type TutorialDefinition } from "./tutorial-recorder";

interface CliOptions {
  baseUrl: string;
  docsScreenshots: boolean;
  headed: boolean;
  outputDir?: string;
  storageState?: string;
  workflowPath?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: process.env.TUTORIAL_BASE_URL ?? "http://localhost:3001",
    docsScreenshots: false,
    headed: false,
    storageState: process.env.TUTORIAL_STORAGE_STATE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--base-url") {
      options.baseUrl = requireValue(argv, ++index, arg);
    } else if (arg === "--docs-screenshots") {
      options.docsScreenshots = true;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--output-dir") {
      options.outputDir = requireValue(argv, ++index, arg);
    } else if (arg === "--storage-state") {
      options.storageState = requireValue(argv, ++index, arg);
    } else if (!options.workflowPath) {
      options.workflowPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.workflowPath) {
    throw new Error("Missing workflow path.");
  }

  return options;
}

function requireValue(argv: string[], index: number, flag: string) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/tutorials/run-tutorial.ts <workflow.ts> [options]

Options:
  --base-url <url>        App origin. Default: TUTORIAL_BASE_URL or http://localhost:3001
  --docs-screenshots      Hide persistent app chrome before capturing screenshots
  --storage-state <file>  Playwright storage state JSON for authenticated routes
  --output-dir <dir>      Output directory. Default: docs/tutorials/{module}/{tutorial}
  --headed                Run browser headed
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workflowPath = path.resolve(options.workflowPath!);
  const module = await import(pathToFileURL(workflowPath).href);
  const exported = module.default ?? module.tutorial;
  const definition = (exported?.default ?? exported) as TutorialDefinition | undefined;

  if (!definition?.workflow) {
    throw new Error(`Workflow did not export a tutorial definition: ${workflowPath}`);
  }

  const outputDir = path.resolve(
    options.outputDir ??
      path.join(process.cwd(), "docs", "tutorials", definition.module, definition.slug),
  );
  if (definition.dataPath) {
    definition.dataPath = path.resolve(path.dirname(workflowPath), definition.dataPath);
  }

  const result = await runTutorial(definition, {
    baseUrl: options.baseUrl,
    docsScreenshots: options.docsScreenshots,
    headed: options.headed,
    outputDir,
    storageState: options.storageState,
  });

  console.log(JSON.stringify(result, null, 2));
}

// `tsx` runs this CLI in CommonJS mode, where a pending promise alone does not
// keep Node alive. Keep the event loop active until the capture settles so the
// recorder can write its manifest, screenshots, and finalized video.
const keepAlive = setInterval(() => undefined, 1 << 30);

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
  });
