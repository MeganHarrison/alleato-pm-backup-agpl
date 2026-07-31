#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const API_V1 = "https://api.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const argValue = (name, fallback = null) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const JP_PROJECT_ID = Number(argValue("jp"));

if (!Number.isInteger(JP_PROJECT_ID)) {
  console.error("Usage: node scripts/jobplanner/audit-submittal-docs-fallback.mjs --jp=<jobplannerProjectId>");
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
if (!JP_KEY) {
  console.error("Missing JOBPLANNER_API_KEY.");
  process.exit(1);
}

async function jpGet(url) {
  const response = await fetch(url, {
    headers: {
      ApiKey: JP_KEY,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Job Planner ${response.status} on ${url.replace(API_V1, "")}`);
  }

  return response.json();
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

function buildFolderMap(attachments) {
  const byFolderId = new Map();
  for (const attachment of attachments) {
    if (!byFolderId.has(attachment.folderId)) byFolderId.set(attachment.folderId, []);
    byFolderId.get(attachment.folderId).push(attachment);
  }
  return byFolderId;
}

function buildPath(attachment, byEntryId) {
  const names = [attachment.name];
  let currentFolderId = attachment.folderId;

  while (currentFolderId && currentFolderId !== -1) {
    const parent = byEntryId.get(currentFolderId);
    if (!parent) break;
    names.push(parent.name);
    currentFolderId = parent.folderId;
  }

  return names.reverse().join(" / ");
}

function candidateMatches(submittals, attachments) {
  const files = attachments.filter((attachment) => !attachment.isFolder);
  const folders = attachments.filter((attachment) => attachment.isFolder);
  const folderNames = new Set(folders.map((folder) => normalize(folder.name)));
  const matches = [];

  for (const submittal of submittals) {
    const submittalNumber = String(submittal.submittalNumber ?? "").trim();
    const numberToken = normalize(submittalNumber);
    const titleToken = normalize(submittal.title);
    const fileHits = [];
    const folderHits = [];

    for (const file of files) {
      const fileName = normalize(file.name);
      if (numberToken && fileName.includes(numberToken)) {
        fileHits.push(file.name);
      } else if (titleToken && titleToken.length >= 12 && fileName.includes(titleToken.slice(0, 18))) {
        fileHits.push(file.name);
      }
      if (fileHits.length >= 5) break;
    }

    for (const folder of folders) {
      const folderName = normalize(folder.name);
      if (numberToken && folderName.includes(numberToken)) {
        folderHits.push(folder.name);
      } else if (titleToken && titleToken.length >= 12 && folderName.includes(titleToken.slice(0, 18))) {
        folderHits.push(folder.name);
      }
      if (folderHits.length >= 5) break;
    }

    if (fileHits.length > 0 || folderHits.length > 0) {
      matches.push({
        submittalNumber,
        title: submittal.title,
        fileHits,
        folderHits,
      });
    }
  }

  const likelySubmittalFolders = [...folderNames].filter((name) =>
    /submitt|shop|product data|sample|drawing|spec/.test(name),
  );

  return {
    noisyMatchCount: matches.length,
    noisyMatchSamples: matches.slice(0, 25),
    likelySubmittalFolders,
  };
}

async function main() {
  const [submittals, attachments] = await Promise.all([
    jpGet(`${API_V1}/projects/${JP_PROJECT_ID}/submittals`),
    jpGet(`${API_V1}/projects/${JP_PROJECT_ID}/attachments`),
  ]);

  if (!Array.isArray(submittals) || !Array.isArray(attachments)) {
    throw new Error("Expected both submittals and attachments endpoints to return arrays.");
  }

  const byEntryId = new Map(
    attachments
      .filter((attachment) => attachment.entryId != null)
      .map((attachment) => [attachment.entryId, attachment]),
  );

  const files = attachments.filter((attachment) => !attachment.isFolder);
  const folders = attachments.filter((attachment) => attachment.isFolder);
  const folderMap = buildFolderMap(attachments);
  const rootChildren = folderMap.get(0) ?? [];
  const fileExtensions = countBy(
    files.map((file) => {
      const pieces = String(file.name ?? "").split(".");
      return pieces.length > 1 ? pieces.at(-1).toLowerCase() : "(none)";
    }),
  );

  const namedSubmittalLikeFiles = files.filter((file) =>
    /submitt|shop|product data|sample|drawing|spec/.test(normalize(file.name)),
  );

  const bidSubmittalFolder = attachments.find((attachment) => attachment.name === "Bid Submittal");
  const bidSubmittalChildren = bidSubmittalFolder
    ? (folderMap.get(bidSubmittalFolder.entryId) ?? []).map((attachment) => ({
        name: attachment.name,
        isFolder: attachment.isFolder,
        size: attachment.size,
        path: buildPath(attachment, byEntryId),
      }))
    : [];

  const fallback = candidateMatches(submittals, attachments);
  const confidence =
    namedSubmittalLikeFiles.length === 0 &&
    fallback.likelySubmittalFolders.length <= 1 &&
    bidSubmittalChildren.length <= 2
      ? "low"
      : "uncertain";

  const summary = {
    projectId: JP_PROJECT_ID,
    submittalCount: submittals.length,
    attachmentCount: attachments.length,
    folderCount: folders.length,
    fileCount: files.length,
    rootFolders: rootChildren.map((child) => child.name),
    fileExtensions,
    namedSubmittalLikeFiles: namedSubmittalLikeFiles.map((file) => ({
      name: file.name,
      size: file.size,
      path: buildPath(file, byEntryId),
    })),
    bidSubmittalChildren,
    fallback,
    assessment: {
      confidence,
      conclusion:
        confidence === "low"
          ? "No trustworthy submittal-document fallback was found on the reachable project attachments surface."
          : "Reachable attachment surfaces exist, but matching confidence is too weak for automated import.",
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
