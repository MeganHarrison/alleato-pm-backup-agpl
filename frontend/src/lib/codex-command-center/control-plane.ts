import { readFile } from "node:fs/promises";
import path from "node:path";

export type ControlPlaneIssue = {
  scope: "session-board" | "review-queue" | "task" | "handoff";
  path: string;
  message: string;
};

export type SessionBoardRow = {
  session: string;
  initiative: string;
  scope: string;
  linearIssue: string;
  ownedPaths: string[];
  currentStatus: string;
  started: string;
  lastUpdate: string;
  handoff: string;
  nextCheckpoint: string;
};

export type ReviewQueueRow = {
  reviewId: string;
  session: string;
  initiative: string;
  linearIssue: string;
  status: string;
  reviewer: string;
  evidence: string;
  dispositionNotes: string;
  lastUpdate: string;
};

export type ResumePack = {
  session: string;
  initiative: string;
  linearIssue: string;
  currentStatus: string;
  nextCheckpoint: string;
  ownedPaths: string[];
  handoffPath: string | null;
  handoffStatus: string | null;
  handoffNextAction: string | null;
  taskPath: string | null;
  taskTitle: string | null;
  taskStatus: string | null;
  taskObjective: string | null;
  risks: string[];
};

export type ControlPlaneData = {
  generatedAt: string;
  sessions: SessionBoardRow[];
  reviewQueue: ReviewQueueRow[];
  resumePacks: ResumePack[];
  issues: ControlPlaneIssue[];
};

type ParsedTaskDoc = {
  title: string | null;
  status: string | null;
  objective: string | null;
  risks: string[];
};

type ParsedHandoffDoc = {
  status: string | null;
  nextAction: string | null;
};

const SESSION_BOARD_PATH = "docs/ops/orchestration/session-board.md";
const REVIEW_QUEUE_PATH = "docs/ops/orchestration/review-queue.md";

function resolveRepoRoot(): string {
  return path.basename(process.cwd()) === "frontend"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
}

async function readRepoFile(repoRoot: string, relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function parseMarkdownTable(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\|/.test(line.trim()))
    .slice(2)
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.some((cell) => cell.length > 0));
}

function extractRelativePaths(value: string): string[] {
  const matches = value.match(
    /(?:docs|frontend|backend|scripts)\/[A-Za-z0-9_./()[\]-]+/g,
  );
  return Array.from(new Set(matches ?? []));
}

function extractSection(markdown: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`^##\\s+${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+|$)`, "im"),
  );
  return match?.[1]?.trim() ?? null;
}

