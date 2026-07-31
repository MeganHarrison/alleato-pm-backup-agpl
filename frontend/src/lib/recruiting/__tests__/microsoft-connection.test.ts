import {
  buildMicrosoftAuthorizeUrl,
  completeMicrosoftOAuth,
  createMicrosoftOAuthState,
  decryptMicrosoftToken,
  encryptMicrosoftToken,
  getValidMicrosoftAccessToken,
  recruitingAppOrigin,
  scopesForCapability,
  verifyMicrosoftOAuthState,
} from "@/lib/recruiting/microsoft-connection";

jest.mock("server-only", () => ({}));

const PERSON_ID = "ee9a8fb5-3cf6-48db-86a2-b09c07152fef";
const TENANT_ID = "a78c72c4-b592-4d0c-a9cb-4c219ecb72fd";

describe("recruiting Microsoft connection", () => {
  beforeEach(() => {
    process.env.RECRUITING_MICROSOFT_TOKEN_ENCRYPTION_KEY = Buffer.alloc(
      32,
      7,
    ).toString("base64");
    process.env.MICROSOFT_TENANT_ID = TENANT_ID;
    process.env.MICROSOFT_CLIENT_ID = "recruiting-client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "recruiting-client-secret";
    process.env.RECRUITING_MICROSOFT_REDIRECT_URI =
      "https://projects.alleatogroup.com/api/recruiting/integrations/microsoft/callback";
  });

  it("requests only the delegated scopes needed by each capability", () => {
    expect(scopesForCapability("mail")).toContain("Mail.Send");
    expect(scopesForCapability("mail")).not.toContain("Calendars.ReadWrite");
    expect(scopesForCapability("calendar")).toContain("Calendars.ReadWrite");
    expect(scopesForCapability("calendar")).not.toContain("Mail.Send");
    expect(scopesForCapability("mail")).not.toEqual(
      expect.arrayContaining(["openid", "profile", "email"]),
    );
  });

  it("can derive an error redirect origin without OAuth credentials", () => {
    delete process.env.MICROSOFT_TENANT_ID;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.RECRUITING_MICROSOFT_REDIRECT_URI;
    delete process.env.APP_BASE_URL;
    delete process.env.NEXTAUTH_URL;

    expect(recruitingAppOrigin("https://projects.alleatogroup.com")).toBe(
      "https://projects.alleatogroup.com",
    );
  });

  it("signs PKCE state and rejects tampering or a different person", () => {
    const generated = createMicrosoftOAuthState({
      capability: "calendar",
      personId: PERSON_ID,
      now: 1_000,
    });

    expect(
      verifyMicrosoftOAuthState(
        generated.cookieValue,
        generated.payload.state,
        PERSON_ID,
        2_000,
      ),
    ).toMatchObject({ capability: "calendar", personId: PERSON_ID });
    expect(() =>
      verifyMicrosoftOAuthState(
        `${generated.cookieValue}x`,
        generated.payload.state,
        PERSON_ID,
        2_000,
      ),
    ).toThrow(/state is invalid/i);
    expect(() =>
      verifyMicrosoftOAuthState(
        generated.cookieValue,
        generated.payload.state,
        "3019bd67-4068-4b74-acb6-d3166bb070df",
        2_000,
      ),
    ).toThrow(/did not match/i);
  });

  it("encrypts Microsoft tokens with authenticated encryption", () => {
    const encrypted = encryptMicrosoftToken("refresh-token-value");
    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptMicrosoftToken(encrypted)).toBe("refresh-token-value");
    expect(() => decryptMicrosoftToken(`${encrypted}x`)).toThrow();
  });

  it("builds a tenant-specific authorization URL with PKCE", () => {
    const url = buildMicrosoftAuthorizeUrl({
      origin: "https://projects.alleatogroup.com",
      state: "state-value",
      codeChallenge: "challenge-value",
      capability: "mail",
    });
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(url.pathname).toContain(TENANT_ID);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("Mail.Send");
  });

  it("exchanges the code, verifies tenant membership, and encrypts returned tokens", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          scope: "User.Read Mail.Send",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "microsoft-user-id",
          displayName: "Jazmin Gaona",
          mail: "jgaona@alleatogroup.com",
          userPrincipalName: "jgaona@alleatogroup.com",
        }),
      });

    const connection = await completeMicrosoftOAuth({
      origin: "https://projects.alleatogroup.com",
      code: "authorization-code",
      verifier: "pkce-verifier",
      expectedEmail: "jgaona@alleatogroup.com",
      capability: "mail",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(connection).toMatchObject({
      tenantId: TENANT_ID,
      microsoftUserId: "microsoft-user-id",
      email: "jgaona@alleatogroup.com",
      scopes: ["User.Read", "Mail.Send"],
    });
    expect(decryptMicrosoftToken(connection.accessTokenCiphertext)).toBe(
      "access-token",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retains the requested capability scopes when code exchange omits scope", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "microsoft-user-id",
          displayName: "Jazmin Gaona",
          mail: "jgaona@alleatogroup.com",
          userPrincipalName: "jgaona@alleatogroup.com",
        }),
      });

    const connection = await completeMicrosoftOAuth({
      origin: "https://projects.alleatogroup.com",
      code: "authorization-code",
      verifier: "pkce-verifier",
      expectedEmail: "jgaona@alleatogroup.com",
      capability: "calendar",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(connection.scopes).toEqual(
      expect.arrayContaining([
        "offline_access",
        "User.Read",
        "Calendars.ReadWrite",
      ]),
    );
  });

  it("rotates an expired refresh token and persists the replacement", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          accessTokenCiphertext: encryptMicrosoftToken("expired-access"),
          refreshTokenCiphertext: encryptMicrosoftToken("current-refresh"),
          expiresAt: "2020-01-01T00:00:00.000Z",
          scopes: ["User.Read", "Mail.Send"],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
        scope: "User.Read Mail.Send",
      }),
    });

    await expect(
      getValidMicrosoftAccessToken({
        db: { rpc } as never,
        personId: PERSON_ID,
        requiredScope: "Mail.Send",
        origin: "https://projects.alleatogroup.com",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBe("new-access");
    expect(rpc).toHaveBeenLastCalledWith(
      "recruiting_admin_refresh_microsoft_connection_tokens",
      expect.objectContaining({
        p_person_id: PERSON_ID,
        p_granted_scopes: ["User.Read", "Mail.Send"],
      }),
    );
  });

  it("retains stored scopes when a refresh response omits scope", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          accessTokenCiphertext: encryptMicrosoftToken("expired-access"),
          refreshTokenCiphertext: encryptMicrosoftToken("current-refresh"),
          expiresAt: "2020-01-01T00:00:00.000Z",
          scopes: ["User.Read", "Calendars.ReadWrite"],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-calendar-access",
        refresh_token: "rotated-calendar-refresh",
        expires_in: 3600,
      }),
    });

    await expect(
      getValidMicrosoftAccessToken({
        db: { rpc } as never,
        personId: PERSON_ID,
        requiredScope: "Calendars.ReadWrite",
        origin: "https://projects.alleatogroup.com",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBe("new-calendar-access");
    expect(rpc).toHaveBeenLastCalledWith(
      "recruiting_admin_refresh_microsoft_connection_tokens",
      expect.objectContaining({
        p_granted_scopes: ["User.Read", "Calendars.ReadWrite"],
      }),
    );
  });
});
