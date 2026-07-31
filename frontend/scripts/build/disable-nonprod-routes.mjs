import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(frontendRoot, "scripts/build/nonprod-routes.json");
const restoreScript = path.join(frontendRoot, "scripts/build/restore-nonprod-routes.mjs");
const stateDir = path.join(frontendRoot, ".next-nonprod-routes");
const statePath = path.join(stateDir, "disabled-routes.json");
const nextDir = path.join(frontendRoot, ".next");
const frontendNodeModules = path.join(frontendRoot, "node_modules");

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopLocalNextDevWriters() {
  const pids = new Set();

  if (existsSync(nextDir)) {
    try {
      const output = execFileSync("lsof", ["+D", nextDir], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      for (const line of output.split("\n").slice(1)) {
        const columns = line.trim().split(/\s+/);
        const pid = Number(columns[1]);
        const command = columns[0];

        if (Number.isInteger(pid) && pid > 0 && ["node", "next-server"].includes(command)) {
          pids.add(pid);
        }
      }
    } catch (error) {
      if (error.status !== 1) {
        console.warn("[build] Could not inspect frontend/.next process users; continuing");
      }
    }
  }

  try {
    const rows = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        return match
          ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }
          : null;
      })
      .filter(Boolean);

    const childrenByParent = new Map();

    for (const row of rows) {
      const children = childrenByParent.get(row.ppid) ?? [];
      children.push(row.pid);
      childrenByParent.set(row.ppid, children);
    }

    const addWithDescendants = (pid) => {
      if (pids.has(pid)) {
        return;
      }

      pids.add(pid);

      for (const childPid of childrenByParent.get(pid) ?? []) {
        addWithDescendants(childPid);
      }
    };

    for (const row of rows) {
      const isRepoNextDev =
        row.command.includes(frontendNodeModules) &&
        row.command.includes("/next/dist/bin/next") &&
        /\bdev\b/.test(row.command);

      if (isRepoNextDev) {
        addWithDescendants(row.pid);
      }
    }
  } catch {
    console.warn("[build] Could not inspect local Next dev processes; continuing");
  }

  if (pids.size === 0) {
    return;
  }

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process exited between lsof and kill.
    }
  }

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && [...pids].some(isRunning)) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }

  for (const pid of pids) {
    if (!isRunning(pid)) {
      continue;
    }

    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Process exited after the liveness check.
    }
  }

  console.log(
    `[build] Stopped ${pids.size} local Next dev process${pids.size === 1 ? "" : "es"} writing frontend/.next before production build`,
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const disabled = [];

stopLocalNextDevWriters();

if (existsSync(statePath)) {
  console.warn("[build] Found existing non-production route disable state; restoring before starting a fresh build");
  execFileSync(process.execPath, [restoreScript], {
    cwd: frontendRoot,
    env: process.env,
    stdio: "inherit",
  });
}

mkdirSync(stateDir, { recursive: true });

for (const relativePath of manifest.files) {
  const absolutePath = path.join(frontendRoot, relativePath);
  const disabledPath = `${absolutePath}.nonprod`;

  if (!existsSync(absolutePath)) {
    if (existsSync(disabledPath)) {
      throw new Error(
        `[build] Found stranded disabled route file without an active source file: ${relativePath}.nonprod`,
      );
    }

    throw new Error(
      `[build] Non-production route manifest is out of sync. Missing active route file: ${relativePath}`,
    );
  }

  if (existsSync(disabledPath)) {
    throw new Error(
      `[build] Refusing to overwrite existing disabled route file: ${relativePath}.nonprod`,
    );
  }

  renameSync(absolutePath, disabledPath);
  disabled.push({ from: relativePath, to: `${relativePath}.nonprod` });
}

writeFileSync(statePath, `${JSON.stringify({ disabledAt: new Date().toISOString(), files: disabled }, null, 2)}\n`);
console.log(`[build] Disabled ${disabled.length} non-production route files for this production build`);
