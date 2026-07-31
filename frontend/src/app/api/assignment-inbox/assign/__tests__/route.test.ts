import { NextRequest } from "next/server";

import { POST } from "../route";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { recordAttributionAssignmentFeedback } from "@/lib/ai/services/feedback-event-service";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createOutlookIntakeServiceClient: jest.fn(),
}));

jest.mock("@/lib/ai/services/feedback-event-service", () => ({
  recordAttributionAssignmentFeedback: jest.fn().mockResolvedValue(undefined),
  extractTitleKeywords: jest.fn(() => ["danville", "theatre"]),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;
const createOutlookIntakeServiceClientMock =
  createOutlookIntakeServiceClient as jest.Mock;
const recordFeedbackMock = recordAttributionAssignmentFeedback as jest.Mock;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/assignment-inbox/assign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  getUserMock.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
});

describe("assignment-inbox assign POST route", () => {
  it("assigns a document_metadata item and records accepted feedback when the suggestion matched", async () => {
    const docUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const docUpdate = jest.fn().mockReturnValue({ eq: docUpdateEq });

    const from = jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: { id: 42, name: "Danville Theatre" }, error: null }),
            }),
          }),
        };
      }
      if (table === "document_metadata") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: "meeting-1",
                  title: "Danville Theatre kickoff",
                  file_name: null,
                  type: "meeting",
                  category: null,
                  host_email: "pm@acme.com",
                  organizer_email: null,
                },
                error: null,
              }),
            }),
          }),
          update: docUpdate,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from });
    createOutlookIntakeServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makeRequest({
        sourceTable: "document_metadata",
        itemId: "meeting-1",
        projectId: 42,
        suggestedProjectId: 42,
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(docUpdate).toHaveBeenCalledWith({ project_id: 42, project: "Danville Theatre" });
    expect(docUpdateEq).toHaveBeenCalledWith("id", "meeting-1");
    expect(recordFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTable: "document_metadata",
        projectId: 42,
        contentType: "meeting",
        fromEmail: "pm@acme.com",
        matchedSuggestion: true,
      }),
    );
  });

  it("assigns an outlook_email_intake item with manual matching metadata and records corrected feedback", async () => {
    const emailUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const emailUpdate = jest.fn().mockReturnValue({ eq: emailUpdateEq });
    const projectEmailInsertSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: 501 }, error: null });
    const projectEmailInsertSelect = jest.fn().mockReturnValue({
      single: projectEmailInsertSingle,
    });
    const projectEmailInsert = jest.fn().mockReturnValue({
      select: projectEmailInsertSelect,
    });
    const documentUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const documentUpdate = jest.fn().mockReturnValue({ eq: documentUpdateEq });

    const from = jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: { id: 7, name: "Acme HQ" }, error: null }),
            }),
          }),
        };
      }
      if (table === "outlook_email_intake") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 99,
                    subject: "RFI response",
                    body: "Please route this to the right project.",
                    body_text: "Please route this to the right project.",
                    from_name: "GC Team",
                    from_email: "gc@builder.com",
                    to_list: ["pm@alleatogroup.com"],
                    cc_list: [],
                    status: "Received",
                    received_at: "2026-06-01T12:00:00Z",
                    has_attachments: false,
                    graph_message_id: "graph-99",
                    mailbox_user_id: "pm@alleatogroup.com",
                    conversation_id: "thread-1",
                    document_metadata_id: "doc-99",
                    project_email_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: emailUpdate,
        };
      }
      if (table === "project_emails") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
          insert: projectEmailInsert,
        };
      }
      if (table === "document_metadata") {
        return {
          update: documentUpdate,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from });
    createOutlookIntakeServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makeRequest({
        sourceTable: "outlook_email_intake",
        itemId: "99",
        projectId: 7,
        suggestedProjectId: null,
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(emailUpdate).toHaveBeenCalledWith({
      project_id: 7,
      project_email_id: 501,
      match_status: "matched",
      assignment_method: "manual",
      assignment_confidence: 1.0,
    });
    expect(emailUpdateEq).toHaveBeenCalledWith("id", 99);
    expect(projectEmailInsert).toHaveBeenCalledWith({
      project_id: 7,
      subject: "RFI response",
      body: "Please route this to the right project.",
      body_text: "Please route this to the right project.",
      from_name: "GC Team",
      from_email: "gc@builder.com",
      to_list: ["pm@alleatogroup.com"],
      cc_list: [],
      status: "Received",
      received_at: "2026-06-01T12:00:00Z",
      has_attachments: false,
      graph_message_id: "graph-99",
      mailbox_user_id: "pm@alleatogroup.com",
      conversation_id: "thread-1",
      deleted_at: null,
    });
    expect(documentUpdate).toHaveBeenCalledWith({
      project_id: 7,
      project: "Acme HQ",
    });
    expect(documentUpdateEq).toHaveBeenCalledWith("id", "doc-99");
    expect(recordFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTable: "outlook_email_intake",
        contentType: "email",
        matchedSuggestion: false,
      }),
    );
  });

  it("assigns a task without sending attribution-learning feedback", async () => {
    const taskUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const taskUpdate = jest.fn().mockReturnValue({ eq: taskUpdateEq });

    const from = jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: { id: 88, name: "Morrisville Yard" }, error: null }),
            }),
          }),
        };
      }
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: "task-1",
                  title: "Follow up with owner",
                  description: "Clarify closeout requirement.",
                },
                error: null,
              }),
            }),
          }),
          update: taskUpdate,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from });
    createOutlookIntakeServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makeRequest({
        sourceTable: "tasks",
        itemId: "task-1",
        projectId: 88,
        suggestedProjectId: null,
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(taskUpdate).toHaveBeenCalledWith({
      project_id: 88,
      project_ids: [88],
    });
    expect(taskUpdateEq).toHaveBeenCalledWith("id", "task-1");
    expect(recordFeedbackMock).not.toHaveBeenCalled();
  });

  it("rejects assignment to a non-existent project", async () => {
    const from = jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: null, error: { message: "not found" } }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from });
    createOutlookIntakeServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makeRequest({ sourceTable: "document_metadata", itemId: "x", projectId: 9999 }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(recordFeedbackMock).not.toHaveBeenCalled();
  });
});
