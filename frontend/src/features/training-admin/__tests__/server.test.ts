jest.mock("server-only", () => ({}));

import { createServiceClient } from "@/lib/supabase/service";

import { deleteTrainingAdminRecord } from "../server";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createServiceClientMock = createServiceClient as jest.Mock;

describe("training admin destructive operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("quarantines an asset, deletes its row, then purges the staged file", async () => {
    const operations: string[] = [];
    const storageMove = jest.fn(async () => {
      operations.push("stage");
      return { error: null };
    });
    const storageRemove = jest.fn(async () => {
      operations.push("purge");
      return { error: null };
    });
    const maybeSingleLookup = jest.fn(async () => ({
      data: {
        storage_bucket: "documents",
        storage_path: "training-docs/doc/asset.png",
        file_name: "asset.png",
      },
      error: null,
    }));
    const maybeSingleDelete = jest.fn(async () => {
      operations.push("database");
      return { data: { id: "asset-1" }, error: null };
    });

    createServiceClientMock.mockReturnValue({
      storage: {
        from: jest.fn(() => ({ move: storageMove, remove: storageRemove })),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ maybeSingle: maybeSingleLookup })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({ maybeSingle: maybeSingleDelete })),
          })),
        })),
      })),
    });

    await deleteTrainingAdminRecord("training_doc_assets", "asset-1");

    expect(storageMove).toHaveBeenCalledWith(
      "training-docs/doc/asset.png",
      expect.stringContaining("training-docs/doc/asset.png.pending-delete-"),
    );
    expect(storageRemove).toHaveBeenCalledWith([
      expect.stringContaining("training-docs/doc/asset.png.pending-delete-"),
    ]);
    expect(operations).toEqual(["stage", "database", "purge"]);
  });

  it("preserves asset metadata when storage staging fails", async () => {
    const databaseDelete = jest.fn();
    createServiceClientMock.mockReturnValue({
      storage: {
        from: jest.fn(() => ({
          move: jest.fn(async () => ({
            error: { message: "Storage unavailable" },
          })),
        })),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                storage_bucket: "documents",
                storage_path: "training-docs/doc/asset.png",
                file_name: "asset.png",
              },
              error: null,
            })),
          })),
        })),
        delete: databaseDelete,
      })),
    });

    await expect(
      deleteTrainingAdminRecord("training_doc_assets", "asset-1"),
    ).rejects.toThrow(/database records were preserved/i);
    expect(databaseDelete).not.toHaveBeenCalled();
  });

  it("restores the original storage path when the database delete fails", async () => {
    const storageMove = jest
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });
    createServiceClientMock.mockReturnValue({
      storage: {
        from: jest.fn(() => ({
          move: storageMove,
          remove: jest.fn(),
        })),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                storage_bucket: "documents",
                storage_path: "training-docs/doc/asset.png",
                file_name: "asset.png",
              },
              error: null,
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: null,
                error: { code: "23503", message: "Still referenced" },
              })),
            })),
          })),
        })),
      })),
    });

    await expect(
      deleteTrainingAdminRecord("training_doc_assets", "asset-1"),
    ).rejects.toThrow(/required relationship/i);
    expect(storageMove).toHaveBeenCalledTimes(2);
    expect(storageMove.mock.calls[1]?.[0]).toContain(".pending-delete-");
    expect(storageMove.mock.calls[1]?.[1]).toBe(
      "training-docs/doc/asset.png",
    );
  });
});
