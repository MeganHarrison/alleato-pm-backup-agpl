import { InviteService } from "../inviteService";
import type { SupabaseClient } from "@supabase/supabase-js";

const createMockSupabase = () => {
  return {
    from: jest.fn(),
    auth: {
      admin: {
        listUsers: jest.fn(),
        createUser: jest.fn(),
      },
    },
  } as unknown as SupabaseClient;
};

const createSelectChain = (response: unknown) => {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  return chain;
};

const createUpdateChain = (response = { error: null }) => {
  const chain: Record<string, jest.Mock> = {
    eq: jest
      .fn()
      .mockImplementation(() => chain),
    then: jest.fn().mockImplementation((resolve) => resolve(response)),
  };
  return chain;
};

describe("InviteService", () => {
  let service: InviteService;
  let mockSupabase: SupabaseClient;
  const emailService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";
    (mockSupabase.from as jest.Mock).mockReset();
    service = new InviteService(mockSupabase, emailService);
    jest.clearAllMocks();
  });

  describe("sendInvite", () => {
    it("returns error when the person query fails", async () => {
      const response = { data: null, error: new Error("not found") };
      (mockSupabase.from as jest.Mock).mockReturnValue(
        createSelectChain(response),
      );

      const result = await service.sendInvite("1", "missing-person");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Person not found");
    });

    it("returns error for non-user person types", async () => {
      const person = {
        id: "person-1",
        person_type: "contact",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        project_directory_memberships: [],
      };
      const response = { data: person, error: null };
      (mockSupabase.from as jest.Mock).mockReturnValue(
        createSelectChain(response),
      );

      const result = await service.sendInvite("1", "person-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Only users can be invited");
    });

    it("sends an invite and emails the user", async () => {
      const membership = {
        id: "membership-1",
        project: { name: "Project Alpha" },
        invited_at: null,
      };
      const person = {
        id: "person-1",
        person_type: "user",
        email: "user@example.com",
        first_name: "User",
        last_name: "Test",
        project_directory_memberships: [membership],
      };
      const peopleResponse = { data: person, error: null };
      const peopleQuery = createSelectChain(peopleResponse);

      const updateChain = createUpdateChain();
      const updateMock = jest.fn().mockReturnValue(updateChain);

      (mockSupabase.from as jest.Mock).mockImplementation((table) => {
        if (table === "people") return peopleQuery;
        if (table === "project_directory_memberships") {
          return {
            update: updateMock,
          };
        }
        return {};
      });

      const result = await service.sendInvite("1", "person-1");

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.message).toContain("user@example.com");
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          invite_token: expect.any(String),
          invite_status: "invited",
        }),
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "user@example.com" }),
      );
    });
  });

  describe("resendInvite", () => {
    it("returns error when membership is missing", async () => {
      const response = { data: null, error: new Error("not found") };
      (mockSupabase.from as jest.Mock).mockReturnValue(
        createSelectChain(response),
      );

      const result = await service.resendInvite("1", "person-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Membership not found");
    });

    it("reuses valid token via sendInviteEmail", async () => {
      const futureDate = new Date(Date.now() + 100000).toISOString();
      const membership = {
        invite_token: "token-123",
        invite_expires_at: futureDate,
      };

      const membershipQuery = createSelectChain({ data: membership, error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue(membershipQuery);

      const sendInviteEmailSpy = jest
        .spyOn(service as any, "sendInviteEmail")
        .mockResolvedValue({
          success: true,
          token: membership.invite_token,
        });

      const result = await service.resendInvite("1", "person-1");

      expect(sendInviteEmailSpy).toHaveBeenCalledWith(
        "1",
        "person-1",
        membership.invite_token,
      );
      expect(result.success).toBe(true);

      sendInviteEmailSpy.mockRestore();
    });
  });

  describe("acceptInvite", () => {
    it("reports invalid tokens", async () => {
      const response = { data: null, error: new Error("invalid") };
      (mockSupabase.from as jest.Mock).mockReturnValue(
        createSelectChain(response),
      );

      const result = await service.acceptInvite("bad-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid invitation token");
    });
  });

  describe("checkInviteStatus", () => {
    it("returns not_invited when lookup fails", async () => {
      const response = { data: null, error: new Error("none") };
      (mockSupabase.from as jest.Mock).mockReturnValue(
        createSelectChain(response),
      );

      const result = await service.checkInviteStatus("1", "person-1");

      expect(result).toBe("not_invited");
    });

    it("detects expired invitations", async () => {
      const pastDate = new Date(Date.now() - 100000).toISOString();
      const response = {
        data: { invite_status: "invited", invite_expires_at: pastDate },
        error: null,
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(
        createSelectChain(response),
      );

      const result = await service.checkInviteStatus("1", "person-1");

      expect(result).toBe("expired");
    });
  });
});
