import { NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { POST } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: jest.fn(),
}));

const createClientMock = createClient as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

type MockQuery = Record<
  string,
  jest.Mock | ((resolve: (value: unknown) => unknown) => Promise<unknown>)
>;

function createQuery(result: unknown, hooks?: { upsert?: jest.Mock; update?: jest.Mock; insert?: jest.Mock }) {
  const query: MockQuery = {};
  const self = query as MockQuery;
  for (const method of ["select", "eq", "ilike", "in"]) {
    query[method] = jest.fn(() => self);
  }
  query.single = jest.fn(async () => result);
  query.maybeSingle = jest.fn(async () => result);
  query.upsert = jest.fn((rows: unknown) => {
    hooks?.upsert?.(rows);
    return self;
  });
  query.update = jest.fn((rows: unknown) => {
    hooks?.update?.(rows);
    return self;
  });
  query.insert = jest.fn((rows: unknown) => {
    hooks?.insert?.(rows);
    return self;
  });
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return self;
}

describe("subcontractor invoice invite route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    sendEmailMock.mockResolvedValue({ id: "email-1", error: null });
  });

  it("grants subcontractor access, sends an invitation email, and marks invoice invited", async () => {
    const membershipUpsert = jest.fn();
    const invoiceUpdate = jest.fn();
    const auditInsert = jest.fn();

    const appQueues = new Map<string, MockQuery[]>([
      [
        "subcontractor_invoices",
        [
          createQuery({
            data: {
              id: 99,
              status: "not_invited",
              invoice_number: "APP-02",
              is_retainage_release: true,
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              project_id: 67,
              subcontract_id: "sub-1",
              purchase_order_id: null,
              subcontracts: {
                contract_number: "SC-001",
                title: "Concrete",
                invoice_contact_ids: ["person-1"],
                contract_company_id: "company-1",
              },
              purchase_orders: null,
            },
            error: null,
          }),
          createQuery(
            {
              data: { id: 99, status: "invited" },
              error: null,
            },
            { update: invoiceUpdate },
          ),
        ],
      ],
      ["projects", [createQuery({ data: { name: "Project 67", project_number: "P-67" }, error: null })]],
      ["people", [
        createQuery({ data: { first_name: "Pat", last_name: "Manager" }, error: null }),
        createQuery({
          data: [
            {
              id: "person-1",
              first_name: "Sam",
              last_name: "Sub",
              email: "sam@example.com",
            },
          ],
          error: null,
        }),
      ]],
      ["subcontractor_invoice_audit_log", [createQuery({ data: null, error: null }, { insert: auditInsert })]],
    ]);

    const serviceQueues = new Map<string, MockQuery[]>([
      ["permission_templates", [createQuery({ data: { id: "template-1" }, error: null })]],
      ["project_directory_memberships", [createQuery({ data: null, error: null }, { upsert: membershipUpsert })]],
      ["users_auth", [createQuery({ data: { auth_user_id: "auth-1" }, error: null })]],
      ["user_profiles", [createQuery({ data: null, error: null })]],
    ]);

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "pm-auth", email: "pm@example.com" } },
          error: null,
        })),
      },
      from: jest.fn((table: string) => {
        const queue = appQueues.get(table);
        if (!queue?.length) throw new Error(`Unexpected app table call: ${table}`);
        return queue.shift();
      }),
    });

    createServiceClientMock.mockReturnValue({
      auth: {
        admin: {
          generateLink: jest.fn(),
        },
      },
      from: jest.fn((table: string) => {
        const queue = serviceQueues.get(table);
        if (!queue?.length) throw new Error(`Unexpected service table call: ${table}`);
        return queue.shift();
      }),
    });

    const request = new NextRequest(
      "http://localhost/api/projects/67/invoicing/subcontractor/invoices/99/invite",
      { method: "POST" },
    );

    const response = await POST(request, {
      params: { projectId: "67", invoiceId: "99" },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toContain("Invoice invitation sent");
    expect(membershipUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        person_id: "person-1",
        project_id: 67,
        user_type: "subcontractor",
        invite_status: "invited",
        permission_template_id: "template-1",
      }),
    ]);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "subcontractor-invoice-invitation",
        to: "sam@example.com",
        subject: "Submit retainage release invoice APP-02",
        entity: { type: "subcontractor_invoice", id: 99 },
      }),
    );
    expect(invoiceUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "invited" }));
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_id: 99,
        event_type: "invoice.invited",
      }),
    );
  });
});
