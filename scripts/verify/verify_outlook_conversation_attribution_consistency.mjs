#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? next : true;
    if (args[key] === next) index += 1;
  }
  return args;
}

function dateRange(args) {
  if (args.date) {
    const start = new Date(`${args.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { since: start.toISOString(), until: end.toISOString() };
  }
  const since = args.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { since, until: args.until ?? new Date().toISOString() };
}

const args = parseArgs(process.argv.slice(2));
const { since, until } = dateRange(args);
const subject = typeof args.subject === "string" ? args.subject.trim() : null;
const exceptionsFile = typeof args["exceptions-file"] === "string"
  ? path.resolve(args["exceptions-file"])
  : null;
const expectedProjectId = args["expected-project-id"]
  ? Number(args["expected-project-id"])
  : null;
if (expectedProjectId !== null && !Number.isInteger(expectedProjectId)) {
  throw new Error("--expected-project-id must be an integer");
}

const rawUrl = getRagDatabaseUrl();
if (!rawUrl) throw new Error("RAG_DATABASE_URL is required");
const connectionString = await buildAppDatabaseConnectionString(rawUrl, {
  includeSslMode: false,
});
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const exceptionLedger = exceptionsFile
  ? JSON.parse(await fs.readFile(exceptionsFile, "utf8"))
  : null;
const documentedExclusions = new Map(
  (exceptionLedger?.dispositions ?? [])
    .filter((item) => item.disposition === "exclude")
    .map((item) => [`${item.kind}:${item.key}`, item]),
);

await client.connect();
try {
  const result = await client.query(
    `
      select
        id,
        mailbox_user_id,
        conversation_id,
        internet_message_id,
        subject,
        project_id,
        assignment_method,
        assignment_confidence,
        received_at
      from public.outlook_email_intake
      where deleted_at is null
        and received_at >= $1::timestamptz
        and received_at < $2::timestamptz
        and ($3::text is null or subject ilike ('%' || $3 || '%'))
      order by received_at, id
    `,
    [since, until, subject],
  );

  const groups = new Map();
  const add = (kind, key, row) => {
    if (!key || row.project_id === null) return;
    const groupKey = `${kind}:${key}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { kind, key, rows: [] });
    groups.get(groupKey).rows.push(row);
  };
  for (const row of result.rows) {
    if (row.mailbox_user_id && row.conversation_id) {
      add("mailbox_conversation", `${row.mailbox_user_id}|${row.conversation_id}`, row);
    }
    add("internet_message", row.internet_message_id, row);
  }

  const conflicts = [];
  for (const group of groups.values()) {
    const projectIds = [...new Set(group.rows.map((row) => Number(row.project_id)))].sort(
      (left, right) => left - right,
    );
    if (projectIds.length > 1) {
      conflicts.push({
        kind: group.kind,
        key: group.key,
        projectIds,
        intakeIds: group.rows.map((row) => Number(row.id)),
        methods: [...new Set(group.rows.map((row) => row.assignment_method))].sort(),
        subject: group.rows[0]?.subject ?? null,
      });
    }
  }

  const activeConflicts = [];
  const documentedExceptions = [];
  for (const conflict of conflicts) {
    const exclusion = documentedExclusions.get(`${conflict.kind}:${conflict.key}`);
    const expectedProjects = exclusion?.expectedProjectIds ?? [];
    const expectedIntakes = exclusion?.expectedIntakeIds ?? [];
    const sameProjects = JSON.stringify(expectedProjects) === JSON.stringify(conflict.projectIds);
    const sameIntakes = JSON.stringify([...expectedIntakes].sort((a, b) => a - b))
      === JSON.stringify([...conflict.intakeIds].sort((a, b) => a - b));
    if (exclusion && sameProjects && sameIntakes) {
      documentedExceptions.push({ ...conflict, exclusionReason: exclusion.exclusionReason });
    } else {
      activeConflicts.push(conflict);
    }
  }

  const unexpectedProjects = expectedProjectId === null
    ? []
    : result.rows
        .filter((row) => row.project_id === null || Number(row.project_id) !== expectedProjectId)
        .map((row) => ({
          intakeId: Number(row.id),
          projectId: row.project_id === null ? null : Number(row.project_id),
          mailbox: row.mailbox_user_id,
          method: row.assignment_method,
        }));

  const output = {
    ok: activeConflicts.length === 0 && unexpectedProjects.length === 0,
    scope: { subject, since, until, expectedProjectId, exceptionsFile },
    rowsScanned: result.rows.length,
    identitiesChecked: groups.size,
    conflicts: activeConflicts,
    documentedExceptions,
    unexpectedProjects,
  };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 1;
} finally {
  await client.end();
}
