import {
  allowedProductionStageTransitions,
  recruitingApplicationIsVisible,
  requisitionAcceptsActiveWorkflow,
  recruitingCommandSchema,
  recruitingFeatureAvailabilitySchema,
  testApplicationAllowsStage,
} from "@/lib/recruiting/production-contracts";

describe("production recruiting contracts", () => {
  it("rejects automatic employment-decision commands", () => {
    expect(() =>
      recruitingCommandSchema.parse({
        command: "application.auto_reject",
        idempotencyKey: "1bb3efab-89e2-41dd-99dd-2230c2e604d5",
        requestHash:
          "05d6b9551f073d0cc08c5d25928704b7da163c671b880018aef9eaf62fe30a0a",
        applicationId: "ff6f49e8-41a2-487d-a7bb-5eb8f79371de",
      }),
    ).toThrow();
  });

  it("accepts a human stage transition with concurrency and idempotency", () => {
    expect(
      recruitingCommandSchema.parse({
        command: "application.transition",
        idempotencyKey: "1bb3efab-89e2-41dd-99dd-2230c2e604d5",
        requestHash:
          "05d6b9551f073d0cc08c5d25928704b7da163c671b880018aef9eaf62fe30a0a",
        applicationId: "ff6f49e8-41a2-487d-a7bb-5eb8f79371de",
        nextStage: "review",
        expectedRowVersion: 2,
        reason: "Resume reviewed by the recruiting coordinator.",
      }),
    ).toMatchObject({
      command: "application.transition",
      nextStage: "review",
      expectedRowVersion: 2,
    });
  });

  it("accepts concurrency-checked assignment from the resume inbox", () => {
    expect(
      recruitingCommandSchema.parse({
        command: "resume.assign",
        idempotencyKey: "1bb3efab-89e2-41dd-99dd-2230c2e604d5",
        requestHash:
          "05d6b9551f073d0cc08c5d25928704b7da163c671b880018aef9eaf62fe30a0a",
        candidateId: "ff6f49e8-41a2-487d-a7bb-5eb8f79371de",
        requisitionId: "2abed750-7bfa-45a0-a64f-fe28aeb95f77",
        expectedRowVersion: 1,
      }),
    ).toMatchObject({
      command: "resume.assign",
      expectedRowVersion: 1,
    });
  });

  it("accepts explicit requisition close and cancel commands", () => {
    const base = {
      idempotencyKey: "1bb3efab-89e2-41dd-99dd-2230c2e604d5",
      requestHash:
        "05d6b9551f073d0cc08c5d25928704b7da163c671b880018aef9eaf62fe30a0a",
      requisitionId: "ff6f49e8-41a2-487d-a7bb-5eb8f79371de",
      expectedRowVersion: 2,
      reason: "Hiring plan changed by the recruiting coordinator.",
    };

    expect(
      recruitingCommandSchema.parse({
        ...base,
        command: "requisition.lifecycle",
        nextStatus: "closed",
      }),
    ).toMatchObject({
      command: "requisition.lifecycle",
      nextStatus: "closed",
    });
    expect(
      recruitingCommandSchema.parse({
        ...base,
        command: "requisition.lifecycle",
        nextStatus: "canceled",
      }),
    ).toMatchObject({
      command: "requisition.lifecycle",
      nextStatus: "canceled",
    });
  });

  it("allows only concurrency-checked draft deletion commands", () => {
    expect(
      recruitingCommandSchema.parse({
        command: "requisition.delete",
        idempotencyKey: "1bb3efab-89e2-41dd-99dd-2230c2e604d5",
        requestHash:
          "05d6b9551f073d0cc08c5d25928704b7da163c671b880018aef9eaf62fe30a0a",
        requisitionId: "ff6f49e8-41a2-487d-a7bb-5eb8f79371de",
        expectedRowVersion: 2,
      }),
    ).toMatchObject({
      command: "requisition.delete",
      expectedRowVersion: 2,
    });

    expect(() =>
      recruitingCommandSchema.parse({
        command: "requisition.lifecycle",
        idempotencyKey: "1bb3efab-89e2-41dd-99dd-2230c2e604d5",
        requestHash:
          "05d6b9551f073d0cc08c5d25928704b7da163c671b880018aef9eaf62fe30a0a",
        requisitionId: "ff6f49e8-41a2-487d-a7bb-5eb8f79371de",
        expectedRowVersion: 2,
        nextStatus: "open",
        reason: null,
      }),
    ).toThrow();
  });

  it("makes provider and AI availability explicit", () => {
    expect(
      recruitingFeatureAvailabilitySchema.parse({
        sharedData: true,
        testMode: true,
        publicIntake: false,
        resumeUpload: false,
        resumeExtraction: false,
        outlookMail: false,
        outlookCalendar: false,
        sms: false,
        eSignature: false,
        automation: false,
        aiAssistance: false,
        retentionExecution: false,
        unavailableReasons: {
          aiAssistance: "Employment AI is disabled by configuration.",
        },
      }).testMode,
    ).toBe(true);
  });

  it("exposes only auditable stage transitions", () => {
    expect(allowedProductionStageTransitions("new")).toEqual(["review"]);
    expect(allowedProductionStageTransitions("offer")).toEqual([
      "interview",
      "hired",
    ]);
    expect(allowedProductionStageTransitions("hired")).toEqual([]);
  });

  it("keeps terminal requisitions out of active recruiting workflows", () => {
    expect(requisitionAcceptsActiveWorkflow("open")).toBe(true);
    expect(requisitionAcceptsActiveWorkflow("paused")).toBe(true);
    expect(requisitionAcceptsActiveWorkflow("filled")).toBe(false);
    expect(requisitionAcceptsActiveWorkflow("closed")).toBe(false);
    expect(requisitionAcceptsActiveWorkflow("canceled")).toBe(false);
  });

  it("shows synthetic UAT applications only while recruiter test mode is active", () => {
    expect(
      recruitingApplicationIsVisible({
        testMode: true,
        isTestApplication: true,
      }),
    ).toBe(true);
    expect(
      recruitingApplicationIsVisible({
        testMode: false,
        isTestApplication: true,
      }),
    ).toBe(false);
    expect(
      recruitingApplicationIsVisible({
        testMode: false,
        isTestApplication: false,
      }),
    ).toBe(true);
  });

  it("keeps test applications out of offer, hired, and closed stages", () => {
    expect(testApplicationAllowsStage("review")).toBe(true);
    expect(testApplicationAllowsStage("interview")).toBe(true);
    expect(testApplicationAllowsStage("offer")).toBe(false);
    expect(testApplicationAllowsStage("hired")).toBe(false);
    expect(testApplicationAllowsStage("closed")).toBe(false);
  });
});
