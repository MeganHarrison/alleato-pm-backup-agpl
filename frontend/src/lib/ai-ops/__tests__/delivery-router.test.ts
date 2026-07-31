import {
  createDeliveryRouter,
  deliveryAttemptFromRouteResult,
  ledgerChannelForDeliveryPlatform,
  type DeliveryAdapter,
  type DeliveryPlatformEntry,
} from "../delivery-router";

const fixedNow = () => new Date("2026-06-19T12:00:00.000Z");
const payload = {
  summary: "Daily brief payload",
  artifactId: "11111111-1111-4111-8111-111111111111",
  contentType: "application/vnd.microsoft.teams.card+json",
};

function sentAdapter(): DeliveryAdapter {
  return {
    async deliver() {
      return {
        ok: true,
        status: "sent",
        providerMessageId: "provider-1",
        metadata: { provider: "test" },
      };
    },
  };
}

describe("delivery router", () => {
  it("routes successful Teams delivery and converts it to an AI Ops attempt", async () => {
    const router = createDeliveryRouter({
      adapters: { teams: sentAdapter() },
      now: fixedNow,
    });

    const routed = await router.route({
      payload,
      targets: [
        {
          platform: "Teams",
          recipientId: "user-1",
          recipientAddress: "29:user",
          displayName: "Megan",
          metadata: { surface: "test" },
        },
      ],
    });

    expect(routed).toMatchObject({
      ok: true,
      status: "succeeded",
      sentCount: 1,
      failedCount: 0,
    });

    const attempt = deliveryAttemptFromRouteResult({
      runId: "22222222-2222-4222-8222-222222222222",
      payload,
      result: routed.results[0],
    });

    expect(attempt).toMatchObject({
      runId: "22222222-2222-4222-8222-222222222222",
      artifactId: payload.artifactId,
      channel: "teams",
      recipientId: "user-1",
      recipientAddress: "29:user",
      status: "sent",
      providerMessageId: "provider-1",
      attemptedAt: "2026-06-19T12:00:00.000Z",
      metadata: {
        routerVersion: "delivery-router.v1",
        platform: "teams",
        displayName: "Megan",
      },
    });
  });

  it("supports dry-run delivery results without marking them sent", async () => {
    const router = createDeliveryRouter({
      adapters: {
        email: {
          async deliver() {
            return { ok: true, status: "dry_run", metadata: { preview: true } };
          },
        },
      },
      now: fixedNow,
    });

    const routed = await router.route({
      payload,
      targets: [{ platform: "email", recipientAddress: "megan@example.com", dryRun: true }],
    });

    expect(routed).toMatchObject({
      ok: true,
      status: "succeeded",
      sentCount: 0,
    });
    expect(routed.results[0]).toMatchObject({
      ok: true,
      status: "dry_run",
      ledgerChannel: "email",
    });
  });

  it("fails loudly for disabled platforms and missing adapters", async () => {
    const router = createDeliveryRouter({
      entries: [
        {
          id: "teams",
          label: "Teams",
          channel: "teams",
          enabled: false,
          supportsDryRun: true,
          supportsLedgerAttempt: true,
          sourceUsage: "ALLEATO_NATIVE",
          notes: "disabled test",
        },
        {
          id: "email",
          label: "Email",
          channel: "email",
          enabled: true,
          supportsDryRun: true,
          supportsLedgerAttempt: true,
          sourceUsage: "ALLEATO_NATIVE",
          notes: "missing adapter test",
        },
      ],
      now: fixedNow,
    });

    const routed = await router.route({
      payload,
      targets: [{ platform: "teams" }, { platform: "email" }],
    });

    expect(routed).toMatchObject({
      ok: false,
      status: "failed",
      blockedCount: 1,
      disabledCount: 1,
    });
    expect(routed.results[0]).toMatchObject({
      status: "disabled",
      failureCode: "DELIVERY_PLATFORM_DISABLED",
    });
    expect(routed.results[1]).toMatchObject({
      status: "blocked",
      failureCode: "DELIVERY_ADAPTER_MISSING",
    });
  });

  it("captures thrown adapter errors as retryable failed results", async () => {
    const router = createDeliveryRouter({
      adapters: {
        teams: {
          async deliver() {
            throw new Error("provider unavailable");
          },
        },
      },
      now: fixedNow,
    });

    const routed = await router.route({
      payload,
      targets: [{ platform: "teams" }],
    });

    expect(routed).toMatchObject({
      ok: false,
      status: "failed",
      failedCount: 1,
    });
    expect(routed.results[0]).toMatchObject({
      ok: false,
      status: "failed",
      failureCode: "DELIVERY_ADAPTER_THROWN",
      failureMessage: "provider unavailable",
      retryable: true,
    });
  });

  it("blocks unknown platforms without using an implicit fallback", async () => {
    const router = createDeliveryRouter({ now: fixedNow });

    const routed = await router.route({
      payload,
      targets: [{ platform: "fax" }],
    });

    expect(routed.results[0]).toMatchObject({
      ok: false,
      platform: "fax",
      status: "blocked",
      failureCode: "UNSUPPORTED_DELIVERY_PLATFORM",
      ledgerChannel: null,
    });
  });

  it("keeps digest as a platform entry without forcing ledger conversion", async () => {
    const router = createDeliveryRouter({
      adapters: { digest: sentAdapter() },
      now: fixedNow,
    });

    const routed = await router.route({
      payload,
      targets: [{ platform: "digest" }],
    });

    expect(routed).toMatchObject({ ok: true, status: "succeeded" });
    expect(routed.results[0]).toMatchObject({
      platform: "digest",
      status: "sent",
      ledgerChannel: null,
    });
    expect(() =>
      deliveryAttemptFromRouteResult({
        runId: "22222222-2222-4222-8222-222222222222",
        payload,
        result: routed.results[0],
      }),
    ).toThrow(/cannot be recorded/);
  });

  it("exposes ledger channel support for existing workflow policy checks", () => {
    expect(ledgerChannelForDeliveryPlatform("teams")).toBe("teams");
    expect(ledgerChannelForDeliveryPlatform("email")).toBe("email");
    expect(ledgerChannelForDeliveryPlatform("digest")).toBeNull();
    expect(ledgerChannelForDeliveryPlatform("unknown")).toBeNull();
  });

  it("blocks dry runs for entries that do not support them", async () => {
    const entries: DeliveryPlatformEntry[] = [
      {
        id: "email",
        label: "Email",
        channel: "email",
        enabled: true,
        supportsDryRun: false,
        supportsLedgerAttempt: true,
        sourceUsage: "ALLEATO_NATIVE",
        notes: "dry-run unsupported test",
      },
    ];
    const router = createDeliveryRouter({
      entries,
      adapters: { email: sentAdapter() },
      now: fixedNow,
    });

    const routed = await router.route({
      payload,
      targets: [{ platform: "email", dryRun: true }],
    });

    expect(routed.results[0]).toMatchObject({
      status: "blocked",
      failureCode: "DELIVERY_DRY_RUN_UNSUPPORTED",
    });
  });
});
