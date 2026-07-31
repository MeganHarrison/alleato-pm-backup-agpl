import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { createRfiResponseToken } from "./response-tokens";
import { recordRfiOpenedAiNotificationDecisions } from "./rfi-ai-notifications";
import { notifyRfiOpened } from "./rfi-notify";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/email/client", () => ({
  APP_BASE_URL: "https://app.example.com",
}));

jest.mock("@/emails/rfi/RFINotification", () => jest.fn(() => null));
jest.mock("@/emails/rfi/RFIClosedNotification", () => jest.fn(() => null));
jest.mock("@/emails/rfi/RFIUpdateNotification", () => jest.fn(() => null));
jest.mock("@/emails/rfi/RFIResponseReceivedNotification", () => jest.fn(() => null));

jest.mock("./response-tokens", () => ({
  createRfiResponseToken: jest.fn(),
}));

jest.mock("./rfi-ai-notifications", () => ({
  recordRfiOpenedAiNotificationDecisions: jest.fn(),
}));

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockCreateRfiResponseToken = createRfiResponseToken as jest.MockedFunction<
  typeof createRfiResponseToken
>;
const mockRecordRfiOpenedAiNotificationDecisions =
  recordRfiOpenedAiNotificationDecisions as jest.MockedFunction<
    typeof recordRfiOpenedAiNotificationDecisions
  >;

const peopleRows = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    first_name: "Assigned",
    last_name: "User",
    email: "assigned@example.com",
    auth_user_id: "assigned-user",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    first_name: "Manager",
    last_name: "User",
    email: "manager@example.com",
    auth_user_id: null,
  },
  {
    id: "ambiguous-one",
    first_name: "Shared",
    last_name: "One",
    email: "shared@example.com",
    auth_user_id: "shared-user-1",
  },
  {
    id: "ambiguous-two",
    first_name: "Shared",
    last_name: "Two",
    email: "shared@example.com",
    auth_user_id: "shared-user-2",
  },
];

function createSupabaseMock() {
  return {
    from: jest.fn((table: string) => {
      if (table === "rfis") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: "rfi-1",
              number: 14,
              subject: "Storefront jamb detail",
              question: "Please clarify.",
              due_date: "2026-07-02",
              assignees: ["11111111-1111-4111-8111-111111111111"],
              distribution_list: ["shared@example.com"],
              rfi_manager: "22222222-2222-4222-8222-222222222222",
              ball_in_court: "Assigned User",
            },
            error: null,
          }),
        };
      }

      if (table === "people") {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn((column: string, values: string[]) => {
            const valueSet = new Set(values);
            return Promise.resolve({
              data: peopleRows.filter((person) =>
                column === "id"
                  ? valueSet.has(person.id)
                  : valueSet.has(person.email),
              ),
              error: null,
            });
          }),
        };
      }

      if (table === "projects") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { name: "Goodwill Noblesville" },
            error: null,
          }),
        };
      }

      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { full_name: "Sender User", email: "sender@example.com" },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("notifyRfiOpened AI notification decisions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateServiceClient.mockReturnValue(createSupabaseMock() as never);
    mockSendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null } as never);
    mockCreateRfiResponseToken.mockResolvedValue("response-token");
    mockRecordRfiOpenedAiNotificationDecisions.mockResolvedValue({
      attempted: 1,
      recorded: 1,
      skippedDuplicate: 0,
      skippedUnmapped: 1,
      skippedAmbiguous: 1,
      failed: [],
    });
  });

  it("passes only schema-backed app-user mappings to the AI decision producer", async () => {
    const result = await notifyRfiOpened({
      projectId: 25125,
      rfiId: "rfi-1",
      actorUserId: "sender-user",
    });

    expect(result).toMatchObject({
      sent: 3,
      failed: [],
      aiDecisions: {
        attempted: 1,
        recorded: 1,
        skippedUnmapped: 1,
        skippedAmbiguous: 1,
      },
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(mockRecordRfiOpenedAiNotificationDecisions).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 25125,
        projectName: "Goodwill Noblesville",
        rfiId: "rfi-1",
        rfiNumber: 14,
        rfiSubject: "Storefront jamb detail",
        actorUserId: "sender-user",
        recipients: expect.arrayContaining([
          expect.objectContaining({
            email: "assigned@example.com",
            userId: "assigned-user",
            userMappingStatus: "mapped",
          }),
          expect.objectContaining({
            email: "manager@example.com",
            userMappingStatus: "unmapped",
          }),
          expect.objectContaining({
            email: "shared@example.com",
            userMappingStatus: "ambiguous",
          }),
        ]),
      }),
    );
  });
});