function extractLabeledLine(markdown: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^\\s*${escaped}:\\s*(.+?)\\s*$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function parseBulletList(section: string | null): string[] {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter(Boolean);
}

function parseTaskDoc(markdown: string): ParsedTaskDoc {
  const titleMatch = markdown.match(/^# Task:\s*(.+)$/m);
  const statusMatch = markdown.match(/^Status:\s*(.+)$/m);
  const objective = extractSection(markdown, "Objective");
  const risks = parseBulletList(extractSection(markdown, "Risks / Gaps"));

  return {
    title: titleMatch?.[1]?.trim() ?? null,
    status: statusMatch?.[1]?.trim() ?? null,
    objective,
    risks,
  };
}

function parseHandoffDoc(markdown: string): ParsedHandoffDoc {
  const status =
    extractLabeledLine(markdown, "5) Current status") ??
    extractLabeledLine(markdown, "Current status");
  const nextAction =
    extractLabeledLine(markdown, "10) Recommended next action (one line)") ??
    extractLabeledLine(markdown, "Recommended next action");

  return { status, nextAction };
}

async function maybeParseTaskDoc(
  repoRoot: string,
  relativePath: string | null,
  issues: ControlPlaneIssue[],
): Promise<ParsedTaskDoc | null> {
  if (!relativePath) return null;
  try {
    return parseTaskDoc(await readRepoFile(repoRoot, relativePath));
  } catch (error) {
    issues.push({
      scope: "task",
      path: relativePath,
      message: error instanceof Error ? error.message : "Task doc could not be read.",
    });
    return null;
  }
}

async function maybeParseHandoffDoc(
  repoRoot: string,
  relativePath: string | null,
  issues: ControlPlaneIssue[],
): Promise<ParsedHandoffDoc | null> {
  if (!relativePath) return null;
  try {
    return parseHandoffDoc(await readRepoFile(repoRoot, relativePath));
  } catch (error) {
    issues.push({
      scope: "handoff",
      path: relativePath,
      message: error instanceof Error ? error.message : "Handoff doc could not be read.",
    });
    return null;
  }
}

async function readSessionBoard(repoRoot: string, issues: ControlPlaneIssue[]): Promise<SessionBoardRow[]> {
  try {
    const rows = parseMarkdownTable(await readRepoFile(repoRoot, SESSION_BOARD_PATH));
    return rows.map((cells) => ({
      session: cells[0] ?? "",
      initiative: cells[1] ?? "",
      scope: cells[2] ?? "",
      linearIssue: cells[3] ?? "",
      ownedPaths: extractRelativePaths(cells[4] ?? ""),
      currentStatus: cells[5] ?? "",
      started: cells[6] ?? "",
      lastUpdate: cells[7] ?? "",
      handoff: cells[8] ?? "",
      nextCheckpoint: cells[9] ?? "",
    }));
  } catch (error) {
    issues.push({
      scope: "session-board",
      path: SESSION_BOARD_PATH,
      message: error instanceof Error ? error.message : "Session board could not be read.",
    });
    return [];
  }
}

async function readReviewQueue(repoRoot: string, issues: ControlPlaneIssue[]): Promise<ReviewQueueRow[]> {
  try {
    const rows = parseMarkdownTable(await readRepoFile(repoRoot, REVIEW_QUEUE_PATH));
    return rows.map((cells) => ({
      reviewId: cells[0] ?? "",
      session: cells[1] ?? "",
      initiative: cells[2] ?? "",
      linearIssue: cells[3] ?? "",
      status: cells[4] ?? "",
      reviewer: cells[5] ?? "",
      evidence: cells[6] ?? "",
      dispositionNotes: cells[7] ?? "",
      lastUpdate: cells[8] ?? "",
    }));
  } catch (error) {
    issues.push({
      scope: "review-queue",
      path: REVIEW_QUEUE_PATH,
      message: error instanceof Error ? error.message : "Review queue could not be read.",
    });
    return [];
  }
}

function firstMatchingPath(paths: string[], pattern: RegExp): string | null {
  return paths.find((value) => pattern.test(value)) ?? null;
}

export async function getCodexControlPlaneData(): Promise<ControlPlaneData> {
  const repoRoot = resolveRepoRoot();
  const issues: ControlPlaneIssue[] = [];
  const sessions = await readSessionBoard(repoRoot, issues);
  const reviewQueue = await readReviewQueue(repoRoot, issues);

  const resumePacks = await Promise.all(
    sessions.map(async (session): Promise<ResumePack> => {
      const taskPath =
        firstMatchingPath(session.ownedPaths, /^docs\/ops\/tasks\/.+\.md$/) ?? null;
      const handoffPath =
        session.handoff && session.handoff !== "N/A"
          ? session.handoff.replace(/`/g, "")
          : firstMatchingPath(session.ownedPaths, /^docs\/ops\/handoffs\/.+\.md$/);

      const [taskDoc, handoffDoc] = await Promise.all([
        maybeParseTaskDoc(repoRoot, taskPath, issues),
        maybeParseHandoffDoc(repoRoot, handoffPath, issues),
      ]);

      return {
        session: session.session,
        initiative: session.initiative,
        linearIssue: session.linearIssue,
        currentStatus: session.currentStatus,
        nextCheckpoint: session.nextCheckpoint,
        ownedPaths: session.ownedPaths,
        handoffPath,
        handoffStatus: handoffDoc?.status ?? null,
        handoffNextAction: handoffDoc?.nextAction ?? null,
        taskPath,
        taskTitle: taskDoc?.title ?? null,
        taskStatus: taskDoc?.status ?? null,
        taskObjective: taskDoc?.objective ?? null,
        risks: taskDoc?.risks ?? [],
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    sessions,
    reviewQueue,
    resumePacks,
    issues,
  };
}
