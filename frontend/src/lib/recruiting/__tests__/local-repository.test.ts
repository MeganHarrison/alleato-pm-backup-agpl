import type { RecruitingWorkspaceSnapshot } from "../contracts";
import { INITIAL_RECRUITING_WORKSPACE } from "@/features/recruiting/workspace-data";
import {
  LocalRecruitingRepository,
  RecruitingRepositoryError,
  type StorageAdapter,
} from "../local-repository";

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function makeSnapshot(): RecruitingWorkspaceSnapshot {
  return {
    schemaVersion: 1,
    revision: 0,
    syntheticOnly: true,
    updatedAt: "2026-07-28T12:00:00.000Z",
    requisitions: [
      {
        id: "req-1",
        title: "Project Manager",
        location: "Indianapolis, IN",
        status: "open",
      },
    ],
    candidates: [],
    applications: [],
    auditEvents: [],
  };
}

describe("LocalRecruitingRepository", () => {
  it("persists a validated snapshot and increments its revision", () => {
    const storage = new MemoryStorage();
    const repository = new LocalRecruitingRepository(storage, makeSnapshot());

    const saved = repository.commit(makeSnapshot(), 0);

    expect(saved.revision).toBe(1);
    expect(repository.load()).toEqual(saved);
  });

  it("fails loudly when saved data is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem("alleato.recruiting.local.v1", "{not valid json");
    const repository = new LocalRecruitingRepository(storage, makeSnapshot());

    expect(() => repository.load()).toThrow(
      expect.objectContaining<Partial<RecruitingRepositoryError>>({
        code: "INVALID_SNAPSHOT",
      }),
    );
  });

  it("prevents a stale tab from overwriting a newer revision", () => {
    const storage = new MemoryStorage();
    const first = new LocalRecruitingRepository(storage, makeSnapshot());
    const second = new LocalRecruitingRepository(storage, makeSnapshot());
    const stale = second.load();

    first.commit(makeSnapshot(), 0);

    expect(() => second.commit(stale, stale.revision)).toThrow(
      expect.objectContaining<Partial<RecruitingRepositoryError>>({
        code: "REVISION_CONFLICT",
      }),
    );
  });

  it("migrates missing starter history into an existing valid workspace", () => {
    const storage = new MemoryStorage();
    const existingSnapshot = {
      ...INITIAL_RECRUITING_WORKSPACE,
      revision: 3,
      auditEvents: [],
    };
    storage.setItem(
      "alleato.recruiting.local.v1",
      JSON.stringify(existingSnapshot),
    );
    const repository = new LocalRecruitingRepository(
      storage,
      INITIAL_RECRUITING_WORKSPACE,
    );

    expect(repository.load()).toMatchObject({
      revision: 3,
      auditEvents: INITIAL_RECRUITING_WORKSPACE.auditEvents,
    });
  });

  it("can clear saved work and return to the supplied starter snapshot", () => {
    const storage = new MemoryStorage();
    const starter = makeSnapshot();
    const repository = new LocalRecruitingRepository(storage, starter);
    repository.commit(starter, 0);

    const reset = repository.reset();

    expect(reset).toEqual(starter);
    expect(repository.load()).toEqual(starter);
  });
});
