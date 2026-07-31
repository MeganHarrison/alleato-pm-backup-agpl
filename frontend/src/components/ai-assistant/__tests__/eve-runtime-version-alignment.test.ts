import fs from "node:fs";
import path from "node:path";

interface PackageManifest {
  dependencies?: Record<string, string>;
}

interface PackageLock {
  packages?: Record<
    string,
    {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      version?: string;
    }
  >;
}

const frontendRoot = path.resolve(__dirname, "../../../..");
const repositoryRoot = path.resolve(frontendRoot, "..");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

describe("Eve runtime version alignment", () => {
  const frontendManifest = readJson<PackageManifest>(
    path.join(frontendRoot, "package.json"),
  );
  const agentManifest = readJson<PackageManifest>(
    path.join(repositoryRoot, "agents", "alleato-assistant", "package.json"),
  );
  const packageLock = readJson<PackageLock>(
    path.join(frontendRoot, "package-lock.json"),
  );
  const pnpmLock = fs.readFileSync(
    path.join(frontendRoot, "pnpm-lock.yaml"),
    "utf8",
  );

  it("pins the frontend and canonical agent to the same Eve and AI SDK versions", () => {
    expect(frontendManifest.dependencies?.eve).toBe(
      agentManifest.dependencies?.eve,
    );
    expect(frontendManifest.dependencies?.ai).toBe(
      agentManifest.dependencies?.ai,
    );
    expect(frontendManifest.dependencies?.eve).not.toMatch(/^[~^]/);
    expect(frontendManifest.dependencies?.ai).not.toMatch(/^[~^]/);
  });

  it("keeps @ai-sdk/react on the same AI SDK version without a nested copy", () => {
    const packages = packageLock.packages ?? {};
    const rootAiVersion = packages["node_modules/ai"]?.version;
    const reactAiVersion =
      packages["node_modules/@ai-sdk/react"]?.dependencies?.ai;
    const aiInstallPaths = Object.keys(packages).filter(
      (packagePath) =>
        packagePath === "node_modules/ai" ||
        packagePath.endsWith("/node_modules/ai"),
    );

    expect(rootAiVersion).toBe(frontendManifest.dependencies?.ai);
    expect(reactAiVersion).toBe(rootAiVersion);
    expect(aiInstallPaths).toEqual(["node_modules/ai"]);
  });

  it("keeps the production pnpm graph on the same Eve and AI SDK versions", () => {
    const expectedAi = frontendManifest.dependencies?.ai;
    const expectedEve = frontendManifest.dependencies?.eve;
    const expectedReact = frontendManifest.dependencies?.["@ai-sdk/react"];
    const aiVersions = new Set(
      [...pnpmLock.matchAll(/(?:^|[\s(/])ai@(\d+\.\d+\.\d+)/gm)].map(
        (match) => match[1],
      ),
    );
    const eveVersions = new Set(
      [...pnpmLock.matchAll(/(?:^|[\s(/])eve@(\d+\.\d+\.\d+)/gm)].map(
        (match) => match[1],
      ),
    );
    const reactVersions = new Set(
      [...pnpmLock.matchAll(/'@ai-sdk\/react@(\d+\.\d+\.\d+)/g)].map(
        (match) => match[1],
      ),
    );
    const reactSnapshotStart = pnpmLock.lastIndexOf(
      `  '@ai-sdk/react@${expectedReact}`,
    );
    const reactSnapshotEnd = pnpmLock.indexOf("\n\n", reactSnapshotStart);
    const reactSnapshot = pnpmLock.slice(
      reactSnapshotStart,
      reactSnapshotEnd,
    );

    expect([...aiVersions]).toEqual([expectedAi]);
    expect([...eveVersions]).toEqual([expectedEve]);
    expect([...reactVersions]).toEqual([expectedReact]);
    expect(reactSnapshot).toContain(`      ai: ${expectedAi}`);
  });
});
