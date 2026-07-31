/**
 * context-resolver.ts
 *
 * Given a matched procore_tools row, assembles a complete context bundle
 * with all the references an agent needs to understand and fix the issue.
 */

import type { MatchedTool } from "./tool-matcher";

export type ToolContextBundle = {
  tool_name: string;
  tool_slug: string;
  tool_category: string;
  tool_description: string | null;

  /** Live Procore URL from the procore_tools table */
  procore_url: string | null;

  /** Path to the PRP document for this tool */
  prp_path: string | null;

  /** Research/planning artifacts folder */
  research_folder: string;

  /** Procore crawl manifest (if it has been generated) */
  manifest_path: string;

  /** Screenshots from prior crawls */
  screenshots_folder: string;

  /** Command to run a fresh Procore deep crawl */
  crawl_command: string;

  /** Structured resolution instructions */
  resolution_steps: string[];
};

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function normalizeToolSlug(slug: string): string {
  return normalizeRepoPath(slug).replace(/^\/+|\/+$/g, "");
}

/**
 * Build the full context bundle for a matched tool.
 */
export function resolveToolContext(tool: MatchedTool): ToolContextBundle {
  const slug = normalizeToolSlug(tool.slug);
  const researchFolder = normalizeRepoPath(`_bmad-output/planning-artifacts/${slug}/`);
  const manifestPath = normalizeRepoPath(`.claude/procore-manifests/${slug}/manifest.json`);
  const screenshotsFolder = normalizeRepoPath(`.claude/procore-manifests/${slug}/screenshots/`);
  const fallbackPrpPath = normalizeRepoPath(
    `_bmad-output/planning-artifacts/${slug}/prp-${slug}.md`,
  );
  const prpPath = normalizeRepoPath(tool.prp_path ?? fallbackPrpPath);

  return {
    tool_name: tool.name,
    tool_slug: slug,
    tool_category: tool.category,
    tool_description: tool.description,

    procore_url: tool.procore_link,
    prp_path: prpPath,
    research_folder: researchFolder,
    manifest_path: manifestPath,
    screenshots_folder: screenshotsFolder,
    crawl_command: `node scripts/playwright-crawl/procore-deep-crawl.js ${slug}`,

    resolution_steps: [
      `1. Read the PRP at \`${prpPath}\` to understand the intended behavior for ${tool.name}.`,
      `2. Check the research folder at \`${researchFolder}\` for screenshots, gap analyses, and design notes.`,
      `3. Read the crawl manifest at \`${manifestPath}\` to see field-level details captured from Procore.`,
      `4. If the manifest doesn't cover the specific feature mentioned in the feedback, run a fresh crawl:\n   \`node scripts/playwright-crawl/procore-deep-crawl.js ${slug}\``,
      tool.procore_link
        ? `5. You can also browse the live Procore page directly at:\n   ${tool.procore_link}`
        : `5. No direct Procore link is configured for this tool — check the procore_tools table or use the crawl command above.`,
      `6. Compare Procore's actual behavior with our implementation in the codebase, then implement the fix.`,
    ],
  };
}

/**
 * Format the context bundle as a Markdown section for inclusion in GitHub issues.
 */
export function formatContextForGitHub(context: ToolContextBundle): string {
  const lines = [
    "## Agent Context",
    "",
    `**Matched Tool:** ${context.tool_name} (${context.tool_category})`,
  ];

  if (context.tool_description) {
    lines.push(`**Description:** ${context.tool_description}`);
  }

  if (context.procore_url) {
    lines.push(`**Procore URL:** ${context.procore_url}`);
  }

  lines.push(
    `**PRP:** \`${context.prp_path}\``,
    `**Research Folder:** \`${context.research_folder}\``,
    `**Crawl Manifest:** \`${context.manifest_path}\``,
    `**Screenshots:** \`${context.screenshots_folder}\``,
    "",
    "### Resolution Steps",
    "",
    ...context.resolution_steps,
    "",
    "### If More Detail Is Needed",
    "",
    "Run the Procore deep crawl to capture the latest field-level data:",
    "```bash",
    context.crawl_command,
    "```",
  );

  return lines.join("\n");
}

/**
 * Format the context bundle as a structured JSON block for the agent payload.
 */
export function contextToAgentPayload(
  context: ToolContextBundle,
): Record<string, unknown> {
  return {
    matched_tool: {
      name: context.tool_name,
      slug: context.tool_slug,
      category: context.tool_category,
    },
    procore_url: context.procore_url,
    prp_path: context.prp_path,
    research_folder: context.research_folder,
    manifest_path: context.manifest_path,
    screenshots_folder: context.screenshots_folder,
    crawl_command: context.crawl_command,
    resolution_steps: context.resolution_steps,
  };
}
