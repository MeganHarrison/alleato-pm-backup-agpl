/** @jest-environment jsdom */

/**
 * Guardrail: a failed Supabase Management API request must NEVER render as an
 * empty state.
 *
 * 2026-07-30 incident: `SUPABASE_MANAGEMENT_API_TOKEN` belonged to an account
 * without access to the PM App / AI Database project refs, so
 * `/api/supabase-proxy/v1/projects/{ref}/database/query` answered 403 with
 * "Your account does not have the necessary privileges to access this
 * endpoint". /db-console rendered "No database tables — Create tables to store
 * and organize your data." on a database with hundreds of tables, because the
 * panel's empty-state branch fired on `!tables`, which is also true when the
 * request failed.
 *
 * Two failure shapes are covered, because openapi-fetch reports them
 * differently (verified against openapi-fetch@0.15 `src/index.js`):
 *   1. non-2xx WITH a body   -> `{ error: <parsed body>, response }`
 *   2. non-2xx with NO body  -> `{ error: undefined, response }` (204 / HEAD /
 *      `Content-Length: 0`) — the dangerous one: keying on `error` alone
 *      resolves to `data: undefined` and never throws at all.
 *
 * The openapi-fetch `client` is mocked (jsdom has no fetch/Request/Response);
 * everything below it — `unwrapManagementApiResult`, the react-query hook, and
 * the real panel — is exercised for real.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { DatabaseManager } from "@/components/platform-kit/components/supabase-manager/database";
import { StorageManager } from "@/components/platform-kit/components/supabase-manager/storage";
import { SheetNavigationProvider } from "@/components/platform-kit/contexts/SheetNavigationContext";
import { runQuery } from "@/components/platform-kit/hooks/use-run-query";
import {
  client,
  ManagementApiError,
} from "@/components/platform-kit/lib/management-api";

jest.mock("@/components/platform-kit/lib/management-api", () => {
  const actual = jest.requireActual("@/components/platform-kit/lib/management-api");
  return {
    ...actual,
    client: {
      GET: jest.fn(),
      POST: jest.fn(),
      PATCH: jest.fn(),
      DELETE: jest.fn(),
    },
  };
});

const PROJECT_REF = "lgveqfnpkxvzbnnwuled";
const FORBIDDEN_MESSAGE =
  "Your account does not have the necessary privileges to access this endpoint";

/** openapi-fetch shape for a non-2xx that carried a JSON error body. */
const failureWithBody = (status: number, body: unknown) => ({
  data: undefined,
  error: body,
  response: { ok: false, status, statusText: "Forbidden" },
});

/** openapi-fetch shape for a non-2xx with an empty body — `error` is undefined. */
const failureWithoutBody = (status: number) => ({
  data: undefined,
  error: undefined,
  response: { ok: false, status, statusText: "Forbidden" },
});

const success = <T,>(data: T) => ({
  data,
  error: undefined,
  response: { ok: true, status: 200, statusText: "OK" },
});

function renderPanel(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SheetNavigationProvider>{children}</SheetNavigationProvider>
    </QueryClientProvider>,
  );
}

describe("Management API failures surface as errors, not empty states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws a ManagementApiError carrying the upstream status and message", async () => {
    (client.POST as jest.Mock).mockResolvedValue(
      failureWithBody(403, { message: FORBIDDEN_MESSAGE }),
    );

    const thrown = await runQuery({
      projectRef: PROJECT_REF,
      query: "select 1",
      readOnly: true,
    }).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(ManagementApiError);
    expect(thrown).toMatchObject({ status: 403 });
    expect((thrown as ManagementApiError).message).toContain(FORBIDDEN_MESSAGE);
    expect((thrown as ManagementApiError).message).toContain("403");
  });

  it("throws even when the failed response has no body", async () => {
    (client.POST as jest.Mock).mockResolvedValue(failureWithoutBody(403));

    const thrown = await runQuery({
      projectRef: PROJECT_REF,
      query: "select 1",
      readOnly: true,
    }).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(ManagementApiError);
    expect(thrown).toMatchObject({ status: 403 });
  });

  it("renders the upstream 403 detail in the Database panel", async () => {
    (client.POST as jest.Mock).mockResolvedValue(
      failureWithBody(403, { message: FORBIDDEN_MESSAGE }),
    );

    renderPanel(<DatabaseManager projectRef={PROJECT_REF} />);

    expect(await screen.findByText(/couldn't load tables/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FORBIDDEN_MESSAGE, "i"))).toBeInTheDocument();
    expect(screen.getByText(/403/)).toBeInTheDocument();
  });

  it("does NOT render the empty state when the tables request fails", async () => {
    (client.POST as jest.Mock).mockResolvedValue(
      failureWithBody(403, { message: FORBIDDEN_MESSAGE }),
    );

    renderPanel(<DatabaseManager projectRef={PROJECT_REF} />);

    await screen.findByText(/couldn't load tables/i);
    expect(screen.queryByText(/no database tables/i)).not.toBeInTheDocument();
  });

  it("still renders the empty state when the query genuinely returns zero tables", async () => {
    (client.POST as jest.Mock).mockResolvedValue(success([]));

    renderPanel(<DatabaseManager projectRef={PROJECT_REF} />);

    expect(await screen.findByText(/no database tables/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/couldn't load tables/i)).not.toBeInTheDocument();
    });
  });

  it("applies the same rule to the Storage panel", async () => {
    (client.GET as jest.Mock).mockResolvedValue(
      failureWithBody(403, { message: FORBIDDEN_MESSAGE }),
    );

    renderPanel(<StorageManager projectRef={PROJECT_REF} />);

    expect(await screen.findByText(/couldn't load storage buckets/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FORBIDDEN_MESSAGE, "i"))).toBeInTheDocument();
    expect(screen.queryByText(/no storage buckets/i)).not.toBeInTheDocument();
  });

  it("names the token as the likely cause on 401/403 so the next reader is not misled", () => {
    const error = new ManagementApiError(403, "Forbidden", {
      message: FORBIDDEN_MESSAGE,
    });

    expect(error.message).toContain("SUPABASE_MANAGEMENT_API_TOKEN");
  });
});
