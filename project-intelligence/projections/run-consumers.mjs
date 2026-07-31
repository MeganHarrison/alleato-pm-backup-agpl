import { spawnSync } from "node:child_process";

const CONSUMER_SCRIPT = "project-intelligence/projections/daily-deep-read-consumers.mjs";

export function parseConsumerReceipt(stdout) {
  const normalized = String(stdout || "").trim();
  const jsonStart = normalized.lastIndexOf("\n{");
  try {
    return JSON.parse(jsonStart >= 0 ? normalized.slice(jsonStart + 1) : normalized);
  } catch {
    return null;
  }
}

export function runConsumersForPacket(packetId, {
  spawn = spawnSync,
  executable = process.execPath,
  cwd = process.cwd(),
  script = CONSUMER_SCRIPT,
} = {}) {
  const scriptArgs = [script, "--packetId", packetId];
  const result = spawn(executable, scriptArgs, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const stdout = String(result.stdout || "").trim();
  const parsed = parseConsumerReceipt(stdout);
  if (result.status !== 0) {
    throw new Error(
      `Daily Deep Read packet ${packetId} was written, but the consumer run failed ` +
        `(exit ${result.status}). Rerun: node ${scriptArgs.join(" ")}\n${String(result.stderr || "").slice(0, 4000)}`,
    );
  }
  if (!parsed || parsed.ok !== true || parsed.packetId !== packetId || parsed.runContract?.status !== "completed") {
    throw new Error(
      `Daily Deep Read packet ${packetId} consumer exited without a completed run receipt. ` +
        `Received: ${stdout.slice(-4000)}`,
    );
  }
  return parsed;
}

export { CONSUMER_SCRIPT };
