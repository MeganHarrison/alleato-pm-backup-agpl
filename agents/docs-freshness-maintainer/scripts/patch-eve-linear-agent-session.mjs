import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const targets = [
  resolve(cwd, "node_modules/eve/dist/src/public/channels/linear/api.js"),
  resolve(cwd, ".vercel/output/functions/__server.func/_libs/eve.mjs"),
  resolve(cwd, ".eve/nitro-output/flow/functions/__server.func/_libs/eve.mjs"),
  ...findFiles(
    resolve(cwd, "node_modules/eve/.eve/workflow-cache"),
    (path) => path.endsWith("/_libs/eve.mjs"),
  ),
];

let patchedCount = 0;
let alreadyPatchedCount = 0;

for (const targetPath of targets) {
  if (!existsSync(targetPath)) continue;

  const source = readFileSync(targetPath, "utf8");
  const next = patchLinearAgentSessionSchema(source);

  if (next === source) {
    alreadyPatchedCount += 1;
    continue;
  }

  writeFileSync(targetPath, next);
  patchedCount += 1;
}

console.log(
  `[patch-eve-linear-agent-session] patched=${patchedCount} already_patched=${alreadyPatchedCount}`,
);

function patchLinearAgentSessionSchema(source) {
  let next = source
    .replace(
      "agentSession {\n            id\n            appUserId\n            commentId\n            creator { id }\n            issue { id identifier title url }\n            issueId\n            organizationId\n            sourceCommentId\n            status\n            url\n          }",
      "agentSession {\n            id\n            creator { id }\n            issue { id identifier title url }\n            status\n            url\n          }",
    )
    .replace(
      "agentSession {\n            id\n            appUserId\n            commentId\n            creator { id }\n            issue { id identifier title url }\n            organizationId\n            sourceCommentId\n            status\n            url\n          }",
      "agentSession {\n            id\n            creator { id }\n            issue { id identifier title url }\n            status\n            url\n          }",
    );

  next = next.replace(
    "let n=isObject(t.creator)?t.creator:void 0,r=normalizeIssue(t.issue),i={id:t.id};return",
    "let n=isObject(t.creator)?t.creator:void 0,r=normalizeIssue(t.issue),i={id:t.id},a=typeof t.issueId==`string`?t.issueId:t.issueId===null?null:r?.id;return",
  );

  next = next.replace(
    "let n = isObject(t.creator) ? t.creator : void 0, r = normalizeIssue(t.issue), i = { id: t.id };",
    "let n = isObject(t.creator) ? t.creator : void 0, r = normalizeIssue(t.issue), i = { id: t.id }, a = typeof t.issueId == `string` ? t.issueId : t.issueId === null ? null : r?.id;",
  );

  next = next.replace(
    "(typeof t.issueId==`string`||t.issueId===null)&&(i.issueId=t.issueId),typeof t.organizationId==`string`&&(i.organizationId=t.organizationId)",
    "(typeof a==`string`||a===null)&&(i.issueId=a),typeof t.organizationId==`string`&&(i.organizationId=t.organizationId)",
  );

  next = next.replace(
    "r!==void 0&&(i.issue=r),let a=typeof t.issueId==`string`?t.issueId:t.issueId===null?null:r?.id;(typeof a==`string`||a===null)&&(i.issueId=a),typeof t.organizationId==`string`&&(i.organizationId=t.organizationId)",
    "r!==void 0&&(i.issue=r),(typeof a==`string`||a===null)&&(i.issueId=a),typeof t.organizationId==`string`&&(i.organizationId=t.organizationId)",
  );

  next = next.replace(
    "return typeof t.appUserId == `string` && (i.appUserId = t.appUserId), (typeof t.commentId == `string` || t.commentId === null) && (i.commentId = t.commentId), (typeof n?.id == `string` || n === void 0) && (i.creatorId = typeof n?.id == `string` ? n.id : null), r !== void 0 && (i.issue = r), (typeof a == `string` || a === null) && (i.issueId = a), typeof t.organizationId == `string` && (i.organizationId = t.organizationId), (typeof t.sourceCommentId == `string` || t.sourceCommentId === null) && (i.sourceCommentId = t.sourceCommentId), typeof t.status == `string` && (i.status = t.status), (typeof t.url == `string` || t.url === null) && (i.url = t.url), i;",
    "return (typeof n?.id == `string` || n === void 0) && (i.creatorId = typeof n?.id == `string` ? n.id : null), r !== void 0 && (i.issue = r), (typeof a == `string` || a === null) && (i.issueId = a), typeof t.status == `string` && (i.status = t.status), (typeof t.url == `string` || t.url === null) && (i.url = t.url), i;",
  );

  return next;
}

function findFiles(root, predicate) {
  if (!existsSync(root)) return [];

  const matches = [];

  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      matches.push(...findFiles(path, predicate));
      continue;
    }

    if (predicate(path)) matches.push(path);
  }

  return matches;
}
