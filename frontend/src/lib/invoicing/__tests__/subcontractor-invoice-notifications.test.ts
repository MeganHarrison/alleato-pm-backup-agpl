import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { notifyStatusChange } from "@/services/notificationService";
import { notifySubcontractorOfInvoiceDecision } from "../subcontractor-invoice-notifications";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/services/notificationService", () => ({
  notifyStatusChange: jest.fn(),
}));

const createServiceClientMock = createServiceClient as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;
const notifyStatusChangeMock = notifyStatusChange as jest.Mock;

type MockQuery = Record<string, unknown>;

function createQuery(result: unknown): MockQuery {
  const query: MockQuery = {};
  const self = query;
  for (const method of ["select", "eq", "in"]) {
    query[method] = jest.fn(() => self);
  }
  query.maybeSingle = jest.fn(async () => result);
  query.single = jest.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return self;
}

/** Build a supabase mock whose `.from(table)` dequeues per-table results in call order. */
function makeSupabase(tables: Record<string, unknown[]>) {
  const queues: Record<string, unknown[]> = {};
  for (const key of Object.keys(tables)) queues[key] = [...tables[key]];
  const from = jest.fn((table: string) => {
    const queue = queues[table];
    const result = queue && queue.length > 0 ? queue.shift() : { data: null };
    return createQuery(result);
  });
  return { from } as unknown as ReturnType<typeof createServiceClient>;
}

const INVOICE_ROW = {
  data: {
    id: 99,
    invoice_number: "APP-02",
    subcontract_id: "sub-1",
    purchase_order_id: null,
  },
};
const SUBCONTRACT_WITH_CONTACT = { data: { invoice_contact_ids: ["person-1"] } };
const PEOPLE = {
  data: [{ id: "person-1", first_name: "Sam", last_name: "Sub", email: "sam@sub.com" }],
};
const PROJECT = { data: { name: "Union Collective" } };
const LINE_ITEMS = {
  data: [
    {
      work_completed_period: 1000,
      materials_stored: 0,
      retainage_amount: 100,
      materials_retainage_amount: 0,
      work_retainage_released: 0,
      materials_retainage_released: 0,
    },
  ],
};
const AUTH_LINKS = { data: [{ auth_user_id: "auth-1" }] };

describe("notifySubcontractorOfInvoiceDecision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendEmailMock.mockResolvedValue({ id: "email-1", error: null });
    notifyStatusChangeMock.mockResolvedValue(undefined);
  });

  it("emails the invoice contact on approval and signals an approved status change", async () => {
    createServiceClientMock.mockReturnValue(
      makeSupabase({
        subcontractor_invoices: [INVOICE_ROW],
        subcontracts: [SUBCONTRACT_WITH_CONTACT],
        people: [PEOPLE],
        projects: [PROJECT],
        subcontractor_invoice_line_items: [LINE_ITEMS],
        users_auth: [AUTH_LINKS],
      }),
    );

    await notifySubcontractorOfInvoiceDecision({
      projectId: 67,
      invoiceId: 99,
      decision: "approved",
      notes: null,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.template).toBe("invoice-approved");
    expect(arg.to).toBe("sam@sub.com");
    expect(arg.idempotencyKey).toBe("invoice-approved/99/approved/sam@sub.com");
    expect(arg.entity).toEqual({ type: "subcontractor_invoice", id: 99 });

    expect(notifyStatusChangeMock).toHaveBeenCalledWith(
      ["auth-1"],
      expect.objectContaining({
        entityType: "subcontractor_invoice",
        entityId: "99",
        to: "approved",
      }),
    );
  });

  it("uses the rejection template and revise status when returning for revision", async () => {
    createServiceClientMock.mockReturnValue(
      makeSupabase({
        subcontractor_invoices: [INVOICE_ROW],
        subcontracts: [SUBCONTRACT_WITH_CONTACT],
        people: [PEOPLE],
        projects: [PROJECT],
        users_auth: [AUTH_LINKS],
      }),
    );

    await notifySubcontractorOfInvoiceDecision({
      projectId: 67,
      invoiceId: 99,
      decision: "revise",
      notes: "Fix line 3",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.template).toBe("invoice-rejected");
    expect(arg.idempotencyKey).toBe("invoice-rejected/99/sam@sub.com");

    expect(notifyStatusChangeMock).toHaveBeenCalledWith(
      ["auth-1"],
      expect.objectContaining({ to: "revise_and_resubmit" }),
    );
  });

  it("sends nothing when the commitment has no invoice contacts", async () => {
    createServiceClientMock.mockReturnValue(
      makeSupabase({
        subcontractor_invoices: [INVOICE_ROW],
        subcontracts: [{ data: { invoice_contact_ids: [] } }],
      }),
    );

    await notifySubcontractorOfInvoiceDecision({
      projectId: 67,
      invoiceId: 99,
      decision: "approved",
      notes: null,
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(notifyStatusChangeMock).not.toHaveBeenCalled();
  });
});
