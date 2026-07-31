import fs from "node:fs";
import process from "node:process";
import { Client } from "pg";

const envText = fs.readFileSync(".env", "utf8");

function env(name) {
  const match = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return match[1].trim().replace(/^['"]|['"]$/g, "").replace(/sslmode=[^&]+/, "sslmode=no-verify");
}

function parseArgs() {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith("--")) {
      const [key, value] = arg.split("=");
      args.set(key, value ?? "true");
    }
  }
  return {
    batchSize: Number(args.get("--batch-size") ?? 25),
    dryRun: args.get("--dry-run") === "true",
  };
}

const intakeColumns = [
  "id",
  "graph_message_id",
  "mailbox_user_id",
  "project_id",
  "project_email_id",
  "document_metadata_id",
  "subject",
  "body",
  "body_html",
  "body_text",
  "from_name",
  "from_email",
  "to_list",
  "cc_list",
  "bcc_list",
  "status",
  "match_status",
  "assignment_method",
  "assignment_confidence",
  "received_at",
  "has_attachments",
  "web_link",
  "internet_message_id",
  "conversation_id",
  "source_metadata",
  "last_synced_at",
  "deleted_at",
  "created_at",
  "updated_at",
];

const attachmentColumns = [
  "id",
  "intake_email_id",
  "email_attachment_id",
  "project_document_id",
  "document_metadata_id",
  "project_id",
  "graph_attachment_id",
  "file_name",
  "file_url",
  "file_size",
  "content_type",
  "content",
  "checksum_sha256",
  "extracted_text",
  "is_inline",
  "promotion_status",
  "promotion_reason",
  "promotion_attempt_count",
  "promoted_at",
  "source_metadata",
  "created_at",
  "updated_at",
];

const jsonColumns = new Set(["source_metadata"]);

function serializeValue(column, value) {
  if (value == null) {
    return value;
  }
  if (jsonColumns.has(column)) {
    return JSON.stringify(value);
  }
  return value;
}

async function getMissingIds(source, target, table) {
  const [sourceResult, targetResult] = await Promise.all([
    source.query(`select id from public.${table} order by id`),
    target.query(`select id from public.${table} order by id`),
  ]);
  const targetIds = new Set(targetResult.rows.map((row) => String(row.id)));
  return sourceResult.rows.map((row) => String(row.id)).filter((id) => !targetIds.has(id));
}

function buildInsert(table, columns, rows) {
  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * columns.length;
    const rowValues = columns.map((column) => serializeValue(column, row[column]));
    values.push(...rowValues);
    return `(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`;
  });
  const updates = columns.filter((column) => column !== "id").map((column) => `${column} = excluded.${column}`);
  return {
    text: `
      insert into public.${table} (${columns.join(", ")})
      values ${placeholders.join(", ")}
      on conflict (id) do update set ${updates.join(", ")}
    `,
    values,
  };
}

async function copyMissingRows({ source, target, table, columns, batchSize, dryRun }) {
  const missingIds = await getMissingIds(source, target, table);
  console.log(`${table}: missing=${missingIds.length}`);
  if (dryRun || missingIds.length === 0) {
    return missingIds.length;
  }

  for (let index = 0; index < missingIds.length; index += batchSize) {
    const batchIds = missingIds.slice(index, index + batchSize);
    const rows = (
      await source.query(
        `select ${columns.join(", ")} from public.${table} where id = any($1::bigint[]) order by id`,
        [batchIds],
      )
    ).rows;

    if (rows.length !== batchIds.length) {
      throw new Error(`${table}: expected ${batchIds.length} rows, got ${rows.length}`);
    }

    await target.query("begin");
    try {
      await target.query(buildInsert(table, columns, rows));
      await target.query("commit");
    } catch (error) {
      await target.query("rollback");
      throw error;
    }
    console.log(`${table}: copied ${Math.min(index + batchSize, missingIds.length)}/${missingIds.length}`);
  }

  return missingIds.length;
}

async function resetIdentity(target, table) {
  await target.query(`
    select setval(
      pg_get_serial_sequence('public.${table}', 'id'),
      coalesce((select max(id) from public.${table}), 1),
      true
    )
  `);
}

async function printCounts(source, target) {
  const countSql = `
    select
      (select count(*)::int from public.outlook_email_intake) as intake,
      (select count(*)::int from public.outlook_email_intake_attachments) as attachments,
      (select count(*)::int from public.outlook_email_skip_audit) as skip_audit,
      (select count(*)::int from pg_stat_activity) as activity
  `;
  const [sourceCounts, targetCounts] = await Promise.all([source.query(countSql), target.query(countSql)]);
  console.log(`PM ${JSON.stringify(sourceCounts.rows[0])}`);
  console.log(`AI ${JSON.stringify(targetCounts.rows[0])}`);
}

async function main() {
  const { batchSize, dryRun } = parseArgs();
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("--batch-size must be an integer from 1 to 100");
  }

  const source = new Client({
    connectionString: env("DATABASE_URL"),
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
  });
  const target = new Client({
    connectionString: env("RAG_DATABASE_URL"),
    connectionTimeoutMillis: 15_000,
    statement_timeout: 120_000,
  });

  await source.connect();
  await target.connect();
  try {
    await printCounts(source, target);
    await copyMissingRows({
      source,
      target,
      table: "outlook_email_intake",
      columns: intakeColumns,
      batchSize,
      dryRun,
    });
    await copyMissingRows({
      source,
      target,
      table: "outlook_email_intake_attachments",
      columns: attachmentColumns,
      batchSize,
      dryRun,
    });
    if (!dryRun) {
      await resetIdentity(target, "outlook_email_intake");
      await resetIdentity(target, "outlook_email_intake_attachments");
    }
    await printCounts(source, target);
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
