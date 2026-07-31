# Feedback Fix Skill

When working on a client feedback item (from the feedback inbox or a GitHub issue
labeled `admin-feedback`), follow this structured resolution process.

## 1. Identify the Tool

Every feedback item should have a `tool_id` or `agent_context` attached. If not:

```bash
# Check the procore_tools table for the relevant tool
# Look for keywords in the feedback title/description
```

Common mappings:
- "forecast", "budget", "cost code", "job plan" → **Budget** tool
- "change order", "CO", "PCO" → **Change Orders** tool
- "commitment", "subcontract", "PO" → **Commitments** tool
- "invoice", "billing", "pay app" → **Invoicing** tool
- "RFI" → **RFIs** tool
- "submittal" → **Submittals** tool

## 2. Read the Context Bundle

If `agent_context` is populated on the feedback item, it contains everything you need:

- `prp_path` — Read this first to understand intended behavior
- `research_folder` — Check for screenshots, gap analyses, design notes
- `manifest_path` — Field-level details captured from Procore
- `procore_url` — The live Procore URL for this tool
- `crawl_command` — Command to run a fresh Procore crawl

## 3. Read the PRP

The PRP (Product Requirements Plan) at `_bmad-output/planning-artifacts/{tool-slug}/`
describes what our implementation should do. Read it to understand:

- What fields/features Procore has for this tool
- What our implementation should model
- Any known gaps or limitations

## 4. Check the Crawl Manifest

Read `.claude/procore-manifests/{tool-slug}/manifest.json` to see the field-level
data captured from the live Procore instance. This tells you:

- Exact field names, types, and available options
- UI layout and form structure
- Action buttons and workflows

## 5. If the Manifest Is Missing or Incomplete

Run the Procore deep crawl:

```bash
node scripts/playwright-crawl/procore-deep-crawl.js {tool-slug}
```

This will capture screenshots and a structured manifest from the live Procore instance.

Alternatively, use the Procore URL from the `procore_tools` table to browse directly.
The URL format is:
```
https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/{tool-path}
```

## 6. Compare and Implement

With the PRP (intended behavior) and the manifest/screenshots (actual Procore behavior):

1. Identify exactly which field, option, or workflow the client is referring to
2. Find our corresponding implementation in the codebase
3. Identify the gap between what Procore does and what we do
4. Implement the fix

## 7. Tool-to-Code Mapping

The frontend pages for each tool typically live at:
- `frontend/src/app/(procore)/{tool-slug}/` — main pages
- `frontend/src/components/` — shared components
- `frontend/src/app/api/` — API routes

Check `frontend/src/app/(procore)/` for the exact route structure.

## Example: FORECAST Feedback

> "it won't let me edit the forecast to complete"

1. Keywords "forecast" + "budget" → **Budget** tool
2. Read PRP: `_bmad-output/planning-artifacts/budget/prp-budget.md`
3. Read manifest: `.claude/procore-manifests/budget/manifest.json`
4. If manifest doesn't cover forecast editing → run crawl:
   `node scripts/playwright-crawl/procore-deep-crawl.js budget`
5. The Procore budget page at `https://us02.procore.com/.../tools/budgets/budget-details`
   has "auto calculate" and "manually calculate" options for forecast columns
6. Find our budget implementation and add the missing edit capability
