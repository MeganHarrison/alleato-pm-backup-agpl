#!/usr/bin/env node
/**
 * generate-procore-spec.js
 *
 * Reads .claude/procore-manifests/<tool>/modals.json and produces a
 * human-readable markdown spec at docs/procore-spec/<tool>.md that documents
 * every modal: trigger, title, fields, actions, screenshot reference.
 *
 * Usage:
 *   node generate-procore-spec.js budget
 *   node generate-procore-spec.js --all
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ALL_TOOLS } from './lib/modal-configs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

const argv = process.argv.slice(2);
const tools = argv.includes('--all') ? ALL_TOOLS : argv.filter((a) => !a.startsWith('--'));
if (tools.length === 0) {
  console.error('Usage: node generate-procore-spec.js <tool>|--all');
  process.exit(1);
}

function modalAnchor(m) {
  return (m.title || m.trigger?.label || m.modalId).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function md(s) {
  if (!s) return '';
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function renderModal(m, pageId) {
  const screenshotPath = `../../.claude/procore-manifests/${currentTool}/modals/${pageId}/${m.screenshot}`;
  const fullScreenshotPath = `../../.claude/procore-manifests/${currentTool}/modals/${pageId}/${m.fullScreenshot}`;
  const lines = [];

  lines.push(`### ${m.title || m.trigger?.label || '(untitled modal)'}\n`);
  lines.push(`**Triggered by:** ${m.trigger?.kind || 'unknown'} — "${md(m.trigger?.label || m.trigger?.ariaLabel || '')}"\n`);
  if (m.tabs?.length) {
    lines.push(`**Tabs:** ${m.tabs.map((t) => (t.active ? `**${t.label}**` : t.label)).join(' · ')}\n`);
  }

  if (m.fields?.length) {
    lines.push(`**Fields:**\n`);
    lines.push(`| Label | Type | Required | Default / Options |`);
    lines.push(`|---|---|---|---|`);
    for (const f of m.fields) {
      const opts = f.options?.length
        ? f.options.map((o) => o.label).filter(Boolean).slice(0, 10).join(', ')
        : f.value || '';
      lines.push(`| ${md(f.label)} | ${md(f.type)} | ${f.required ? 'yes' : ''} | ${md(opts)} |`);
    }
    lines.push('');
  }

  if (m.readOnlyRows?.length) {
    lines.push(`**Read-only rows:**`);
    for (const r of m.readOnlyRows.slice(0, 10)) {
      lines.push(`- ${md(r)}`);
    }
    lines.push('');
  }

  if (m.actions?.length) {
    const primary = m.actions.filter((a) => a.variant === 'primary').map((a) => a.label);
    const destructive = m.actions.filter((a) => a.variant === 'destructive').map((a) => a.label);
    const other = m.actions.filter((a) => a.variant === 'secondary').map((a) => a.label);
    const parts = [];
    if (primary.length) parts.push(`Primary: ${primary.join(', ')}`);
    if (destructive.length) parts.push(`Destructive: ${destructive.join(', ')}`);
    if (other.length) parts.push(`Secondary: ${other.slice(0, 10).join(', ')}`);
    lines.push(`**Actions:** ${parts.join(' | ')}\n`);
  }

  lines.push(`**Screenshot:** \`${m.screenshot}\` · **Full page:** \`${m.fullScreenshot}\` · **DOM:** \`${m.dom}\`\n`);
  lines.push('---');
  return lines.join('\n');
}

let currentTool = '';

function generate(tool) {
  currentTool = tool;
  const manifestPath = join(PROJECT_ROOT, '.claude/procore-manifests', tool, 'modals.json');
  if (!existsSync(manifestPath)) {
    console.error(`❌ No manifest at ${manifestPath}. Run procore-modal-crawl.js first.`);
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const out = [];
  out.push(`# Procore ${tool} — Modal Spec\n`);
  out.push(`_Source: \`.claude/procore-manifests/${tool}/modals.json\`_\n`);
  out.push(`_Captured: ${manifest.capturedAt}_\n\n`);
  out.push(`This is the ground-truth reference for what every modal in the ${tool} tool must contain. Our app should match this structure: same title, same fields with same types and options, same actions, same read-only context.\n`);

  // Summary stats
  const totalAttempted = manifest.pages.reduce((n, p) => n + (p.attemptedTriggers || 0), 0);
  const totalOpened = manifest.pages.reduce((n, p) => n + p.modals.filter((m) => m.opened).length, 0);
  const uniqueTitles = new Set();
  manifest.pages.forEach((p) => p.modals.forEach((m) => m.opened && m.title && uniqueTitles.add(m.title.trim())));

  out.push(`**Pages visited:** ${manifest.pages.length}  `);
  out.push(`**Triggers attempted:** ${totalAttempted}  `);
  out.push(`**Modals opened:** ${totalOpened}  `);
  out.push(`**Unique modal titles:** ${uniqueTitles.size}\n`);

  out.push('## Table of contents\n');
  for (const p of manifest.pages) {
    out.push(`- [${p.id}](#${p.id.toLowerCase()})`);
    // Dedupe modals by title within a page
    const seen = new Set();
    for (const m of p.modals.filter((x) => x.opened)) {
      const key = (m.title || '').trim() || m.modalId;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`  - [${key}](#${modalAnchor(m)})`);
    }
  }
  out.push('');

  for (const p of manifest.pages) {
    out.push(`\n## ${p.id}\n`);
    out.push(`**URL:** \`${p.url}\`  `);
    out.push(`**Page screenshot:** \`${p.pageScreenshot}\`\n`);

    const opened = p.modals.filter((x) => x.opened);
    // Dedupe modals by title to avoid the same "Original Budget Amount" appearing 10 times
    const seen = new Map();
    for (const m of opened) {
      const key = (m.title || '').trim() || m.modalId;
      if (!seen.has(key)) seen.set(key, m);
      else {
        // Keep the one with the most fields
        if ((m.fields?.length || 0) > (seen.get(key).fields?.length || 0)) seen.set(key, m);
      }
    }

    if (seen.size === 0) {
      out.push(`_No modals captured on this page. Either the page has no modal interactions, or our discovery pass missed them._\n`);
      continue;
    }

    for (const m of seen.values()) {
      out.push(renderModal(m, p.id));
    }
  }

  const outDir = join(PROJECT_ROOT, 'docs/procore-spec');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${tool}.md`);
  writeFileSync(outPath, out.join('\n'));
  console.log(`✅ ${tool} spec → ${outPath} (${seen?.size ?? totalOpened} unique modals documented)`);
}

for (const t of tools) generate(t);
