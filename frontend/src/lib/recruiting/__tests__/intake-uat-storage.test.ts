import { ensureUatResumeObject } from "@/lib/recruiting/intake-uat-storage";

describe("ensureUatResumeObject", () => {
  it("restores a missing object after a committed-record retry", async () => {
    const bucket = {
      upload: jest.fn(async () => ({ error: null })),
      list: jest.fn(async () => ({ data: [], error: null })),
    };

    await expect(
      ensureUatResumeObject({
        bucket,
        storagePath: "uat/key/resume.pdf",
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
      }),
    ).resolves.toBe("uploaded");
    expect(bucket.upload).toHaveBeenCalledTimes(1);
    expect(bucket.list).not.toHaveBeenCalled();
  });

  it("accepts an already-present object on an idempotent replay", async () => {
    const bucket = {
      upload: jest.fn(async () => ({
        error: { message: "The resource already exists" },
      })),
      list: jest.fn(async () => ({
        data: [{ name: "resume.pdf" }],
        error: null,
      })),
    };

    await expect(
      ensureUatResumeObject({
        bucket,
        storagePath: "uat/key/resume.pdf",
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
      }),
    ).resolves.toBe("existing");
  });
});
