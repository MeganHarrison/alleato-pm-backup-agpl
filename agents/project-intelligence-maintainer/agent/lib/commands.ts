import { spawn } from "node:child_process";

import { redactText } from "./redaction.js";
import { repoRoot } from "./repo.js";

export type CommandResult = {
  ok: boolean;
  command: string;
  code: number | null;
  stdout: string;
  stderr: string;
};

export async function runRepoCommand(command: string, args: string[], timeoutMs = 120000): Promise<CommandResult> {
  const display = [command, ...args].join(" ");

  return await new Promise<CommandResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        command: display,
        code,
        stdout: compact(redactText(stdout)),
        stderr: compact(redactText(stderr)),
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        command: display,
        code: null,
        stdout: "",
        stderr: redactText(error.message),
      });
    });
  });
}

function compact(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-40)
    .join("\n");
}
