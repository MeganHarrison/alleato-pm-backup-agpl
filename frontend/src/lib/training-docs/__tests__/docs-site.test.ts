import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@jest/globals";

import { getPublishedTrainingDocUrl } from "../constants";
import {
  publishTrainingDocToDocsSite,
  renderTrainingDocMdx,
  resolveDocsSiteRoot,
} from "../docs-site";

test("renderTrainingDocMdx includes screenshots and review notes", () => {
  const mdx = renderTrainingDocMdx({
    title: "Create Change Request",
    slug: "create-change-request",
    summary: "How to create a change request with screenshots.",
    audience: "internal",
    status: "approved",
    sourceRoute: "/[projectId]/change-events",
    reviewNotes: "Revenue explanation still needs product clarification.",
    bodyMarkdown: "## Steps\n\n1. Open the tool.",
    assets: [
      {
        fileName: "step-1.png",
        caption: "Step one",
        altText: "Change request form",
        assetType: "screenshot",
        stepOrder: 0,
        bytes: new TextEncoder().encode("png"),
      },
    ],
  });

  expect(mdx).toMatch(/title: Create Change Request/);
  expect(mdx).toMatch(/category: Training Docs/);
  expect(mdx).toMatch(/## Screenshots/);
  expect(mdx).toMatch(
    /!\[Change request form\]\(\/images\/training-docs\/create-change-request\/step-1\.png\)/,
  );
  expect(mdx).toMatch(/## Review Notes/);
});

test("getPublishedTrainingDocUrl builds docs-site article URLs from publish paths", () => {
  expect(
    getPublishedTrainingDocUrl(
      "project-management-tools/training-docs/create-project.mdx",
    ),
  ).toBe(
    "https://alleato-os-docs.vercel.app/project-management-tools/training-docs/create-project",
  );
  expect(getPublishedTrainingDocUrl(null)).toBeNull();
});

test("renderTrainingDocMdx renders generated steps with their screenshots", () => {
  const mdx = renderTrainingDocMdx({
    title: "Create a Project",
    slug: "create-a-project",
    summary: "How to create a project.",
    audience: "internal",
    status: "approved",
    sourceRoute: "/create-project",
    reviewNotes: null,
    bodyMarkdown:
      "## Purpose\n\nUse this workflow to start a new project.\n\n## Steps\n\n1. Legacy manual step.\n\n## Quality Check\n\nConfirm the project appears.",
    assets: [
      {
        fileName: "step-1.png",
        caption: "Create project screen",
        altText: "Create project form",
        assetType: "screenshot",
        stepOrder: 0,
        bytes: new TextEncoder().encode("png"),
      },
    ],
    steps: [
      {
        title: "Open Create Project",
        instructionMarkdown: "Navigate to the create project workflow.",
        expectedResult: "The create project form is visible.",
        sourceUrl: "http://localhost:3001/create-project",
        stepOrder: 0,
        screenshot: {
          fileName: "step-1.png",
          caption: "Create project screen",
          altText: "Create project form",
        },
      },
    ],
  });

  expect(mdx).toMatch(/## Steps/);
  expect(mdx).toMatch(/### Step 1: Open Create Project/);
  expect(mdx).toMatch(/Navigate to the create project workflow\./);
  expect(mdx).toMatch(/## Purpose/);
  expect(mdx).toMatch(/## Quality Check/);
  expect(mdx).not.toMatch(/Legacy manual step/);
  expect(mdx).toMatch(
    /!\[Create project form\]\(\/images\/training-docs\/create-a-project\/step-1\.png\)/,
  );
  expect(mdx).toMatch(/Expected result: The create project form is visible\./);
  expect(mdx).not.toMatch(/## Screenshots/);
});

test("publishTrainingDocToDocsSite writes the page, index, assets, and docs nav entry", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "training-docs-"));
  const docsRoot = path.join(tmpRoot, "apps", "docs");
  await mkdir(
    path.join(docsRoot, "project-management-tools", "training-docs"),
    {
      recursive: true,
    },
  );
  await mkdir(path.join(docsRoot, "images"), { recursive: true });
  await writeFile(
    path.join(docsRoot, "docs.json"),
    JSON.stringify(
      {
        navigation: {
          tabs: [
            {
              tab: "Product",
              groups: [
                {
                  group: "Product",
                  pages: [
                    {
                      group: "Help Articles",
                      expanded: false,
                      pages: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await publishTrainingDocToDocsSite(
    docsRoot,
    {
      title: "Create Change Request",
      slug: "create-change-request",
      summary: "How to create a change request with screenshots.",
      audience: "internal",
      status: "approved",
      sourceRoute: "/[projectId]/change-events",
      reviewNotes: null,
      bodyMarkdown: "## Steps\n\n1. Open the tool.",
      targetCollection: "project-management-tools/training-docs",
      assets: [
        {
          fileName: "step-1.png",
          caption: "Step one",
          altText: "Change request form",
          assetType: "screenshot",
          stepOrder: 0,
          bytes: new TextEncoder().encode("png"),
        },
      ],
    },
    [
      {
        title: "Create Change Request",
        slug: "create-change-request",
        summary: "How to create a change request with screenshots.",
        audience: "internal",
        status: "published",
        sourceRoute: "/[projectId]/change-events",
        publishedDocPath:
          "project-management-tools/training-docs/create-change-request.mdx",
        lastPublishedAt: "2026-06-26T00:00:00.000Z",
      },
    ],
  );

  expect(result.publishedDocPath).toBe(
    "project-management-tools/training-docs/create-change-request.mdx",
  );

  const page = await readFile(
    path.join(
      docsRoot,
      "project-management-tools",
      "training-docs",
      "create-change-request.mdx",
    ),
    "utf8",
  );
  const index = await readFile(
    path.join(
      docsRoot,
      "project-management-tools",
      "training-docs",
      "index.mdx",
    ),
    "utf8",
  );
  const docsJson = JSON.parse(
    await readFile(path.join(docsRoot, "docs.json"), "utf8"),
  );

  expect(page).toMatch(/# Create Change Request/);
  expect(index).toMatch(
    /\[Create Change Request\]\(\/project-management-tools\/training-docs\/create-change-request\)/,
  );
  expect(JSON.stringify(docsJson)).toMatch(
    /project-management-tools\/training-docs\/index/,
  );
});

test("renderTrainingDocMdx renders walkthrough video without treating it as an image", () => {
  const mdx = renderTrainingDocMdx({
    title: "Create a Commitment",
    slug: "create-a-commitment",
    summary: "How to create a commitment.",
    audience: "internal",
    status: "approved",
    sourceRoute: "/1034/commitments/new",
    reviewNotes: null,
    bodyMarkdown: "## Purpose\n\nCreate the commitment record.",
    assets: [
      {
        fileName: "session.webm",
        caption: "Complete recorded walkthrough",
        altText: "Commitment walkthrough video",
        assetType: "video",
        mimeType: "video/webm",
        stepOrder: 0,
        bytes: new TextEncoder().encode("webm"),
      },
    ],
    steps: [],
  });

  expect(mdx).toMatch(/## Walkthrough Video/);
  expect(mdx).toMatch(
    /<video controls playsinline preload="metadata" src="\/images\/training-docs\/create-a-commitment\/session\.webm"><\/video>/,
  );
  expect(mdx).not.toMatch(/!\[Commitment walkthrough video\]/);
});

test("publishTrainingDocToDocsSite rejects paths outside the docs site", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "training-docs-path-"));
  const docsRoot = path.join(tmpRoot, "apps", "docs");
  await mkdir(
    path.join(docsRoot, "project-management-tools", "training-docs"),
    {
      recursive: true,
    },
  );
  await writeFile(
    path.join(docsRoot, "docs.json"),
    JSON.stringify({
      navigation: {
        tabs: [
          {
            tab: "Product",
            groups: [
              {
                group: "Product",
                pages: [{ group: "Help Articles", expanded: false, pages: [] }],
              },
            ],
          },
        ],
      },
    }),
    "utf8",
  );

  await expect(() =>
    publishTrainingDocToDocsSite(
      docsRoot,
      {
        title: "Unsafe",
        slug: "unsafe",
        summary: null,
        audience: "internal",
        status: "approved",
        sourceRoute: null,
        reviewNotes: null,
        bodyMarkdown: "## Steps",
        targetCollection: "../../outside",
        assets: [],
      },
      [],
    ),
  ).rejects.toThrow(
    /target collection must be a relative path inside the docs site/i,
  );
});

test("resolveDocsSiteRoot skips partial local folders that do not include docs.json", async () => {
  const cwd = process.cwd();
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "training-docs-root-"));
  const fakeRepoRoot = path.join(tmpRoot, "alleato-pm");
  const partialDocsRoot = path.join(fakeRepoRoot, "docs", "alleato-os-docs");
  const fallbackDocsRoot = path.join(
    os.homedir(),
    "Documents",
    "github",
    "alleato-os",
    "apps",
    "docs",
  );
  const fallbackDocsJsonPath = path.join(fallbackDocsRoot, "docs.json");
  let createdFallbackDocsJson = false;

  await mkdir(partialDocsRoot, { recursive: true });
  await mkdir(fallbackDocsRoot, { recursive: true });
  try {
    await readFile(fallbackDocsJsonPath, "utf8");
  } catch {
    await writeFile(
      fallbackDocsJsonPath,
      '{\n  "navigation": {"tabs": []}\n}\n',
      "utf8",
    );
    createdFallbackDocsJson = true;
  }

  process.chdir(fakeRepoRoot);

  try {
    const resolvedRoot = resolveDocsSiteRoot();
    expect(resolvedRoot).not.toBe(partialDocsRoot);
    expect(resolvedRoot).toMatch(/alleato-os-docs|apps\/docs/);
    await readFile(path.join(resolvedRoot, "docs.json"), "utf8");
  } finally {
    process.chdir(cwd);
    if (createdFallbackDocsJson) {
      await rm(fallbackDocsJsonPath, { force: true });
    }
  }
});
