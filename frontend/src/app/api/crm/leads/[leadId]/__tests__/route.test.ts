import { NextRequest } from "next/server";

import { requireCrmAccess } from "@/lib/crm/server";
import { createClient } from "@/lib/supabase/server";

import { PATCH } from "@/lib/crm/api-handlers/lead-profile";
import { GET as GET_EMAIL_HISTORY } from "@/lib/crm/api-handlers/lead-email-history";
import {
  GET as GET_PHOTO,
  POST as POST_PHOTO,
} from "@/lib/crm/api-handlers/lead-photo";
import { POST as POST_RESEARCH_DECISION } from "@/lib/crm/api-handlers/lead-research-decision";

jest.mock("@/lib/crm/server", () => ({
  requireCrmAccess: jest.fn(),
  assertCrmOwnerOrAdmin: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const requireCrmAccessMock = jest.mocked(requireCrmAccess);
const leadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/crm/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/crm/leads/[leadId]", () => {
  const updateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    updateMock.mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({
              data: { id: leadId, full_name: "Taylor Prospect" },
              error: null,
            }),
          }),
        }),
      }),
    });
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn(() => ({
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    owner_person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    row_version: 3,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        })),
      },
      personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      isAdmin: false,
      user: { id: "auth-user" },
    } as never);
  });

  it("updates whitelisted person fields with optimistic concurrency", async () => {
    const response = await PATCH(
      request({
        row_version: 3,
        full_name: "Taylor Prospect",
        website_url: "https://example.com",
      }),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Taylor Prospect",
        website_url: "https://example.com",
      }),
    );
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty("notes");
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty("facebook_url");
  });

  it("rejects stale updates", async () => {
    const response = await PATCH(
      request({ row_version: 2, full_name: "Taylor Prospect" }),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects dangerous URL schemes before writing", async () => {
    const response = await PATCH(
      request({ row_version: 3, website_url: "javascript:alert(1)" }),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("lead profile supporting routes", () => {
  const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("rejects a spoofed image before storage upload", async () => {
    const upload = jest.fn();
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn(() => ({
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: leadId,
                    owner_person_id: ownerId,
                    photo_storage_path: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        })),
        storage: { from: () => ({ upload }) },
      },
      personId: ownerId,
      isAdmin: false,
    } as never);
    const form = new FormData();
    form.set(
      "photo",
      new File(["not an image"], "lead.png", { type: "image/png" }),
    );
    const response = await POST_PHOTO(
      new NextRequest(`http://localhost/api/crm/leads/${leadId}/photo`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns only accepted Outlook email history filters", async () => {
    const eq = jest.fn();
    const is = jest.fn();
    const activityQuery: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order", "limit", "lt"]) {
      activityQuery[method] = jest.fn((...args: unknown[]) => {
        if (method === "eq") eq(...args);
        if (method === "is") is(...args);
        return activityQuery;
      });
    }
    activityQuery.then = (resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null });
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn((table: string) =>
          table === "crm_leads"
            ? {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({
                        data: { owner_person_id: ownerId },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }
            : activityQuery,
        ),
      },
      personId: ownerId,
      isAdmin: false,
    } as never);
    const response = await GET_EMAIL_HISTORY(
      new NextRequest(`http://localhost/api/crm/leads/${leadId}/email-history`),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("activity_type", "email");
    expect(eq).toHaveBeenCalledWith("source_system", "outlook");
    expect(eq).toHaveBeenCalledWith("record_origin", "auto");
    expect(eq).toHaveBeenCalledWith("visibility_scope", "standard");
    expect(is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("binds research approval to both the lead and artifact version", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { applied: true }, error: null });
    jest.mocked(createClient).mockResolvedValue({ rpc } as never);
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn(() => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { owner_person_id: ownerId },
                error: null,
              }),
            }),
          }),
        })),
      },
      personId: ownerId,
      isAdmin: false,
    } as never);
    const artifactId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const response = await POST_RESEARCH_DECISION(
      new NextRequest(
        `http://localhost/api/crm/leads/${leadId}/research/${artifactId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "apply", row_version: 7 }),
        },
      ),
      { params: Promise.resolve({ leadId, artifactId }) },
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("crm_apply_lead_research", {
      p_lead_id: leadId,
      p_artifact_id: artifactId,
      p_expected_lead_row_version: 7,
    });
  });

  it("checks ownership before returning a private photo URL", async () => {
    const signedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example/lead" },
      error: null,
    });
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn(() => ({
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: leadId,
                    owner_person_id: ownerId,
                    photo_storage_path: `${ownerId}/${leadId}/profile.png`,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        })),
        storage: { from: () => ({ createSignedUrl: signedUrl }) },
      },
      personId: ownerId,
      isAdmin: false,
    } as never);
    const response = await GET_PHOTO(
      new NextRequest(`http://localhost/api/crm/leads/${leadId}/photo`),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(200);
    expect(signedUrl).toHaveBeenCalledTimes(1);
  });
});
