/**
 * @file etl_ingest_procore_crawl.js
 * @description ETL script that reads metadata.json files from crawl output and
 * ingests discovered UI actions into Supabase (app_system_actions table).
 *
 * Reads from: dom/<page-name>/metadata.json
 *
 * Extracts actions from:
 *   - systemActions[]    (interaction-discovered actions)
 *   - clickableDetails[] (buttons, links)
 *   - dropdownDetails[]  (dropdown menus)
 *   - tabDetails[]       (tab navigation)
 *
 * Environment variables:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   PROCORE_MODULE            - Module name (e.g. "submittals")
 *   CRAWL_ROOT_DIR            - Root directory for crawl data (default: ./procore-crawls)
 *   CRAWL_DIR                 - Absolute path override for module directory
 *
 * Usage:
 *   PROCORE_MODULE=submittals node etl_ingest_procore_crawl.js
 *   CRAWL_DIR=/path/to/crawl PROCORE_MODULE=submittals node etl_ingest_procore_crawl.js
 */
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CRAWL_ROOT_DIR,
  PROCORE_MODULE
} = process.env;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const MODULE_DIR = process.env.CRAWL_DIR || path.join(CRAWL_ROOT_DIR, PROCORE_MODULE);
const DOM_DIR = path.join(MODULE_DIR, "dom");

async function getAllMetadataFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllMetadataFiles(fullPath));
    } else if (entry.name === "metadata.json") {
      files.push(fullPath);
    }
  }
  return files;
}

const NOISE_LABELS = ["More", "Learn More", "Feedback", "SearchCmdK"];

function isNoise(label) {
  if (!label || label.trim().length < 3) return true;
  if (NOISE_LABELS.includes(label.trim())) return true;
  return false;
}

async function insertAction(label, triggerType, source) {
  const trimmed = label?.trim();
  if (isNoise(trimmed)) return;

  const { error } = await supabase
    .from("app_system_actions")
    .insert({
      label: trimmed,
      trigger_type: triggerType,
      affects_resource: PROCORE_MODULE,
      source
    });

  if (error) {
    console.error("❌ Action insert failed:", trimmed, error.message);
  } else {
    console.log("✅ Inserted action:", trimmed, `(${triggerType})`);
  }
}

/**
 * Extract actions from metadata produced by the generic crawler.
 * Reads systemActions[], clickableDetails[], dropdownDetails[], tabDetails[].
 */
function extractActions(metadata) {
  const actions = [];

  // Interaction-discovered actions (context menus, modal buttons, etc.)
  if (Array.isArray(metadata.systemActions)) {
    for (const a of metadata.systemActions) {
      if (a.text) {
        actions.push({ label: a.text, triggerType: a.type, source: "interaction" });
      }
    }
  }

  // Clickable elements (buttons, links)
  if (Array.isArray(metadata.clickableDetails)) {
    for (const btn of metadata.clickableDetails) {
      if (btn.text) {
        actions.push({ label: btn.text, triggerType: btn.type || "button", source: "clickable" });
      }
    }
  }

  // Dropdown details
  if (Array.isArray(metadata.dropdownDetails)) {
    for (const item of metadata.dropdownDetails) {
      if (item.text || item.label) {
        actions.push({ label: item.text || item.label, triggerType: item.type || "dropdown", source: "dropdown" });
      }
    }
  }

  // Tabs
  if (Array.isArray(metadata.tabDetails)) {
    for (const tab of metadata.tabDetails) {
      if (tab.text) {
        actions.push({ label: tab.text, triggerType: "tab", source: "tab-detail" });
      }
    }
  }

  return actions;
}

async function runETL() {
  console.log(`🚀 ETL for ${PROCORE_MODULE}`);

  if (!await fs.pathExists(DOM_DIR)) {
    console.error(`❌ No dom/ directory found at ${DOM_DIR}`);
    process.exit(1);
  }

  const files = await getAllMetadataFiles(DOM_DIR);
  console.log(`📄 Found ${files.length} metadata files`);

  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const metadata = await fs.readJson(file);
    const actions = extractActions(metadata);

    if (actions.length === 0) {
      skipped++;
      continue;
    }

    for (const { label, triggerType, source } of actions) {
      await insertAction(label, triggerType, source);
      if (!isNoise(label?.trim())) inserted++;
    }
  }

  console.log(`\n📊 Summary: ${inserted} actions inserted, ${skipped} files had no actions`);
  console.log("🎉 ETL complete");
}

runETL().catch(console.error);
